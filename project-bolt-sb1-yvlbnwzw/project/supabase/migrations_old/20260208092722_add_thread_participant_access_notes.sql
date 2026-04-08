/*
  # Thread Participant Access Control
  
  1. Documentation
    - Customer profiles accessed from chat should verify thread participation
    - Pro profiles remain publicly accessible for browsing
    - Application-level access control is implemented in:
      - /users/[id]/page.tsx - checks thread participation
      - /pros/[id]/page.tsx - public access maintained
    
  2. Access Rules
    - Customers viewing customer profiles: must share a thread
    - Pros viewing customer profiles: must share a thread
    - Anyone viewing pro profiles: public access
    - Thread participants can view each other's posted jobs
  
  3. Security
    - Thread participation verified via threads table join
    - Profile data remains publicly readable at DB level
    - Access enforcement happens in application layer
    - Prevents unauthorized profile access via direct URLs
*/

-- No database changes needed
-- Access control implemented at application level
-- This migration documents the access control pattern
