-- Add emergency_after_hours to booking_profiles.
-- emergency_enabled=true + emergency_after_hours=false → during working hours only
-- emergency_enabled=true + emergency_after_hours=true  → any time (24/7)

ALTER TABLE booking_profiles
  ADD COLUMN IF NOT EXISTS emergency_after_hours BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN booking_profiles.emergency_after_hours IS
  'When true (and emergency_enabled=true), business accepts emergency requests outside working hours (24/7)';
