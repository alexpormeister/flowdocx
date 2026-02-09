-- Add dashboard background URL to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS dashboard_background_url TEXT;

-- Create storage bucket for user backgrounds
INSERT INTO storage.buckets (id, name, public)
VALUES ('backgrounds', 'backgrounds', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own backgrounds
CREATE POLICY "Users can upload their own backgrounds"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'backgrounds' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update their own backgrounds
CREATE POLICY "Users can update their own backgrounds"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'backgrounds' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own backgrounds
CREATE POLICY "Users can delete their own backgrounds"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'backgrounds' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access to backgrounds
CREATE POLICY "Backgrounds are publicly accessible"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'backgrounds');