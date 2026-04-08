-- ============================================================
-- MasterConnect - MySQL Schema Migration
-- Converted from Supabase/PostgreSQL
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- ============================================================
-- USERS (replaces Supabase Auth)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email_confirmed TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT NOW(),
  updated_at DATETIME NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id CHAR(36) NOT NULL,
  email VARCHAR(255) NOT NULL DEFAULT '',
  phone VARCHAR(50) NULL,
  name VARCHAR(255) NOT NULL,
  bio TEXT NULL,
  skills JSON NOT NULL DEFAULT ('[]'),
  city VARCHAR(255) NULL,
  avatar_url TEXT NULL,
  cover_url TEXT NULL,
  recent_emojis JSON NOT NULL DEFAULT ('[]'),
  account_type VARCHAR(20) NOT NULL,
  is_admin TINYINT(1) NOT NULL DEFAULT 0,
  average_rating DECIMAL(3,2) NULL,
  review_count INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT NOW(),
  updated_at DATETIME NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  CONSTRAINT chk_profiles_account_type CHECK (account_type IN ('professional', 'customer')),
  FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- JOBS
-- ============================================================
CREATE TABLE IF NOT EXISTS jobs (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  customer_id CHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(255) NOT NULL,
  category_normalized VARCHAR(255) NULL,
  city VARCHAR(255) NOT NULL,
  budget VARCHAR(255) NULL,
  preferred_date VARCHAR(255) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  job_type VARCHAR(20) NOT NULL DEFAULT 'project',
  payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
  payment_placeholder_message_sent TINYINT(1) NOT NULL DEFAULT 0,
  completion_requested TINYINT(1) NOT NULL DEFAULT 0,
  completion_requested_at DATETIME NULL,
  completion_request_dismissed_at DATETIME NULL,
  completion_reminder_sent_at DATETIME NULL,
  completed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  CONSTRAINT chk_jobs_status CHECK (status IN ('open', 'closed', 'completed')),
  CONSTRAINT chk_jobs_job_type CHECK (job_type IN ('project', 'employment')),
  FOREIGN KEY (customer_id) REFERENCES profiles(id) ON DELETE CASCADE,
  INDEX idx_jobs_customer_id (customer_id),
  INDEX idx_jobs_status (status),
  INDEX idx_jobs_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- POSTS
-- ============================================================
CREATE TABLE IF NOT EXISTS posts (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  user_id CHAR(36) NOT NULL,
  text TEXT NULL,
  post_type VARCHAR(50) NOT NULL DEFAULT 'social_post',
  is_pinned TINYINT(1) NOT NULL DEFAULT 0,
  pinned_at DATETIME NULL,
  category VARCHAR(255) NULL,
  category_normalized VARCHAR(255) NULL,
  city VARCHAR(255) NULL,
  job_title VARCHAR(255) NULL,
  price_type VARCHAR(50) NULL,
  price_value DECIMAL(15,2) NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'RSD',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  spam_score INT NOT NULL DEFAULT 0,
  phone_count INT NOT NULL DEFAULT 0,
  link_count INT NOT NULL DEFAULT 0,
  hashtag_count INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT NOW(),
  updated_at DATETIME NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  CONSTRAINT chk_posts_post_type CHECK (post_type IN ('portfolio_post', 'hiring_post', 'service_request', 'job_seeker_post', 'social_post', 'service_listing')),
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  INDEX idx_posts_user_id (user_id),
  INDEX idx_posts_created_at (created_at),
  INDEX idx_posts_post_type (post_type),
  INDEX idx_posts_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- POST MEDIA
-- ============================================================
CREATE TABLE IF NOT EXISTS post_media (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  post_id CHAR(36) NOT NULL,
  type VARCHAR(10) NOT NULL,
  url TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  CONSTRAINT chk_post_media_type CHECK (type IN ('image', 'video')),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  INDEX idx_post_media_post_id (post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- POST REACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS post_reactions (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  post_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  emoji VARCHAR(10) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  UNIQUE KEY uq_post_reactions (post_id, user_id),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  INDEX idx_post_reactions_post_id (post_id),
  INDEX idx_post_reactions_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- POST COMMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS post_comments (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  post_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  text TEXT NOT NULL,
  parent_comment_id CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_comment_id) REFERENCES post_comments(id) ON DELETE CASCADE,
  INDEX idx_post_comments_post_id (post_id),
  INDEX idx_post_comments_user_id (user_id),
  INDEX idx_post_comments_parent (parent_comment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- COMMENT REACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS comment_reactions (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  comment_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  emoji VARCHAR(10) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  UNIQUE KEY uq_comment_reactions (comment_id, user_id),
  FOREIGN KEY (comment_id) REFERENCES post_comments(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  INDEX idx_comment_reactions_comment_id (comment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- THREADS (conversations)
-- ============================================================
CREATE TABLE IF NOT EXISTS threads (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  customer_id CHAR(36) NOT NULL,
  pro_id CHAR(36) NOT NULL,
  job_id CHAR(36) NULL,
  post_id CHAR(36) NULL,
  thread_type VARCHAR(20) NOT NULL DEFAULT 'direct',
  created_at DATETIME NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  CONSTRAINT chk_threads_thread_type CHECK (thread_type IN ('direct', 'job', 'post')),
  FOREIGN KEY (customer_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (pro_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  INDEX idx_threads_customer_id (customer_id),
  INDEX idx_threads_pro_id (pro_id),
  INDEX idx_threads_job_id (job_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- OFFERS
-- ============================================================
CREATE TABLE IF NOT EXISTS offers (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  conversation_id CHAR(36) NULL,
  sender_id CHAR(36) NULL,
  receiver_id CHAR(36) NULL,
  related_post_id CHAR(36) NULL,
  price DECIMAL(15,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'RSD',
  estimated_start DATE NULL,
  duration_deadline VARCHAR(255) NULL,
  note TEXT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  offer_type VARCHAR(20) NOT NULL DEFAULT 'job',
  price_type VARCHAR(20) NOT NULL DEFAULT 'fixed',
  responded_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  CONSTRAINT chk_offers_currency CHECK (currency IN ('RSD', 'EUR', 'USD')),
  CONSTRAINT chk_offers_status CHECK (status IN ('pending', 'accepted', 'declined')),
  CONSTRAINT chk_offers_offer_type CHECK (offer_type IN ('job', 'service')),
  CONSTRAINT chk_offers_price_type CHECK (price_type IN ('fixed', 'per_hour')),
  FOREIGN KEY (conversation_id) REFERENCES threads(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (related_post_id) REFERENCES posts(id) ON DELETE SET NULL,
  INDEX idx_offers_conversation_id (conversation_id),
  INDEX idx_offers_sender_id (sender_id),
  INDEX idx_offers_receiver_id (receiver_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  thread_id CHAR(36) NOT NULL,
  sender_id CHAR(36) NOT NULL,
  receiver_id CHAR(36) NOT NULL,
  text TEXT NULL,
  message_type VARCHAR(20) NOT NULL DEFAULT 'text',
  offer_id CHAR(36) NULL,
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  deleted_at DATETIME NULL,
  delivered_at DATETIME NULL,
  seen_at DATETIME NULL,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  CONSTRAINT chk_messages_message_type CHECK (message_type IN ('text', 'offer', 'system')),
  FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE SET NULL,
  INDEX idx_messages_thread_id (thread_id),
  INDEX idx_messages_sender_id (sender_id),
  INDEX idx_messages_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- MESSAGE ATTACHMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS message_attachments (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  message_id CHAR(36) NOT NULL,
  file_url TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(100) NOT NULL,
  file_size INT NOT NULL,
  uploaded_by CHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE CASCADE,
  INDEX idx_message_attachments_message_id (message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- MESSAGE REACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS message_reactions (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  message_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  emoji VARCHAR(10) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  UNIQUE KEY uq_message_reactions (message_id, user_id),
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  INDEX idx_message_reactions_message_id (message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- THREAD PARTICIPANTS
-- ============================================================
CREATE TABLE IF NOT EXISTS thread_participants (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  thread_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  last_read_at DATETIME NULL,
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  -- NOTE: MySQL ne podrzava parcijalne unique indexe (WHERE deleted_at IS NULL)
  -- Ovo se handleuje na nivou aplikacije
  FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  INDEX idx_thread_participants_thread_id (thread_id),
  INDEX idx_thread_participants_user_id (user_id),
  INDEX idx_thread_participants_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  user_id CHAR(36) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'message',
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  meta JSON NOT NULL DEFAULT ('{}'),
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  INDEX idx_notifications_user_id (user_id),
  INDEX idx_notifications_read_at (read_at),
  INDEX idx_notifications_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- REVIEWS
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  pro_id CHAR(36) NOT NULL,
  customer_id CHAR(36) NOT NULL,
  job_id CHAR(36) NULL,
  rating INT NOT NULL,
  comment TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  CONSTRAINT chk_reviews_rating CHECK (rating >= 1 AND rating <= 5),
  FOREIGN KEY (pro_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL,
  INDEX idx_reviews_pro_id (pro_id),
  INDEX idx_reviews_customer_id (customer_id),
  INDEX idx_reviews_job_id (job_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- BLOCKS
-- ============================================================
CREATE TABLE IF NOT EXISTS blocks (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  blocker_user_id CHAR(36) NOT NULL,
  blocked_user_id CHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  UNIQUE KEY uq_blocks (blocker_user_id, blocked_user_id),
  CONSTRAINT chk_blocks_no_self CHECK (blocker_user_id != blocked_user_id),
  FOREIGN KEY (blocker_user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (blocked_user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  INDEX idx_blocks_blocker (blocker_user_id),
  INDEX idx_blocks_blocked (blocked_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- REPORTS
-- ============================================================
CREATE TABLE IF NOT EXISTS reports (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  reporter_user_id CHAR(36) NOT NULL,
  target_type VARCHAR(20) NOT NULL,
  target_id CHAR(36) NOT NULL,
  target_owner_user_id CHAR(36) NOT NULL,
  reason TEXT NOT NULL,
  details TEXT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  created_at DATETIME NOT NULL DEFAULT NOW(),
  updated_at DATETIME NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  UNIQUE KEY uq_reports (reporter_user_id, target_type, target_id),
  CONSTRAINT chk_reports_target_type CHECK (target_type IN ('post', 'comment', 'profile')),
  CONSTRAINT chk_reports_status CHECK (status IN ('open', 'reviewed', 'resolved')),
  FOREIGN KEY (reporter_user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (target_owner_user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  INDEX idx_reports_reporter (reporter_user_id),
  INDEX idx_reports_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SUPPORT MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS support_messages (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  user_id CHAR(36) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  admin_notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT NOW(),
  updated_at DATETIME NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  CONSTRAINT chk_support_messages_status CHECK (status IN ('pending', 'in_progress', 'resolved')),
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  INDEX idx_support_messages_user_id (user_id),
  INDEX idx_support_messages_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- FOLLOWS (nova tabela)
-- ============================================================
CREATE TABLE IF NOT EXISTS follows (
  id CHAR(36) NOT NULL DEFAULT (UUID()),
  follower_id CHAR(36) NOT NULL,
  following_id CHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  UNIQUE KEY uq_follows (follower_id, following_id),
  CONSTRAINT chk_follows_no_self CHECK (follower_id != following_id),
  FOREIGN KEY (follower_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (following_id) REFERENCES profiles(id) ON DELETE CASCADE,
  INDEX idx_follows_follower_id (follower_id),
  INDEX idx_follows_following_id (following_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TRIGGERS - auto update updated_at
-- ============================================================
DROP TRIGGER IF EXISTS trg_profiles_updated_at;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW SET NEW.updated_at = NOW();

DROP TRIGGER IF EXISTS trg_posts_updated_at;
CREATE TRIGGER trg_posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW SET NEW.updated_at = NOW();

DROP TRIGGER IF EXISTS trg_reports_updated_at;
CREATE TRIGGER trg_reports_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW SET NEW.updated_at = NOW();

DROP TRIGGER IF EXISTS trg_support_messages_updated_at;
CREATE TRIGGER trg_support_messages_updated_at
  BEFORE UPDATE ON support_messages
  FOR EACH ROW SET NEW.updated_at = NOW();

DROP TRIGGER IF EXISTS trg_users_updated_at;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW SET NEW.updated_at = NOW();

-- ============================================================
-- TRIGGER - auto update average_rating on profiles after review
-- ============================================================
DROP TRIGGER IF EXISTS trg_reviews_update_rating_after_insert;
CREATE TRIGGER trg_reviews_update_rating_after_insert
  AFTER INSERT ON reviews
  FOR EACH ROW
  UPDATE profiles
  SET
    average_rating = (SELECT AVG(rating) FROM reviews WHERE pro_id = NEW.pro_id),
    review_count = (SELECT COUNT(*) FROM reviews WHERE pro_id = NEW.pro_id)
  WHERE id = NEW.pro_id;

DROP TRIGGER IF EXISTS trg_reviews_update_rating_after_delete;
CREATE TRIGGER trg_reviews_update_rating_after_delete
  AFTER DELETE ON reviews
  FOR EACH ROW
  UPDATE profiles
  SET
    average_rating = (SELECT AVG(rating) FROM reviews WHERE pro_id = OLD.pro_id),
    review_count = (SELECT COUNT(*) FROM reviews WHERE pro_id = OLD.pro_id)
  WHERE id = OLD.pro_id;

SET FOREIGN_KEY_CHECKS = 1;
