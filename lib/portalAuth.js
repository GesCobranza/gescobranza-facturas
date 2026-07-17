export async function validarClavePortal(supabase, grupo, clave) {
  const { data: claveRow, error } = await supabase
    .from('claves_portal')
    .select('*')
    .eq('grupo', grupo)
    .maybeSingle();
  if (error) return { ok: false, status: 500, error: 'Error de servidor.' };
  if (!claveRow || claveRow.clave !== clave) return { ok: false, status: 401, error: 'Grupo o clave incorrectos.' };
  return { ok: true };
}
