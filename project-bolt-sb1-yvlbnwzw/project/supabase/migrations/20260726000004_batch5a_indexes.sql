-- Batch 5A: Verified performance indexes
-- Each index is backed by a concrete query. No speculative additions.

-- ============================================================
-- posts: compound partial for promoted posts query
-- Query: app/api/posts/route.ts:161-171
--   .eq('is_promoted', true).eq('post_type', 'social_post').eq('status', 'published')
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_posts_published_promoted
  ON posts(is_promoted, post_type)
  WHERE status = 'published';

-- ============================================================
-- posts: city for exact equality filter in feed RPC
-- Query: get_feed_with_engagement_score → AND (p_city IS NULL OR p.city = p_city)
-- Note: does NOT help ILIKE search (leading wildcard) — only exact city filter
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_posts_city
  ON posts(lower(city));

-- ============================================================
-- notifications: compound (user_id, created_at DESC)
-- Replaces the single-column idx_notifications_user_id.
-- A compound index covers both the WHERE user_id = ? filter AND the ORDER BY created_at DESC
-- sort in a single index scan, eliminating the in-memory sort.
-- Query: notificationRepository.getAll → .eq('user_id').order('created_at', { ascending: false })
-- The leading column (user_id) still covers queries that filter only by user_id.
-- ============================================================
DROP INDEX IF EXISTS idx_notifications_user_id;
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC);

-- ============================================================
-- notifications: partial index for unread-only queries
-- Query: notificationRepository.getUnreadCount → .eq('user_id').is('read_at', null)
-- Query: notificationRepository.markAllRead → .eq('user_id').is('read_at', null)
-- Partial index is small (only unread rows) and stays current as notifications get marked read.
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id)
  WHERE read_at IS NULL;
