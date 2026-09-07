CREATE OR REPLACE FUNCTION public.verify_worker_token(_token text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name = 'worker_tick_token' AND decrypted_secret = _token
  );
$$;

REVOKE ALL ON FUNCTION public.verify_worker_token(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_worker_token(text) TO service_role;