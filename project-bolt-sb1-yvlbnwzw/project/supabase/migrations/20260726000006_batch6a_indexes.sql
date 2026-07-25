-- Batch 6A: Compound indexes for hot query paths
-- Each index is backed by a concrete query. No speculative additions.

-- ============================================================
-- messages: compound (thread_id, is_deleted, created_at DESC)
-- Supersedes the combination of:
--   idx_messages_thread_id ON messages(thread_id)          [initial schema]
--   idx_messages_created_at ON messages(created_at DESC)   [initial schema]
-- Those single-column indexes remain and cover other access patterns.
--
-- Queries covered:
--   1. fetchMessages in app/messages/[threadId]/page.tsx:
--      WHERE thread_id = X AND is_deleted = false ORDER BY created_at DESC
--   2. LATERAL subquery in get_thread_list():
--      WHERE thread_id = tp.thread_id AND is_deleted = false
--      ORDER BY created_at DESC LIMIT 1
--
-- Without this index, Postgres uses idx_messages_thread_id, then filters
-- is_deleted in memory, then sorts. The compound index returns rows already
-- filtered and sorted — eliminating the in-memory sort step.
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_messages_thread_feed
  ON messages(thread_id, is_deleted, created_at DESC);

-- ============================================================
-- thread_participants: compound (thread_id, user_id)
-- Supersedes the combination of:
--   idx_thread_participants_thread_id ON thread_participants(thread_id)  [initial schema]
--   idx_thread_participants_user_id   ON thread_participants(user_id)    [initial schema]
-- Those single-column indexes remain and cover other access patterns.
--
-- Queries covered:
--   1. 20-second ping UPDATE in app/messages/[threadId]/page.tsx:
--      UPDATE thread_participants SET last_seen_at = now()
--      WHERE thread_id = X AND user_id = Y
--      → direct compound lookup instead of one-column scan + filter
--   2. JOIN in get_thread_list() (Batch 5C):
--      JOIN thread_participants op
--        ON op.thread_id = tp.thread_id AND op.user_id != auth.uid() AND op.deleted_at IS NULL
--   3. get_unread_count() RPC (Batch 6B):
--      FROM thread_participants WHERE user_id = auth.uid() AND deleted_at IS NULL
--      → that query uses existing idx_thread_participants_user_id (user_id is 2nd column here)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_thread_participants_lookup
  ON thread_participants(thread_id, user_id);
