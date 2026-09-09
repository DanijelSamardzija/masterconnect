-- Allow message senders to delete their own attachment rows.
--
-- WHY: message_attachments had INSERT and SELECT policies but no DELETE policy,
-- so the client could not remove attachment rows when a message was deleted.
-- Storage objects already had a DELETE policy ("Users can delete own message
-- attachments") scoped to the uploader's folder — this mirrors that for the DB row.
--
-- SCOPE: only the uploader (uploaded_by = auth.uid()) can delete their own rows.
-- Recipients cannot delete attachment metadata even if they can view it.

CREATE POLICY "Message sender can delete own attachments"
  ON public.message_attachments FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid());
