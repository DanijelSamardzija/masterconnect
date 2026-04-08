/*
  # Add Moderation Reasons to Posts

  1. New Column
    - `moderation_reasons` (text array) - List of reasons why post was moderated
      - Possible values: 'too_many_links', 'too_many_phones', 'excessive_caps', 
        'duplicate_content', 'rapid_posting', 'spam_detected', etc.
    
  2. Purpose
    - Allow UI to show specific reasons why a post is shadow_hidden or limited
    - Help users understand what triggered moderation
    - Improve transparency of anti-spam system

  3. Notes
    - Empty array means no moderation applied
    - Multiple reasons can apply to a single post
    - Reasons correspond to spam detection features that triggered penalties
*/

ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS moderation_reasons text[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_posts_moderation_reasons ON posts USING GIN (moderation_reasons);
