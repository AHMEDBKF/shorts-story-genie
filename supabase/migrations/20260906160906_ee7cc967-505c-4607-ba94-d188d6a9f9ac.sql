
REVOKE ALL ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM public, anon;

CREATE POLICY "no client access" ON public.youtube_accounts FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "no client access" ON public.job_locks FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
