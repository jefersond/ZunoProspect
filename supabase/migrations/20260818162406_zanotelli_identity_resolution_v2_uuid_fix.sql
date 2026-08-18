-- Production compatibility marker.
-- The UUID aggregate correction that required this hotfix is already folded into
-- 20260818162220_zanotelli_identity_resolution_v2.sql for clean installations.
-- Keeping this version aligned with the applied migration history avoids drift.
select 1;
