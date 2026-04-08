/*
  # Fix Rank Penalty Constraint - Allow 0.0

  1. Problem
    - DB error 23514 (CHECK constraint violation) when creating posts with 8+ links
    - Two conflicting constraints on rank_penalty:
      * posts_rank_penalty_check: allows 0.0 to 1.0 ✓
      * posts_rank_penalty_range: requires minimum 0.1 ✗
    - Anti-spam system sets rank_penalty = 0 for shadow_hidden posts
    - This causes INSERT to fail with constraint violation

  2. Changes
    - Drop the problematic posts_rank_penalty_range constraint
    - Keep posts_rank_penalty_check which correctly allows 0.0 to 1.0

  3. Expected Behavior After Fix
    - Posts with 8 links: spam_score ~40, status='published', rank_penalty=0.4
    - Posts with 10+ links: spam_score ≥70, status='shadow_hidden', rank_penalty=0.0
    - All posts should INSERT successfully regardless of link count
*/

-- Drop the constraint that requires minimum 0.1
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_rank_penalty_range;

-- Verify the correct constraint remains (allows 0.0 to 1.0)
-- posts_rank_penalty_check already exists and is correct