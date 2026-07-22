import { createClient } from '@supabase/supabase-js';

let cliente = null;

export function getSupabaseBrowser() {
  if (!cliente) {
    cliente = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false } }
    );
  }
  return cliente;
}

// Sube un archivo directo a Storage usando una liga firmada (sin pasar por el servidor de la app)
export async function subirArchivoDirecto(file, path, token) {
  const supabase = getSupabaseBrowser();
  const { error } = await supabase.storage.from('documentos').uploadToSignedUrl(path, token, file);
  if (error) throw error;
}
