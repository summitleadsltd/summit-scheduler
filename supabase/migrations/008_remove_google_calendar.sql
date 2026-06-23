-- Remove Google Calendar Integration
-- Drops Google Calendar columns and tables as we now use internal scheduling only

-- ============================================
-- DROP GOOGLE CALENDAR SYNC LOGS TABLE
-- ============================================
DROP TABLE IF EXISTS public.ss_calendar_sync_logs CASCADE;

-- ============================================
-- REMOVE GOOGLE FIELDS FROM SS_USERS
-- ============================================
ALTER TABLE public.ss_users
  DROP COLUMN IF EXISTS google_account_id,
  DROP COLUMN IF EXISTS google_calendar_id,
  DROP COLUMN IF EXISTS google_access_token,
  DROP COLUMN IF EXISTS google_refresh_token,
  DROP COLUMN IF EXISTS google_token_expires_at,
  DROP COLUMN IF EXISTS calendar_connected;

-- ============================================
-- REMOVE GOOGLE CALENDAR FIELDS FROM SS_APPOINTMENTS
-- ============================================
ALTER TABLE public.ss_appointments
  DROP COLUMN IF EXISTS google_calendar_event_id,
  DROP COLUMN IF EXISTS google_calendar_id;

-- ============================================
-- DROP INDEXES
-- ============================================
DROP INDEX IF EXISTS public.idx_ss_users_calendar_connected;
