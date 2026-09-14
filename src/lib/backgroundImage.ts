import { supabase } from "@/integrations/supabase/client";

const BUCKET = "backgrounds";

/**
 * Extracts the storage path from a stored background value.
 * Stored values are either a storage path ("userId/file.png") or a
 * legacy full public URL containing "/backgrounds/".
 */
export function extractBackgroundPath(value: string): string | null {
  if (value.startsWith("linear-gradient")) return null;
  if (value.startsWith("http")) {
    const marker = `/${BUCKET}/`;
    const idx = value.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(value.slice(idx + marker.length).split("?")[0]);
  }
  return value;
}

/**
 * Resolves a stored background value to a displayable URL.
 * The bucket is private, so storage paths are exchanged for
 * short-lived signed URLs. Gradients and external URLs pass through.
 */
export async function resolveBackgroundUrl(value: string | null): Promise<string | null> {
  if (!value || value.startsWith("linear-gradient")) return null;
  const path = extractBackgroundPath(value);
  if (!path) return value; // external URL, leave untouched
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
