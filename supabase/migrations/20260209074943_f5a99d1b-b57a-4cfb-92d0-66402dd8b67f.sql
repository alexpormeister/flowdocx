-- Add parent_id for nested folders
ALTER TABLE public.folders 
ADD COLUMN parent_id UUID REFERENCES public.folders(id) ON DELETE CASCADE;

-- Add index for faster nested folder queries
CREATE INDEX idx_folders_parent_id ON public.folders(parent_id);

-- Update RLS policy to allow viewing child folders
DROP POLICY IF EXISTS "Users can view their own folders" ON public.folders;
CREATE POLICY "Users can view their own folders" 
ON public.folders 
FOR SELECT 
USING (auth.uid() = user_id);

-- Ensure all folder operations still work with nested structure
DROP POLICY IF EXISTS "Users can create their own folders" ON public.folders;
CREATE POLICY "Users can create their own folders" 
ON public.folders 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own folders" ON public.folders;
CREATE POLICY "Users can update their own folders" 
ON public.folders 
FOR UPDATE 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own folders" ON public.folders;
CREATE POLICY "Users can delete their own folders" 
ON public.folders 
FOR DELETE 
USING (auth.uid() = user_id);