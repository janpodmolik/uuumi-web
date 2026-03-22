-- Enable Row Level Security on the waitlist table
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Drop any existing permissive policies (clean slate)
DROP POLICY IF EXISTS "Allow anonymous insert" ON public.waitlist;
DROP POLICY IF EXISTS "Allow anonymous select" ON public.waitlist;

-- No policies for anon role = anon key cannot read, insert, update, or delete.
-- The join-waitlist edge function uses the service_role key, which bypasses RLS entirely.
-- This means even if someone has the anon key (public), they cannot touch the waitlist table directly.

-- Optional: allow authenticated users (e.g. admin dashboard) to read the waitlist
-- Uncomment if needed:
-- CREATE POLICY "Allow authenticated select" ON public.waitlist
--   FOR SELECT
--   TO authenticated
--   USING (true);

-- =============================================================================
-- Rate limiting table — tracks request counts per IP across all edge instances
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.rate_limits (
  ip TEXT PRIMARY KEY,
  count INT NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: no public access (only service_role key from edge functions)
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Auto-cleanup: delete expired rate limit entries older than 5 minutes
-- (run this periodically via pg_cron or manually)
-- SELECT cron.schedule('cleanup-rate-limits', '*/5 * * * *',
--   $$DELETE FROM public.rate_limits WHERE window_start < now() - interval '5 minutes'$$
-- );

-- =============================================================================
-- Add email_sent flag to waitlist table
-- =============================================================================
-- Tracks whether the welcome email was successfully sent.
-- If Resend returns an error (e.g. 429 rate limit), email_sent stays false.
-- Query unsent: SELECT * FROM waitlist WHERE email_sent = false;
ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS email_sent BOOLEAN NOT NULL DEFAULT false;
