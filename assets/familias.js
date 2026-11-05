/* Dentikids · web de las familias. Usa solo las funciones fam_* de la base. */
(function () {
  'use strict';
  const rootEl = document.getElementById('root');
  const fail = (msg) => { rootEl.innerHTML = '<div class="load-fail"><h1>Dentikids</h1><p>' + msg + '</p></div>'; };
  if (!window.htmPreact || !window.supabase) { fail('No se pudo cargar la página. Revisa la conexión y vuelve a abrir el enlace.'); return; }
  const CFG = window.DK_CONFIG || {};
  if (!CFG.url || !CFG.key || /^PEGA_AQUI/.test(String(CFG.url)) || /^PEGA_AQUI/.test(String(CFG.key))) { fail('Esta página todavía no está conectada con su base de datos.'); return; }
  const { html, render, useState, useEffect, useRef } = window.htmPreact;
  const sb = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

  /* ---------- Conexión ---------- */
  function mensajeDe(error) {
    const m = String((error && error.message) || '');
    if (error && (error.code === 'P0001' || (error.code === '42501' && !/permission denied/i.test(m)))) return m;
    if (/fetch|network|load failed|conexi/i.test(m)) return 'No hay conexión. Revisa el internet e inténtalo de nuevo.';
    return 'Algo falló. Inténtalo de nuevo en un momento.';
  }
  async function api(fn, args) {
    let res;
    try { res = await sb.rpc(fn, args || {}); } catch (e) { throw new Error(mensajeDe(e)); }
    if (res.error) { const e = new Error(mensajeDe(res.error)); e.code = res.error.code; throw e; }
    return res.data;
  }
  const KEY = 'dk-enlace';
  const leerToken = () => { try { return window.localStorage.getItem(KEY) || ''; } catch (e) { return ''; } };
  const guardarToken = (t) => { try { window.localStorage.setItem(KEY, t); } catch (e) { /* sin almacenamiento */ } };
  const borrarToken = () => { try { window.localStorage.removeItem(KEY); } catch (e) { /* sin almacenamiento */ } };

  /* ---------- Fechas, montos y textos ---------- */
  const NB = String.fromCharCode(160);
  const WD = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const WDS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const MO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const MOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const D = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
  const parseIso = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? D(+m[1], +m[2], +m[3]) : null; };
  const isoOf = (dt) => dt.getUTCFullYear() + '-' + String(dt.getUTCMonth() + 1).padStart(2, '0') + '-' + String(dt.getUTCDate()).padStart(2, '0');
  // Venezuela usa UTC-4 todo el año.
  const tsCar = (ts) => { const d = new Date(new Date(ts).getTime() - 4 * 3600000); return { iso: isoOf(d), min: d.getUTCHours() * 60 + d.getUTCMinutes() }; };
  let HOY = tsCar(Date.now()).iso;
  let BASE = parseIso(HOY);
  const setHoy = (iso) => { if (iso && parseIso(iso)) { HOY = iso; BASE = parseIso(iso); } };
  const dayDiff = (iso) => Math.round((parseIso(iso) - BASE) / 86400000);
  const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
  const longIso = (iso) => { const dt = parseIso(iso); return WD[dt.getUTCDay()] + ' ' + dt.getUTCDate() + ' de ' + MO[dt.getUTCMonth()] + (dt.getUTCFullYear() !== BASE.getUTCFullYear() ? ' de ' + dt.getUTCFullYear() : ''); };
  const fechaLarga = (iso) => { const dt = parseIso(iso); return dt.getUTCDate() + ' de ' + MO[dt.getUTCMonth()] + ' de ' + dt.getUTCFullYear(); };
  const shortIso = (iso) => { const dt = parseIso(iso); return WDS[dt.getUTCDay()] + ' ' + dt.getUTCDate() + ' ' + MOS[dt.getUTCMonth()]; };
  const dmy = (iso) => { const p = String(iso).slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; };
  function fmt(min) {
    const h = Math.floor(min / 60) % 24;
    const m = min % 60;
    return (h % 12 === 0 ? 12 : h % 12) + ':' + String(m).padStart(2, '0') + ' ' + (h >= 12 ? 'p. m.' : 'a. m.');
  }
  const alas = (min) => (Math.floor(min / 60) % 12 === 1 ? 'a la ' : 'a las ') + fmt(min);
  const hm = (min) => { const h = Math.floor(min / 60) % 24; return (h % 12 === 0 ? 12 : h % 12) + ':' + String(min % 60).padStart(2, '0'); };
  const ap = (min) => (Math.floor(min / 60) % 24 >= 12 ? 'p. m.' : 'a. m.');
  const relDay = (iso) => { const n = dayDiff(iso); return n === 0 ? 'hoy' : n === 1 ? 'mañana' : n === -1 ? 'ayer' : 'el ' + longIso(iso); };
  const cuandoCorto = (iso, min) => { const n = dayDiff(iso); return (n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : n === -1 ? 'Ayer' : cap(shortIso(iso))) + ', ' + fmt(min); };
  const hastaTxt = (h) => (!h ? 'por dos horas' : h.iso === HOY ? 'hasta ' + alas(h.min).replace(/^a /, '') : 'hasta mañana ' + alas(h.min));
  const stamp = (x) => x.fecha + String(x.min).padStart(4, '0');
  const asc = (a, b) => (stamp(a) < stamp(b) ? -1 : 1);
  const desc = (a, b) => (stamp(a) < stamp(b) ? 1 : -1);
  function monthsOld(nac) {
    const b = parseIso(nac);
    let m = (BASE.getUTCFullYear() - b.getUTCFullYear()) * 12 + (BASE.getUTCMonth() - b.getUTCMonth());
    if (BASE.getUTCDate() < b.getUTCDate()) m -= 1;
    return m;
  }
  const ageLabel = (nac) => { const m = monthsOld(nac); return m < 24 ? m + (m === 1 ? ' mes' : ' meses') : Math.floor(m / 12) + ' años'; };
  const first = (n) => (n || '').trim().split(/\s+/)[0];
  const titleCase = (t) => t.toLowerCase().replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase());
  const fmtNum = (n) => { const p = Number(n).toFixed(2).split('.'); return p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + p[1]; };
  const usd = (n) => '$ ' + (Number(n) % 1 ? fmtNum(n) : String(Number(n)));
  const RX_HORA = /(\d) ([ap])\. m\./g;
  const RX_MON = /(Bs\.|\$) (?=\d)/g;
  const RX_USDT = /(\d) (USDT)/g;
  const RX_DOBLE = new RegExp('([ap]\\.[\\s' + NB + ']m\\.)\\.', 'g');
  const nb = (t) => (typeof t !== 'string' ? t : t.replace(RX_HORA, '$1' + NB + '$2.' + NB + 'm.').replace(RX_MON, '$1' + NB).replace(RX_USDT, '$1' + NB + '$2').replace(RX_DOBLE, '$1'));
  const digitos = (t) => String(t || '').replace(/\D/g, '');
  const telTxt = (t) => { const d = digitos(t); return d.length === 11 && d[0] === '0' ? d.slice(0, 4) + '-' + d.slice(4, 7) + ' ' + d.slice(7, 9) + ' ' + d.slice(9) : (t || ''); };
  const waNum = (t) => { let d = digitos(t); if (d.indexOf('00') === 0) d = d.slice(2); if (d.length === 11 && d[0] === '0') d = '58' + d.slice(1); else if (d.length === 10 && d[0] === '4') d = '58' + d; return d; };
  const waLink = (phone, text) => 'https://wa.me/' + waNum(phone) + (text ? '?text=' + encodeURIComponent(text) : '');
  const enlaceDe = (token) => window.location.origin + '/c/' + token;

  /* ---------- Catálogos ---------- */
  const MOTIVOS = [
    { id: 'primera', label: 'Primera visita', desc: 'Revisión completa y limpieza', txt: 'primera visita', tone: 'pink', icon: 'tooth' },
    { id: 'control', label: 'Control', desc: 'La revisión de cada seis meses', txt: 'cita de control', tone: 'blue', icon: 'cal' },
    { id: 'preocupa', label: 'Algo me preocupa', desc: 'Una mancha, un diente flojo o una molestia', txt: 'cita', tone: 'yel', icon: 'chat' },
    { id: 'urgencia', label: 'Urgencia', desc: 'Dolor fuerte o un golpe', txt: 'urgencia', tone: 'peach', icon: 'bell' },
    { id: 'tratamiento', label: 'Tratamiento', desc: 'Una sesión del tratamiento en curso', txt: 'sesión de tratamiento', tone: 'lav', icon: 'tooth', oculto: true }
  ];
  const motivoOf = (id) => MOTIVOS.find((x) => x.id === id) || MOTIVOS[2];
  const PERMS = [
    { id: 'avisos', label: 'Recibir los avisos de las citas', short: 'Avisos' },
    { id: 'agenda', label: 'Agendar y cambiar citas', short: 'Agenda' },
    { id: 'pagos', label: 'Ver y hacer pagos', short: 'Pagos' },
    { id: 'historia', label: 'Ver los informes', short: 'Informes', help: 'Solo para representantes legales; la doctora lo confirma en la consulta.' }
  ];
  const METODO_LBL = { ef: 'Efectivo', pm: 'Pago Móvil', tr: 'Transferencia', ze: 'Zelle', bi: 'Binance Pay' };
  const BANKS = ['Banco de Venezuela', 'Banesco', 'Mercantil', 'Provincial', 'BNC', 'Bancamiga', 'Banco del Tesoro', 'Bicentenario', 'Banplus', 'Banco Exterior', 'Venezolano de Crédito', 'Otro banco'];
  const PARENTESCOS = ['Mamá', 'Papá', 'Abuela', 'Abuelo', 'Tía', 'Tío', 'Otro'];
  const TPL = {
    bienvenida: { tone: 'pink', icon: 'star' }, confirmacion: { tone: 'mint', icon: 'check' }, recordatorio: { tone: 'blue', icon: 'bell' },
    confirmar_hoy: { tone: 'blue', icon: 'bell' }, resumen: { tone: 'lav', icon: 'doc' }, control: { tone: 'blue', icon: 'cal' },
    reactivacion: { tone: 'blue', icon: 'cal' }, cumple: { tone: 'yel', icon: 'star' }, pago_revisar: { tone: 'peach', icon: 'pagos' },
    pago_pendiente: { tone: 'yel', icon: 'pagos' }, cambio: { tone: 'blue', icon: 'cal' }, cancelacion: { tone: 'peach', icon: 'close' },
    asistencia: { tone: 'mint', icon: 'check' }, enlace: { tone: 'lav', icon: 'lock' }
  };
  const CANALES = [
    { id: 'wa', label: 'WhatsApp', desc: 'El consultorio te escribe desde su WhatsApp, y aquí queda la copia.', tone: 'mint' },
    { id: 'web', label: 'Solo en esta página', desc: 'Los avisos quedan aquí, en tu enlace; conviene revisarlo antes de cada cita.', tone: 'lav' }
  ];
  const TABS = [
    { id: 'inicio', label: 'Inicio', tone: 'blue' },
    { id: 'agendar', label: 'Agendar', tone: 'lav' },
    { id: 'peques', label: 'Peques', tone: 'pink' },
    { id: 'pagos', label: 'Pagos', tone: 'yel' },
    { id: 'avisos', label: 'Avisos', tone: 'mint' }
  ];
  const TONES = ['blue', 'pink', 'yel', 'mint', 'lav'];
  const toneOf = (id) => { let h = 0; const t = String(id || ''); for (let i = 0; i < t.length; i += 1) h = (h * 31 + t.charCodeAt(i)) >>> 0; return TONES[h % TONES.length]; };
  function metodosDe(cl) {
    const ab = Number(cl.abono_usd || 0);
    const bs = ab * Number(cl.tasa_bcv || 0);
    const bsTxt = 'Bs. ' + fmtNum(bs);
    const bsCopia = bs.toFixed(2).replace('.', ',');
    const pm = cl.pago_movil || {};
    const tr = cl.transferencia || {};
    const ze = cl.zelle || {};
    const bi = cl.binance || {};
    const compacto = (t) => String(t || '').replace(/[\s.-]/g, '');
    const rows = (list) => list.filter((r) => r[1]);
    return {
      pm: { label: 'Pago Móvil', amount: bsTxt, bs: true, rows: rows([['Banco', pm.banco, pm.banco], ['Teléfono', pm.telefono, digitos(pm.telefono)], ['Cédula o RIF', pm.rif, compacto(pm.rif)], ['Monto', bsTxt, bsCopia]]), field: 'Referencia', ph: 'Últimos 6 dígitos', kind: 'num', bank: true },
      tr: { label: 'Transferencia', amount: bsTxt, bs: true, rows: rows([['Banco', tr.banco, tr.banco], ['Cuenta', tr.cuenta, digitos(tr.cuenta)], ['Titular', tr.titular, tr.titular], ['Cédula o RIF', tr.rif, compacto(tr.rif)], ['Monto', bsTxt, bsCopia]]), field: 'Número de referencia', ph: 'Del comprobante', kind: 'num', bank: true },
      ze: { label: 'Zelle', amount: '$ ' + fmtNum(ab), bs: false, rows: rows([['Correo', ze.correo, ze.correo], ['Titular', ze.titular, ze.titular], ['Monto', '$ ' + fmtNum(ab), String(ab)]]), field: 'Titular de tu cuenta', ph: 'Como aparece en tu banco', kind: 'text', bank: false },
      bi: { label: 'Binance Pay', amount: ab + ' USDT', bs: false, rows: rows([['Binance Pay ID', bi.id, bi.id], ['Monto', ab + ' USDT', String(ab)]]), field: 'Número de la orden', ph: 'De Binance Pay', kind: 'num', bank: false }
    };
  }

  /* ---------- Datos de la cuenta ---------- */
  function normal(est, token) {
    const yo = est.yo;
    const s = {
      token: token, yo: yo.id, yoNombre: yo.nombre, clinica: est.clinica,
      personas: [{ id: yo.id, nombre: yo.nombre, tel: yo.telefono, correo: yo.correo }],
      pacientes: [], vinculos: [], citas: [], pagos: [], informes: {}, avisos: [],
      prefs: { canal: yo.canal === 'wa' ? 'wa' : 'web', consejos: !!yo.consejos }
    };
    (est.peques || []).forEach((k) => {
      s.pacientes.push({ id: k.id, nombre: k.nombre, nac: k.nacimiento, alergias: k.alergias || 'Ninguna registrada', star: k.estrella, seg: k.segmento, ultima: k.ultima, tieneInformes: !!k.tiene_informes });
      (k.personas || []).forEach((x) => {
        const pid = x.yo ? yo.id : 'v_' + x.id;
        if (!x.yo && x.estado === 'activo') s.personas.push({ id: pid, nombre: x.nombre });
        s.vinculos.push({
          id: x.id, per: x.estado === 'invitado' ? null : pid, invitado: x.estado === 'invitado' ? x.nombre : null, pac: k.id,
          parentesco: x.parentesco, legal: !!x.legal, estado: x.estado,
          permisos: { avisos: !!x.avisos, agenda: !!x.agenda, pagos: !!x.pagos, historia: !!x.historia },
          legalConfirmado: x.yo ? !!(k.vinculo && k.vinculo.legal_confirmado) : undefined
        });
      });
      (k.citas || []).forEach((c) => {
        s.citas.push({ id: c.id, pac: k.id, fecha: c.fecha, min: c.minuto, motivo: c.motivo, detalle: c.detalle || '', estado: c.estado, asiste: !!c.asiste, asistePor: c.asiste_por || '', por: c.creada_por || '', informe: c.informe || null, hasta: c.hasta ? tsCar(c.hasta) : null, abono: c.abono || null });
      });
      (k.pagos || []).forEach((p) => { const t = tsCar(p.reportado); s.pagos.push({ id: p.id, pac: k.id, cita: p.cita, tipo: p.tipo, metodo: p.metodo, usd: Number(p.usd), bs: p.bs == null ? null : Number(p.bs), banco: p.banco, ref: p.referencia, estado: p.estado, fecha: t.iso, min: t.min, reportado: p.reportado }); });
      (k.informes || []).forEach((i) => { s.informes[i.id] = { id: i.id, cita: i.cita, fecha: i.fecha, motivo: i.motivo, pac: k.id }; });
    });
    (est.avisos || []).forEach((a) => { const t = tsCar(a.cuando); s.avisos.push({ id: a.id, tpl: a.plantilla, nombre: a.nombre, canal: a.canal, fecha: t.iso, min: t.min, texto: a.texto, nuevo: !a.leido, pac: a.paciente, link: a.informe || null }); });
    return s;
  }
  const VACIO = { token: '', yo: null, yoNombre: '', clinica: null, personas: [], pacientes: [], vinculos: [], citas: [], pagos: [], informes: {}, avisos: [], prefs: { canal: 'wa', consejos: false } };
  const byId = (list, id) => list.find((x) => x.id === id) || null;
  const per = (s, id) => byId(s.personas, id) || { nombre: '' };
  const pac = (s, id) => byId(s.pacientes, id) || { nombre: '' };
  const vinDe = (s, perId, pacId) => s.vinculos.find((v) => v.per === perId && v.pac === pacId && v.estado === 'activo') || null;
  const puede = (s, pacId, k) => { const v = vinDe(s, s.yo, pacId); return !!(v && v.permisos[k]); };
  const misPeques = (s) => s.vinculos.filter((v) => v.per === s.yo && v.estado === 'activo').map((v) => pac(s, v.pac));
  const VIVAS = ['apartada', 'abono', 'confirmada', 'sala'];
  const proximasDe = (s, pacId) => s.citas.filter((c) => c.pac === pacId && VIVAS.indexOf(c.estado) >= 0 && dayDiff(c.fecha) >= 0).sort(asc);
  const proximasMias = (s) => misPeques(s).reduce((acc, k) => acc.concat(proximasDe(s, k.id)), []).sort(asc);
  const pasadasDe = (s, pacId) => s.citas.filter((c) => c.pac === pacId && c.estado === 'atendida').sort(desc);
  const legalesDe = (s, pacId) => s.vinculos.filter((v) => v.pac === pacId && v.legal && v.estado === 'activo').map((v) => per(s, v.per));
  const nombres = (list) => (list.length ? list.map((p) => first(p.nombre)).join(' y ') : 'Quien representa a tu peque');
  const citaTitulo = (s, c) => cap(motivoOf(c.motivo).txt) + ' de ' + first(pac(s, c.pac).nombre);
  const abonoDe = (s, citaId) => { const ps = s.pagos.filter((p) => p.cita === citaId && p.tipo === 'abono').sort((a, b) => (a.reportado < b.reportado ? 1 : -1)); if (ps[0]) return ps[0]; const c = byId(s.citas, citaId); return c && c.abono ? { id: c.abono.id, metodo: c.abono.metodo, usd: Number(c.abono.usd), bs: c.abono.bs == null ? null : Number(c.abono.bs), banco: c.abono.banco, ref: c.abono.referencia, estado: c.abono.estado } : null; };
  const montoDe = (s, p) => (p.metodo === 'pm' || p.metodo === 'tr' ? 'Bs. ' + fmtNum(p.bs || p.usd * Number(s.clinica.tasa_bcv)) : p.metodo === 'bi' ? p.usd + ' USDT' : '$ ' + fmtNum(p.usd));
  const misAvisos = (s) => s.avisos.slice().sort(desc);
  const sinLeer = (s) => s.avisos.filter((a) => a.nuevo).length;
  const corregible = (s, c) => { const p = abonoDe(s, c.id); return c.estado === 'abono' && p && p.estado === 'no aparece'; };
  const avisoPor = (s) => (s.prefs.canal === 'wa' ? 'Te avisamos por WhatsApp al confirmarlo.' : 'El aviso aparecerá aquí al confirmarlo.');
  const bookInit = (pacId) => ({ step: 'quien', pac: pacId || null, nuevo: { nombre: '', nac: '', par: 'Mamá', legal: true }, contacto: { nombre: '', tel: '', correo: '', canal: 'wa', consejos: false }, motivo: null, dia: null, min: null, cita: null, err: '', busy: false, ronda: 0, nuevaCuenta: false });
  const defaultKid = (s) => { const vs = s.vinculos.filter((v) => v.per === s.yo && v.estado === 'activo' && v.permisos.agenda); return vs.length === 1 ? vs[0].pac : null; };

  /* ---------- Íconos y marca ---------- */
  const svg = (z, body, sw) => html`<svg width=${z} height=${z} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width=${sw || 2} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
  const I = {
    inicio: (z) => svg(z || 18, html`<path d="M4 11.2 12 4.8l8 6.4v8.3a1.5 1.5 0 0 1-1.5 1.5H15v-5.5H9V21H5.5A1.5 1.5 0 0 1 4 19.5z" />`, 1.9),
    agendar: (z) => svg(z || 18, html`<rect x="3" y="4.5" width="18" height="16" rx="3" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4M12 12.5v5M9.5 15h5" />`, 1.9),
    peques: (z) => svg(z || 18, html`<circle cx="12" cy="12" r="8.5" /><path d="M9 14.6c.8.9 1.8 1.4 3 1.4s2.2-.5 3-1.4M9.3 10.2h.01M14.7 10.2h.01" />`, 1.9),
    pagos: (z) => svg(z || 18, html`<rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10.5h18M7 15h4" />`, 1.9),
    avisos: (z) => svg(z || 18, html`<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" />`, 1.9),
    bell: (z) => svg(z || 16, html`<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" />`, 1.9),
    cal: (z) => svg(z || 16, html`<rect x="3" y="4.5" width="18" height="16" rx="3" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4M8 14h3" />`, 1.9),
    chat: (z) => svg(z || 16, html`<path d="M4.5 5h15A1.5 1.5 0 0 1 21 6.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5V17h-1A1.5 1.5 0 0 1 3 15.5v-9A1.5 1.5 0 0 1 4.5 5z" />`, 1.9),
    doc: (z) => svg(z || 16, html`<path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5a1.5 1.5 0 0 1 1-1.5z" /><path d="M14 3.5V8h4M9 12.5h6M9 16h4" />`, 1.9),
    tooth: (z) => svg(z || 16, html`<path d="M7.5 3.5c-2.5 0-4 2-4 4.6 0 2.4 1.2 3.9 1.8 6.1.7 2.7 1 6.3 2.9 6.3 1.6 0 1.7-3.3 2.4-5 .4-.9.8-1.3 1.4-1.3s1 .4 1.4 1.3c.7 1.7.8 5 2.4 5 1.9 0 2.2-3.6 2.9-6.3.6-2.2 1.8-3.7 1.8-6.1 0-2.6-1.5-4.6-4-4.6-1.9 0-2.9 1-4.5 1s-2.6-1-4.5-1z" />`, 1.8),
    star: (z) => svg(z || 16, html`<path d="M12 3.5l2.5 5.2 5.6.7-4.1 3.9 1 5.6L12 16.2l-5 2.7 1-5.6-4.1-3.9 5.6-.7z" />`, 1.8),
    check: (z) => svg(z || 15, html`<path d="M5 12.5l4.2 4.2L19 7" />`, 2.4),
    close: (z) => svg(z || 16, html`<path d="M6 6l12 12M18 6L6 18" />`),
    back: (z) => svg(z || 16, html`<path d="M15 5l-7 7 7 7" />`),
    chev: (z) => svg(z || 18, html`<path d="M9 6l6 6-6 6" />`),
    plus: (z) => svg(z || 18, html`<path d="M12 5v14M5 12h14" />`),
    lock: (z) => svg(z || 18, html`<rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />`, 1.9),
    copy: (z) => svg(z || 14, html`<rect x="8" y="8" width="12" height="12" rx="2.5" /><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" />`),
    pin: (z) => svg(z || 16, html`<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.5" />`, 1.9),
    clock: (z) => svg(z || 16, html`<circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" />`, 1.9),
    user: (z) => svg(z || 16, html`<circle cx="9" cy="8" r="3.5" /><path d="M2.5 19.5c.7-3.4 3.3-5.4 6.5-5.4 1.6 0 3 .5 4.1 1.3M18 13v6M15 16h6" />`, 1.9),
    mail: (z) => svg(z || 16, html`<rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3.5 6.5 12 13l8.5-6.5" />`, 1.9),
    phone: (z) => svg(z || 16, html`<rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" />`, 1.9),
    send: (z) => svg(z || 16, html`<path d="M4 12 20 4l-4 16-4-6.5z" /><path d="M12 13.5 20 4" />`)
  };
  const pill = (tone, text) => html`<span class=${'pill ' + tone}>${nb(text)}</span>`;
  const pt = (tone, icon) => html`<span class=${'ptag t-' + tone} aria-hidden="true">${icon}</span>`;
  const Word = () => html`<svg class="dk-word" viewBox="0 0 907 275.8" role="img" aria-label="Dentikids"><use href="#dk-word" width="907" height="275.8"></use></svg>`;
  const Stars = (cls) => html`<svg class=${'dk-stars' + (cls ? ' ' + cls : '')} viewBox="0 0 407.1 411.6" aria-hidden="true" focusable="false"><use href="#dk-stars" width="407.1" height="411.6"></use></svg>`;
  const KStar = (k, size) => html`<span class=${'kstar ks-' + (k.star || 'blue') + (size ? ' ' + size : '')} aria-hidden="true">${(k.nombre || '?').charAt(0)}</span>`;
  const Av = (p) => html`<span class=${'av t-' + toneOf(p.id || p.nombre)} aria-hidden="true">${(p.nombre || p.invitado || '?').charAt(0)}</span>`;
  const canalIc = (c) => (c === 'wa' ? I.chat(16) : I.bell(16));
  const conEnlaces = (t) => String(t || '').split(/(https?:\/\/[^\s]+)/g).map((part, i) => (i % 2 ? html`<a key=${i} class="lnk" href=${part} rel="noopener">${part.replace(/^https?:\/\//, '')}</a>` : nb(part)));

  function estadoInfo(s, c) {
    const pago = abonoDe(s, c.id);
    const pp = puede(s, c.pac, 'pagos');
    const n = dayDiff(c.fecha);
    const prox = relDay(c.fecha);
    const ab = usd(s.clinica.abono_usd);
    if (c.estado === 'apartada') {
      return { pill: pill('warn', 'Falta el abono'), txt: pp ? 'La hora queda apartada ' + hastaTxt(c.hasta) + ' mientras pagas el abono de ' + ab + '.' : 'La hora queda apartada ' + hastaTxt(c.hasta) + '. ' + nombres(legalesDe(s, c.pac)) + ' recibió el aviso para pagar el abono.' };
    }
    if (c.estado === 'abono') {
      if (pago && pago.estado === 'no aparece') return { pill: pill('warn', 'Pago por revisar'), txt: pp ? 'El consultorio no encontró el pago en su banco. Revisa la referencia y corrígela, o envía el comprobante por WhatsApp.' : 'El consultorio está revisando el abono con la familia.' };
      return { pill: pill('info', 'Abono en verificación'), txt: pp && pago ? 'Estamos verificando el pago de ' + montoDe(s, pago) + ' por ' + METODO_LBL[pago.metodo] + '. ' + avisoPor(s) : 'El consultorio está verificando el abono.' };
    }
    if (c.estado === 'sala') return { pill: pill('info', 'En el consultorio'), txt: 'Ya registramos la llegada.' };
    if (c.asiste) return { pill: pill('ok', 'Asistencia confirmada'), txt: (!c.asistePor || c.asistePor === s.yoNombre ? 'Los esperamos ' : first(c.asistePor) + ' confirmó que van. Los esperamos ') + prox + ' ' + alas(c.min) + '.' };
    if (n <= 1) return { pill: pill('ok', 'Cita confirmada'), txt: '¿Van ' + prox + '? Confírmalo con un toque.' };
    return { pill: pill('ok', 'Cita confirmada'), txt: 'El abono está confirmado, y el día anterior te recordamos la cita.' };
  }
  const puedeAsistir = (s, c) => dayDiff(c.fecha) >= 0 && dayDiff(c.fecha) <= 1 && !c.asiste && (c.estado === 'confirmada' || c.estado === 'abono') && puede(s, c.pac, 'agenda');

  /* ---------- Piezas comunes ---------- */
  function Back({ act }) { return html`<button type="button" class="back" onClick=${act.back}>${I.back(16)} Volver</button>`; }
  function copiar(text, okMsg, say) {
    const ok = () => say(okMsg);
    const fallback = () => {
      let done = false;
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.className = 'vh';
        document.body.appendChild(ta);
        ta.select();
        done = !!(document.execCommand && document.execCommand('copy'));
        document.body.removeChild(ta);
      } catch (e) { done = false; }
      say(done ? okMsg : 'No se pudo copiar. El dato es ' + text + '.');
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fallback);
      else fallback();
    } catch (e) { fallback(); }
  }
  function CopyBtn({ text, label, act }) {
    return html`<button type="button" class="copy" onClick=${() => copiar(text, 'Copiado: ' + label.toLowerCase() + '.', act.say)} aria-label=${'Copiar ' + label.toLowerCase()}>${I.copy(14)} Copiar</button>`;
  }
  function useHoras(token, excl, ronda) {
    const [st, setSt] = useState({ dias: null, err: '' });
    useEffect(() => {
      let vivo = true;
      setSt({ dias: null, err: '' });
      api('fam_horas', { p_token: token || null, p_desde: null, p_dias: 10, p_excluir: excl || null })
        .then((d) => { if (vivo) setSt({ dias: d || [], err: '' }); }, (e) => { if (vivo) setSt({ dias: [], err: e.message }); });
      return () => { vivo = false; };
    }, [token, excl, ronda]);
    return st;
  }
  function Picker({ h, dia, min, onPick }) {
    if (!h.dias) return html`<p class="empty">Buscando las horas libres…</p>`;
    if (h.err) return html`<p class="err" role="alert">${h.err}</p>`;
    const conLibres = h.dias.filter((d) => d.libres.length);
    if (!conLibres.length) return html`<p class="empty">No quedan horas libres en los próximos días. Escríbele al consultorio y te buscamos un espacio.</p>`;
    const cur = h.dias.find((d) => d.fecha === dia) || conLibres[0];
    const am = cur.libres.filter((m) => m < 720);
    const pm = cur.libres.filter((m) => m >= 720);
    const slot = (m) => html`<button type="button" key=${m} class="slot" aria-pressed=${min === m && dia === cur.fecha ? 'true' : 'false'} onClick=${() => onPick(cur.fecha, m)}>${fmt(m)}</button>`;
    return html`<div class="stack gap12">
      <div class="days" role="group" aria-label="Día">${h.dias.map((d) => { const n = d.libres.length; const dt = parseIso(d.fecha); return html`<button type="button" key=${d.fecha} class="day" aria-pressed=${cur.fecha === d.fecha ? 'true' : 'false'} disabled=${!n} onClick=${() => onPick(d.fecha, null)}><small>${cap(WDS[dt.getUTCDay()])}</small><b>${dt.getUTCDate()}</b><small>${n ? n + (n === 1 ? ' libre' : ' libres') : 'Lleno'}</small></button>`; })}</div>
      <p class="pick-day">${cap(longIso(cur.fecha))}</p>
      <div class="half"><span class="lbl">En la mañana</span>${am.length ? html`<div class="slots">${am.map(slot)}</div>` : html`<p class="empty">No quedan horas en la mañana.</p>`}</div>
      <div class="half"><span class="lbl">En la tarde</span>${pm.length ? html`<div class="slots">${pm.map(slot)}</div>` : html`<p class="empty">No quedan horas en la tarde.</p>`}</div>
    </div>`;
  }
  function NuevoForm({ v, onChange }) {
    const set = (k, val) => onChange(Object.assign({}, v, { [k]: val }));
    return html`<div class="stack gap12">
      <div class="field"><label for="nk-nombre">Nombre y apellido de tu peque</label><input id="nk-nombre" class="input" type="text" autocomplete="off" maxlength="80" value=${v.nombre} onInput=${(e) => set('nombre', e.target.value)} /></div>
      <div class="grid2">
        <div class="field"><label for="nk-nac">Fecha de nacimiento</label><input id="nk-nac" class="input" type="date" max=${HOY} value=${v.nac} onInput=${(e) => set('nac', e.target.value)} /></div>
        <div class="field"><label for="nk-par">Tú eres su</label><select id="nk-par" class="select" value=${v.par} onChange=${(e) => set('par', e.target.value)}>${PARENTESCOS.map((p) => html`<option value=${p}>${p}</option>`)}</select></div>
      </div>
      <label class="check" for="nk-legal"><input id="nk-legal" type="checkbox" checked=${!!v.legal} onChange=${(e) => set('legal', e.target.checked)} /><span><b>Soy su representante legal</b><small>Así podrás ver los informes. La doctora lo confirma en la primera visita.</small></span></label>
    </div>`;
  }
  function validarPeque(v) {
    const nm = (v.nombre || '').trim();
    if (nm.split(/\s+/).length < 2) return 'Escribe el nombre y el apellido de tu peque.';
    if (!parseIso(v.nac) || dayDiff(v.nac) > 0) return 'Escribe una fecha de nacimiento válida.';
    if (monthsOld(v.nac) >= 216) return 'En Dentikids atendemos a niños y adolescentes hasta los 17 años.';
    return '';
  }
  function ContactoForm({ v, onChange }) {
    const set = (k, val) => onChange(Object.assign({}, v, { [k]: val }));
    return html`<div class="stack gap12">
      <div class="field"><label for="ct-nombre">Tu nombre y apellido</label><input id="ct-nombre" class="input" type="text" autocomplete="name" maxlength="80" value=${v.nombre} onInput=${(e) => set('nombre', e.target.value)} /></div>
      <div class="grid2">
        <div class="field"><label for="ct-tel">Tu teléfono con WhatsApp</label><input id="ct-tel" class="input" type="tel" inputmode="tel" autocomplete="tel" placeholder="0414 000 00 00" value=${v.tel} onInput=${(e) => set('tel', e.target.value)} /></div>
        <div class="field"><label for="ct-mail">Correo (opcional)</label><input id="ct-mail" class="input" type="email" autocomplete="email" value=${v.correo} onInput=${(e) => set('correo', e.target.value)} /></div>
      </div>
      <div><span class="flabel">¿Cómo prefieres los avisos?</span>
        <div class="radios" role="radiogroup" aria-label="Canal preferido">${CANALES.map((c) => html`<button type="button" key=${c.id} role="radio" class="radio" aria-checked=${v.canal === c.id ? 'true' : 'false'} onClick=${() => set('canal', c.id)}><span class=${'opt-ic t-' + c.tone}>${canalIc(c.id)}</span><span><b>${c.label}</b><small>${c.desc}</small></span></button>`)}</div>
      </div>
      <label class="check" for="ct-tips"><input id="ct-tips" type="checkbox" checked=${!!v.consejos} onChange=${(e) => set('consejos', e.target.checked)} /><span><b>Quiero recibir consejos de cuidado</b><small>Dos al mes como máximo, y los dejas cuando quieras.</small></span></label>
    </div>`;
  }
  function validarContacto(v) {
    if ((v.nombre || '').trim().split(/\s+/).length < 2) return 'Escribe tu nombre y tu apellido.';
    const d = digitos(v.tel);
    if (d.length < 10 || d.length > 15) return 'Escribe un teléfono válido, con su código.';
    if (v.correo && !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v.correo.trim())) return 'Revisa el correo.';
    return '';
  }
  function PagoForm({ s, act, citaId, onDone }) {
    const METHODS = metodosDe(s.clinica);
    const [m, setM] = useState('pm');
    const [banco, setBanco] = useState('');
    const [ref, setRef] = useState('');
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);
    const meth = METHODS[m];
    const c = byId(s.citas, citaId);
    const submit = async (e) => {
      if (e) e.preventDefault();
      if (busy) return;
      const v = ref.trim();
      if (meth.bank && !banco) { setErr('Elige el banco desde el que pagaste.'); return; }
      if (meth.kind === 'num' && v.replace(/\D/g, '').length < 4) { setErr(m === 'bi' ? 'Escribe el número de la orden de Binance Pay.' : 'Escribe al menos los últimos 4 dígitos de la referencia.'); return; }
      if (meth.kind === 'text' && v.length < 3) { setErr('Escribe el nombre del titular, como aparece en tu banco.'); return; }
      setBusy(true);
      try {
        await act.reportarPago(citaId, m, banco, meth.kind === 'num' ? v.replace(/\D/g, '') : v);
        if (onDone) onDone();
      } catch (x) { setErr(x.message); setBusy(false); }
    };
    return html`<form class="payform" onSubmit=${submit}>
      <div class="mtabs" role="tablist" aria-label="Método de pago">${Object.keys(METHODS).map((k) => html`<button type="button" role="tab" key=${k} class="mtab" aria-selected=${m === k ? 'true' : 'false'} onClick=${() => { setM(k); setErr(''); setRef(''); setBanco(''); }}>${METHODS[k].label}</button>`)}</div>
      <div class="paybox">
        <div class="pay-top"><span class="lbl">Monto del abono</span><p class="pay-amt">${nb(meth.amount)}</p>${meth.bs ? html`<span class="small muted">${nb('Equivale a ' + usd(s.clinica.abono_usd) + ' a la tasa BCV, Bs. ' + fmtNum(s.clinica.tasa_bcv) + ' por dólar.')}</span>` : null}</div>
        <ul class="datarows">${meth.rows.map((r) => html`<li key=${r[0]}><span class="dl">${r[0]}</span><span class="dv">${nb(r[1])}</span>${r[2] ? html`<${CopyBtn} text=${r[2]} label=${r[0]} act=${act} />` : null}</li>`)}</ul>
      </div>
      <p class="small muted m0">Paga desde tu banco con estos datos y después escribe aquí ${meth.kind === 'text' ? 'el titular de tu cuenta' : 'la referencia'}, para que el consultorio ubique el pago.</p>
      ${meth.bank ? html`<div class="field"><label for="pf-banco">Banco desde el que pagaste</label><select id="pf-banco" class="select" value=${banco} onChange=${(e) => { setBanco(e.target.value); setErr(''); }}><option value="">Elige el banco</option>${BANKS.map((b) => html`<option value=${b}>${b}</option>`)}</select></div>` : null}
      <div class="field"><label for="pf-ref">${meth.field}</label><input id="pf-ref" class="input" type="text" inputmode=${meth.kind === 'num' ? 'numeric' : 'text'} autocomplete="off" maxlength="60" placeholder=${meth.ph} value=${ref} onInput=${(e) => { setRef(e.target.value); setErr(''); }} /></div>
      ${err ? html`<p class="err" role="alert">${err}</p>` : null}
      <button type="submit" class="btn primary big block" disabled=${busy}>${busy ? 'Enviando…' : 'Ya pagué'}</button>
      ${c && c.estado === 'apartada' && c.hasta ? html`<p class="small muted center m0">${nb('La hora queda apartada ' + hastaTxt(c.hasta) + '.')}</p>` : null}
    </form>`;
  }
  function EnlaceBox({ s, act, titulo }) {
    const link = enlaceDe(s.token);
    const yo = per(s, s.yo);
    const msg = 'Mi enlace de Dentikids: ' + link;
    return html`<div class="invite-box">
      <span class="lbl">${titulo || 'Tu enlace personal'}</span>
      <div class="row"><span class="dv grow brk">${link}</span><${CopyBtn} text=${link} label="Enlace" act=${act} /></div>
      <div class="actions">${yo.tel ? html`<a class="btn" href=${waLink(yo.tel, msg)} target="_blank" rel="noopener">${I.chat(16)} Enviármelo por WhatsApp</a>` : null}</div>
      <p class="small muted m0">Con este enlace entras sin contraseña. Guárdalo y no lo compartas: quien lo tenga ve las citas de tus peques.</p>
    </div>`;
  }

  /* ---------- Inicio ---------- */
  function Hero({ s, act, c }) {
    const k = pac(s, c.pac);
    const n = dayDiff(c.fecha);
    const info = estadoInfo(s, c);
    return html`<section class=${'hero t-' + (k.star || 'blue')} aria-labelledby=${'h-' + c.id}>
      ${Stars('hero-stars')}
      <div class="hero-top">${KStar(k)}<div><span class="eyebrow">${n === 0 ? 'Tu cita de hoy' : n === 1 ? 'Tu cita de mañana' : 'Tu próxima cita'}</span><h2 id=${'h-' + c.id}>${citaTitulo(s, c)}</h2></div></div>
      <p class="hero-when">${n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : cap(shortIso(c.fecha))} · ${nb(fmt(c.min))}</p>
      <p class="hero-sub">${cap(longIso(c.fecha))} · ${s.clinica.duracion_min} minutos · ${s.clinica.nombre}, Lechería</p>
      <div class="hero-state">${info.pill}<span class="txt">${nb(info.txt)}</span></div>
      <div class="actions">
        ${(c.estado === 'apartada' || corregible(s, c)) && puede(s, c.pac, 'pagos') ? html`<button type="button" class="btn primary big" onClick=${() => act.abrir('pago', c.id)}>${I.pagos(17)} ${c.estado === 'apartada' ? 'Pagar el abono' : 'Corregir el pago'}</button>` : null}
        ${puedeAsistir(s, c) ? html`<button type="button" class="btn primary big" onClick=${() => act.asistir(c.id)}>${I.check(16)} Sí, vamos</button>` : null}
        <button type="button" class="btn big" onClick=${() => act.abrir('cita', c.id)}>Ver la cita</button>
      </div>
    </section>`;
  }
  function MiniCita({ s, act, c }) {
    const info = estadoInfo(s, c);
    return html`<button type="button" class="mini-cita" onClick=${() => act.abrir('cita', c.id)}>
      <span class="tcol"><small>${dayDiff(c.fecha) === 0 ? 'Hoy' : dayDiff(c.fecha) === 1 ? 'Mañana' : shortIso(c.fecha)}</small><b>${hm(c.min)}</b><small>${ap(c.min)}</small></span>
      <span class="stack fill"><b>${citaTitulo(s, c)}</b><span>${info.pill}</span></span>
      <span class="muted">${I.chev(18)}</span>
    </button>`;
  }
  function Inicio({ s, act }) {
    const yo = per(s, s.yo);
    const kids = misPeques(s);
    const up = proximasMias(s);
    const next = up[0];
    const rest = up.slice(1);
    const tareas = [];
    rest.forEach((c) => {
      if ((c.estado === 'apartada' || corregible(s, c)) && puede(s, c.pac, 'pagos')) tareas.push({ id: c.id, txt: (c.estado === 'apartada' ? 'Paga el abono de la ' : 'Corrige el pago de la ') + motivoOf(c.motivo).txt + ' de ' + first(pac(s, c.pac).nombre) + ', ' + relDay(c.fecha) + '.', btn: c.estado === 'apartada' ? 'Pagar' : 'Corregir', go: () => act.abrir('pago', c.id) });
      else if (puedeAsistir(s, c)) tareas.push({ id: c.id, txt: 'Confirma que van ' + relDay(c.fecha) + ' ' + alas(c.min) + '.', btn: 'Sí, vamos', go: () => act.asistir(c.id) });
    });
    const informes = Object.keys(s.informes).map((k) => s.informes[k]).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
    const ult = informes[0];
    const avs = misAvisos(s).slice(0, 3);
    return html`
      <div class="hello"><h1>Hola, ${first(yo.nombre)}</h1><p>${kids.length === 1 ? 'Aquí tienes todo lo de ' + first(kids[0].nombre) + ': sus citas, sus pagos y los avisos del consultorio.' : kids.length ? 'Aquí tienes las citas, los pagos y los avisos de tus peques.' : 'Agrega a tu peque para agendar su primera cita.'}</p></div>
      <div class="cols">
        <div class="col">
          ${next ? html`<${Hero} s=${s} act=${act} c=${next} />` : html`<section class="card"><h2>${pt('lav', I.agendar(16))}No tienes citas próximas</h2><p class="muted m0">Eliges el día y la hora en menos de un minuto.</p><div class="actions"><button type="button" class="btn primary big" onClick=${() => act.go('agendar')}>Agendar una cita</button></div></section>`}
          ${tareas.length ? html`<section class="card"><h2>${pt('pink', I.check(15))}Para hacer</h2><ul class="todo">${tareas.map((t) => html`<li key=${t.id}><span class="txt">${nb(t.txt)}</span><button type="button" class="btn primary" onClick=${t.go}>${t.btn}</button></li>`)}</ul></section>` : null}
          ${rest.length ? html`<section class="card"><h2>${pt('blue', I.cal(16))}Otras citas</h2><div class="stack gap8">${rest.map((c) => html`<${MiniCita} key=${c.id} s=${s} act=${act} c=${c} />`)}</div></section>` : null}
          ${next ? html`<button type="button" class="add" onClick=${() => act.go('agendar')}>${I.plus(18)} Agendar otra cita</button>` : null}
        </div>
        <div class="col">
          <section class="card"><h2>${pt('pink', I.peques(16))}${kids.length === 1 ? 'Tu peque' : 'Tus peques'}</h2>
            ${kids.length ? html`<div>${kids.map((k) => { const p = proximasDe(s, k.id)[0]; const v = vinDe(s, s.yo, k.id); return html`<button type="button" key=${k.id} class="krow" onClick=${() => act.abrir('peque', k.id)}>${KStar(k, 'sm')}<span class="stack fill"><b>${first(k.nombre)}</b><span class="small">${ageLabel(k.nac)} · ${p ? 'próxima cita ' + nb(relDay(p.fecha)) : 'sin citas próximas'}${v && !v.legal ? ' · eres su ' + v.parentesco.toLowerCase() : ''}</span></span><span class="chev">${I.chev(18)}</span></button>`; })}</div>` : html`<p class="empty">Todavía no hay peques en tu cuenta.</p>`}
            <button type="button" class="link" onClick=${() => act.abrir('nuevo')}>${I.plus(16)} Agregar otro peque</button>
          </section>
          ${ult ? html`<section class="card"><h2>${pt('lav', I.doc(16))}Último informe</h2><p class="m0"><b>${'Informe de la ' + motivoOf(ult.motivo).txt + ' de ' + first(pac(s, ult.pac).nombre)}</b><br /><span class="muted">${cap(fechaLarga(ult.fecha))} · ${s.clinica.doctora}</span></p><div class="actions"><button type="button" class="btn" onClick=${() => act.abrir('informe', ult.id)}>Leer el informe</button></div></section>` : null}
          <section class="card"><div class="card-h"><h2>${pt('mint', I.bell(16))}Últimos avisos</h2><button type="button" class="link" onClick=${() => act.go('avisos')}>Ver todos</button></div>
            ${avs.length ? html`<ul class="inbox">${avs.map((a) => html`<${AvisoItem} key=${a.id} s=${s} act=${act} a=${a} />`)}</ul>` : html`<p class="empty">Todavía no hay avisos.</p>`}
          </section>
        </div>
      </div>`;
  }
  function AvisoItem({ s, act, a }) {
    const t = TPL[a.tpl] || TPL.recordatorio;
    return html`<li>
      <span class=${'in-ic t-' + t.tone} aria-hidden="true">${I[t.icon](16)}</span>
      <div class="stack gap0">
        <div class="in-top">${a.nuevo ? html`<span class="in-new" aria-label="Nuevo"></span>` : null}<b>${a.nombre}</b><span class="small muted">${nb(cuandoCorto(a.fecha, a.min))} · ${a.canal === 'wa' ? 'WhatsApp' : 'En esta página'}</span></div>
        <p class="in-txt brk">${conEnlaces(a.texto)}</p>
        ${a.link && s.informes[a.link] ? html`<button type="button" class="link mt4" onClick=${() => act.abrir('informe', a.link)}>Leer el informe</button>` : null}
      </div>
    </li>`;
  }

  /* ---------- Cita ---------- */
  function CitaDetalle({ s, act, id }) {
    const c = byId(s.citas, id);
    if (!c) return html`<${Back} act=${act} /><p class="empty">Esta cita ya no existe.</p>`;
    const k = pac(s, c.pac);
    const pago = abonoDe(s, c.id);
    const pa = puede(s, c.pac, 'agenda');
    const pp = puede(s, c.pac, 'pagos');
    const viva = ['apartada', 'abono', 'confirmada'].indexOf(c.estado) >= 0 && dayDiff(c.fecha) >= 0;
    const info = viva || c.estado === 'sala' ? estadoInfo(s, c) : { pill: c.estado === 'cancelada' ? pill('neutral', 'Cancelada') : c.estado === 'no_vino' ? pill('neutral', 'No asistió') : pill('neutral', 'Atendida'), txt: c.estado === 'cancelada' ? 'Esta cita se canceló.' : 'Esta cita ya pasó.' };
    const quien = !c.por ? 'El consultorio' : c.por === s.yoNombre ? 'Tú' : c.por === 'el consultorio' ? 'El consultorio' : c.por;
    return html`<${Back} act=${act} />
      <section class=${'hero t-' + (k.star || 'blue')} aria-labelledby="h-cita">
        ${Stars('hero-stars')}
        <div class="hero-top">${KStar(k)}<div><span class="eyebrow">${motivoOf(c.motivo).label}</span><h2 id="h-cita">${citaTitulo(s, c)}</h2></div></div>
        <p class="hero-when">${dayDiff(c.fecha) === 0 ? 'Hoy' : dayDiff(c.fecha) === 1 ? 'Mañana' : cap(shortIso(c.fecha))} · ${nb(fmt(c.min))}</p>
        <div class="hero-state">${info.pill}<span class="txt">${nb(info.txt)}</span></div>
        ${viva && puedeAsistir(s, c) ? html`<div class="actions"><button type="button" class="btn primary big" onClick=${() => act.asistir(c.id)}>${I.check(16)} Sí, vamos</button></div>` : null}
      </section>
      <section class="card"><h2>${pt('blue', I.cal(16))}Detalles</h2>
        <dl class="kv">
          <dt>Peque</dt><dd>${k.nombre}, ${ageLabel(k.nac)}</dd>
          <dt>Día</dt><dd>${cap(longIso(c.fecha))}</dd>
          <dt>Hora</dt><dd>${nb(fmt(c.min))} · ${s.clinica.duracion_min} minutos</dd>
          ${c.detalle ? html`<dt>Motivo</dt><dd>${c.detalle}</dd>` : null}
          <dt>Dónde</dt><dd>${s.clinica.nombre}, con la ${s.clinica.doctora} · ${s.clinica.direccion}</dd>
          <dt>La agendó</dt><dd>${quien}</dd>
        </dl>
      </section>
      ${pp && (pago || c.estado === 'apartada') ? html`<section class="card"><h2>${pt('yel', I.pagos(16))}Abono</h2>
        ${pago ? html`<div class="row"><span class="stack fill"><b>${nb(montoDe(s, pago))}</b><span class="small muted">${METODO_LBL[pago.metodo]}${pago.banco ? ' desde ' + pago.banco : ''} · ${pago.metodo === 'ze' ? 'titular ' + pago.ref : 'referencia terminada en ' + String(pago.ref || '').slice(-4)}</span></span>${pago.estado === 'conciliado' ? pill('ok', 'Confirmado') : pago.estado === 'no aparece' ? pill('warn', 'No aparece en el banco') : pill('info', 'En verificación')}</div>` : html`<p class="muted m0">${nb('Falta pagar el abono de ' + usd(s.clinica.abono_usd) + ' para confirmar la cita. Se descuenta del total de ' + usd(s.clinica.total_usd) + '.')}</p>`}
        ${c.estado === 'apartada' || corregible(s, c) ? html`<div class="actions"><button type="button" class="btn primary big" onClick=${() => act.abrir('pago', c.id)}>${c.estado === 'apartada' ? 'Pagar el abono' : 'Corregir el pago'}</button>${corregible(s, c) ? html`<button type="button" class="btn big" onClick=${() => act.sheet('whatsapp')}>Enviar el comprobante</button>` : null}</div>` : null}
      </section>` : null}
      ${viva && pa ? html`<section class="card"><h2>${pt('lav', I.agendar(16))}Opciones</h2><div class="optlist">
        <button type="button" class="row-btn" onClick=${() => act.abrir('cambiar', c.id)}><span class="row-ic t-blue">${I.clock(16)}</span>Cambiar el día o la hora<span class="chev">${I.chev(18)}</span></button>
        <button type="button" class="row-btn" onClick=${() => act.sheet('calendario', c.id)}><span class="row-ic t-mint">${I.cal(16)}</span>Agregar al calendario<span class="chev">${I.chev(18)}</span></button>
        <button type="button" class="row-btn" onClick=${() => act.sheet('llegar')}><span class="row-ic t-pink">${I.pin(16)}</span>Cómo llegar<span class="chev">${I.chev(18)}</span></button>
        <button type="button" class="row-btn" onClick=${() => act.sheet('whatsapp')}><span class="row-ic t-yel">${I.chat(16)}</span>Escribir al consultorio<span class="chev">${I.chev(18)}</span></button>
        <button type="button" class="row-btn danger" onClick=${() => act.sheet('cancelar', c.id)}><span class="row-ic t-peach">${I.close(16)}</span>Cancelar la cita<span class="chev">${I.chev(18)}</span></button>
      </div></section>` : null}
      ${viva && c.motivo === 'primera' ? html`<section class="card"><h2>${pt('pink', I.tooth(16))}Para la primera visita</h2><ul class="tips">
        <li>Llega diez minutos antes, así llenas la ficha con calma.</li>
        <li>Trae tu cédula y, si los tienes, informes de otros médicos.</li>
        <li>${'Si ' + first(k.nombre) + ' toma algún medicamento, anótalo para contárselo a la doctora.'}</li>
      </ul></section>` : null}`;
  }
  function Cambiar({ s, act, id }) {
    const c = byId(s.citas, id);
    const [sel, setSel] = useState({ dia: null, min: null });
    const [ronda, setRonda] = useState(0);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const h = useHoras(s.token, id, ronda);
    if (!c) return html`<${Back} act=${act} /><p class="empty">Esta cita ya no existe.</p>`;
    const go = async () => {
      setBusy(true); setErr('');
      try { await act.cambiar(id, sel.dia, sel.min); } catch (e) { setErr(e.message); setBusy(false); setSel({ dia: sel.dia, min: null }); setRonda(ronda + 1); }
    };
    return html`<${Back} act=${act} />
      <div class="ph"><h1>Cambiar la cita</h1><p>${nb(citaTitulo(s, c) + '. Ahora está para el ' + longIso(c.fecha) + ' ' + alas(c.min) + '.')}</p></div>
      <section class="card"><${Picker} h=${h} dia=${sel.dia} min=${sel.min} onPick=${(d, m) => { setErr(''); setSel({ dia: d, min: m }); }} />
        ${err ? html`<p class="err" role="alert">${err}</p>` : null}
        <button type="button" class="btn primary big block" disabled=${!sel.min || busy} onClick=${go}>${busy ? 'Cambiando…' : sel.min ? nb('Cambiar al ' + shortIso(sel.dia) + ', ' + fmt(sel.min)) : 'Elige una hora'}</button>
      </section>`;
  }
  function PagoSub({ s, act, id }) {
    const c = byId(s.citas, id);
    if (!c || !(c.estado === 'apartada' || corregible(s, c))) return html`<${Back} act=${act} /><section class="card"><p class="empty">Este abono ya se reportó.</p></section>`;
    const corr = c.estado !== 'apartada';
    return html`<${Back} act=${act} />
      <div class="ph"><h1>${corr ? 'Corrige el pago' : 'Paga el abono'}</h1><p>${nb(citaTitulo(s, c) + ' · ' + cap(longIso(c.fecha)) + ', ' + fmt(c.min) + '. ' + (corr ? 'El consultorio no encontró el pago anterior en su banco; revisa los datos y vuelve a escribir la referencia.' : 'El abono de ' + usd(s.clinica.abono_usd) + ' se descuenta del total de ' + usd(s.clinica.total_usd) + '.'))}</p></div>
      <section class="card"><${PagoForm} s=${s} act=${act} citaId=${id} onDone=${() => { act.back(); act.say('Recibimos tu reporte. Te avisamos cuando el consultorio confirme el abono.'); }} /></section>`;
  }

  /* ---------- Agendar ---------- */
  function Agendar({ s, act, nueva }) {
    const b = s.book;
    const set = (patch) => act.setBook(Object.assign({ err: '' }, patch));
    const h = useHoras(s.token, null, b.ronda);
    if (b.step === 'pago') {
      const c = byId(s.citas, b.cita);
      if (!c) return html`<p class="empty">Cargando la cita…</p>`;
      return html`<div class="ph"><h1>Paga el abono</h1><p>${nb('Apartamos el ' + longIso(c.fecha) + ' ' + alas(c.min) + '. Con el abono de ' + usd(s.clinica.abono_usd) + ' la cita queda confirmada, y se descuenta del total de ' + usd(s.clinica.total_usd) + '.')}</p></div>
        <section class="card"><${PagoForm} s=${s} act=${act} citaId=${b.cita} onDone=${() => act.setBook({ step: 'listo' })} />
          <button type="button" class="link center-self" onClick=${() => act.setBook({ step: 'listo' })}>Pagar más tarde</button></section>`;
    }
    if (b.step === 'listo') return html`<${Listo} s=${s} act=${act} />`;
    const kids = nueva ? [] : misPeques(s).filter((k) => puede(s, k.id, 'agenda'));
    const pasos = nueva ? ['quien', 'motivo', 'hora', 'contacto', 'revisa'] : ['quien', 'motivo', 'hora', 'revisa'];
    const LBL = { quien: '¿Para quién es?', motivo: 'Motivo', hora: 'Día y hora', contacto: 'Tus datos', revisa: 'Revisa y aparta' };
    const idx = pasos.indexOf(b.step) + 1;
    const kidName = b.pac === 'nuevo' ? first(b.nuevo.nombre) || 'tu peque' : first(pac(s, b.pac).nombre);
    const canPay = b.pac === 'nuevo' || (b.pac && puede(s, b.pac, 'pagos'));
    const err = b.err ? html`<p class="err" role="alert">${b.err}</p>` : null;
    const atras = (step) => html`<button type="button" class="btn ghost" onClick=${() => set({ step: step })}>${I.back(16)} Atrás</button>`;
    let body = null;
    if (b.step === 'quien') {
      body = html`<h2>${nueva ? 'Cuéntanos de tu peque' : '¿Para quién es la cita?'}</h2>
        ${nueva ? null : html`<div class="opts">
          ${kids.map((k) => html`<button type="button" key=${k.id} class="opt" aria-pressed=${b.pac === k.id ? 'true' : 'false'} onClick=${() => set({ pac: k.id })}>${KStar(k, 'sm')}<span><b>${first(k.nombre)}</b><span class="small">${ageLabel(k.nac)}</span></span></button>`)}
          <button type="button" class="opt" aria-pressed=${b.pac === 'nuevo' ? 'true' : 'false'} onClick=${() => set({ pac: 'nuevo', motivo: null })}><span class="opt-ic t-lav">${I.plus(18)}</span><span><b>Otro peque</b><span class="small">Lo agregamos a tu cuenta</span></span></button>
        </div>`}
        ${b.pac === 'nuevo' ? html`<${NuevoForm} v=${b.nuevo} onChange=${(v) => set({ nuevo: v })} />` : null}
        ${err}
        <div class="actions end"><button type="button" class="btn primary big" onClick=${act.bookNext}>Continuar</button></div>`;
    } else if (b.step === 'motivo') {
      body = html`<h2>${'¿Por qué quieres llevar a ' + kidName + '?'}</h2>
        <div class="opts">${MOTIVOS.filter((m) => !m.oculto).map((m) => html`<button type="button" key=${m.id} class="opt" aria-pressed=${b.motivo === m.id ? 'true' : 'false'} onClick=${() => set({ motivo: m.id })}><span class=${'opt-ic t-' + m.tone}>${I[m.icon](18)}</span><span><b>${m.label}</b><span class="small">${m.desc}</span></span></button>`)}</div>
        ${b.motivo === 'urgencia' ? html`<div class="note">Si es una urgencia no hace falta agendar: escríbenos por WhatsApp y te atendemos lo antes posible.<button type="button" class="link" onClick=${() => act.sheet('whatsapp')}>Ver el WhatsApp del consultorio</button></div>` : null}
        ${err}
        <div class="actions between">${atras('quien')}${b.motivo !== 'urgencia' ? html`<button type="button" class="btn primary big" onClick=${act.bookNext}>Continuar</button>` : null}</div>`;
    } else if (b.step === 'hora') {
      body = html`<h2>Elige el día y la hora</h2>
        <${Picker} h=${h} dia=${b.dia} min=${b.min} onPick=${(d, m) => set({ dia: d, min: m })} />
        ${err}
        <div class="actions between">${atras('motivo')}<button type="button" class="btn primary big" onClick=${act.bookNext}>Continuar</button></div>`;
    } else if (b.step === 'contacto') {
      body = html`<h2>Tus datos</h2>
        <p class="muted m0">Con ellos te enviamos los avisos y te creamos tu enlace personal, sin contraseña.</p>
        <${ContactoForm} v=${b.contacto} onChange=${(v) => set({ contacto: v })} />
        ${err}
        <div class="actions between">${atras('hora')}<button type="button" class="btn primary big" onClick=${act.bookNext}>Continuar</button></div>`;
    } else {
      body = html`<h2>Revisa y aparta la hora</h2>
        <dl class="kv">
          <dt>Peque</dt><dd>${b.pac === 'nuevo' ? titleCase(b.nuevo.nombre.trim()) : pac(s, b.pac).nombre}</dd>
          <dt>Motivo</dt><dd>${motivoOf(b.motivo).label}</dd>
          <dt>Día</dt><dd>${cap(longIso(b.dia))}</dd>
          <dt>Hora</dt><dd>${nb(fmt(b.min))} · ${s.clinica.duracion_min} minutos</dd>
          <dt>Dónde</dt><dd>${s.clinica.nombre}, Lechería</dd>
          ${nueva ? html`<dt>Avisos para</dt><dd>${titleCase(b.contacto.nombre.trim())} · ${telTxt(b.contacto.tel)}</dd>` : null}
        </dl>
        <div class="paynote"><b>${nb('Abono de ' + usd(s.clinica.abono_usd))}</b><span>${nb('Aparta la hora y se descuenta del total de ' + usd(s.clinica.total_usd) + '. Hoy equivale a Bs. ' + fmtNum(Number(s.clinica.abono_usd) * Number(s.clinica.tasa_bcv)) + ' a la tasa BCV.')}</span></div>
        ${canPay ? null : html`<div class="note">${'Al apartar, ' + nombres(legalesDe(s, b.pac)) + ' recibe el aviso para pagar el abono.'}</div>`}
        ${err}
        <div class="actions between">${atras(nueva ? 'contacto' : 'hora')}<button type="button" class="btn primary big" disabled=${b.busy} onClick=${act.apartar}>${b.busy ? 'Apartando…' : 'Apartar la hora'}</button></div>`;
    }
    return html`
      <div class="ph"><h1>Agenda una cita</h1><p>${'Eliges el día y la hora en menos de un minuto. La ' + s.clinica.doctora + ' atiende a niños y adolescentes en Lechería.'}</p></div>
      <div class="stepper"><span class="step-lbl">${'Paso ' + idx + ' de ' + pasos.length + ' · ' + LBL[b.step]}</span><div class="steps" aria-hidden="true">${pasos.map((p, i) => html`<i key=${p} class=${i < idx ? 'on' : ''}></i>`)}</div></div>
      <section class="card">${body}</section>`;
  }
  function Listo({ s, act }) {
    const b = s.book;
    const c = byId(s.citas, b.cita);
    if (!c) return html`<p class="empty">Cargando la cita…</p>`;
    const k = pac(s, c.pac);
    const yo = per(s, s.yo);
    const pagado = c.estado === 'abono' || c.estado === 'confirmada';
    const pp = puede(s, c.pac, 'pagos');
    const txt = 'Apartamos el ' + longIso(c.fecha) + ' ' + alas(c.min) + ' para ' + first(k.nombre) + '. ' + (pagado ? avisoPor(s) : pp ? 'La hora queda apartada ' + hastaTxt(c.hasta) + '; puedes pagar el abono desde el inicio.' : nombres(legalesDe(s, c.pac)) + ' recibió el aviso para pagar el abono, y la hora queda apartada ' + hastaTxt(c.hasta) + '.');
    return html`<section class="card done">${Stars()}<h1>${'Listo, ' + first(yo.nombre)}</h1>
      <p>${nb(txt)}</p>
      ${b.nuevaCuenta ? html`<${EnlaceBox} s=${s} act=${act} titulo="Guarda tu enlace personal" />` : null}
      <div class="actions center"><button type="button" class="btn primary big" onClick=${() => act.verCita(c.id)}>Ver la cita</button><button type="button" class="btn big" onClick=${act.otraReserva}>Agendar otra</button></div>
    </section>`;
  }

  /* ---------- Peques ---------- */
  function Peques({ s, act }) {
    const kids = misPeques(s);
    return html`<div class="ph"><h1>${kids.length === 1 ? 'Tu peque' : 'Tus peques'}</h1><p>Cada peque tiene su ficha, con sus citas, sus informes y las personas que lo pueden traer.</p></div>
      <ul class="kids">${kids.map((k) => { const p = proximasDe(s, k.id)[0]; const gente = s.vinculos.filter((v) => v.pac === k.id && v.estado === 'activo').map((v) => per(s, v.per)); return html`<li key=${k.id}><button type="button" class="kid-card" onClick=${() => act.abrir('peque', k.id)}>${KStar(k)}<span class="stack"><b>${first(k.nombre)}</b><span class="small muted">${ageLabel(k.nac)} · ${p ? 'próxima cita ' + nb(relDay(p.fecha)) + ', ' + nb(fmt(p.min)) : 'sin citas próximas'}</span><span class="faces">${gente.map((g, i) => html`<span key=${i}>${Av(g)}</span>`)}</span></span><span class="muted">${I.chev(18)}</span></button></li>`; })}</ul>
      <button type="button" class="add" onClick=${() => act.abrir('nuevo')}>${I.plus(18)} Agregar otro peque</button>`;
  }
  function Peque({ s, act, id }) {
    const k = pac(s, id);
    const v = vinDe(s, s.yo, id);
    if (!v) return html`<${Back} act=${act} /><p class="empty">No tienes acceso a esta ficha.</p>`;
    const prox = proximasDe(s, id);
    const past = pasadasDe(s, id);
    const gente = s.vinculos.filter((x) => x.pac === id && (x.estado === 'activo' || x.estado === 'invitado'));
    const ph = puede(s, id, 'historia');
    const lockTxt = v.legal && !v.legalConfirmado
      ? { b: 'Los informes se activan después de la primera visita', p: 'En la consulta, la doctora confirma que eres su representante legal; desde ese momento los ves aquí.' }
      : { b: 'Los informes los ven sus representantes legales', p: nombres(legalesDe(s, id)) + ' puede leerlos.' };
    return html`<${Back} act=${act} />
      <div class="kid-head">${KStar(k, 'big')}<div><h1>${k.nombre}</h1><p>${ageLabel(k.nac)} · nació el ${dmy(k.nac)}</p></div></div>
      <div class="cols">
        <div class="col">
          <section class="card"><h2>${pt('blue', I.cal(16))}Próximas citas</h2>
            ${prox.length ? html`<div class="stack gap8">${prox.map((c) => html`<${MiniCita} key=${c.id} s=${s} act=${act} c=${c} />`)}</div>` : html`<p class="empty">No tiene citas próximas.</p>`}
            ${v.permisos.agenda ? html`<div class="actions"><button type="button" class="btn" onClick=${() => act.agendarPara(id)}>${I.plus(16)} Agendar una cita</button></div>` : null}
          </section>
          <section class="card"><h2>${pt('lav', I.doc(16))}Visitas anteriores</h2>
            ${past.length ? html`<ul class="list">${past.map((c) => html`<li key=${c.id}><div class="row"><span class="stack grow"><b>${motivoOf(c.motivo).label}</b><span class="small muted">${cap(fechaLarga(c.fecha))} · ${nb(fmt(c.min))}</span></span>${c.informe && ph ? html`<button type="button" class="btn" onClick=${() => act.abrir('informe', c.informe)}>Leer el informe</button>` : null}</div></li>`)}</ul>` : html`<p class="empty">Todavía no tiene visitas.</p>`}
            ${(past.length || k.tieneInformes) && !ph ? html`<div class="lock"><span class="lock-ic">${I.lock(18)}</span><span><b>${lockTxt.b}</b><p>${lockTxt.p}</p></span></div>` : null}
          </section>
        </div>
        <div class="col">
          <section class="card"><h2>${pt('pink', I.peques(16))}Personas vinculadas</h2>
            <ul class="list">${gente.map((x) => { const p = x.per ? per(s, x.per) : { id: x.id, nombre: x.invitado }; return html`<li key=${x.id}><div class="row">${Av(p)}<span class="stack grow"><b>${p.nombre}${x.per === s.yo ? ' (tú)' : ''}</b><span class="small muted">${x.parentesco}${x.legal ? ' · representante legal' : ''}</span></span>${x.estado === 'invitado' ? pill('warn', 'Invitación enviada') : null}</div><div class="row mt8">${PERMS.map((pm) => html`<span key=${pm.id}>${pill(x.permisos[pm.id] ? 'info' : 'off', pm.short)}</span>`)}</div></li>`; })}</ul>
            ${v.legal ? html`<button type="button" class="btn" onClick=${() => act.abrir('invitar', id)}>${I.user(16)} Invitar a alguien</button>` : html`<p class="small muted m0">${'Para invitar a alguien más, pídeselo a ' + nombres(legalesDe(s, id)) + '.'}</p>`}
          </section>
          <section class="card"><h2>${pt('yel', I.star(16))}Datos</h2>
            <dl class="kv"><dt>Nació</dt><dd>${cap(fechaLarga(k.nac))}</dd><dt>Alergias</dt><dd>${k.alergias}</dd><dt>Tú eres su</dt><dd>${v.parentesco.toLowerCase()}</dd></dl>
            <p class="small muted m0">Para corregir un dato, escríbele al consultorio.</p>
          </section>
        </div>
      </div>`;
  }
  function NuevoPeque({ s, act }) {
    const [v, setV] = useState({ nombre: '', nac: '', par: 'Mamá', legal: true });
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);
    const save = async () => {
      const e = validarPeque(v);
      if (e) { setErr(e); return; }
      setBusy(true);
      try { await act.agregarPeque(v); } catch (x) { setErr(x.message); setBusy(false); }
    };
    return html`<${Back} act=${act} />
      <div class="ph"><h1>Agregar otro peque</h1><p>Cuéntanos de tu peque. Solo lo pedimos la primera vez.</p></div>
      <section class="card"><${NuevoForm} v=${v} onChange=${(x) => { setV(x); setErr(''); }} />${err ? html`<p class="err" role="alert">${err}</p>` : null}<div class="actions end"><button type="button" class="btn primary big" disabled=${busy} onClick=${save}>${busy ? 'Agregando…' : 'Agregar'}</button></div></section>`;
  }
  function Invitar({ s, act, id }) {
    const k = pac(s, id);
    const [nombre, setNombre] = useState('');
    const [par, setPar] = useState('Abuela');
    const [perm, setPerm] = useState({ avisos: true, agenda: true, pagos: false, historia: false });
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);
    const [hecho, setHecho] = useState(null);
    if (hecho) {
      const link = window.location.origin + '/i/' + hecho.inv;
      const msg = 'Hola, ' + first(hecho.nombre) + '. Te invito a ver las citas de ' + first(k.nombre) + ' en Dentikids desde este enlace: ' + link + ' (vence en 24 horas).';
      return html`<${Back} act=${act} />
        <div class="ph"><h1>${'Invitación para ' + first(hecho.nombre)}</h1><p>Envíale este enlace desde tu WhatsApp. Cuando lo abra y acepte, quedará vinculada a la ficha con los permisos que elegiste.</p></div>
        <section class="card"><div class="invite-box"><span class="lbl">Enlace</span><div class="row"><span class="dv grow brk">${link}</span><${CopyBtn} text=${link} label="Enlace" act=${act} /></div></div>
          <div class="invite-box"><span class="lbl">Mensaje para enviar</span><span class="dv">${msg}</span><div class="actions"><a class="btn wa" href=${'https://wa.me/?text=' + encodeURIComponent(msg)} target="_blank" rel="noopener">${I.send(15)} Enviar por WhatsApp</a><${CopyBtn} text=${msg} label="Mensaje" act=${act} /></div></div>
          <p class="small muted m0">El enlace sirve una sola vez y vence en 24 horas.</p>
          <div class="actions end"><button type="button" class="btn primary big" onClick=${act.back}>Listo</button></div>
        </section>`;
    }
    const save = async () => {
      if (nombre.trim().length < 3) { setErr('Escribe el nombre de la persona.'); return; }
      setBusy(true);
      try {
        const r = await act.invitar(id, titleCase(nombre.trim()), par, perm);
        setHecho({ inv: r.invitacion, nombre: titleCase(nombre.trim()) });
      } catch (x) { setErr(x.message); setBusy(false); }
    };
    return html`<${Back} act=${act} />
      <div class="ph"><h1>Invitar a alguien</h1><p>${'Para que también pueda ver lo que tú elijas sobre ' + first(k.nombre) + '. Le enviarás un enlace desde tu propio WhatsApp.'}</p></div>
      <section class="card">
        <div class="grid2">
          <div class="field"><label for="iv-nombre">Nombre</label><input id="iv-nombre" class="input" type="text" autocomplete="off" maxlength="80" value=${nombre} onInput=${(e) => { setNombre(e.target.value); setErr(''); }} /></div>
          <div class="field"><label for="iv-par">${'Parentesco con ' + first(k.nombre)}</label><select id="iv-par" class="select" value=${par} onChange=${(e) => setPar(e.target.value)}>${PARENTESCOS.map((p) => html`<option value=${p}>${p}</option>`)}</select></div>
        </div>
        <div><span class="flabel">Qué puede hacer</span>
          ${PERMS.map((pm) => html`<label key=${pm.id} class=${'check' + (pm.id === 'historia' ? ' off' : '')} for=${'iv-' + pm.id}><input id=${'iv-' + pm.id} type="checkbox" disabled=${pm.id === 'historia'} checked=${!!perm[pm.id]} onChange=${(e) => setPerm(Object.assign({}, perm, { [pm.id]: e.target.checked }))} /><span><b>${pm.label}</b>${pm.help ? html`<small>${pm.help}</small>` : null}</span></label>`)}
        </div>
        ${err ? html`<p class="err" role="alert">${err}</p>` : null}
        <div class="actions end"><button type="button" class="btn primary big" disabled=${busy} onClick=${save}>${busy ? 'Creando…' : 'Crear la invitación'}</button></div>
      </section>`;
  }
  function Informe({ s, act, id }) {
    const [st, setSt] = useState({ inf: null, err: '' });
    useEffect(() => {
      let vivo = true;
      api('fam_informe', { p_token: s.token, p_informe: id }).then((inf) => { if (vivo) setSt({ inf: inf, err: '' }); }, (e) => { if (vivo) setSt({ inf: null, err: e.message }); });
      return () => { vivo = false; };
    }, [id]);
    if (st.err) return html`<${Back} act=${act} /><div class="lock"><span class="lock-ic">${I.lock(18)}</span><span><b>No se pudo abrir el informe</b><p>${st.err}</p></span></div>`;
    if (!st.inf) return html`<${Back} act=${act} /><p class="empty">Abriendo el informe…</p>`;
    const inf = st.inf;
    return html`<${Back} act=${act} />
      <article class="card report">
        <header><span class="eyebrow t-lav">Informe de consulta</span><h1>${cap(motivoOf(inf.motivo).txt) + ' de ' + first(inf.peque)}</h1><p>${cap(longIso(inf.fecha)) + ' · ' + inf.firma + ', odontopediatra'}</p></header>
        <section><h2>Lo que vimos</h2><p>${inf.vimos}</p></section>
        ${inf.hicimos ? html`<section><h2>Lo que hicimos</h2><p>${inf.hicimos}</p></section>` : null}
        ${inf.casa && inf.casa.length ? html`<section><h2>Para la casa</h2><ul>${inf.casa.map((x, i) => html`<li key=${i}>${x}</li>`)}</ul></section>` : null}
        ${inf.proximo ? html`<section><h2>Próximo control</h2><p>${inf.proximo}</p></section>` : null}
      </article>`;
  }

  /* ---------- Pagos y avisos ---------- */
  function Pagos({ s, act }) {
    const kids = misPeques(s);
    const conPagos = kids.filter((k) => puede(s, k.id, 'pagos'));
    const sinPagos = kids.filter((k) => !puede(s, k.id, 'pagos'));
    const pend = proximasMias(s).filter((c) => (c.estado === 'apartada' || corregible(s, c)) && puede(s, c.pac, 'pagos'));
    const ab = usd(s.clinica.abono_usd);
    const resto = usd(Number(s.clinica.total_usd) - Number(s.clinica.abono_usd));
    return html`<div class="ph"><h1>Pagos</h1><p>${nb('El abono de cada cita es de ' + ab + ' y aparta la hora; el resto, ' + resto + ', se paga en el consultorio.')}</p></div>
      <div class="cols">
        <div class="col">
          ${pend.length ? html`<section class="card"><h2>${pt('pink', I.check(15))}Por pagar</h2><ul class="todo">${pend.map((c) => html`<li key=${c.id}><span class="txt">${nb((c.estado === 'apartada' ? 'Abono de ' + ab : 'Pago por corregir') + ' · ' + motivoOf(c.motivo).txt + ' de ' + first(pac(s, c.pac).nombre) + ', ' + relDay(c.fecha))}</span><button type="button" class="btn primary" onClick=${() => act.abrir('pago', c.id)}>${c.estado === 'apartada' ? 'Pagar' : 'Corregir'}</button></li>`)}</ul></section>` : null}
          ${conPagos.map((k) => { const ps = s.pagos.filter((p) => p.pac === k.id).sort(desc); return html`<section class="card" key=${k.id}><h2>${KStar(k, 'sm')}${first(k.nombre)}</h2>${ps.length ? html`<ul class="list">${ps.map((p) => { const c = byId(s.citas, p.cita); return html`<li key=${p.id}><div class="row"><span class="stack grow"><b>${(p.tipo === 'abono' ? 'Abono' : 'Resto de la consulta') + (c ? ' · ' + motivoOf(c.motivo).label.toLowerCase() : '')}</b><span class="small muted">${cap(fechaLarga(p.fecha))} · ${METODO_LBL[p.metodo]}</span></span><span class="stack end-items"><b>${nb(montoDe(s, p))}</b>${p.estado === 'conciliado' ? pill('ok', 'Confirmado') : p.estado === 'por verificar' ? pill('info', 'En verificación') : pill('warn', 'Por revisar')}</span></div></li>`; })}</ul>` : html`<p class="empty">Todavía no hay pagos.</p>`}</section>`; })}
          ${sinPagos.map((k) => html`<div class="lock" key=${k.id}><span class="lock-ic">${I.lock(18)}</span><span><b>${'Los pagos de ' + first(k.nombre) + ' los maneja ' + nombres(legalesDe(s, k.id))}</b><p>Tú puedes ver y cambiar sus citas, y recibes sus avisos.</p></span></div>`)}
        </div>
        <div class="col">
          <section class="card"><h2>${pt('yel', I.pagos(16))}Cómo se paga</h2>
            <ul class="list">
              <li><b>Pago Móvil o transferencia</b><br /><span class="small muted">${nb('En bolívares, a la tasa BCV del día. Hoy el abono son Bs. ' + fmtNum(Number(s.clinica.abono_usd) * Number(s.clinica.tasa_bcv)) + '.')}</span></li>
              <li><b>Zelle o Binance Pay</b><br /><span class="small muted">${nb(ab + ' o ' + Number(s.clinica.abono_usd) + ' USDT, sin conversión.')}</span></li>
              <li><b>Efectivo</b><br /><span class="small muted">Solo para el resto, en el consultorio.</span></li>
            </ul>
            <p class="small muted m0">Después de pagar escribes la referencia aquí, y el consultorio la confirma con su banco.</p>
          </section>
        </div>
      </div>`;
  }
  function Avisos({ s, act }) {
    const yo = per(s, s.yo);
    const avs = misAvisos(s);
    const unread = sinLeer(s);
    const [salir, setSalir] = useState(false);
    useEffect(() => { if (unread) { const t = setTimeout(act.leerAvisos, 1200); return () => clearTimeout(t); } return undefined; }, [unread]);
    return html`<div class="ph"><h1>Avisos</h1><p>Todo lo que el consultorio te envía queda aquí, y aquí eliges por dónde te llega.</p></div>
      <div class="cols">
        <div class="col">
          <section class="card"><h2>${pt('mint', I.bell(16))}Recibidos</h2>${avs.length ? html`<ul class="inbox">${avs.map((a) => html`<${AvisoItem} key=${a.id} s=${s} act=${act} a=${a} />`)}</ul>` : html`<p class="empty">Todavía no hay avisos.</p>`}</section>
        </div>
        <div class="col">
          <section class="card"><h2>${pt('lav', I.chat(16))}Cómo te avisamos</h2>
            <div class="radios" role="radiogroup" aria-label="Canal preferido">${CANALES.map((c) => html`<button type="button" key=${c.id} role="radio" class="radio" aria-checked=${s.prefs.canal === c.id ? 'true' : 'false'} onClick=${() => act.setPref('canal', c.id)}><span class=${'opt-ic t-' + c.tone}>${canalIc(c.id)}</span><span><b>${c.label}</b><small>${c.desc}</small></span></button>`)}</div>
            <label class="switch" for="pf-tips"><span><b>Consejos de cuidado</b><small>Dos al mes como máximo; puedes dejarlos cuando quieras.</small></span><input id="pf-tips" type="checkbox" checked=${!!s.prefs.consejos} onChange=${(e) => act.setPref('consejos', e.target.checked)} /></label>
          </section>
          <section class="card"><h2>${pt('pink', I.user(16))}Tus datos</h2>
            <dl class="kv"><dt>Nombre</dt><dd>${yo.nombre}</dd><dt>Teléfono</dt><dd>${telTxt(yo.tel)}</dd><dt>Correo</dt><dd>${yo.correo || 'Sin correo'}</dd></dl>
            <p class="small muted m0">Para corregir un dato, escríbele al consultorio.</p>
            <${EnlaceBox} s=${s} act=${act} />
            <p class="small muted m0">Si pierdes el enlace, el consultorio te envía uno nuevo y el anterior deja de funcionar.</p>
            ${salir ? html`<div class="note">En este teléfono se borrará el acceso guardado; para volver a entrar tendrás que abrir tu enlace.<div class="actions"><button type="button" class="btn" onClick=${() => setSalir(false)}>Cancelar</button><button type="button" class="btn ghost danger-txt" onClick=${act.salir}>Sí, salir</button></div></div>` : html`<button type="button" class="link" onClick=${() => setSalir(true)}>Salir en este teléfono</button>`}
          </section>
        </div>
      </div>`;
  }

  /* ---------- Calendario ---------- */
  const icsTxt = (t) => String(t || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const utcStamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  function citaMs(c) { const dt = parseIso(c.fecha); return dt.getTime() + (c.min + 240) * 60000; }
  function icsDe(s, c) {
    const k = pac(s, c.pac);
    const ini = citaMs(c);
    const fin = ini + Number(s.clinica.duracion_min || 45) * 60000;
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Dentikids//Citas//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
      'UID:cita-' + c.id + '@dentikids', 'DTSTAMP:' + utcStamp(Date.now()), 'DTSTART:' + utcStamp(ini), 'DTEND:' + utcStamp(fin),
      'SUMMARY:' + icsTxt(cap(motivoOf(c.motivo).txt) + ' de ' + first(k.nombre) + ' en ' + s.clinica.nombre),
      'LOCATION:' + icsTxt(s.clinica.direccion), 'DESCRIPTION:' + icsTxt('Con la ' + s.clinica.doctora + '. Todo lo de la cita: ' + enlaceDe(s.token)),
      'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsTxt('Mañana es la cita de ' + first(k.nombre)), 'END:VALARM',
      'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsTxt('En dos horas es la cita de ' + first(k.nombre)), 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'].join('\r\n') + '\r\n';
  }
  function gcalDe(s, c) {
    const k = pac(s, c.pac);
    const ini = citaMs(c);
    const fin = ini + Number(s.clinica.duracion_min || 45) * 60000;
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(cap(motivoOf(c.motivo).txt) + ' de ' + first(k.nombre) + ' en ' + s.clinica.nombre) + '&dates=' + utcStamp(ini) + '/' + utcStamp(fin) + '&location=' + encodeURIComponent(s.clinica.direccion) + '&details=' + encodeURIComponent('Con la ' + s.clinica.doctora + '.');
  }
  function descargarIcs(text) {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (ios) { window.location.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(text); return; }
    const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cita-dentikids.ics';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }

  /* ---------- Ventanas ---------- */
  function Sheet({ s, act }) {
    const sh = s.sheet;
    const c = sh.id ? byId(s.citas, sh.id) : null;
    const ref = useRef(null);
    const [busy, setBusy] = useState(false);
    useEffect(() => { const b = ref.current && ref.current.querySelector('button, a'); if (b) b.focus(); }, [sh.kind]);
    const cl = s.clinica;
    let body = null;
    if (sh.kind === 'llegar') {
      body = html`<h2>${pt('pink', I.pin(16))}Cómo llegar</h2><p>${cl.nombre}, consultorio de la ${cl.doctora}.</p><div class="row"><span class="dv grow">${cl.direccion}</span><${CopyBtn} text=${cl.direccion} label="Dirección" act=${act} /></div>
        <a class="btn primary big block" href=${'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(cl.direccion)} target="_blank" rel="noopener">${I.pin(16)} Abrir en el mapa</a>`;
    } else if (sh.kind === 'whatsapp') {
      body = html`<h2>${pt('yel', I.chat(16))}Escribir al consultorio</h2>${cl.whatsapp ? html`<p>El consultorio responde por WhatsApp en horario de consulta.</p><div class="row"><span class="dv grow">${telTxt(cl.whatsapp)}</span><${CopyBtn} text=${cl.whatsapp} label="Número" act=${act} /></div>
        <a class="btn wa big block" href=${waLink(cl.whatsapp, s.yoNombre ? 'Hola, soy ' + first(s.yoNombre) + '. ' : '')} target="_blank" rel="noopener">${I.send(15)} Abrir WhatsApp</a>` : html`<p>El consultorio todavía no publicó su número de WhatsApp en esta página.</p>`}`;
    } else if (sh.kind === 'calendario' && c) {
      body = html`<h2>${pt('mint', I.cal(16))}Agregar al calendario</h2><p>${nb('La cita del ' + longIso(c.fecha) + ' ' + alas(c.min) + ' queda en tu calendario, con un aviso el día anterior.')}</p>
        <div class="stack gap8"><button type="button" class="btn primary big block" onClick=${() => { descargarIcs(icsDe(s, c)); act.say('Listo. Abre el archivo para guardar la cita en tu calendario.'); }}>${I.cal(16)} Calendario del teléfono</button>
        <a class="btn big block" href=${gcalDe(s, c)} target="_blank" rel="noopener">Google Calendar</a></div>`;
    } else if (sh.kind === 'cancelar' && c) {
      const pago = abonoDe(s, c.id);
      body = html`<h2>${pt('peach', I.close(16))}Cancelar la cita</h2><p>${nb('¿Cancelar la ' + motivoOf(c.motivo).txt + ' de ' + first(pac(s, c.pac).nombre) + ' del ' + longIso(c.fecha) + ' ' + alas(c.min) + '?')}</p>${pago && pago.estado === 'conciliado' ? html`<p class="small muted">Escríbele al consultorio para dejar el abono a favor de la próxima cita.</p>` : null}
        <div class="actions"><button type="button" class="btn big" onClick=${act.cerrarSheet}>No, mantenerla</button><button type="button" class="btn ghost big danger-txt" disabled=${busy} onClick=${async () => { setBusy(true); try { await act.cancelar(c.id); } catch (e) { setBusy(false); act.say(e.message); } }}>${busy ? 'Cancelando…' : 'Sí, cancelar'}</button></div>`;
    }
    return html`<div class="scrim" onClick=${(e) => { if (e.target === e.currentTarget) act.cerrarSheet(); }}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label="Detalle" ref=${ref}>${body}${sh.kind !== 'cancelar' ? html`<button type="button" class="btn big block" onClick=${act.cerrarSheet}>Cerrar</button>` : null}</div>
    </div>`;
  }

  /* ---------- Pantallas sin cuenta ---------- */
  function Landing({ s, act }) {
    const cl = s.clinica;
    return html`<section class=${'hero t-lav'} aria-labelledby="h-land">
        ${Stars('hero-stars')}
        <span class="eyebrow">Odontopediatría en Lechería</span>
        <h1 id="h-land" class="land-h">Agenda la cita de tu peque</h1>
        <p class="hero-sub">${nb('La ' + cl.doctora + ' atiende a niños y adolescentes. Eliges el día y la hora, apartas con un abono de ' + usd(cl.abono_usd) + ' y recibes los avisos por WhatsApp.')}</p>
        <div class="actions"><button type="button" class="btn primary big" onClick=${act.empezar}>${I.agendar(17)} Agendar una cita</button></div>
      </section>
      <section class="card"><h2>${pt('blue', I.lock(16))}¿Ya tienes cuenta?</h2>
        <p class="muted m0">Entra con el enlace personal que te enviamos por WhatsApp. Si no lo encuentras, escríbele al consultorio y te enviamos uno nuevo.</p>
        <div class="actions"><button type="button" class="btn" onClick=${() => act.sheet('whatsapp')}>${I.chat(16)} Escribir al consultorio</button></div>
      </section>
      <section class="card"><h2>${pt('pink', I.pin(16))}Dónde estamos</h2><p class="m0">${cl.direccion}</p><div class="actions"><button type="button" class="btn" onClick=${() => act.sheet('llegar')}>Cómo llegar</button></div></section>`;
  }
  function Invitacion({ s, act, inv, info }) {
    const guardado = leerToken();
    const [modo, setModo] = useState(guardado ? 'elegir' : 'nuevo');
    const [v, setV] = useState({ nombre: info.nombre || '', tel: '', correo: '', canal: 'wa', consejos: false });
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);
    const aceptar = async (conToken) => {
      if (!conToken) { const e = validarContacto(v); if (e) { setErr(e); return; } }
      setBusy(true); setErr('');
      try {
        const r = await api('fam_aceptar', { p_invitacion: inv, p_token: conToken || null, p_contacto: conToken ? null : { nombre: titleCase(v.nombre.trim()), telefono: v.tel, correo: v.correo.trim(), canal: v.canal, consejos: v.consejos } });
        act.entrar(r.token, 'Listo. Ya ves la ficha de ' + info.peque + '.');
      } catch (x) { setErr(x.message); setBusy(false); }
    };
    const permisos = [info.avisos ? 'recibir los avisos de sus citas' : null, info.agenda ? 'agendar y cambiar sus citas' : null, info.pagos ? 'ver y hacer sus pagos' : null].filter(Boolean);
    return html`<section class="card done">${Stars()}<h1>${'Hola, ' + first(info.nombre)}</h1>
        <p>${(info.de ? first(info.de) : 'Una persona de la familia') + ' te invitó a la ficha de ' + info.peque + ' en ' + s.clinica.nombre + (permisos.length ? ', para ' + permisos.join(', ').replace(/, ([^,]*)$/, ' y $1') : '') + '.'}</p>
      </section>
      <section class="card">
        ${modo === 'elegir' ? html`<h2>¿Con qué cuenta entras?</h2><p class="muted m0">En este teléfono ya hay una cuenta de ${s.clinica.nombre}.</p>
          <div class="actions"><button type="button" class="btn primary big" disabled=${busy} onClick=${() => aceptar(guardado)}>Agregar a mi cuenta</button><button type="button" class="btn big" onClick=${() => setModo('nuevo')}>Soy otra persona</button></div>`
        : html`<h2>Tus datos</h2><${ContactoForm} v=${v} onChange=${(x) => { setV(x); setErr(''); }} />
          <div class="actions end"><button type="button" class="btn primary big" disabled=${busy} onClick=${() => aceptar(null)}>${busy ? 'Aceptando…' : 'Aceptar la invitación'}</button></div>`}
        ${err ? html`<p class="err" role="alert">${err}</p>` : null}
      </section>`;
  }
  function Problema({ titulo, texto, s, act }) {
    return html`<section class="card done">${Stars()}<h1>${titulo}</h1><p>${texto}</p>
      <div class="actions center"><button type="button" class="btn primary big" onClick=${act.inicioPublico}>Agendar como familia nueva</button>${s.clinica && s.clinica.whatsapp ? html`<button type="button" class="btn big" onClick=${() => act.sheet('whatsapp')}>Escribir al consultorio</button>` : null}</div>
    </section>`;
  }

  /* ---------- Marco ---------- */
  const viewFromHash = () => { try { const h = (window.location.hash || '').replace('#', ''); return TABS.some((t) => t.id === h) ? h : 'inicio'; } catch (e) { return 'inicio'; } };
  const setHash = (v) => { try { if (window.location.hash !== '#' + v) window.history.replaceState(null, '', '#' + v); } catch (e) { /* sin hash */ } };
  function rutaInicial() {
    const p = window.location.pathname;
    let m = /^\/c\/([A-Za-z0-9_-]{20,64})\/?$/.exec(p);
    if (m) return { modo: 'cuenta', token: m[1] };
    m = /^\/i\/([A-Za-z0-9_-]{20,64})\/?$/.exec(p);
    if (m) return { modo: 'invitacion', inv: m[1] };
    const t = leerToken();
    if (t && /^[A-Za-z0-9_-]{20,64}$/.test(t)) { try { window.history.replaceState(null, '', '/c/' + t + window.location.hash); } catch (e) { /* sin historia */ } return { modo: 'cuenta', token: t }; }
    return { modo: 'publico' };
  }

  function App() {
    const ruta0 = useRef(rutaInicial()).current;
    const [ui, setUi] = useState(() => ({ modo: ruta0.modo === 'cuenta' ? 'cargando' : ruta0.modo === 'invitacion' ? 'cargando' : 'cargando', token: ruta0.token || '', view: viewFromHash(), stack: [], sheet: null, book: bookInit(null), problema: null, info: null }));
    const [data, setData] = useState(null);
    const [clinica, setClinica] = useState(null);
    const uiRef = useRef(ui);
    uiRef.current = ui;
    const dataRef = useRef(data);
    dataRef.current = data;
    const [toast, setToast] = useState(null);
    useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(null), 4200); return () => clearTimeout(t); }, [toast]);
    const say = (text) => setToast({ text: text, n: Date.now() });
    const top = () => { try { window.scrollTo(0, 0); } catch (e) { /* sin scroll */ } };
    const patch = (p) => setUi((x) => Object.assign({}, x, p));

    async function recargar(token, quieto) {
      const est = await api('fam_estado', { p_token: token });
      setHoy(est.clinica && est.clinica.hoy);
      const d = normal(est, token);
      setData(d);
      setClinica(est.clinica);
      return d;
    }
    useEffect(() => {
      (async () => {
        try {
          if (ruta0.modo === 'cuenta') {
            try {
              await recargar(ruta0.token);
              guardarToken(ruta0.token);
              patch({ modo: 'cuenta', book: bookInit(null) });
            } catch (e) {
              if (leerToken() === ruta0.token) borrarToken();
              const cl = await api('fam_clinica').catch(() => null);
              if (cl) { setHoy(cl.hoy); setClinica(cl); }
              patch({ modo: 'problema', problema: /no es válido/.test(e.message) ? { titulo: 'Este enlace ya no funciona', texto: 'Puede que el consultorio te haya enviado uno más reciente. Búscalo en tu WhatsApp, o escríbele al consultorio y te enviamos uno nuevo.' } : { titulo: 'No pudimos abrir tu cuenta', texto: e.message } });
            }
          } else {
            const cl = await api('fam_clinica');
            setHoy(cl.hoy);
            setClinica(cl);
            if (ruta0.modo === 'invitacion') {
              try { const info = await api('fam_invitacion', { p_invitacion: ruta0.inv }); patch({ modo: 'invitacion', info: info }); } catch (e) { patch({ modo: 'problema', problema: { titulo: 'Esta invitación ya no es válida', texto: 'Las invitaciones sirven una sola vez y vencen en 24 horas. Pídele una nueva a quien te invitó.' } }); }
            } else patch({ modo: 'publico' });
          }
        } catch (e) { patch({ modo: 'problema', problema: { titulo: 'No pudimos cargar la página', texto: e.message } }); }
      })();
    }, []);
    useEffect(() => {
      const tick = () => { const u = uiRef.current; if (u.modo === 'cuenta' && u.token && document.visibilityState === 'visible') recargar(u.token, true).catch(() => {}); };
      const t = setInterval(tick, 60000);
      document.addEventListener('visibilitychange', tick);
      return () => { clearInterval(t); document.removeEventListener('visibilitychange', tick); };
    }, []);
    useEffect(() => {
      const on = () => setUi((p) => Object.assign({}, p, { view: viewFromHash(), stack: [], sheet: null }));
      window.addEventListener('hashchange', on);
      return () => window.removeEventListener('hashchange', on);
    }, []);
    useEffect(() => {
      const onKey = (e) => { if (e.key === 'Escape' && uiRef.current.sheet) setUi((p) => Object.assign({}, p, { sheet: null })); };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }, []);

    const vista = () => Object.assign({}, dataRef.current || VACIO, { clinica: (dataRef.current && dataRef.current.clinica) || clinica }, uiRef.current);
    const act = {
      say: say,
      go: (view) => { patch({ view: view, stack: [], sheet: null }); setHash(view); top(); },
      abrir: (kind, id) => { setUi((p) => Object.assign({}, p, { stack: p.stack.concat([{ kind: kind, id: id || null }]), sheet: null })); top(); },
      back: () => { setUi((p) => Object.assign({}, p, { stack: p.stack.slice(0, -1) })); top(); },
      sheet: (kind, id) => patch({ sheet: { kind: kind, id: id || null } }),
      cerrarSheet: () => patch({ sheet: null }),
      setBook: (p) => setUi((x) => Object.assign({}, x, { book: Object.assign({}, x.book, p) })),
      agendarPara: (pacId) => { patch({ view: 'agendar', stack: [], sheet: null, book: bookInit(pacId) }); setHash('agendar'); top(); },
      otraReserva: () => { const s = vista(); patch({ book: bookInit(defaultKid(s)) }); top(); },
      verCita: (citaId) => { const s = vista(); patch({ view: 'inicio', stack: [{ kind: 'cita', id: citaId }], sheet: null, book: bookInit(defaultKid(s)) }); setHash('inicio'); top(); },
      empezar: () => { patch({ modo: 'nueva', book: Object.assign(bookInit('nuevo'), { pac: 'nuevo' }) }); top(); },
      inicioPublico: () => { borrarToken(); try { window.history.replaceState(null, '', '/'); } catch (e) { /* sin historia */ } patch({ modo: 'nueva', token: '', problema: null, sheet: null, book: Object.assign(bookInit('nuevo'), { pac: 'nuevo' }) }); setData(null); top(); },
      entrar: async (token, msg) => {
        guardarToken(token);
        try { window.history.replaceState(null, '', '/c/' + token); } catch (e) { /* sin historia */ }
        await recargar(token);
        patch({ modo: 'cuenta', token: token, view: 'inicio', stack: [], sheet: null, book: bookInit(null) });
        if (msg) say(msg);
        top();
      },
      salir: () => { borrarToken(); window.location.href = '/'; },
      bookNext: () => {
        const s = vista();
        const b = s.book;
        const nueva = uiRef.current.modo === 'nueva';
        if (b.step === 'quien') {
          if (!b.pac) { act.setBook({ err: 'Elige para quién es la cita.' }); return; }
          if (b.pac === 'nuevo') { const e = validarPeque(b.nuevo); if (e) { act.setBook({ err: e }); return; } }
          const primera = b.pac === 'nuevo' || pasadasDe(s, b.pac).length === 0;
          act.setBook({ err: '', step: 'motivo', motivo: b.motivo || (primera ? 'primera' : 'control') });
        } else if (b.step === 'motivo') {
          if (!b.motivo) { act.setBook({ err: 'Elige el motivo de la cita.' }); return; }
          if (b.motivo === 'urgencia') return;
          act.setBook({ err: '', step: 'hora' });
        } else if (b.step === 'hora') {
          if (!b.min || !b.dia) { act.setBook({ err: 'Elige una hora para continuar.' }); return; }
          act.setBook({ err: '', step: nueva ? 'contacto' : 'revisa' });
        } else if (b.step === 'contacto') {
          const e = validarContacto(b.contacto);
          if (e) { act.setBook({ err: e }); return; }
          act.setBook({ err: '', step: 'revisa' });
        }
        top();
      },
      apartar: async () => {
        const u = uiRef.current;
        const b = u.book;
        if (b.busy || !b.dia || !b.min) return;
        const nueva = u.modo === 'nueva';
        act.setBook({ busy: true, err: '' });
        try {
          const r = await api('fam_reservar', {
            p_token: nueva ? null : u.token,
            p_paciente: b.pac === 'nuevo' ? null : b.pac,
            p_nuevo: b.pac === 'nuevo' ? { nombre: titleCase(b.nuevo.nombre.trim()), nacimiento: b.nuevo.nac, parentesco: b.nuevo.par, legal: !!b.nuevo.legal } : null,
            p_contacto: nueva ? { nombre: titleCase(b.contacto.nombre.trim()), telefono: b.contacto.tel, correo: b.contacto.correo.trim(), canal: b.contacto.canal, consejos: !!b.contacto.consejos } : null,
            p_motivo: b.motivo, p_fecha: b.dia, p_minuto: b.min
          });
          const token = r.token || u.token;
          if (r.token) { guardarToken(r.token); try { window.history.replaceState(null, '', '/c/' + r.token + '#agendar'); } catch (e) { /* sin historia */ } }
          const d = await recargar(token);
          const canPay = puede(d, r.paciente, 'pagos');
          setUi((x) => Object.assign({}, x, { modo: 'cuenta', token: token, view: 'agendar', stack: [], book: Object.assign({}, x.book, { busy: false, step: canPay ? 'pago' : 'listo', cita: r.cita, pac: r.paciente, nuevaCuenta: !!r.token }) }));
          top();
        } catch (e) {
          if (/ocupar/.test(e.message)) act.setBook({ busy: false, step: 'hora', min: null, err: e.message, ronda: b.ronda + 1 });
          else act.setBook({ busy: false, err: e.message });
        }
      },
      reportarPago: async (citaId, metodo, banco, ref) => {
        const u = uiRef.current;
        await api('fam_reportar_pago', { p_token: u.token, p_cita: citaId, p_metodo: metodo, p_banco: banco || '', p_referencia: ref });
        await recargar(u.token);
        top();
      },
      asistir: async (citaId) => {
        const u = uiRef.current;
        const c0 = byId(vista().citas, citaId);
        try {
          await api('fam_asistencia', { p_token: u.token, p_cita: citaId });
          await recargar(u.token);
          if (c0) say(nb('Listo. Los esperamos ' + relDay(c0.fecha) + ' ' + alas(c0.min) + '.'));
        } catch (e) { say(e.message); }
      },
      cambiar: async (citaId, dia, min) => {
        const u = uiRef.current;
        await api('fam_cambiar', { p_token: u.token, p_cita: citaId, p_fecha: dia, p_minuto: min });
        await recargar(u.token);
        setUi((x) => Object.assign({}, x, { stack: x.stack.slice(0, -1) }));
        say(nb('Listo. La cita quedó para el ' + longIso(dia) + ' ' + alas(min) + '.'));
        top();
      },
      cancelar: async (citaId) => {
        const u = uiRef.current;
        await api('fam_cancelar', { p_token: u.token, p_cita: citaId });
        await recargar(u.token);
        setUi((x) => Object.assign({}, x, { sheet: null, stack: x.stack.filter((k) => !((k.kind === 'cita' || k.kind === 'cambiar' || k.kind === 'pago') && k.id === citaId)) }));
        say('Cancelamos la cita.');
        top();
      },
      agregarPeque: async (v) => {
        const u = uiRef.current;
        const r = await api('fam_agregar_peque', { p_token: u.token, p_nuevo: { nombre: titleCase(v.nombre.trim()), nacimiento: v.nac, parentesco: v.par, legal: !!v.legal } });
        await recargar(u.token);
        setUi((x) => Object.assign({}, x, { stack: x.stack.slice(0, -1).concat([{ kind: 'peque', id: r.paciente }]) }));
        say('Agregamos a ' + first(v.nombre) + ' a tu cuenta.');
        top();
      },
      invitar: async (pacId, nombre, par, permisos) => {
        const u = uiRef.current;
        const r = await api('fam_invitar', { p_token: u.token, p_paciente: pacId, p_nombre: nombre, p_parentesco: par, p_permisos: { avisos: !!permisos.avisos, agenda: !!permisos.agenda, pagos: !!permisos.pagos } });
        recargar(u.token).catch(() => {});
        return r;
      },
      setPref: async (k, v) => {
        const u = uiRef.current;
        const s = vista();
        try {
          await api('fam_preferencias', { p_token: u.token, p_canal: k === 'canal' ? v : s.prefs.canal, p_consejos: k === 'consejos' ? v : s.prefs.consejos });
          await recargar(u.token);
          if (k === 'canal') say(v === 'wa' ? 'Listo. Los avisos te llegarán por WhatsApp.' : 'Listo. Los avisos quedarán solo en esta página.');
          else say(v ? 'Listo. Recibirás consejos de cuidado.' : 'Ya no recibirás consejos de cuidado.');
        } catch (e) { say(e.message); }
      },
      leerAvisos: () => {
        const u = uiRef.current;
        api('fam_leidos', { p_token: u.token }).then(() => setData((d) => (d ? Object.assign({}, d, { avisos: d.avisos.map((a) => Object.assign({}, a, { nuevo: false })) }) : d)), () => {});
      }
    };

    const s = Object.assign({}, data || VACIO, { clinica: (data && data.clinica) || clinica }, ui);
    if (ui.modo === 'cargando' || !s.clinica) {
      return html`<div class="app"><header class="top"><div class="top-in"><span class="logo">${Stars()}${Word()}</span></div></header><main class="wrap narrow"><p class="empty center">Cargando…</p></main></div>`;
    }
    const sub = ui.stack[ui.stack.length - 1];
    const cuenta = ui.modo === 'cuenta';
    let content;
    if (ui.modo === 'problema') content = html`<${Problema} titulo=${ui.problema.titulo} texto=${ui.problema.texto} s=${s} act=${act} />`;
    else if (ui.modo === 'invitacion') content = html`<${Invitacion} s=${s} act=${act} inv=${ruta0.inv} info=${ui.info} />`;
    else if (ui.modo === 'publico') content = html`<${Landing} s=${s} act=${act} />`;
    else if (ui.modo === 'nueva') content = html`<${Agendar} s=${s} act=${act} nueva=${true} />`;
    else if (sub) {
      content = sub.kind === 'cita' ? html`<${CitaDetalle} key=${'c' + sub.id} s=${s} act=${act} id=${sub.id} />`
        : sub.kind === 'cambiar' ? html`<${Cambiar} key=${'m' + sub.id} s=${s} act=${act} id=${sub.id} />`
        : sub.kind === 'pago' ? html`<${PagoSub} key=${'p' + sub.id} s=${s} act=${act} id=${sub.id} />`
        : sub.kind === 'peque' ? html`<${Peque} key=${'k' + sub.id} s=${s} act=${act} id=${sub.id} />`
        : sub.kind === 'nuevo' ? html`<${NuevoPeque} s=${s} act=${act} />`
        : sub.kind === 'invitar' ? html`<${Invitar} key=${'i' + sub.id} s=${s} act=${act} id=${sub.id} />`
        : html`<${Informe} key=${'f' + sub.id} s=${s} act=${act} id=${sub.id} />`;
    } else {
      content = ui.view === 'agendar' ? html`<${Agendar} s=${s} act=${act} nueva=${false} />`
        : ui.view === 'peques' ? html`<${Peques} s=${s} act=${act} />`
        : ui.view === 'pagos' ? html`<${Pagos} s=${s} act=${act} />`
        : ui.view === 'avisos' ? html`<${Avisos} s=${s} act=${act} />`
        : html`<${Inicio} s=${s} act=${act} />`;
    }
    const narrow = !cuenta || !!sub || ui.view === 'agendar';
    const yo = cuenta ? per(s, s.yo) : null;
    const unread = cuenta ? sinLeer(s) : 0;
    return html`<div class=${'app' + (cuenta ? '' : ' sin-tabs')}>
      <header class="top"><div class="top-in">
        <button type="button" class="logo" onClick=${() => (cuenta ? act.go('inicio') : ui.modo === 'nueva' ? patch({ modo: 'publico' }) : null)} aria-label="Dentikids, ir al inicio">${Stars()}${Word()}</button>
        ${cuenta ? html`<nav class="dnav" aria-label="Secciones">${TABS.map((t) => html`<button type="button" key=${t.id} class="dnav-btn" aria-current=${ui.view === t.id && !sub ? 'page' : 'false'} onClick=${() => act.go(t.id)}>${t.label}${t.id === 'avisos' && unread ? html`<span class="badge">${unread}</span>` : null}</button>`)}</nav>
        <span class="me">${Av(yo)}<span class="me-name">${yo.nombre}</span></span>` : null}
      </div></header>
      <main class=${'wrap' + (narrow ? ' narrow' : '')} key=${ui.modo + ui.view + (sub ? sub.kind + sub.id : '')}>${content}</main>
      ${cuenta ? html`<nav class="tabbar" aria-label="Secciones">${TABS.map((t) => html`<button type="button" key=${t.id} class="tb" aria-current=${ui.view === t.id && !sub ? 'page' : 'false'} onClick=${() => act.go(t.id)}><span class=${'tb-ic t-' + t.tone}>${I[t.id](20)}</span><span>${t.label}</span>${t.id === 'avisos' && unread ? html`<span class="badge">${unread}</span>` : null}</button>`)}</nav>` : null}
      ${ui.sheet ? html`<${Sheet} key=${ui.sheet.kind + (ui.sheet.id || '')} s=${s} act=${act} />` : null}
      ${toast ? html`<div class="toast" role="status" key=${toast.n}>${nb(toast.text)}</div>` : null}
    </div>`;
  }

  render(html`<${App} />`, rootEl);
})();
