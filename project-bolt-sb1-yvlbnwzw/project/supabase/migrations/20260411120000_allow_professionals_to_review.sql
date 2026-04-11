-- Allow any authenticated user (including professionals) to create reviews
-- Previously only customers could leave reviews

DROP POLICY IF EXISTS "Customers can create reviews" ON "public"."reviews";

CREATE POLICY "Authenticated users can create reviews"
  ON "public"."reviews"
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = customer_id);
