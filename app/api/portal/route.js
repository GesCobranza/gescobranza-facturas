import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { validarClavePortal } from '../../../lib/portalAuth';

export async function POST(request) {
  const body = await request.json();
  const grupo = String(body.grupo || '').trim();
  const clave = String(body.clave || '').trim();
  if (!grupo || !clave) return NextResponse.json({ ok: false, error: 'Grupo o clave incorrectos.' }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const auth = await validarClavePortal(supabase, grupo, clave);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const { data: delegaciones, error: errDeleg } = await supabase.from('catalogo_delegaciones').select('nombre').order('nombre');
  if (errDeleg) return NextResponse.json({ ok: false, error: errDeleg.message }, { status: 500 });

  const { data: empresas, error: errEmp } = await supabase.from('catalogo_empresas').select('numero, nombre').eq('grupo', grupo).order('nombre');
  if (errEmp) return NextResponse.json({ ok: false, error: errEmp.message }, { status: 500 });

  return NextResponse.json({ ok: true, delegaciones, empresas });
}
