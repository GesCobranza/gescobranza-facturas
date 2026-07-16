import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const grupoFiltro = searchParams.get('grupo') || null;
  const supabase = getSupabaseAdmin();

  let empresasQuery = supabase.from('catalogo_empresas').select('*');
  if (grupoFiltro) empresasQuery = empresasQuery.eq('grupo', grupoFiltro);
  const { data: empresasData, error: err1 } = await empresasQuery;
  if (err1) return NextResponse.json({ error: err1.message }, { status: 500 });

  const { data: delegacionesData, error: err2 } = await supabase.from('catalogo_delegaciones').select('*');
  if (err2) return NextResponse.json({ error: err2.message }, { status: 500 });

  const gruposMap = {};
  empresasData.forEach((e) => {
    if (!gruposMap[e.grupo]) gruposMap[e.grupo] = [];
    gruposMap[e.grupo].push({ nombre: e.nombre, numero: e.numero });
  });
  const grupos = Object.keys(gruposMap).map((nombre) => ({ nombre, empresas: gruposMap[nombre] }));
  const delegaciones = delegacionesData.map((d) => ({ codigo: d.codigo, nombre: d.nombre }));

  return NextResponse.json({ grupos, delegaciones });
}

export async function POST(request) {
  const body = await request.json();
  const supabase = getSupabaseAdmin();

  if (body.tipo === 'empresa') {
    const { grupo, nombre, numero } = body;
    if (!grupo || !nombre || !numero) {
      return NextResponse.json({ ok: false, error: 'Faltan datos de la empresa.' });
    }
    const { error } = await supabase.from('catalogo_empresas').insert({ grupo, nombre, numero });
    if (error) return NextResponse.json({ ok: false, error: error.message });
    return NextResponse.json({ ok: true });
  }

  if (body.tipo === 'delegacion') {
    const { codigo, nombre } = body;
    if (!codigo || !nombre) {
      return NextResponse.json({ ok: false, error: 'Faltan datos de la delegación.' });
    }
    const { error } = await supabase.from('catalogo_delegaciones').insert({ codigo, nombre });
    if (error) return NextResponse.json({ ok: false, error: error.message });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: 'Tipo no reconocido.' });
}

export async function DELETE(request) {
  const body = await request.json();
  const supabase = getSupabaseAdmin();

  if (body.tipo === 'empresa') {
    const { error } = await supabase.from('catalogo_empresas').delete().eq('numero', body.numero);
    if (error) return NextResponse.json({ ok: false, error: error.message });
    return NextResponse.json({ ok: true });
  }

  if (body.tipo === 'delegacion') {
    const { error } = await supabase.from('catalogo_delegaciones').delete().eq('nombre', body.nombre);
    if (error) return NextResponse.json({ ok: false, error: error.message });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: 'Tipo no reconocido.' });
}
