/*
  # Add conversation hiding functionality

  1. Changes
    - Rename `deleted_at` to `hidden_at` in thread_participants for clarity
    - When a user "deletes" a conversation, we set `hidden_at` timestamp
    - Only messages created AFTER `hidden_at` will be shown to that user
    - This prevents old messages from reappearing when conversation restarts

  2. Implementation Details
    - `hidden_at` stores when the user last hid/deleted this conversation
    - Messages with `created_at > hidden_at` will be visible
    - If `hidden_at` is NULL, all messages are visible
*/

-- Ažuriraj thread_participants komentare da objasne novi sistem
COMMENT ON COLUMN thread_participants.deleted_at IS 'Timestamp when user hid this conversation. Messages created after this time will still be visible.';
