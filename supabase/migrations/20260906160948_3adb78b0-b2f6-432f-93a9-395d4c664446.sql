
CREATE POLICY "read own media" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);
