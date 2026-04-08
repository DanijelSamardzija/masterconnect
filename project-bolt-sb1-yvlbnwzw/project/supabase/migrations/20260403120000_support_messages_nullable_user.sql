-- Allow contact form submissions without a logged-in user
ALTER TABLE support_messages ALTER COLUMN user_id DROP NOT NULL;
