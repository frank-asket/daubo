-- Supabase RLS policies for tables keyed by clerk_user_id.
-- This file is intended for Supabase SQL editor / migrations when client-side queries are enabled.
-- If the API exclusively uses service-role credentials, application-layer filtering still applies.

-- Helper note:
-- - We assume the auth subject claim (`auth.jwt()->>'sub'`) maps to `clerk_user_id`.
-- - Adjust role names and claim mapping to your deployment model as needed.

-- ============================================================================
-- CORE USER-SCOPED TABLES
-- ============================================================================

ALTER TABLE IF EXISTS user_resumes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_resumes_isolation ON user_resumes;
CREATE POLICY user_resumes_isolation ON user_resumes
  FOR ALL TO authenticated
  USING (clerk_user_id = (auth.jwt()->>'sub'))
  WITH CHECK (clerk_user_id = (auth.jwt()->>'sub'));

ALTER TABLE IF EXISTS user_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_preferences_isolation ON user_preferences;
CREATE POLICY user_preferences_isolation ON user_preferences
  FOR ALL TO authenticated
  USING (clerk_user_id = (auth.jwt()->>'sub'))
  WITH CHECK (clerk_user_id = (auth.jwt()->>'sub'));

ALTER TABLE IF EXISTS user_workspace_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_workspace_settings_isolation ON user_workspace_settings;
CREATE POLICY user_workspace_settings_isolation ON user_workspace_settings
  FOR ALL TO authenticated
  USING (clerk_user_id = (auth.jwt()->>'sub'))
  WITH CHECK (clerk_user_id = (auth.jwt()->>'sub'));

ALTER TABLE IF EXISTS user_autopilot_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_autopilot_profiles_isolation ON user_autopilot_profiles;
CREATE POLICY user_autopilot_profiles_isolation ON user_autopilot_profiles
  FOR ALL TO authenticated
  USING (clerk_user_id = (auth.jwt()->>'sub'))
  WITH CHECK (clerk_user_id = (auth.jwt()->>'sub'));

ALTER TABLE IF EXISTS user_profile_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_profile_documents_isolation ON user_profile_documents;
CREATE POLICY user_profile_documents_isolation ON user_profile_documents
  FOR ALL TO authenticated
  USING (clerk_user_id = (auth.jwt()->>'sub'))
  WITH CHECK (clerk_user_id = (auth.jwt()->>'sub'));

ALTER TABLE IF EXISTS user_gmail_credentials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_gmail_credentials_isolation ON user_gmail_credentials;
CREATE POLICY user_gmail_credentials_isolation ON user_gmail_credentials
  FOR ALL TO authenticated
  USING (clerk_user_id = (auth.jwt()->>'sub'))
  WITH CHECK (clerk_user_id = (auth.jwt()->>'sub'));

-- ============================================================================
-- JOB + PIPELINE TABLES
-- ============================================================================

ALTER TABLE IF EXISTS job_listings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS job_listings_isolation ON job_listings;
CREATE POLICY job_listings_isolation ON job_listings
  FOR ALL TO authenticated
  USING (clerk_user_id = (auth.jwt()->>'sub'))
  WITH CHECK (clerk_user_id = (auth.jwt()->>'sub'));

ALTER TABLE IF EXISTS job_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS job_applications_isolation ON job_applications;
CREATE POLICY job_applications_isolation ON job_applications
  FOR ALL TO authenticated
  USING (clerk_user_id = (auth.jwt()->>'sub'))
  WITH CHECK (clerk_user_id = (auth.jwt()->>'sub'));

ALTER TABLE IF EXISTS job_approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS job_approvals_isolation ON job_approvals;
CREATE POLICY job_approvals_isolation ON job_approvals
  FOR ALL TO authenticated
  USING (clerk_user_id = (auth.jwt()->>'sub'))
  WITH CHECK (clerk_user_id = (auth.jwt()->>'sub'));

ALTER TABLE IF EXISTS prep_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS prep_sessions_isolation ON prep_sessions;
CREATE POLICY prep_sessions_isolation ON prep_sessions
  FOR ALL TO authenticated
  USING (clerk_user_id = (auth.jwt()->>'sub'))
  WITH CHECK (clerk_user_id = (auth.jwt()->>'sub'));

ALTER TABLE IF EXISTS autopilot_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS autopilot_runs_isolation ON autopilot_runs;
CREATE POLICY autopilot_runs_isolation ON autopilot_runs
  FOR ALL TO authenticated
  USING (clerk_user_id = (auth.jwt()->>'sub'))
  WITH CHECK (clerk_user_id = (auth.jwt()->>'sub'));

ALTER TABLE IF EXISTS autopilot_run_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS autopilot_run_items_isolation ON autopilot_run_items;
CREATE POLICY autopilot_run_items_isolation ON autopilot_run_items
  FOR ALL TO authenticated
  USING (clerk_user_id = (auth.jwt()->>'sub'))
  WITH CHECK (clerk_user_id = (auth.jwt()->>'sub'));
