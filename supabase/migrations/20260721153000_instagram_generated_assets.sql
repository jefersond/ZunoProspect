-- Public Instagram assets rendered by the admin-only Zuno content studio.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'instagram-assets',
  'instagram-assets',
  true,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public reads Instagram assets" ON storage.objects;
CREATE POLICY "Public reads Instagram assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'instagram-assets');

DROP POLICY IF EXISTS "Admins upload Instagram assets" ON storage.objects;
CREATE POLICY "Admins upload Instagram assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'instagram-assets'
  AND public.is_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins update Instagram assets" ON storage.objects;
CREATE POLICY "Admins update Instagram assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'instagram-assets'
  AND public.is_admin(auth.uid())
)
WITH CHECK (
  bucket_id = 'instagram-assets'
  AND public.is_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins delete Instagram assets" ON storage.objects;
CREATE POLICY "Admins delete Instagram assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'instagram-assets'
  AND public.is_admin(auth.uid())
);
