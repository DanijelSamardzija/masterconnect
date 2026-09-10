-- ==========================================================================
-- F9: Booking Reminder System
--   1. Partial index for fast reminder window scan
--   2. send_booking_reminders() RPC — called by Vercel cron, service_role only
-- ==========================================================================
--
-- Design decisions:
--   • Only 'confirmed' bookings are reminded (not 'pending' — avoids confusion
--     about unconfirmed state; pending bookings already got booking_created notif)
--   • 24-hour window: starts_at BETWEEN now()+23h AND now()+25h
--     (2-hour band absorbs cron drift and late-night job queuing)
--   • FOR UPDATE SKIP LOCKED — concurrent cron calls skip in-flight rows,
--     preventing duplicate notifications under any scheduling condition
--   • CTE: SELECT lock → UPDATE reminder_sent_at → INSERT notification
--     All three steps in one atomic statement; notification is only inserted
--     if the UPDATE succeeded for that row.
--   • GRANT TO service_role ONLY — cron uses service_role key; authenticated
--     users cannot trigger mass reminder sends.
--
-- Acceptance criteria:
--   AC1: No eligible bookings → returns {ok:true, sent:0}
--   AC2: 1 confirmed booking in 24h window → sent:1, reminder_sent_at set,
--        1 notification row inserted for client
--   AC3: Immediate second call → sent:0 (reminder_sent_at already set)
--   AC4: 'pending' booking in window → NOT reminded (status filter)
--   AC5: 'confirmed' booking outside window → NOT reminded (time filter)
--   AC6: Concurrent calls → FOR UPDATE SKIP LOCKED prevents duplicate rows
--   AC7: Cron endpoint without CRON_SECRET → HTTP 401
--   AC8: Cron endpoint with valid CRON_SECRET → HTTP 200, RPC called
-- ==========================================================================

-- ── Index: fast scan for upcoming confirmed unreminded bookings ────────────
CREATE INDEX IF NOT EXISTS idx_bookings_reminder_window
  ON public.bookings(starts_at, reminder_sent_at)
  WHERE status = 'confirmed' AND reminder_sent_at IS NULL;

-- ==========================================================================
-- RPC: send_booking_reminders
-- ==========================================================================
-- Finds all confirmed bookings whose appointment starts in 23–25 hours and
-- for which no reminder has been sent yet. Sets reminder_sent_at and inserts
-- a booking_reminder notification for the client in one atomic CTE.
--
-- Returns JSONB: { "ok": true, "sent": N }
--   sent — number of reminders dispatched in this call
--
-- Called exclusively by Vercel cron via service_role client.
-- GRANT is TO service_role — NOT to authenticated or anon.
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.send_booking_reminders()
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sent INTEGER := 0;
BEGIN
  WITH
  -- Step 1: Acquire row locks, skipping any rows locked by concurrent calls.
  locked AS (
    SELECT b.id,
           b.client_id,
           b.business_id,
           b.service_name_snapshot,
           b.starts_at
    FROM   bookings b
    WHERE  b.status           = 'confirmed'
      AND  b.reminder_sent_at IS NULL
      AND  b.starts_at BETWEEN (now() + INTERVAL '23 hours')
                           AND (now() + INTERVAL '25 hours')
    FOR UPDATE SKIP LOCKED
  ),
  -- Step 2: Mark each locked booking as reminded.
  updated AS (
    UPDATE bookings
    SET    reminder_sent_at = now()
    WHERE  id IN (SELECT id FROM locked)
    RETURNING id
  ),
  -- Step 3: Insert a notification for each successfully updated booking.
  notifs AS (
    INSERT INTO notifications(user_id, type, action_type, title, body, meta)
    SELECT
      l.client_id,
      'booking',
      'booking_reminder',
      'Termin sutra ⏰',
      private_fmt_booking_dt(l.starts_at),
      jsonb_build_object(
        'booking_id',    l.id,
        'business_id',   l.business_id,
        'business_name', (SELECT name FROM profiles WHERE id = l.business_id LIMIT 1),
        'service_name',  l.service_name_snapshot,
        'starts_at',     l.starts_at
      )
    FROM   locked l
    INNER JOIN updated u ON u.id = l.id
    RETURNING 1
  )
  SELECT COUNT(*)::INT INTO v_sent FROM notifs;

  RETURN jsonb_build_object('ok', true, 'sent', v_sent);
END;
$$;

-- Cron-only: service_role has its own bypass; authenticated users cannot call this.
REVOKE ALL ON FUNCTION public.send_booking_reminders() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.send_booking_reminders() TO service_role;
