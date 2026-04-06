
-- Create a security definer function to look up a single token by value
CREATE OR REPLACE FUNCTION public.lookup_presentation_token(_token text)
RETURNS SETOF presentation_tokens
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM presentation_tokens
  WHERE token = _token
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;
$$;

-- Drop the overly broad anon SELECT policy
DROP POLICY IF EXISTS "Anyone can look up active tokens" ON presentation_tokens;
