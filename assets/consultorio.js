/* Dientario · consola del consultorio Dentikids. Usa solo las funciones st_* de la base. */
(function () {
  'use strict';
  const rootEl = document.getElementById('root');
  const fail = (msg) => { rootEl.innerHTML = '<div class="load-fail"><h1>Dientario</h1><p>' + msg + '</p></div>'; };
  if (!window.htmPreact || !window.supabase) { fail('No se pudo cargar la consola. Revisa la conexión y vuelve a abrirla.'); return; }
  const CFG = window.DK_CONFIG || {};
  if (!CFG.url || !CFG.key || /^PEGA_AQUI/.test(String(CFG.url)) || /^PEGA_AQUI/.test(String(CFG.key))) { fail('La consola todavía no está conectada con su base de datos. Falta completar el archivo assets/config.js.'); return; }
  const { html, render, useState, useEffect, useRef } = window.htmPreact;
  const sb = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'dk-consultorio' } });

  /* ---------- Conexión ---------- */
  function mensajeDe(error) {
    const m = String((error && error.message) || '');
    if (error && (error.code === 'P0001' || (error.code === '42501' && !/permission denied/i.test(m)))) return m;
    if (/permission denied/i.test(m)) return 'Tu cuenta no tiene permiso para esto.';
    if (/fetch|network|load failed|conexi/i.test(m)) return 'No hay conexión. Revisa el internet e inténtalo de nuevo.';
    return 'Algo falló. Inténtalo de nuevo en un momento.';
  }
  let onAuthProblem = () => {};
  async function api(fn, args) {
    let res;
    try { res = await sb.rpc(fn, args || {}); } catch (e) { throw new Error(mensajeDe(e)); }
    if (res.error) {
      const e = new Error(mensajeDe(res.error));
      e.code = res.error.code;
      e.hint = res.error.hint;
      if (e.hint === 'mfa' || (e.code === '42501' && /no tiene acceso|Inicia sesión/.test(e.message))) onAuthProblem(e);
      throw e;
    }
    return res.data;
  }

  /* ---------- Fechas, montos y textos ---------- */
  const NB = String.fromCharCode(160);
  const WD = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const WDS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const MO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const MOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const D = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
  const parseIso = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? D(+m[1], +m[2], +m[3]) : null; };
  const isoOf = (dt) => dt.getUTCFullYear() + '-' + String(dt.getUTCMonth() + 1).padStart(2, '0') + '-' + String(dt.getUTCDate()).padStart(2, '0');
  const tsCar = (ts) => { const d = new Date(new Date(ts).getTime() - 4 * 3600000); return { iso: isoOf(d), min: d.getUTCHours() * 60 + d.getUTCMinutes() }; };
  let HOY = tsCar(Date.now()).iso;
  let BASE = parseIso(HOY);
  const setHoy = (iso) => { if (iso && iso !== HOY && parseIso(iso)) { HOY = iso; BASE = parseIso(iso); } };
  const ahoraMin = () => tsCar(Date.now()).min;
  const dayDiff = (iso) => Math.round((parseIso(iso) - BASE) / 86400000);
  const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
  const longIso = (iso) => { const dt = parseIso(iso); return WD[dt.getUTCDay()] + ' ' + dt.getUTCDate() + ' de ' + MO[dt.getUTCMonth()] + (dt.getUTCFullYear() !== BASE.getUTCFullYear() ? ' de ' + dt.getUTCFullYear() : ''); };
  const shortIso = (iso) => { const dt = parseIso(iso); return WDS[dt.getUTCDay()] + ' ' + dt.getUTCDate() + ' ' + MOS[dt.getUTCMonth()] + (dt.getUTCFullYear() !== BASE.getUTCFullYear() ? ' ' + dt.getUTCFullYear() : ''); };
  const monthYear = (iso) => { const dt = parseIso(iso); return MO[dt.getUTCMonth()] + ' de ' + dt.getUTCFullYear(); };
  const dmy = (iso) => { const p = String(iso).slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; };
  function fmt(min) {
    const h = Math.floor(min / 60) % 24;
    const m = min % 60;
    return (h % 12 === 0 ? 12 : h % 12) + ':' + String(m).padStart(2, '0') + ' ' + (h >= 12 ? 'p. m.' : 'a. m.');
  }
  const alas = (min) => (Math.floor(min / 60) % 12 === 1 ? 'a la ' : 'a las ') + fmt(min);
  const relDay = (iso) => { const n = dayDiff(iso); return n === 0 ? 'hoy' : n === 1 ? 'mañana' : n === -1 ? 'ayer' : shortIso(iso); };
  const when = (iso, min) => cap(relDay(iso)) + ', ' + fmt(min);
  const cuando = (ts) => { if (!ts) return ''; const t = tsCar(ts); return when(t.iso, t.min); };
  function monthsOld(nac) {
    const b = parseIso(nac);
    let m = (BASE.getUTCFullYear() - b.getUTCFullYear()) * 12 + (BASE.getUTCMonth() - b.getUTCMonth());
    if (BASE.getUTCDate() < b.getUTCDate()) m -= 1;
    return m;
  }
  const ageLabel = (nac) => { const m = monthsOld(nac); return m < 24 ? m + (m === 1 ? ' mes' : ' meses') : Math.floor(m / 12) + ' años'; };
  const addMonthsIso = (iso, n) => { const dt = parseIso(iso); const m = dt.getUTCMonth() + n; return isoOf(D(dt.getUTCFullYear() + Math.floor(m / 12), (m % 12) + 1, Math.min(dt.getUTCDate(), 28))); };
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
  const conOrigen = (t) => String(t || '').replace(/(^|\s)\/c\//g, '$1' + window.location.origin + '/c/');

  /* ---------- Catálogos ---------- */
  const METODOS = { ef: { label: 'Efectivo', mon: 'usd' }, pm: { label: 'Pago Móvil', mon: 'bs' }, tr: { label: 'Transferencia', mon: 'bs' }, ze: { label: 'Zelle', mon: 'usd' }, bi: { label: 'Binance Pay', mon: 'usdt' } };
  const montoPago = (p, tasa) => (METODOS[p.metodo].mon === 'bs' ? 'Bs. ' + fmtNum(p.bs != null ? p.bs : p.usd * tasa) : METODOS[p.metodo].mon === 'usdt' ? Number(p.usd) + ' USDT' : '$ ' + fmtNum(p.usd));
  const montoMetodo = (m, u, tasa) => (METODOS[m].mon === 'bs' ? 'Bs. ' + fmtNum(u * tasa) : METODOS[m].mon === 'usdt' ? Number(u) + ' USDT' : '$ ' + fmtNum(u));
  const BANKS = ['Banco de Venezuela', 'Banesco', 'Mercantil', 'Provincial', 'BNC', 'Bancamiga', 'Banco del Tesoro', 'Bicentenario', 'Banplus', 'Banco Exterior', 'Venezolano de Crédito', 'Otro banco'];
  const MOTIVOS = { primera: 'Primera visita', control: 'Control', preocupa: 'Revisión por una molestia', urgencia: 'Urgencia', tratamiento: 'Tratamiento' };
  const motivoTxt = (c) => (MOTIVOS[c.motivo] || 'Cita') + (c.detalle ? ' · ' + c.detalle : '');
  const SEGS = [
    { id: 'todos', label: 'Todos' }, { id: 'primera', label: 'Primera visita' }, { id: 'bebe', label: 'Bebés' },
    { id: 'control', label: 'En control' }, { id: 'tratamiento', label: 'En tratamiento' }, { id: 'inactivo', label: 'Inactivos' }
  ];
  const segLabel = (id) => (SEGS.find((g) => g.id === id) || SEGS[0]).label;
  const SEG_TONE = { primera: 'accent', bebe: 'info', control: 'ok', tratamiento: 'warn', inactivo: 'neutral', todos: 'neutral' };
  const segDesc = (id) => ({ todos: 'Todas las familias', primera: 'Familias que vienen por primera vez', bebe: 'Bebés de hasta dos años', control: 'Peques en controles cada seis meses', tratamiento: 'Peques con un tratamiento en curso', inactivo: 'Familias que no vienen desde hace ocho meses o más' }[id] || 'Todas las familias');
  const CANAL = { wa: 'WhatsApp', web: 'su enlace', mail: 'correo', push: 'notificación' };
  const PRIO = ['confirmar_hoy', 'confirmacion', 'pago_revisar', 'enlace', 'recordatorio', 'resumen', 'cambio', 'cancelacion', 'pago_pendiente', 'control', 'reactivacion', 'cumple', 'bienvenida', 'asistencia'];
  const VIEWS = [
    { id: 'hoy', label: 'Hoy' }, { id: 'pacientes', label: 'Pacientes' }, { id: 'mensajes', label: 'Mensajes' },
    { id: 'plantillas', label: 'Plantillas' }, { id: 'pagos', label: 'Pagos' }, { id: 'seguridad', label: 'Seguridad' }, { id: 'ajustes', label: 'Ajustes' }
  ];
  const NAV_TONE = { hoy: 'blue', pacientes: 'pink', mensajes: 'mint', plantillas: 'lav', pagos: 'yel', seguridad: 'peach', ajustes: 'blue' };
  const TONES = ['blue', 'pink', 'yel', 'mint', 'lav'];
  const toneOf = (id) => { let h = 0; const t = String(id || ''); for (let i = 0; i < t.length; i += 1) h = (h * 31 + t.charCodeAt(i)) >>> 0; return TONES[h % TONES.length]; };

  /* ---------- Íconos ---------- */
  const svg = (z, body, sw) => html`<svg width=${z} height=${z} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width=${sw || 2} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
  const I = {
    hoy: (z) => svg(z || 18, html`<rect x="3" y="4.5" width="18" height="16" rx="3" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4M8 14h3" />`, 1.9),
    pacientes: (z) => svg(z || 18, html`<circle cx="9" cy="8" r="3.5" /><path d="M2.5 19.5c.7-3.4 3.3-5.4 6.5-5.4s5.8 2 6.5 5.4" /><circle cx="17" cy="9" r="2.6" /><path d="M16.5 14.2c2.6.1 4.3 1.8 5 4.3" />`, 1.9),
    mensajes: (z) => svg(z || 18, html`<path d="M4.5 5h15A1.5 1.5 0 0 1 21 6.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5V17h-1A1.5 1.5 0 0 1 3 15.5v-9A1.5 1.5 0 0 1 4.5 5z" />`, 1.9),
    plantillas: (z) => svg(z || 18, html`<path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5a1.5 1.5 0 0 1 1-1.5z" /><path d="M14 3.5V8h4M9 12.5h6M9 16h4" />`, 1.9),
    pagos: (z) => svg(z || 18, html`<rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10.5h18M7 15h4" />`, 1.9),
    seguridad: (z) => svg(z || 18, html`<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6z" /><path d="m9 12 2.2 2.2L15.5 10" />`, 1.9),
    ajustes: (z) => svg(z || 18, html`<circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />`, 1.6),
    search: (z) => svg(z || 18, html`<circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" />`),
    back: (z) => svg(z || 16, html`<path d="M15 5l-7 7 7 7" />`),
    chev: (z) => svg(z || 18, html`<path d="M9 6l6 6-6 6" />`),
    check: (z) => svg(z || 15, html`<path d="M5 12.5l4.2 4.2L19 7" />`, 2.4),
    close: (z) => svg(z || 18, html`<path d="M6 6l12 12M18 6L6 18" />`),
    lock: (z) => svg(z || 18, html`<rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />`, 1.9),
    send: (z) => svg(z || 16, html`<path d="M4 12 20 4l-4 16-4-6.5z" /><path d="M12 13.5 20 4" />`),
    bell: (z) => svg(z || 14, html`<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" />`),
    plus: (z) => svg(z || 16, html`<path d="M12 5v14M5 12h14" />`),
    copy: (z) => svg(z || 14, html`<rect x="8" y="8" width="12" height="12" rx="2.5" /><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" />`),
    tooth: (z) => svg(z || 18, html`<path d="M7.5 3.5c-2.5 0-4 2-4 4.6 0 2.4 1.2 3.9 1.8 6.1.7 2.7 1 6.3 2.9 6.3 1.6 0 1.7-3.3 2.4-5 .4-.9.8-1.3 1.4-1.3s1 .4 1.4 1.3c.7 1.7.8 5 2.4 5 1.9 0 2.2-3.6 2.9-6.3.6-2.2 1.8-3.7 1.8-6.1 0-2.6-1.5-4.6-4-4.6-1.9 0-2.9 1-4.5 1s-2.6-1-4.5-1z" />`, 1.8),
    phone: (z) => svg(z || 18, html`<rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" />`, 1.9),
    out: (z) => svg(z || 16, html`<path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14M10 16l-4-4 4-4M6 12h10" />`, 1.9)
  };
  const pill = (tone, text) => html`<span class=${'pill ' + tone}>${nb(text)}</span>`;
  const pt = (tone, icon) => html`<span class=${'ptag t-' + tone} aria-hidden="true">${icon}</span>`;
  const Word = () => html`<svg class="dk-word" viewBox="0 0 907 275.8" role="img" aria-label="Dentikids"><use href="#dk-word" width="907" height="275.8"></use></svg>`;
  const Stars = (cls) => html`<svg class=${'dk-stars' + (cls ? ' ' + cls : '')} viewBox="0 0 407.1 411.6" aria-hidden="true" focusable="false"><use href="#dk-stars" width="407.1" height="411.6"></use></svg>`;
  const Av = (id, nombre, cls) => html`<span class=${'av t-' + toneOf(id) + (cls ? ' ' + cls : '')} aria-hidden="true">${(nombre || '?').charAt(0)}</span>`;
  const canalPill = (c) => (c === 'wa' ? pill('wa', 'WhatsApp') : pill('accent', 'Su enlace'));
  const tcol = (min) => { const h = Math.floor(min / 60) % 24; return html`<span class="tcol"><b>${(h % 12 === 0 ? 12 : h % 12) + ':' + String(min % 60).padStart(2, '0')}</b><small>${h >= 12 ? 'p. m.' : 'a. m.'}</small></span>`; };
  const estadoPago = (x) => (x.estado === 'conciliado' ? pill('ok', 'Conciliado') : x.estado === 'por verificar' ? pill('warn', 'Por verificar') : pill('bad', 'No aparece'));
  function estadoCita(c) {
    if (c.estado === 'atendida') return c.informe_estado === 'por aprobar' ? pill('warn', 'Informe por aprobar') : pill('ok', 'Atendida');
    if (c.estado === 'sala') return pill('accent', 'En sala desde las ' + fmt(c.llego ? tsCar(c.llego).min : c.minuto));
    if (c.estado === 'abono') return c.abono && c.abono.estado === 'no aparece' ? pill('bad', 'Pago por revisar') : pill('warn', 'Abono en verificación');
    if (c.estado === 'apartada') return pill('warn', 'Falta el abono');
    if (c.estado === 'confirmada') return c.asiste ? pill('ok', 'Confirmó que viene') : pill('ok', 'Confirmada');
    if (c.estado === 'cancelada') return pill('neutral', 'Cancelada');
    if (c.estado === 'no_vino') return pill('neutral', 'No vino');
    if (c.estado === 'vencida') return pill('neutral', 'Venció sin abono');
    return pill('neutral', c.estado);
  }
  const nombresDe = (personas) => (personas || []).map((p) => first(p.nombre)).join(' y ');
  const avisoTxt = (personas) => { const ps = (personas || []).filter((p) => p.avisos !== false); return ps.length ? (ps.length > 1 ? 'lo reciben ' : 'lo recibe ') + ps.map((x) => first(x.nombre) + ' por ' + CANAL[x.canal]).join(' y ') : 'nadie recibe avisos'; };

  /* ---------- Piezas comunes ---------- */
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
      say(done ? okMsg : 'No se pudo copiar; selecciona el texto y cópialo a mano.');
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fallback);
      else fallback();
    } catch (e) { fallback(); }
  }
  function CopyBtn({ text, label, act }) {
    return html`<button type="button" class="copy" onClick=${() => copiar(text, 'Copiado: ' + label.toLowerCase() + '.', act.say)}>${I.copy(14)} Copiar</button>`;
  }
  function useCarga(fn, deps) {
    const [st, setSt] = useState({ data: null, err: '' });
    const n = useRef(0);
    const load = () => {
      n.current += 1;
      const my = n.current;
      return fn().then((d) => { if (my === n.current) setSt({ data: d, err: '' }); return d; }, (e) => { if (my === n.current) setSt((p) => ({ data: p.data, err: e.message })); });
    };
    useEffect(() => { load(); }, deps);
    return [st, load];
  }
  const Cargando = () => html`<p class="empty">Cargando…</p>`;
  const Fallo = ({ err }) => html`<div class="alert" role="alert"><span class="stack"><b>No se pudo cargar</b><p>${err}</p></span></div>`;
  function Picker({ h, dia, min, onPick }) {
    if (!h.data) return h.err ? html`<p class="err" role="alert">${h.err}</p>` : html`<p class="empty">Buscando las horas libres…</p>`;
    const conLibres = h.data.filter((d) => d.libres.length);
    if (!conLibres.length) return html`<p class="empty">No quedan horas libres en los próximos días.</p>`;
    const cur = h.data.find((d) => d.fecha === dia) || conLibres[0];
    const slot = (m) => html`<button type="button" key=${m} class="slot" aria-pressed=${min === m && dia === cur.fecha ? 'true' : 'false'} onClick=${() => onPick(cur.fecha, m)}>${nb(fmt(m))}</button>`;
    return html`<div class="stack gap12">
      <div class="days" role="group" aria-label="Día">${h.data.map((d) => { const n = d.libres.length; const dt = parseIso(d.fecha); return html`<button type="button" key=${d.fecha} class="day" aria-pressed=${cur.fecha === d.fecha ? 'true' : 'false'} disabled=${!n} onClick=${() => onPick(d.fecha, null)}><small>${dayDiff(d.fecha) === 0 ? 'Hoy' : cap(WDS[dt.getUTCDay()])}</small><b>${dt.getUTCDate()}</b><small>${n ? n + (n === 1 ? ' libre' : ' libres') : 'Lleno'}</small></button>`; })}</div>
      <span class="small muted">${cap(longIso(cur.fecha))}</span>
      <div class="slots">${cur.libres.map(slot)}</div>
    </div>`;
  }
  function Confirmar({ texto, si, onSi, onNo, busy }) {
    return html`<div class="note">${texto}<div class="actions mt8"><button type="button" class="btn" onClick=${onNo}>Cancelar</button><button type="button" class="btn ghost danger-txt" disabled=${busy} onClick=${onSi}>${si}</button></div></div>`;
  }

  /* ---------- Vista: Hoy ---------- */
  function Hoy({ s, act }) {
    const h = s.resumen;
    if (!h) return s.resumenErr ? html`<${Fallo} err=${s.resumenErr} />` : html`<${Cargando} />`;
    const doc = s.yo.rol === 'doctora';
    const citas = h.citas;
    const at = citas.filter((c) => c.estado === 'atendida').length;
    const sala = citas.filter((c) => c.estado === 'sala').length;
    const porVer = h.pagos.filter((p) => p.estado === 'por verificar');
    const noAp = h.pagos.filter((p) => p.estado === 'no aparece');
    const restos = citas.filter((c) => ['abono', 'confirmada', 'sala', 'atendida'].indexOf(c.estado) >= 0 && !c.resto);
    const resto = Number(h.clinica.total_usd) - Number(h.clinica.abono_usd);
    const ahora = ahoraMin();
    const saludo = (h.ahora < 720 ? 'Buenos días' : h.ahora < 1140 ? 'Buenas tardes' : 'Buenas noches') + ', ' + (doc ? 'doctora' : first(s.yo.nombre));
    const rows = [];
    let nowPut = false;
    citas.forEach((c) => { if (!nowPut && c.minuto > ahora) { rows.push({ now: true }); nowPut = true; } rows.push({ c: c }); });
    if (!nowPut && citas.length) rows.push({ now: true });
    const dias = [];
    h.proximas.forEach((c) => { let g = dias.find((x) => x.fecha === c.fecha); if (!g) { g = { fecha: c.fecha, items: [] }; dias.push(g); } g.items.push(c); });
    const cola = h.cola.slice().sort((x, y) => PRIO.indexOf(x.plantilla) - PRIO.indexOf(y.plantilla));
    return html`
      <div class="vhead">
        <div><h1>${Stars('stars-inline')}<span>${saludo}</span></h1><p>${cap(longIso(h.hoy))} · ${nb(fmt(ahora))}</p></div>
        <div class="chips"><button type="button" class="chip bcv" onClick=${() => act.go('pagos')}>${nb('BCV Bs. ' + fmtNum(h.clinica.tasa_bcv))}</button><button type="button" class="btn primary" onClick=${() => act.modal('agendar', {})}>${I.plus(16)} Agendar cita</button></div>
      </div>
      ${h.alerta_2fa ? html`<div class="alert"><span class="stack"><b>Activa tu segundo factor</b><p>Con un código de la app autenticadora en tu teléfono, nadie entra a la consola solo con tu contraseña.</p></span><button type="button" class="btn" onClick=${() => act.go('seguridad')}>Activarlo</button></div>` : null}
      ${!h.total_pacientes ? html`<section class="panel"><div class="panel-h"><h2>${pt('pink', I.pacientes(16))}Todavía no hay pacientes</h2></div><p class="m0">Las familias aparecen aquí cuando agendan desde la web, o cuando agendas una cita desde el botón de arriba.${doc ? ' Para probar la consola puedes cargar unos datos de ejemplo y borrarlos después.' : ''}</p>${doc ? html`<div class="actions"><button type="button" class="btn primary" onClick=${() => act.run(() => api('st_ejemplo', { p_cargar: true }), 'Listo. Cargamos siete familias de ejemplo; las borras desde Ajustes.')}>Cargar datos de ejemplo</button><button type="button" class="btn" onClick=${() => act.go('ajustes')}>Ver el enlace para las familias</button></div>` : null}</section>` : null}
      <div class="stats">
        <div class="stat t-blue"><b>${citas.length}</b><span>Citas de hoy</span><small>${at} atendidas · ${sala} en sala</small></div>
        <button type="button" class=${'stat t-yel' + (porVer.length ? ' hot' : '')} onClick=${() => act.go('pagos')}><b>${porVer.length + noAp.length}</b><span>Pagos por verificar</span><small>${porVer.length ? porVer.map((p) => METODOS[p.metodo].label).filter((x, i, a) => a.indexOf(x) === i).join(' y ') : noAp.length ? noAp.length + ' sin aparecer en el banco' : 'Todo conciliado'}</small></button>
        <button type="button" class=${'stat t-mint' + (cola.length ? ' hot' : '')} onClick=${() => act.go('mensajes')}><b>${cola.length}</b><span>WhatsApp por enviar</span><small>${cola.length ? 'Se envían con un toque' : 'Nada pendiente'}</small></button>
        <button type="button" class="stat t-pink" onClick=${() => act.go('pagos')}><b>${restos.length}</b><span>Restos por cobrar</span><small>${nb(usd(resto) + ' cada uno, al llegar')}</small></button>
      </div>
      <div class="two">
        <section class="panel" aria-labelledby="h-agenda">
          <div class="panel-h"><h2 id="h-agenda">${pt('blue', I.hoy(16))}Agenda de hoy</h2><span class="small muted">${h.clinica.duracion_min} minutos por cita</span></div>
          ${citas.length ? html`<ol class="ag">${rows.map((r, i) => (r.now ? html`<li class="now" key=${'now' + i}>Ahora · ${nb(fmt(ahora))}</li>` : html`<${AgRow} key=${r.c.id} s=${s} c=${r.c} act=${act} />`))}</ol>` : html`<p class="empty">No hay citas para hoy.</p>`}
        </section>
        <div class="col">
          <section class="panel" aria-labelledby="h-ver">
            <div class="panel-h"><h2 id="h-ver">${pt('yel', I.pagos(16))}Pagos por verificar</h2>${h.pagos.length ? html`<span class="badge">${h.pagos.length}</span>` : null}</div>
            ${h.pagos.length ? html`<ul class="mini">${h.pagos.map((p) => html`<${PagoItem} key=${p.id} p=${p} s=${s} act=${act} tasa=${h.clinica.tasa_bcv} />`)}</ul>` : html`<p class="empty">No hay pagos esperando revisión.</p>`}
          </section>
          <section class="panel" aria-labelledby="h-wa">
            <div class="panel-h"><h2 id="h-wa">${pt('mint', I.mensajes(16))}WhatsApp por enviar</h2><button type="button" class="link" onClick=${() => act.go('mensajes')}>Ver todos</button></div>
            ${cola.length ? html`<ul class="mini">${cola.slice(0, 3).map((m) => html`<li key=${m.id}><div class="top"><b>${m.nombre}</b><span class="small muted">${first(m.persona.nombre)}${m.paciente ? ' · ' + first(m.paciente.nombre) : ''}</span></div><div class="actions"><button type="button" class="btn wa" onClick=${() => act.modal('wa', { m: m })}>${I.send(15)} Enviar por WhatsApp</button></div></li>`)}</ul>` : html`<p class="empty">No hay mensajes pendientes por ahora.</p>`}
          </section>
          <section class="panel" aria-labelledby="h-inf">
            <div class="panel-h"><h2 id="h-inf">${pt('lav', I.plantillas(16))}Informes por aprobar</h2></div>
            ${h.informes.length ? html`<ul class="mini">${h.informes.map((c) => html`<li key=${c.id}><div class="top"><b>${c.pac.nombre}</b><span class="small muted">${nb(when(c.fecha, c.minuto))}</span></div><span class="sub">${motivoTxt(c)}. Al aprobarlo, el resumen sale para la familia.</span><div class="actions">${doc ? html`<button type="button" class="btn primary" onClick=${() => act.modal('informe', { c: c })}>${I.check(15)} Escribir y aprobar</button>` : html`<span class="pill neutral">Lo aprueba la doctora</span>`}</div></li>`)}</ul>` : html`<p class="empty">No hay informes pendientes.</p>`}
          </section>
          <section class="panel" aria-labelledby="h-prox">
            <div class="panel-h"><h2 id="h-prox">${pt('pink', I.bell(16))}Próximos días</h2></div>
            ${dias.length ? dias.map((g) => html`<div class="stack gap8" key=${g.fecha}><span class="lbl">${cap(relDay(g.fecha))}</span><ul class="mini">${g.items.map((c) => html`<li key=${c.id}><div class="top"><button type="button" class="ag-name" onClick=${() => act.abrirPac(c.paciente)}>${c.pac.nombre}</button><span class="small muted">${nb(fmt(c.minuto))}</span></div><span class="sub">${motivoTxt(c)} · ${avisoTxt(c.personas)}</span><span>${estadoCita(c)}</span></li>`)}</ul></div>`) : html`<p class="empty">No hay citas en los próximos siete días.</p>`}
          </section>
        </div>
      </div>`;
  }
  function AgRow({ s, c, act }) {
    const p = c.pac;
    const doc = s.yo.rol === 'doctora';
    const [conf, setConf] = useState(false);
    let action = null;
    if (c.estado === 'apartada') action = html`<button type="button" class="btn" onClick=${() => act.modal('cobro', { c: c, tipo: 'abono' })}>Registrar abono</button>`;
    else if (c.estado === 'abono') action = html`<button type="button" class="btn" onClick=${() => act.go('pagos')}>Ver pago</button><button type="button" class="btn ghost" onClick=${() => act.run(() => api('st_llego', { p_cita: c.id }), 'Llegada registrada.')}>Llegó</button>`;
    else if (c.estado === 'confirmada') action = conf ? html`<button type="button" class="btn ghost" onClick=${() => setConf(false)}>No</button><button type="button" class="btn ghost danger-txt" onClick=${() => act.run(() => api('st_no_vino', { p_cita: c.id }), 'Marcamos que no vino.')}>Sí, no vino</button>` : html`<button type="button" class="btn" onClick=${() => act.run(() => api('st_llego', { p_cita: c.id }), 'Llegada registrada.')}>Llegó</button><button type="button" class="btn ghost" onClick=${() => setConf(true)}>No vino</button>`;
    else if (c.estado === 'sala') action = html`<button type="button" class="btn primary" onClick=${() => act.run(() => api('st_atendida', { p_cita: c.id }), doc ? 'Consulta terminada. El informe quedó por aprobar.' : 'Consulta terminada. El informe quedó para la doctora.')}>Terminar consulta</button>`;
    else if (c.estado === 'atendida' && c.informe_estado === 'por aprobar' && doc) action = html`<button type="button" class="btn primary" onClick=${() => act.modal('informe', { c: c })}>Escribir informe</button>`;
    return html`<li class=${'ag-row' + (c.estado === 'sala' ? ' sala' : '') + (c.estado === 'atendida' || c.estado === 'no_vino' ? ' done' : '')}>
      ${tcol(c.minuto)}
      <span class="stack"><span><button type="button" class="ag-name" onClick=${() => act.abrirPac(c.paciente)}>${p.nombre}</button></span><span class="ag-sub">${ageLabel(p.nacimiento)} · ${motivoTxt(c)} · ${nombresDe(c.personas)}</span></span>
      <span class="ag-act">${estadoCita(c)}${action}</span>
    </li>`;
  }
  function PagoItem({ p, s, act, tasa }) {
    const [busy, setBusy] = useState(false);
    const verificar = async () => {
      setBusy(true);
      const r = await act.run(() => api('st_verificar_pago', { p_pago: p.id }), (x) => (!x.abono ? 'Pago conciliado y sumado al cierre del día.' : x.canal === 'wa' ? 'Abono conciliado. La cita quedó confirmada, y el WhatsApp de confirmación está listo para enviar.' : 'Abono conciliado. La cita quedó confirmada, y la familia ve el aviso en su enlace.'));
      if (!r) setBusy(false);
    };
    const noAparece = async () => { setBusy(true); const r = await act.run(() => api('st_no_aparece', { p_pago: p.id }), 'El mensaje para pedir el comprobante quedó en los WhatsApp por enviar.'); if (!r) setBusy(false); };
    return html`<li class=${p.estado === 'no aparece' ? '' : 'hot'}>
      <div class="top"><b>${p.persona ? p.persona.nombre : 'Familia'}</b><span class="small">${nb(montoPago(p, tasa))}</span></div>
      <span class="sub">${METODOS[p.metodo].label}${p.banco ? ' desde ' + p.banco : ''} · ${p.referencia ? (/^\d+$/.test(p.referencia) ? 'referencia terminada en ' + p.referencia.slice(-6) : 'titular ' + p.referencia) : 'sin referencia'} · ${nb(cuando(p.reportado).toLowerCase())}</span>
      <span class="sub">${(p.tipo === 'abono' ? 'Abono' : 'Resto') + ' de ' + (p.paciente ? p.paciente.nombre : '') + (p.cita_fecha ? ', cita del ' + shortIso(p.cita_fecha) + ' ' + alas(p.cita_minuto) : '')}</span>
      ${p.estado === 'no aparece' ? html`<span class="sub">Se le pidió el comprobante a la familia; si corrige la referencia, el pago vuelve a esta lista.</span><div class="actions"><button type="button" class="btn" disabled=${busy} onClick=${verificar}>Ya apareció: confirmar</button></div>`
        : html`<div class="actions"><button type="button" class="btn primary" disabled=${busy} onClick=${verificar}>${I.check(15)} Llegó al banco</button><button type="button" class="btn ghost" disabled=${busy} onClick=${noAparece}>No aparece</button></div>`}
    </li>`;
  }

  /* ---------- Vista: Pacientes ---------- */
  function proximoPaso(p) {
    const c = p.proxima;
    if (c && c.estado === 'sala') return 'En sala ahora';
    if (c) return cap(relDay(c.fecha)) + ', ' + fmt(c.minuto) + ' · ' + (MOTIVOS[c.motivo] || 'cita').toLowerCase();
    if (p.segmento === 'inactivo' && p.ultima) return 'Sin visita desde ' + monthYear(p.ultima);
    if (p.ultima) { const ctl = addMonthsIso(p.ultima, 6); return (dayDiff(ctl) >= 0 ? 'Control en ' : 'Control pendiente desde ') + monthYear(ctl); }
    return 'Sin citas agendadas';
  }
  function Pacientes({ s, act }) {
    const [dq, setDq] = useState(s.q);
    useEffect(() => { const t = setTimeout(() => setDq(s.q), 250); return () => clearTimeout(t); }, [s.q]);
    const [st] = useCarga(() => api('st_pacientes', { p_q: dq, p_seg: s.seg }), [dq, s.seg, s.rev]);
    if (s.pacSel) return html`<${Perfil} key=${s.pacSel} s=${s} act=${act} id=${s.pacSel} />`;
    const d = st.data;
    return html`
      <div class="vhead"><div><h1>Pacientes</h1><p>Cada peque tiene su ficha, a la que se vinculan las personas que lo traen, cada una con sus permisos.</p></div><div class="chips"><button type="button" class="btn primary" onClick=${() => act.modal('agendar', {})}>${I.plus(16)} Agendar cita</button></div></div>
      <div class="toolbar">
        <label class="searchwrap"><span class="vh">Buscar por peque, representante o teléfono</span>${I.search(18)}<input id="q" class="search" type="search" placeholder="Buscar por peque, representante o teléfono" value=${s.q} onInput=${(e) => act.set({ q: e.target.value })} /></label>
      </div>
      <div class="fchips" role="group" aria-label="Tipo de paciente">${SEGS.map((g) => html`<button type="button" key=${g.id} class="fchip" aria-pressed=${s.seg === g.id ? 'true' : 'false'} onClick=${() => act.set({ seg: g.id })}>${g.label} <span class="n">${d && d.conteo ? d.conteo[g.id] || 0 : '·'}</span></button>`)}</div>
      ${st.err ? html`<${Fallo} err=${st.err} />` : !d ? html`<${Cargando} />` : d.lista.length ? html`<ul class="plist">${d.lista.map((p) => { const rep = p.personas[0] || {}; return html`<li key=${p.id}><button type="button" class="prow" onClick=${() => act.abrirPac(p.id)}>
          ${Av(p.id, p.nombre)}
          <span class="stack"><b>${p.nombre}</b><span>${ageLabel(p.nacimiento)} · ${pill(SEG_TONE[p.segmento], segLabel(p.segmento))}</span></span>
          <span class="stack c-rep"><span>${rep.nombre || 'Sin representante'}${p.personas.length > 1 ? ' y ' + (p.personas.length - 1) + ' más' : ''}</span><span>${rep.canal ? 'Avisos por ' + CANAL[rep.canal] : ''}</span></span>
          <span class="stack c-next"><span>${nb(proximoPaso(p))}</span></span>
          <span class="c-chev muted">${I.chev(18)}</span>
        </button></li>`; })}</ul>` : html`<p class="empty">${s.q ? 'No hay pacientes con ese nombre en este grupo.' : 'Todavía no hay pacientes en este grupo.'}</p>`}`;
  }
  const TABS = [{ id: 'resumen', label: 'Resumen' }, { id: 'personas', label: 'Personas' }, { id: 'citas', label: 'Citas' }, { id: 'pagos', label: 'Pagos' }, { id: 'mensajes', label: 'Mensajes' }, { id: 'historia', label: 'Historia clínica' }];
  function Perfil({ s, act, id }) {
    const [st] = useCarga(() => api('st_paciente', { p_id: id }), [id, s.rev]);
    const tab = s.tab;
    const back = html`<button type="button" class="link self-start" onClick=${act.cerrarPac}>${I.back(16)} Pacientes</button>`;
    if (st.err && !st.data) return html`${back}<${Fallo} err=${st.err} />`;
    if (!st.data) return html`${back}<${Cargando} />`;
    const p = st.data;
    const tasa = s.resumen ? s.resumen.clinica.tasa_bcv : 0;
    let body = null;
    if (tab === 'resumen') {
      const proxima = p.citas.filter((c) => ['apartada', 'abono', 'confirmada', 'sala'].indexOf(c.estado) >= 0 && dayDiff(c.fecha) >= 0).sort((a, b) => (a.fecha + a.minuto < b.fecha + b.minuto ? -1 : 1))[0];
      const activas = p.personas.filter((x) => x.estado === 'activo');
      body = html`<div class="two">
        <section class="panel"><h2 class="vh">Resumen</h2>
          <dl class="kv">
            <dt>Próximo paso</dt><dd>${nb(proximoPaso(Object.assign({}, p, { proxima: proxima })))}</dd>
            <dt>Última visita</dt><dd>${p.ultima ? cap(longIso(p.ultima)) : 'Todavía no viene'}</dd>
            <dt>Nació</dt><dd>${dmy(p.nacimiento)} · ${ageLabel(p.nacimiento)}</dd>
            <dt>Tipo de paciente</dt><dd>${pill(SEG_TONE[p.segmento], segLabel(p.segmento))}</dd>
            <dt>Avisos</dt><dd>${activas.length ? activas.filter((x) => x.avisos).map((x) => first(x.nombre) + ' por ' + CANAL[x.canal] + (x.consejos ? ', con consejos' : '')).join('; ') || 'Nadie recibe avisos' : 'Sin personas vinculadas'}</dd>
            <dt>Alergias</dt><dd>${p.alergias || 'Ninguna registrada'}</dd>
          </dl>
        </section>
        <section class="panel"><div class="panel-h"><h2>${pt('blue', I.hoy(16))}Agenda</h2></div><p class="small m0">${proxima ? nb('Próxima cita: ' + longIso(proxima.fecha) + ' ' + alas(proxima.minuto) + '.') : 'No tiene citas próximas.'}</p><div class="actions"><button type="button" class="btn primary" onClick=${() => act.modal('agendar', { pac: { id: p.id, nombre: p.nombre } })}>${I.plus(16)} Agendar cita</button></div></section>
      </div>`;
    } else if (tab === 'personas') {
      body = html`<section class="panel"><div class="panel-h"><h2>${pt('pink', I.pacientes(16))}Personas vinculadas</h2><span class="small muted">Cada una entra con su propio enlace</span></div>
        <ul class="list">${p.personas.map((v) => html`<${PersonaRow} key=${v.vinculo} v=${v} p=${p} s=${s} act=${act} />`)}</ul>
      </section>`;
    } else if (tab === 'citas') {
      body = html`<section class="panel"><div class="panel-h"><h2>${pt('blue', I.hoy(16))}Citas</h2><button type="button" class="btn primary" onClick=${() => act.modal('agendar', { pac: { id: p.id, nombre: p.nombre } })}>${I.plus(16)} Agendar</button></div>
        ${p.citas.length ? html`<ul class="list">${p.citas.map((c) => html`<${CitaRow} key=${c.id} c=${c} s=${s} act=${act} />`)}</ul>` : html`<p class="empty">Sin citas.</p>`}</section>`;
    } else if (tab === 'pagos') {
      body = html`<section class="panel"><div class="panel-h"><h2>${pt('yel', I.pagos(16))}Pagos</h2></div>${p.pagos.length ? html`<ul class="list">${p.pagos.map((x) => html`<li key=${x.id}><div class="row"><span class="mono">${nb(cuando(x.reportado))}</span><span class="grow">${x.tipo === 'abono' ? 'Abono' : 'Resto de la consulta'} · ${METODOS[x.metodo].label}${x.persona ? ' · ' + first(x.persona.nombre) : ''}</span><b class="small">${nb(montoPago(x, tasa))}</b>${estadoPago(x)}</div></li>`)}</ul>` : html`<p class="empty">Sin pagos todavía.</p>`}</section>`;
    } else if (tab === 'mensajes') {
      const pend = p.mensajes.filter((m) => m.estado === 'pendiente');
      const hs = p.mensajes.filter((m) => m.estado === 'enviado');
      body = html`<section class="panel"><div class="panel-h"><h2>${pt('mint', I.mensajes(16))}Mensajes</h2><span class="small muted">Historial de envíos a cada persona</span></div>
        ${pend.length ? html`<ul class="mini">${pend.map((m) => html`<li class="hot" key=${m.id}><div class="top"><b>${m.nombre}</b><span class="small">por enviar a ${first(m.persona.nombre)}</span></div><div class="actions"><button type="button" class="btn wa" onClick=${() => act.modal('wa', { m: m })}>${I.send(15)} Enviar por WhatsApp</button></div></li>`)}</ul>` : null}
        ${hs.length ? html`<ol class="tl">${hs.map((m) => html`<li key=${m.id}><span class=${'tl-dot ' + (m.canal === 'wa' ? 'wa' : 'push')} aria-hidden="true"></span><div class="row"><b>${m.nombre}</b>${canalPill(m.canal)}<span class="small muted">${nb(cuando(m.enviado || m.programado))}</span></div><span class="small muted">Para ${m.persona.nombre} · ${m.enviado_por ? 'enviado por ' + m.enviado_por : 'automático'}</span></li>`)}</ol>` : html`<p class="empty">Todavía no hay mensajes enviados.</p>`}
      </section>`;
    } else {
      body = html`<${Historia} key=${p.id} s=${s} act=${act} p=${p} />`;
    }
    const vs = p.personas.filter((x) => x.estado === 'activo');
    return html`
      ${back}
      <div class="pf-head">${Av(p.id, p.nombre, 'lg')}<div class="grow"><h1>${p.nombre}</h1><p>${ageLabel(p.nacimiento)} · ${segLabel(p.segmento)} · ${vs.length === 1 ? '1 persona vinculada' : vs.length + ' personas vinculadas'}</p></div></div>
      <div class="tabs" role="tablist" aria-label="Ficha del paciente">${TABS.map((t) => html`<button type="button" role="tab" key=${t.id} class="tab" aria-selected=${tab === t.id ? 'true' : 'false'} onClick=${() => act.set({ tab: t.id })}>${t.id === 'historia' ? I.lock(15) : null}${t.label}</button>`)}</div>
      ${body}`;
  }
  function PersonaRow({ v, p, s, act }) {
    const doc = s.yo.rol === 'doctora';
    const [conf, setConf] = useState(null);
    const [busy, setBusy] = useState(false);
    const hacer = async (fn, msg) => { setBusy(true); await act.run(fn, msg); setBusy(false); setConf(null); };
    if (v.estado === 'invitado') return html`<li><div class="row">${Av(v.vinculo, v.nombre)}<span class="stack grow"><b>${v.nombre}</b><span class="small muted">${v.parentesco} · invitación sin aceptar</span></span>${pill('warn', 'Invitación pendiente')}</div></li>`;
    return html`<li><div class="row">${Av(v.id, v.nombre)}<span class="stack grow"><b>${v.nombre}</b><span class="small muted">${v.parentesco} · ${telTxt(v.telefono)}${v.correo ? ' · ' + v.correo : ''}</span></span>${v.legal ? (v.legal_confirmado ? pill('ok', 'Representante legal') : pill('warn', 'Representante por confirmar')) : pill('neutral', 'Autorizada')}</div>
      <div class="row mt8">${canalPill(v.canal)}${['avisos', 'agenda', 'pagos', 'historia'].map((k) => html`<span key=${k}>${pill(v[k] && (k !== 'historia' || (v.legal && v.legal_confirmado)) ? 'info' : 'off', { avisos: 'Avisos', agenda: 'Agenda', pagos: 'Pagos', historia: 'Informes' }[k])}</span>`)}<span class="small muted">${v.ultimo_acceso ? 'Entró ' + nb(cuando(v.ultimo_acceso).toLowerCase()) : 'No ha entrado'}</span></div>
      <div class="actions mt8">
        ${v.telefono ? html`<a class="btn" href=${waLink(v.telefono)} target="_blank" rel="noopener">${I.mensajes(15)} WhatsApp</a>` : null}
        <button type="button" class="btn" onClick=${() => setConf('enlace')}>Enviar enlace nuevo</button>
        ${doc && v.legal && !v.legal_confirmado ? html`<button type="button" class="btn primary" disabled=${busy} onClick=${() => hacer(() => api('st_vinculo', { p_vinculo: v.vinculo, p_cambios: { legal_confirmado: true, historia: true } }), 'Representante confirmado. Ya puede leer los informes.')}>Confirmar representante legal</button>` : null}
        <button type="button" class="btn ghost" onClick=${() => setConf('quitar')}>Quitar de la ficha</button>
      </div>
      ${conf === 'enlace' ? html`<${Confirmar} texto=${'Se crea un enlace nuevo para ' + first(v.nombre) + ' y el anterior deja de funcionar. El mensaje con el enlace queda en los WhatsApp por enviar.'} si="Crear enlace nuevo" busy=${busy} onNo=${() => setConf(null)} onSi=${() => hacer(() => api('st_nuevo_enlace', { p_persona: v.id }), 'Enlace nuevo listo. El mensaje quedó en los WhatsApp por enviar.')} />` : null}
      ${conf === 'quitar' ? html`<${Confirmar} texto=${first(v.nombre) + ' dejará de ver la ficha de ' + first(p.nombre) + ' y de recibir sus avisos.'} si="Sí, quitar" busy=${busy} onNo=${() => setConf(null)} onSi=${() => hacer(() => api('st_vinculo', { p_vinculo: v.vinculo, p_cambios: { quitar: true } }), first(v.nombre) + ' ya no está vinculada a la ficha.')} />` : null}
    </li>`;
  }
  function CitaRow({ c, s, act }) {
    const [conf, setConf] = useState(false);
    const viva = ['apartada', 'abono', 'confirmada'].indexOf(c.estado) >= 0 && dayDiff(c.fecha) >= 0;
    return html`<li><div class="row"><span class="mono">${nb(when(c.fecha, c.minuto))}</span><span class="grow">${motivoTxt(c)}</span>${estadoCita(c)}</div>
      ${viva ? html`<div class="actions mt8">${c.estado === 'apartada' ? html`<button type="button" class="btn" onClick=${() => act.modal('cobro', { c: c, tipo: 'abono' })}>Registrar abono</button>` : null}<button type="button" class="btn" onClick=${() => act.modal('mover', { c: c })}>Mover</button><button type="button" class="btn ghost" onClick=${() => setConf(true)}>Cancelar</button></div>` : null}
      ${conf ? html`<${Confirmar} texto="La familia recibe el aviso de la cancelación y la hora queda libre." si="Sí, cancelar la cita" onNo=${() => setConf(false)} onSi=${() => { setConf(false); act.run(() => api('st_cancelar_cita', { p_cita: c.id }), 'Cita cancelada. El aviso para la familia quedó listo.'); }} />` : null}
    </li>`;
  }
  const UPPER_T = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65];
  const LOWER_T = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75];
  const UPPER_P = [17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27];
  const LOWER_P = [47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37];
  const CICLO = ['', 'caries', 'sellante', 'restaurado', 'pendiente', 'ausente'];
  function Odonto({ nac, dientes, onTap }) {
    const mo = monthsOld(nac);
    const temp = mo < 72;
    const up = temp ? UPPER_T : UPPER_P;
    const lo = temp ? LOWER_T : LOWER_P;
    const half = up.length / 2;
    const row = (list, lower) => html`<div class="odo-row">${list.map((n, i) => html`${i === half ? html`<span class="odo-gap" aria-hidden="true"></span>` : null}<button type="button" class=${'tooth' + (lower ? ' lower' : '') + ' ' + (dientes[n] || '')} title=${'Diente ' + n + (dientes[n] ? ': ' + dientes[n] : '')} aria-label=${'Diente ' + n + (dientes[n] ? ', ' + dientes[n] : ', sano')} onClick=${() => onTap(n)}>${n}</button>`)}</div>`;
    return html`<div class="odo">
      ${row(up, false)}${row(lo, true)}
      <div class="legend"><span><i class="sw"></i>Sano</span><span><i class="sw caries"></i>Caries</span><span><i class="sw sellante"></i>Sellante</span><span><i class="sw restaurado"></i>Restaurado</span><span><i class="sw pendiente"></i>Pendiente</span><span><i class="sw ausente"></i>Ausente</span><span>${temp ? 'Dentición temporal' : 'Dentición permanente'}</span></div>
    </div>`;
  }
  function Historia({ s, act, p }) {
    const [st, setSt] = useState({ h: null, err: '' });
    const [draft, setDraft] = useState(null);
    const [busy, setBusy] = useState(false);
    useEffect(() => {
      let vivo = true;
      api('st_historia', { p_paciente: p.id }).then((h) => { if (vivo) { setSt({ h: h, err: '' }); if (!h.denegado) setDraft({ notas: h.notas || '', dientes: Object.assign({}, h.dientes || {}), alergias: h.alergias || '' }); } }, (e) => { if (vivo) setSt({ h: null, err: e.message }); });
      return () => { vivo = false; };
    }, [p.id]);
    if (st.err) return html`<${Fallo} err=${st.err} />`;
    if (!st.h) return html`<${Cargando} />`;
    if (st.h.denegado) return html`<div class="lock"><span class="lock-ic">${I.lock(20)}</span><b>La historia clínica solo la ve la doctora</b><p>Las familias leen los informes aprobados si son representantes legales confirmados. Este intento quedó en el registro de actividad, a tu nombre.</p><button type="button" class="link" onClick=${() => act.go('seguridad')}>Ver tu actividad</button></div>`;
    const tap = (n) => { const cur = draft.dientes[n] || ''; const next = CICLO[(CICLO.indexOf(cur) + 1) % CICLO.length]; const d = Object.assign({}, draft.dientes); if (next) d[n] = next; else delete d[n]; setDraft(Object.assign({}, draft, { dientes: d })); };
    const guardar = async () => { setBusy(true); await act.run(() => api('st_guardar_historia', { p_paciente: p.id, p_notas: draft.notas, p_dientes: draft.dientes, p_alergias: draft.alergias }), 'Historia clínica guardada.'); setBusy(false); };
    return html`<div class="two">
      <section class="panel"><div class="panel-h"><h2>${pt('blue', I.tooth(16))}Odontograma</h2><span class="small muted">Toca un diente para cambiar su estado</span></div><${Odonto} nac=${p.nacimiento} dientes=${draft.dientes} onTap=${tap} /></section>
      <section class="panel"><div class="panel-h"><h2>${pt('lav', I.plantillas(16))}Notas clínicas</h2></div>
        <div class="field"><label for="hc-notas">Notas</label><textarea id="hc-notas" class="ta" rows="6" value=${draft.notas} onInput=${(e) => setDraft(Object.assign({}, draft, { notas: e.target.value }))}></textarea></div>
        <div class="field"><label for="hc-alergias">Alergias</label><input id="hc-alergias" class="input" type="text" maxlength="300" value=${draft.alergias} onInput=${(e) => setDraft(Object.assign({}, draft, { alergias: e.target.value }))} /></div>
        <div class="actions"><button type="button" class="btn primary" disabled=${busy} onClick=${guardar}>${busy ? 'Guardando…' : 'Guardar'}</button></div>
        <p class="note">Esta apertura quedó registrada a nombre de ${s.yo.nombre}.</p>
      </section>
      ${st.h.informes && st.h.informes.length ? html`<section class="panel"><div class="panel-h"><h2>${pt('mint', I.check(16))}Informes aprobados</h2></div><ul class="list">${st.h.informes.map((i) => html`<li key=${i.id}><b>${cap(longIso(i.fecha))}</b><p class="small m0">${i.vimos}</p>${i.proximo ? html`<p class="small muted m0">${i.proximo}</p>` : null}</li>`)}</ul></section>` : null}
    </div>`;
  }

  /* ---------- Vista: Mensajes ---------- */
  function Mensajes({ s, act }) {
    const [st] = useCarga(() => api('st_mensajes'), [s.rev]);
    if (!st.data) return st.err ? html`<${Fallo} err=${st.err} />` : html`<${Cargando} />`;
    const d = st.data;
    const activas = d.cola.filter((m) => d.pausadas.indexOf(m.plantilla) < 0).sort((x, y) => PRIO.indexOf(x.plantilla) - PRIO.indexOf(y.plantilla));
    const pausados = d.cola.length - activas.length;
    const groups = [];
    activas.forEach((m) => { let g = groups.find((x) => x.tpl === m.plantilla); if (!g) { g = { tpl: m.plantilla, nombre: m.nombre, regla: m.regla, items: [] }; groups.push(g); } g.items.push(m); });
    return html`
      <div class="vhead"><div><h1>Mensajes</h1><p>Cada familia recibe el mensaje que corresponde a su tipo y a su momento; de esta lista salen con un toque los que van por WhatsApp.</p></div></div>
      <div class="two">
        <section class="panel" aria-labelledby="h-cola">
          <div class="panel-h"><h2 id="h-cola">${pt('mint', I.mensajes(16))}WhatsApp por enviar</h2>${activas.length ? html`<span class="badge">${activas.length}</span>` : null}</div>
          ${groups.length ? groups.map((g) => html`<div class="qgroup" key=${g.tpl}><h3>${g.nombre} <small>${nb(g.regla)}</small></h3>${g.items.map((m) => html`<div class="qitem" key=${m.id}><div class="row"><b class="grow">${m.persona.nombre}</b><span class="small muted">${m.paciente ? first(m.paciente.nombre) + ' · ' : ''}${telTxt(m.persona.telefono)}</span></div><p class="qprev">${nb(conOrigen(m.texto))}</p><div class="actions"><button type="button" class="btn wa" onClick=${() => act.modal('wa', { m: m })}>${I.send(15)} Enviar por WhatsApp</button><button type="button" class="btn ghost" onClick=${() => act.run(() => api('st_omitir', { p_mensaje: m.id }), 'Mensaje omitido.')}>Omitir</button></div></div>`)}</div>`) : html`<p class="empty">No hay WhatsApp pendientes.</p>`}
          ${pausados ? html`<p class="small muted m0">${pausados === 1 ? 'Un mensaje está en espera porque su plantilla está pausada.' : pausados + ' mensajes están en espera porque su plantilla está pausada.'}</p>` : null}
        </section>
        <div class="col">
          <section class="panel" aria-labelledby="h-hist">
            <div class="panel-h"><h2 id="h-hist">${pt('blue', I.bell(16))}Enviados</h2><span class="small muted">Últimos tres días</span></div>
            ${d.historial.length ? html`<ol class="tl">${d.historial.map((x) => html`<li key=${x.id}><span class=${'tl-dot ' + (x.canal === 'wa' ? 'wa' : 'push')} aria-hidden="true"></span><div class="row"><b>${x.nombre}</b>${canalPill(x.canal)}</div><span class="small muted">${x.persona.nombre} · ${nb(cuando(x.cuando))} · ${x.enviado_por ? 'por ' + x.enviado_por : 'automático'}</span></li>`)}</ol>` : html`<p class="empty">Todavía no hay envíos.</p>`}
          </section>
          <section class="panel" aria-labelledby="h-reglas">
            <div class="panel-h"><h2 id="h-reglas">${pt('lav', I.plantillas(16))}Reglas de envío</h2><button type="button" class="link" onClick=${() => act.go('plantillas')}>Plantillas</button></div>
            <ul class="rules">
              <li><span class="muted">${I.bell(16)}</span><span><b>Recordatorios:</b> se preparan el día anterior. Si la familia prefiere WhatsApp, entran en esta lista; si prefiere su enlace, le aparecen allí.</span></li>
              <li><span class="muted">${I.check(16)}</span><span><b>Confirmaciones:</b> al verificar un abono, el mensaje con el enlace de la familia queda listo aquí.</span></li>
              <li><span class="muted">${I.hoy(16)}</span><span><b>Controles:</b> a los cinco meses y medio de la última visita, la familia recibe la invitación para elegir el día.</span></li>
              <li><span class="muted">${I.lock(16)}</span><span><b>Consejos y cumpleaños:</b> solo para las familias que los aceptaron.</span></li>
            </ul>
          </section>
        </div>
      </div>`;
  }

  /* ---------- Vista: Plantillas ---------- */
  function Plantillas({ s, act }) {
    const [st] = useCarga(() => api('st_plantillas'), [s.rev]);
    if (!st.data) return st.err ? html`<${Fallo} err=${st.err} />` : html`<${Cargando} />`;
    const list = st.data.filter((t) => s.tplSeg === 'todos' || t.segmento === s.tplSeg || t.segmento === 'todos');
    const t = list.find((x) => x.id === s.tplSel) || list[0];
    return html`
      <div class="vhead"><div><h1>Plantillas</h1><p>Hay un mensaje para cada tipo de familia y cada momento, que se llena con los datos del peque y de quien lo representa.</p></div></div>
      <div class="fchips" role="group" aria-label="Tipo de paciente">${SEGS.map((g) => html`<button type="button" key=${g.id} class="fchip" aria-pressed=${s.tplSeg === g.id ? 'true' : 'false'} onClick=${() => act.set({ tplSeg: g.id })}>${g.label}</button>`)}</div>
      <div class="tplgrid">
        <ul class="tpllist">${list.map((x) => html`<li key=${x.id}><button type="button" class="tplbtn" aria-current=${t && t.id === x.id ? 'true' : 'false'} onClick=${() => act.set({ tplSel: x.id })}><span class="row"><b class="grow">${x.nombre}</b>${x.activa ? null : pill('neutral', 'Pausada')}</span><span>${segLabel(x.segmento)} · ${x.canal === 'wa' ? 'WhatsApp con un toque' : 'Automático'}</span></button></li>`)}</ul>
        ${t ? html`<${TplEditor} key=${t.id + t.cuerpo} s=${s} act=${act} t=${t} />` : null}
      </div>`;
  }
  function TplEditor({ s, act, t }) {
    const [draft, setDraft] = useState(t.cuerpo || '');
    const taRef = useRef(null);
    const vars = ['representante', 'peque', 'fecha', 'hora', 'enlace', 'ultima', 'edad'].concat(t.id === 'pago_revisar' ? ['monto', 'metodo'] : []);
    let dia = parseIso(HOY);
    do { dia = new Date(dia.getTime() + 86400000); } while (dia.getUTCDay() === 0 || dia.getUTCDay() === 6);
    const tasa = s.resumen ? Number(s.resumen.clinica.tasa_bcv) : 0;
    const abono = s.resumen ? Number(s.resumen.clinica.abono_usd) : 15;
    const ctx = { representante: 'Daniela', peque: 'Amelia', fecha: longIso(isoOf(dia)), hora: fmt(885), enlace: window.location.origin + '/c/…', ultima: monthYear(addMonthsIso(HOY, -6)), edad: '7 años', monto: 'Bs. ' + fmtNum(abono * tasa), metodo: 'Pago Móvil' };
    const fill = (body) => body.replace(/\{(\w+)\}/g, (m, k) => (ctx[k] != null ? ctx[k] : m)).replace(RX_DOBLE, '$1');
    const insert = (v) => {
      const el = taRef.current;
      const tok = '{' + v + '}';
      const a0 = el && typeof el.selectionStart === 'number' ? el.selectionStart : draft.length;
      const b0 = el && typeof el.selectionEnd === 'number' ? el.selectionEnd : draft.length;
      setDraft(draft.slice(0, a0) + tok + draft.slice(b0));
      setTimeout(() => { try { el.focus(); el.setSelectionRange(a0 + tok.length, a0 + tok.length); } catch (e) { /* sin selección */ } }, 0);
    };
    const changed = draft !== t.cuerpo;
    return html`<section class="panel" aria-labelledby="h-tpl">
      <div class="panel-h"><h2 id="h-tpl">${pt('lav', I.plantillas(16))}${t.nombre}</h2><label class="switch"><input type="checkbox" checked=${!!t.activa} onChange=${() => act.run(() => api('st_guardar_plantilla', { p_id: t.id, p_cuerpo: null, p_activa: !t.activa }), t.activa ? 'Plantilla pausada.' : 'Plantilla activa.')} />${t.activa ? 'Activa' : 'Pausada'}</label></div>
      <dl class="kv"><dt>Para</dt><dd>${segDesc(t.segmento)}</dd><dt>Cuándo sale</dt><dd>${nb(t.regla)}</dd><dt>Canal</dt><dd>${t.canal === 'wa' ? 'WhatsApp, con un toque desde la lista de mensajes' : 'Automático en el enlace de la familia; por WhatsApp si la familia lo prefiere'}</dd></dl>
      <div class="field"><label for="tpl-body">Texto</label><textarea id="tpl-body" class="ta" rows="5" ref=${taRef} value=${draft} onInput=${(e) => setDraft(e.target.value)}></textarea></div>
      <div class="vars" role="group" aria-label="Insertar un dato">${vars.map((v) => html`<button type="button" key=${v} class="var" onClick=${() => insert(v)}>${'{' + v + '}'}</button>`)}</div>
      <div class="field"><span class="flabel">Así le llega a Daniela, con los datos de Amelia</span><p class="qprev">${nb(fill(draft))}</p></div>
      <div class="actions"><button type="button" class="btn primary" disabled=${!changed} onClick=${() => act.run(() => api('st_guardar_plantilla', { p_id: t.id, p_cuerpo: draft, p_activa: null }), 'Plantilla guardada. Los mensajes nuevos salen con este texto.')}>Guardar cambios</button>${changed ? html`<button type="button" class="btn ghost" onClick=${() => setDraft(t.cuerpo)}>Descartar</button>` : null}</div>
    </section>`;
  }

  /* ---------- Vista: Pagos ---------- */
  function Pagos({ s, act }) {
    const [st] = useCarga(() => api('st_pagos', { p_fecha: null }), [s.rev]);
    const [tasa, setTasa] = useState('');
    if (!st.data) return st.err ? html`<${Fallo} err=${st.err} />` : html`<${Cargando} />`;
    const d = st.data;
    const tz = Number(d.tasa_bcv);
    const resto = Number(d.total_usd) - Number(d.abono_usd);
    const tot = {};
    const totBs = {};
    Object.keys(METODOS).forEach((k) => { const ps = d.movimientos.filter((p) => p.metodo === k); tot[k] = ps.reduce((a, p) => a + Number(p.usd), 0); totBs[k] = ps.reduce((a, p) => a + Number(p.bs || 0), 0); });
    const totalUsd = Object.keys(tot).reduce((a, k) => a + tot[k], 0);
    const guardarTasa = () => {
      const v = Number(String(tasa).replace(/\./g, '').replace(',', '.'));
      if (!(v > 0)) { act.say('Escribe la tasa con números, por ejemplo 891,11.'); return; }
      act.run(() => api('st_guardar_ajustes', { p: { tasa_bcv: v } }), 'Tasa actualizada. Los montos en bolívares ya usan la nueva.').then((r) => { if (r !== undefined) setTasa(''); });
    };
    return html`
      <div class="vhead"><div><h1>Pagos</h1><p>Cada abono se confirma al verlo en la app del banco, antes de que la cita quede confirmada.</p></div><div class="chips"><span class="chip bcv">${nb('BCV Bs. ' + fmtNum(tz))}</span></div></div>
      <div class="stats">
        <div class=${'stat t-yel' + (d.por_verificar.length ? ' hot' : '')}><b>${d.por_verificar.length}</b><span>Por verificar</span><small>Abonos y restos reportados</small></div>
        <div class="stat t-mint"><b>${nb('$ ' + fmtNum(totalUsd))}</b><span>Conciliado hoy</span><small>${d.movimientos.length} pagos</small></div>
        <div class="stat t-pink"><b>${d.restos.length}</b><span>Restos por cobrar</span><small>${nb(usd(resto) + ' cada uno, al llegar')}</small></div>
        <div class="stat t-lav"><b>${nb(usd(d.total_usd))}</b><span>Valor de la consulta</span><small>${nb(usd(d.abono_usd) + ' de abono y ' + usd(resto) + ' al llegar')}</small></div>
      </div>
      <div class="two">
        <div class="col">
          <section class="panel" aria-labelledby="h-pv">
            <div class="panel-h"><h2 id="h-pv">${pt('yel', I.pagos(16))}Por verificar</h2></div>
            ${d.por_verificar.length ? html`<ul class="mini">${d.por_verificar.map((p) => html`<${PagoItem} key=${p.id} p=${p} s=${s} act=${act} tasa=${tz} />`)}</ul>` : html`<p class="empty">Todo está conciliado.</p>`}
          </section>
          <section class="panel" aria-labelledby="h-restos">
            <div class="panel-h"><h2 id="h-restos">${pt('pink', I.pagos(16))}Restos por cobrar hoy</h2></div>
            ${d.restos.length ? html`<ul class="list">${d.restos.map((c) => html`<li key=${c.id}><div class="row">${tcol(c.minuto)}<span class="stack fill"><b>${c.pac.nombre}</b><span class="small muted">${nombresDe(c.personas)}</span></span><button type="button" class="btn" onClick=${() => act.modal('cobro', { c: c, tipo: 'resto' })}>Cobrar</button></div></li>`)}</ul>` : html`<p class="empty">No quedan restos por cobrar hoy.</p>`}
          </section>
        </div>
        <div class="col">
          <section class="panel" aria-labelledby="h-cierre">
            <div class="panel-h"><h2 id="h-cierre">${pt('mint', I.check(16))}Cierre del día</h2><span class="small muted">${cap(longIso(d.fecha))}</span></div>
            <div class="tablewrap"><table class="t"><thead><tr><th>Método</th><th class="num">Recibido</th></tr></thead>
              <tbody>${Object.keys(METODOS).map((k) => html`<tr key=${k}><td>${METODOS[k].label}</td><td class="num">${tot[k] ? html`<span class="amt"><span>${nb(METODOS[k].mon === 'bs' ? 'Bs. ' + fmtNum(totBs[k] || tot[k] * tz) : montoMetodo(k, tot[k], tz))}</span>${METODOS[k].mon === 'bs' ? html`<span class="small muted">${nb('$ ' + fmtNum(tot[k]))}</span>` : null}</span>` : '—'}</td></tr>`)}</tbody>
              <tfoot><tr><td>Total en dólares</td><td class="num">${nb('$ ' + fmtNum(totalUsd))}</td></tr></tfoot>
            </table></div>
          </section>
          <section class="panel" aria-labelledby="h-mov">
            <div class="panel-h"><h2 id="h-mov">${pt('blue', I.hoy(16))}Movimientos de hoy</h2></div>
            ${d.movimientos.length ? html`<ul class="list">${d.movimientos.map((p) => html`<li key=${p.id}><div class="row">${tcol(tsCar(p.verificado).min)}<span class="stack fill"><b>${p.persona ? p.persona.nombre : 'Familia'}</b><span class="small muted">${(p.tipo === 'abono' ? 'Abono' : 'Resto') + ' de ' + (p.paciente ? first(p.paciente.nombre) : '') + ' · ' + METODOS[p.metodo].label}</span></span><b class="small">${nb(montoPago(p, tz))}</b></div></li>`)}</ul>` : html`<p class="empty">Todavía no hay pagos conciliados hoy.</p>`}
          </section>
          <section class="panel" aria-labelledby="h-tasa">
            <div class="panel-h"><h2 id="h-tasa">${pt('lav', I.pagos(16))}Tasa BCV</h2></div>
            <p class="small muted m0">Con esta tasa se calculan los montos en bolívares del Pago Móvil y la transferencia.</p>
            <div class="row"><input class="input grow" type="text" inputmode="decimal" aria-label="Tasa BCV en bolívares por dólar" placeholder=${fmtNum(tz)} value=${tasa} onInput=${(e) => setTasa(e.target.value)} /><button type="button" class="btn primary" disabled=${!tasa} onClick=${guardarTasa}>Actualizar</button></div>
          </section>
        </div>
      </div>`;
  }

  /* ---------- Vista: Seguridad ---------- */
  const PERM_ROWS = [
    ['Agenda y citas', 'yes', 'yes', 'Solo las de sus peques'],
    ['Pagos', 'yes', 'yes', 'Solo los suyos, si tienen permiso'],
    ['Mensajes y plantillas', 'yes', 'yes', 'Los reciben'],
    ['Datos de contacto', 'yes', 'yes', 'Solo los suyos'],
    ['Historia clínica', 'yes', 'no', 'Informes aprobados, si son representantes legales confirmados'],
    ['Equipo, ajustes y datos de ejemplo', 'yes', 'no', 'No']
  ];
  function MfaPanel({ s, act, onListo, compacto }) {
    const [st, setSt] = useState({ factores: null, err: '' });
    const [enr, setEnr] = useState(null);
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const [quitar, setQuitar] = useState(false);
    const cargar = async () => {
      const r = await sb.auth.mfa.listFactors();
      if (r.error) { setSt({ factores: [], err: 'No se pudo consultar el segundo factor.' }); return; }
      setSt({ factores: r.data.all || [], err: '' });
    };
    useEffect(() => { cargar(); }, []);
    const verificado = (st.factores || []).find((f) => f.factor_type === 'totp' && f.status === 'verified');
    const empezar = async () => {
      setBusy(true); setErr('');
      try {
        for (const f of (st.factores || []).filter((x) => x.status !== 'verified')) await sb.auth.mfa.unenroll({ factorId: f.id });
        const r = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Dientario ' + new Date().toISOString().slice(0, 16) });
        if (r.error) throw r.error;
        setEnr(r.data);
      } catch (e) { setErr('No se pudo empezar. ' + (e.message || '')); }
      setBusy(false);
    };
    const verificar = async () => {
      if (!/^\d{6}$/.test(code.trim())) { setErr('Escribe los seis dígitos del código.'); return; }
      setBusy(true); setErr('');
      const ch = await sb.auth.mfa.challenge({ factorId: enr.id });
      if (ch.error) { setErr('No se pudo verificar. Inténtalo de nuevo.'); setBusy(false); return; }
      const v = await sb.auth.mfa.verify({ factorId: enr.id, challengeId: ch.data.id, code: code.trim() });
      if (v.error) { setErr('El código no coincide. Revisa la hora del teléfono y escribe el código que se ve ahora.'); setBusy(false); return; }
      setEnr(null); setCode(''); setBusy(false);
      await cargar();
      act.say('Segundo factor activo. Desde ahora la consola te pedirá el código al entrar.');
      if (onListo) onListo();
    };
    const desactivar = async () => {
      setBusy(true);
      const r = await sb.auth.mfa.unenroll({ factorId: verificado.id });
      setBusy(false); setQuitar(false);
      if (r.error) { act.say('No se pudo quitar. Cierra sesión, entra de nuevo con el código e inténtalo otra vez.'); return; }
      await sb.auth.refreshSession();
      await cargar();
      act.say('Quitamos el segundo factor de tu cuenta.');
      if (onListo) onListo();
    };
    if (!st.factores) return html`<${Cargando} />`;
    if (enr) {
      const qr = enr.totp && enr.totp.qr_code ? (/^data:/.test(enr.totp.qr_code) ? enr.totp.qr_code : 'data:image/svg+xml;utf-8,' + encodeURIComponent(enr.totp.qr_code)) : '';
      return html`<div class="stack gap12">
        <p class="m0">1. Abre tu app autenticadora (Google Authenticator, Microsoft Authenticator o la que uses) y escanea este código.</p>
        ${qr ? html`<img class="qr" src=${qr} alt="Código QR para la app autenticadora" />` : null}
        <p class="small muted m0">Si no puedes escanearlo, escribe esta clave en la app:</p><span class="secret">${enr.totp && enr.totp.secret}</span>
        <div class="field"><label for="mfa-code">2. Escribe el código de seis dígitos que muestra la app</label><input id="mfa-code" class="input code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" value=${code} onInput=${(e) => { setCode(e.target.value.replace(/\D/g, '')); setErr(''); }} /></div>
        ${err ? html`<p class="err" role="alert">${err}</p>` : null}
        <div class="actions"><button type="button" class="btn primary" disabled=${busy} onClick=${verificar}>${busy ? 'Verificando…' : 'Activar'}</button><button type="button" class="btn ghost" onClick=${() => { setEnr(null); setErr(''); }}>Cancelar</button></div>
      </div>`;
    }
    if (verificado) {
      return html`<div class="stack gap8"><div class="row">${pill('ok', 'Activo')}<span class="small muted">Al entrar, la consola te pide el código de la app.</span></div>
        ${compacto ? null : quitar ? html`<${Confirmar} texto="Sin el segundo factor, basta tu contraseña para entrar a la consola." si="Sí, quitarlo" busy=${busy} onNo=${() => setQuitar(false)} onSi=${desactivar} />` : html`<button type="button" class="link self-start" onClick=${() => setQuitar(true)}>Quitar el segundo factor</button>`}</div>`;
    }
    return html`<div class="stack gap8"><p class="m0 small">Con el segundo factor, entrar a la consola pide tu contraseña y un código que cambia cada 30 segundos en tu teléfono.</p>${err ? html`<p class="err" role="alert">${err}</p>` : null}<div class="actions"><button type="button" class="btn primary" disabled=${busy} onClick=${empezar}>Activar el segundo factor</button></div></div>`;
  }
  function Seguridad({ s, act }) {
    const doc = s.yo.rol === 'doctora';
    const [solo, setSolo] = useState(false);
    const [eq] = useCarga(() => api('st_equipo'), [s.rev]);
    const [au] = useCarga(() => api('st_auditoria', { p_solo_clinico: solo }), [s.rev, solo]);
    const [inv, setInv] = useState({ correo: '', nombre: '', rol: 'asistente' });
    const [ierr, setIerr] = useState('');
    const [quitar, setQuitar] = useState(null);
    const invitar = async () => {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(inv.correo.trim())) { setIerr('Revisa el correo.'); return; }
      if (inv.nombre.trim().length < 3) { setIerr('Escribe el nombre.'); return; }
      const r = await act.run(() => api('st_invitar_staff', { p_correo: inv.correo.trim(), p_nombre: inv.nombre.trim(), p_rol: inv.rol }), 'Invitación guardada. Cuando entre con ese correo, tendrá acceso.');
      if (r !== undefined) setInv({ correo: '', nombre: '', rol: 'asistente' });
    };
    return html`
      <div class="vhead"><div><h1>Seguridad</h1><p>Los permisos de cada rol y el registro de lo que se hace en la consola, con nombre y hora.</p></div></div>
      <div class="two">
        <div class="col">
          <section class="panel" aria-labelledby="h-mfa">
            <div class="panel-h"><h2 id="h-mfa">${pt('peach', I.phone(16))}Tu segundo factor</h2></div>
            <${MfaPanel} s=${s} act=${act} onListo=${act.bump} />
          </section>
          <section class="panel" aria-labelledby="h-eq">
            <div class="panel-h"><h2 id="h-eq">${pt('pink', I.pacientes(16))}Equipo</h2></div>
            ${!eq.data ? html`<${Cargando} />` : html`<ul class="list">${eq.data.staff.map((x) => html`<li key=${x.id}><div class="row">${Av(x.id, x.nombre)}<span class="stack grow"><b>${x.nombre}${x.yo ? ' (tú)' : ''}</b><span class="small muted">${x.rol === 'doctora' ? 'Doctora · acceso completo' : 'Asistente · agenda, pagos y mensajes'} · ${x.correo}</span></span>${x.activo ? (x.mfa ? pill('ok', 'Segundo factor activo') : pill('warn', 'Sin segundo factor')) : pill('neutral', 'Sin acceso')}</div>
                ${doc && !x.yo && x.activo ? (quitar === x.id ? html`<${Confirmar} texto=${first(x.nombre) + ' no podrá volver a entrar a la consola.'} si="Sí, quitar el acceso" onNo=${() => setQuitar(null)} onSi=${() => { setQuitar(null); act.run(() => api('st_quitar_staff', { p_user: x.id }), 'Acceso quitado.'); }} />` : html`<div class="actions mt8"><button type="button" class="btn ghost" onClick=${() => setQuitar(x.id)}>Quitar el acceso</button></div>`) : null}</li>`)}</ul>
              ${doc && eq.data.invitaciones.length ? html`<div class="stack gap8"><span class="lbl">Invitaciones sin usar</span>${eq.data.invitaciones.map((i) => html`<div class="row" key=${i.correo}><span class="grow">${i.nombre} · ${i.correo}</span>${pill('neutral', i.rol === 'doctora' ? 'Doctora' : 'Asistente')}</div>`)}</div>` : null}
              ${doc ? html`<div class="stack gap12"><span class="lbl">Invitar a alguien del equipo</span>
                <div class="grid2"><div class="field"><label for="iv-nombre">Nombre</label><input id="iv-nombre" class="input" type="text" value=${inv.nombre} onInput=${(e) => { setInv(Object.assign({}, inv, { nombre: e.target.value })); setIerr(''); }} /></div><div class="field"><label for="iv-correo">Correo</label><input id="iv-correo" class="input" type="email" value=${inv.correo} onInput=${(e) => { setInv(Object.assign({}, inv, { correo: e.target.value })); setIerr(''); }} /></div></div>
                <div class="field"><label for="iv-rol">Rol</label><select id="iv-rol" class="select" value=${inv.rol} onChange=${(e) => setInv(Object.assign({}, inv, { rol: e.target.value }))}><option value="asistente">Asistente</option><option value="doctora">Doctora</option></select></div>
                ${ierr ? html`<p class="err" role="alert">${ierr}</p>` : null}
                <p class="small muted m0">La cuenta con ese correo se crea en Supabase, en Authentication, Users, Add user. Al entrar por primera vez, la persona queda con este rol.</p>
                <div class="actions"><button type="button" class="btn primary" onClick=${invitar}>Guardar la invitación</button></div></div>` : null}`}
          </section>
          <section class="panel" aria-labelledby="h-perm">
            <div class="panel-h"><h2 id="h-perm">${pt('peach', I.seguridad(16))}Permisos por rol</h2></div>
            <div class="tablewrap permtable"><table class="t"><thead><tr><th>Área</th><th>Doctora</th><th>Asistente</th><th>Familias</th></tr></thead>
              <tbody>${PERM_ROWS.map((r) => html`<tr key=${r[0]}><td>${r[0]}</td><td class="yes">${I.check(16)}<span class="vh">Sí</span></td><td class=${r[2] === 'yes' ? 'yes' : 'no'}>${r[2] === 'yes' ? I.check(16) : I.lock(16)}<span class="vh">${r[2] === 'yes' ? 'Sí' : 'No'}</span></td><td class="small">${r[3]}</td></tr>`)}</tbody>
            </table></div>
            <ul class="permlist">${PERM_ROWS.map((r) => html`<li key=${r[0]}><b>${r[0]}</b><span class="row">${pill('ok', 'Doctora')}${pill(r[2] === 'yes' ? 'ok' : 'off', 'Asistente')}<span class="small muted">${'Familias: ' + r[3].toLowerCase()}</span></span></li>`)}</ul>
          </section>
        </div>
        <div class="col">
          <section class="panel" aria-labelledby="h-reg">
            <div class="panel-h"><h2 id="h-reg">${pt('lav', I.lock(16))}${doc ? 'Registro de actividad' : 'Tu actividad'}</h2><label class="switch"><input type="checkbox" checked=${solo} onChange=${(e) => setSolo(e.target.checked)} />Solo historia clínica</label></div>
            ${!au.data ? (au.err ? html`<${Fallo} err=${au.err} />` : html`<${Cargando} />`) : au.data.length ? html`<ol class="tl">${au.data.map((x) => html`<li key=${x.id}><span class=${'tl-dot k-' + x.tipo} aria-hidden="true"></span><div class="row"><b>${x.actor}</b><span class="small muted">${nb(cuando(x.cuando))}</span>${x.tipo === 'denegado' ? pill('bad', 'Denegado') : x.tipo === 'clinico' ? pill('accent', 'Historia clínica') : x.actor_tipo === 'familia' ? pill('info', 'Familia') : null}</div><span class="small">${x.accion}</span></li>`)}</ol>` : html`<p class="empty">Nada en este filtro.</p>`}
          </section>
          <section class="panel" aria-labelledby="h-reglas-db">
            <div class="panel-h"><h2 id="h-reglas-db">${pt('peach', I.lock(16))}Reglas de la base de datos</h2></div>
            <ul class="rules">
              <li><span class="muted">${I.lock(16)}</span><span>Ninguna tabla se lee directamente desde la web: cada pantalla pasa por funciones que revisan quién pide qué.</span></li>
              <li><span class="muted">${I.lock(16)}</span><span>Cada familia ve solo a los peques con los que tiene vínculo, con su enlace personal.</span></li>
              <li><span class="muted">${I.lock(16)}</span><span>La historia clínica la abre solo la doctora; cada apertura y cada intento sin permiso quedan en este registro.</span></li>
              <li><span class="muted">${I.lock(16)}</span><span>Las invitaciones de las familias sirven una vez y vencen en 24 horas.</span></li>
              <li><span class="muted">${I.lock(16)}</span><span>El equipo entra con correo y contraseña, y con el código de la app autenticadora si lo activa.</span></li>
            </ul>
          </section>
        </div>
      </div>`;
  }

  /* ---------- Vista: Ajustes ---------- */
  function Ajustes({ s, act }) {
    const doc = s.yo.rol === 'doctora';
    const [st] = useCarga(() => api('st_ajustes'), [s.rev]);
    const [f, setF] = useState(null);
    const [nueva, setNueva] = useState('');
    const [busy, setBusy] = useState(false);
    const [borrar, setBorrar] = useState(false);
    useEffect(() => { if (st.data) setF(JSON.parse(JSON.stringify(st.data))); }, [st.data]);
    if (!st.data || !f) return st.err ? html`<${Fallo} err=${st.err} />` : html`<${Cargando} />`;
    const set = (k, v) => setF(Object.assign({}, f, { [k]: v }));
    const setIn = (g, k, v) => setF(Object.assign({}, f, { [g]: Object.assign({}, f[g], { [k]: v }) }));
    const num = (t) => Number(String(t).replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
    const inp = (id, label, val, on, extra) => html`<div class="field"><label for=${id}>${label}</label><input id=${id} class="input" type="text" value=${val == null ? '' : val} onInput=${(e) => on(e.target.value)} ...${extra || {}} /></div>`;
    const guardar = async () => {
      const p = doc ? {
        nombre: f.nombre, doctora: f.doctora, direccion: f.direccion, whatsapp: f.whatsapp,
        abono_usd: num(f.abono_usd), total_usd: num(f.total_usd), tasa_bcv: num(f.tasa_bcv),
        pago_movil: f.pago_movil, transferencia: f.transferencia, zelle: f.zelle, binance: f.binance,
        horas: f.horas, exigir_2fa: !!f.exigir_2fa
      } : { tasa_bcv: num(f.tasa_bcv) };
      if (!(p.tasa_bcv > 0) || (doc && (!(p.abono_usd > 0) || !(p.total_usd >= p.abono_usd)))) { act.say('Revisa los montos: la tasa y el abono van con números, y el total no puede ser menor que el abono.'); return; }
      setBusy(true);
      await act.run(() => api('st_guardar_ajustes', { p: p }), 'Ajustes guardados.');
      setBusy(false);
    };
    const agregarHora = () => { const m = /^(\d{1,2}):(\d{2})$/.exec(nueva); if (!m) return; const v = +m[1] * 60 + +m[2]; if (f.horas.indexOf(v) < 0) set('horas', f.horas.concat([v]).sort((a, b) => a - b)); setNueva(''); };
    const linkFam = window.location.origin + '/';
    return html`
      <div class="vhead"><div><h1>Ajustes</h1><p>${doc ? 'Los datos del consultorio que ven las familias, los datos para recibir pagos y el horario de citas.' : 'La tasa BCV del día; el resto de los ajustes los maneja la doctora.'}</p></div></div>
      <div class="two">
        <div class="col">
          ${doc ? html`<section class="panel"><div class="panel-h"><h2>${pt('blue', I.hoy(16))}Consultorio</h2></div>
            <div class="grid2">${inp('aj-nombre', 'Nombre', f.nombre, (v) => set('nombre', v))}${inp('aj-doctora', 'Doctora', f.doctora, (v) => set('doctora', v))}</div>
            ${inp('aj-dir', 'Dirección', f.direccion, (v) => set('direccion', v))}
            ${inp('aj-wa', 'WhatsApp del consultorio', f.whatsapp, (v) => set('whatsapp', v), { inputmode: 'tel', placeholder: '0414 000 00 00' })}
          </section>` : null}
          <section class="panel"><div class="panel-h"><h2>${pt('yel', I.pagos(16))}Montos</h2></div>
            <div class="grid2">${inp('aj-tasa', 'Tasa BCV (Bs. por dólar)', String(f.tasa_bcv).replace('.', ','), (v) => set('tasa_bcv', v), { inputmode: 'decimal' })}${doc ? inp('aj-abono', 'Abono en dólares', String(f.abono_usd).replace('.', ','), (v) => set('abono_usd', v), { inputmode: 'decimal' }) : null}${doc ? inp('aj-total', 'Total de la consulta', String(f.total_usd).replace('.', ','), (v) => set('total_usd', v), { inputmode: 'decimal' }) : null}</div>
            ${doc ? null : html`<div class="actions"><button type="button" class="btn primary" disabled=${busy} onClick=${guardar}>Guardar la tasa</button></div>`}
          </section>
          ${doc ? html`<section class="panel"><div class="panel-h"><h2>${pt('mint', I.pagos(16))}Datos para recibir pagos</h2></div>
            <span class="lbl">Pago Móvil</span>
            <div class="grid2">${inp('aj-pm-banco', 'Banco y código', f.pago_movil.banco, (v) => setIn('pago_movil', 'banco', v))}${inp('aj-pm-tel', 'Teléfono', f.pago_movil.telefono, (v) => setIn('pago_movil', 'telefono', v))}${inp('aj-pm-rif', 'Cédula o RIF', f.pago_movil.rif, (v) => setIn('pago_movil', 'rif', v))}</div>
            <span class="lbl">Transferencia</span>
            <div class="grid2">${inp('aj-tr-banco', 'Banco', f.transferencia.banco, (v) => setIn('transferencia', 'banco', v))}${inp('aj-tr-cuenta', 'Número de cuenta', f.transferencia.cuenta, (v) => setIn('transferencia', 'cuenta', v))}${inp('aj-tr-tit', 'Titular', f.transferencia.titular, (v) => setIn('transferencia', 'titular', v))}${inp('aj-tr-rif', 'Cédula o RIF', f.transferencia.rif, (v) => setIn('transferencia', 'rif', v))}</div>
            <span class="lbl">Zelle y Binance Pay</span>
            <div class="grid2">${inp('aj-ze-correo', 'Correo de Zelle', f.zelle.correo, (v) => setIn('zelle', 'correo', v))}${inp('aj-ze-tit', 'Titular de Zelle', f.zelle.titular, (v) => setIn('zelle', 'titular', v))}${inp('aj-bi', 'ID de Binance Pay', f.binance.id, (v) => setIn('binance', 'id', v))}</div>
          </section>` : null}
        </div>
        <div class="col">
          ${doc ? html`<section class="panel"><div class="panel-h"><h2>${pt('lav', I.hoy(16))}Horario de citas</h2></div>
            <p class="small muted m0">${'Las familias eligen entre estas horas, de lunes a viernes. Cada cita dura ' + f.duracion_min + ' minutos.'}</p>
            <div class="hourchips">${f.horas.map((m) => html`<span class="hourchip" key=${m}>${nb(fmt(m))}<button type="button" aria-label=${'Quitar ' + fmt(m)} onClick=${() => set('horas', f.horas.filter((x) => x !== m))}>${I.close(14)}</button></span>`)}</div>
            <div class="row"><input class="input grow" type="time" step="900" aria-label="Hora nueva" value=${nueva} onInput=${(e) => setNueva(e.target.value)} /><button type="button" class="btn" disabled=${!nueva} onClick=${agregarHora}>${I.plus(16)} Agregar hora</button></div>
          </section>
          <section class="panel"><div class="panel-h"><h2>${pt('peach', I.seguridad(16))}Acceso del equipo</h2></div>
            <label class="check" for="aj-2fa"><input id="aj-2fa" type="checkbox" checked=${!!f.exigir_2fa} onChange=${(e) => set('exigir_2fa', e.target.checked)} /><span><b>Exigir el segundo factor a todo el equipo</b><small>Quien no lo tenga activo deberá activarlo antes de entrar a la consola.</small></span></label>
          </section>
          <div class="actions"><button type="button" class="btn primary big" disabled=${busy} onClick=${guardar}>${busy ? 'Guardando…' : 'Guardar los ajustes'}</button></div>` : null}
          <section class="panel"><div class="panel-h"><h2>${pt('pink', I.send(16))}Enlace para las familias</h2></div>
            <p class="small m0">Con este enlace las familias nuevas agendan su primera cita. Sirve para la biografía de Instagram o para responder en WhatsApp.</p>
            <div class="okbox"><div class="row"><span class="grow brk">${linkFam}</span><${CopyBtn} text=${linkFam} label="Enlace" act=${act} /></div></div>
          </section>
          ${doc ? html`<section class="panel"><div class="panel-h"><h2>${pt('yel', I.pacientes(16))}Datos de ejemplo</h2></div>
            <p class="small m0">Siete familias inventadas, con citas, pagos y mensajes, para probar la consola sin tocar datos reales.</p>
            ${borrar ? html`<${Confirmar} texto="Se borran las familias de ejemplo con sus citas, pagos y mensajes. Las familias reales no se tocan." si="Sí, borrar" onNo=${() => setBorrar(false)} onSi=${() => { setBorrar(false); act.run(() => api('st_ejemplo', { p_cargar: false }), 'Borramos los datos de ejemplo.'); }} />` : html`<div class="actions"><button type="button" class="btn" onClick=${() => act.run(() => api('st_ejemplo', { p_cargar: true }), 'Cargamos los datos de ejemplo.')}>Cargar</button><button type="button" class="btn ghost" onClick=${() => setBorrar(true)}>Borrar</button></div>`}
          </section>` : null}
        </div>
      </div>`;
  }

  /* ---------- Ventanas ---------- */
  function Modal({ act, label, children, wide }) {
    const ref = useRef(null);
    useEffect(() => { const b = ref.current && ref.current.querySelector('input, textarea, select, button'); if (b) b.focus(); }, []);
    return html`<div class="scrim" onClick=${(e) => { if (e.target === e.currentTarget) act.cerrarModal(); }}><div class=${'modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label=${label} ref=${ref}>${children}</div></div>`;
  }
  function WaModal({ s, act, m }) {
    const [txt, setTxt] = useState(conOrigen(m.texto));
    const tel = m.persona.telefono;
    const enviar = () => { act.run(() => api('st_enviado', { p_mensaje: m.id, p_texto: txt.trim() }), 'Listo. Quedó en el historial de mensajes de la familia.'); setTimeout(act.cerrarModal, 80); };
    return html`<${Modal} act=${act} label=${'WhatsApp para ' + m.persona.nombre}>
      <div class="modal-h"><span class="wa-ic" aria-hidden="true">${I.mensajes(18)}</span><span class="grow"><b>${m.persona.nombre}</b><span class="mh-sub">${telTxt(tel)} · ${m.nombre}</span></span></div>
      <div class="field"><label for="wa-txt">Mensaje</label><textarea id="wa-txt" class="ta" rows="7" value=${txt} onInput=${(e) => setTxt(e.target.value)}></textarea></div>
      <p class="small muted m0">El botón abre WhatsApp con el número y el texto listos; solo queda tocar enviar allí.</p>
      <div class="actions">${tel ? html`<a class="btn wa" href=${waLink(tel, txt.trim())} target="_blank" rel="noopener" onClick=${enviar}>${I.send(15)} Abrir WhatsApp</a>` : html`<span class="pill bad">Sin teléfono</span>`}<${CopyBtn} text=${txt.trim()} label="Mensaje" act=${act} /><button type="button" class="btn ghost" onClick=${act.cerrarModal}>Cancelar</button></div>
    </${Modal}>`;
  }
  function CobroModal({ s, act, c, tipo }) {
    const cl = s.resumen ? s.resumen.clinica : { tasa_bcv: 0, abono_usd: 15, total_usd: 30 };
    const [m, setM] = useState('ef');
    const [banco, setBanco] = useState('');
    const [ref, setRef] = useState('');
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);
    const monto = tipo === 'abono' ? Number(cl.abono_usd) : Number(cl.total_usd) - Number(cl.abono_usd);
    const save = async () => {
      if ((m === 'pm' || m === 'tr') && !banco) { setErr('Elige el banco.'); return; }
      if (m !== 'ef' && ref.trim().length < 3) { setErr(m === 'ze' ? 'Escribe el nombre del titular.' : 'Escribe la referencia.'); return; }
      setBusy(true);
      const r = await act.run(() => api('st_registrar_pago', { p_cita: c.id, p_tipo: tipo, p_metodo: m, p_banco: banco, p_referencia: ref.trim() }), tipo === 'abono' ? 'Abono registrado. La cita quedó confirmada.' : 'Pago registrado en el cierre del día.');
      if (r !== undefined) act.cerrarModal(); else setBusy(false);
    };
    return html`<${Modal} act=${act} label=${(tipo === 'abono' ? 'Abono de ' : 'Resto de ') + c.pac.nombre}>
      <div class="modal-h">${Av(c.paciente, c.pac.nombre)}<span class="grow"><b>${(tipo === 'abono' ? 'Abono de ' : 'Resto de ') + c.pac.nombre}</b><span class="mh-sub">${nb(usd(monto) + ' · cita del ' + shortIso(c.fecha) + ' ' + alas(c.minuto))}</span></span></div>
      <div class="field"><span class="flabel">Método</span><div class="methods" role="group" aria-label="Método de pago">${Object.keys(METODOS).map((k) => html`<button type="button" key=${k} class="mopt" aria-pressed=${m === k ? 'true' : 'false'} onClick=${() => { setErr(''); setM(k); }}>${METODOS[k].label}</button>`)}</div></div>
      <p class="small muted m0">${nb('Monto: ' + montoMetodo(m, monto, Number(cl.tasa_bcv)))}</p>
      ${m === 'pm' || m === 'tr' ? html`<div class="field"><label for="cb-banco">Banco de la familia</label><select id="cb-banco" class="select" value=${banco} onChange=${(e) => { setBanco(e.target.value); setErr(''); }}><option value="">Elige el banco</option>${BANKS.map((b) => html`<option value=${b}>${b}</option>`)}</select></div>` : null}
      ${m !== 'ef' ? html`<div class="field"><label for="cb-ref">${m === 'ze' ? 'Titular de la cuenta' : 'Referencia'}</label><input id="cb-ref" class="input" type="text" maxlength="40" value=${ref} onInput=${(e) => { setErr(''); setRef(e.target.value); }} /></div>` : null}
      ${err ? html`<p class="err" role="alert">${err}</p>` : null}
      <div class="actions"><button type="button" class="btn primary" disabled=${busy} onClick=${save}>Registrar pago</button><button type="button" class="btn" onClick=${act.cerrarModal}>Cancelar</button></div>
    </${Modal}>`;
  }
  function InformeModal({ s, act, c }) {
    const [st, setSt] = useState(null);
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);
    const porConfirmar = (c.personas || []).filter((p) => p.legal && !p.confirmado);
    const [conf, setConf] = useState({});
    useEffect(() => { api('st_informe', { p_cita: c.id }).then((d) => setSt({ vimos: d.vimos, hicimos: d.hicimos, casa: (d.casa || []).join('\n'), proximo: d.proximo || (c.motivo === 'tratamiento' ? '' : 'Control en ' + monthYear(addMonthsIso(c.fecha, 6)) + '.') }), (e) => setErr(e.message)); }, [c.id]);
    const aprobar = async () => {
      if (!st.vimos.trim()) { setErr('Escribe al menos lo que viste en la consulta.'); return; }
      setBusy(true); setErr('');
      try {
        for (const p of porConfirmar.filter((x) => conf[x.vinculo])) await api('st_vinculo', { p_vinculo: p.vinculo, p_cambios: { legal_confirmado: true, historia: true } });
        await api('st_aprobar_informe', { p_cita: c.id, p_vimos: st.vimos, p_hicimos: st.hicimos, p_casa: st.casa.split('\n').map((x) => x.trim()).filter(Boolean), p_proximo: st.proximo });
        act.cerrarModal();
        act.say('Informe aprobado. El resumen salió para la familia por su canal.');
        act.bump();
      } catch (e) { setErr(e.message); setBusy(false); }
    };
    const set = (k, v) => setSt(Object.assign({}, st, { [k]: v }));
    return html`<${Modal} act=${act} label=${'Informe de ' + c.pac.nombre} wide=${true}>
      <div class="modal-h">${Av(c.paciente, c.pac.nombre)}<span class="grow"><b>${'Informe de ' + c.pac.nombre}</b><span class="mh-sub">${nb(cap(longIso(c.fecha)) + ' · ' + motivoTxt(c))}</span></span></div>
      ${!st ? (err ? html`<p class="err">${err}</p>` : html`<${Cargando} />`) : html`
        <div class="field"><label for="in-vimos">Lo que vimos</label><textarea id="in-vimos" class="ta" rows="3" value=${st.vimos} onInput=${(e) => set('vimos', e.target.value)}></textarea></div>
        <div class="field"><label for="in-hicimos">Lo que hicimos</label><textarea id="in-hicimos" class="ta" rows="2" value=${st.hicimos} onInput=${(e) => set('hicimos', e.target.value)}></textarea></div>
        <div class="field"><label for="in-casa">Para la casa (una indicación por línea)</label><textarea id="in-casa" class="ta" rows="3" value=${st.casa} onInput=${(e) => set('casa', e.target.value)}></textarea></div>
        <div class="field"><label for="in-prox">Próximo control</label><input id="in-prox" class="input" type="text" value=${st.proximo} onInput=${(e) => set('proximo', e.target.value)} /></div>
        ${porConfirmar.length ? html`<div class="stack gap8"><span class="flabel">Representantes por confirmar</span>${porConfirmar.map((p) => html`<label class="check" key=${p.vinculo} for=${'cf-' + p.vinculo}><input id=${'cf-' + p.vinculo} type="checkbox" checked=${!!conf[p.vinculo]} onChange=${(e) => setConf(Object.assign({}, conf, { [p.vinculo]: e.target.checked }))} /><span><b>${'Confirmé que ' + p.nombre + ' es su representante legal'}</b><small>Así puede leer los informes en su enlace.</small></span></label>`)}</div>` : null}
        <p class="small muted m0">Al aprobarlo, el resumen sale para los representantes legales por el canal que prefiere cada uno.</p>
        ${err ? html`<p class="err" role="alert">${err}</p>` : null}
        <div class="actions"><button type="button" class="btn primary" disabled=${busy} onClick=${aprobar}>${busy ? 'Aprobando…' : 'Aprobar y enviar'}</button><button type="button" class="btn" onClick=${act.cerrarModal}>Cancelar</button></div>`}
    </${Modal}>`;
  }
  function MoverModal({ s, act, c }) {
    const [ronda, setRonda] = useState(0);
    const [h] = useCarga(() => api('st_horas', { p_desde: null, p_dias: 10, p_excluir: c.id }), [ronda]);
    const [sel, setSel] = useState({ dia: null, min: null });
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);
    const mover = async () => {
      setBusy(true); setErr('');
      try {
        await api('st_mover_cita', { p_cita: c.id, p_fecha: sel.dia, p_minuto: sel.min });
        act.cerrarModal(); act.say('Cita movida. El aviso para la familia quedó listo.'); act.bump();
      } catch (e) { setErr(e.message); setBusy(false); setRonda(ronda + 1); }
    };
    return html`<${Modal} act=${act} label="Mover la cita" wide=${true}>
      <div class="modal-h"><span class="wa-ic" aria-hidden="true">${I.hoy(18)}</span><span class="grow"><b>Mover la cita</b><span class="mh-sub">${nb('Ahora: ' + longIso(c.fecha) + ' ' + alas(c.minuto))}</span></span></div>
      <${Picker} h=${h} dia=${sel.dia} min=${sel.min} onPick=${(d, m) => setSel({ dia: d, min: m })} />
      ${err ? html`<p class="err" role="alert">${err}</p>` : null}
      <div class="actions"><button type="button" class="btn primary" disabled=${!sel.min || busy} onClick=${mover}>${sel.min ? nb('Mover al ' + shortIso(sel.dia) + ', ' + fmt(sel.min)) : 'Elige una hora'}</button><button type="button" class="btn" onClick=${act.cerrarModal}>Cancelar</button></div>
    </${Modal}>`;
  }
  function AgendarModal({ s, act, pac }) {
    const [modo, setModo] = useState(pac ? 'existente' : 'buscar');
    const [q, setQ] = useState('');
    const [lista, setLista] = useState([]);
    const [elegido, setElegido] = useState(pac || null);
    const [nuevo, setNuevo] = useState({ nombre: '', nac: '', rep: '', tel: '', par: 'Mamá', canal: 'wa' });
    const [motivo, setMotivo] = useState(pac ? 'control' : 'primera');
    const [detalle, setDetalle] = useState('');
    const [sel, setSel] = useState({ dia: null, min: null });
    const [pagado, setPagado] = useState(false);
    const [ronda, setRonda] = useState(0);
    const [h] = useCarga(() => api('st_horas', { p_desde: null, p_dias: 10, p_excluir: null }), [ronda]);
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);
    const [hecho, setHecho] = useState(null);
    useEffect(() => {
      if (modo !== 'buscar' || q.trim().length < 2) { setLista([]); return undefined; }
      const t = setTimeout(() => { api('st_pacientes', { p_q: q.trim(), p_seg: 'todos' }).then((d) => setLista(d.lista.slice(0, 6)), () => setLista([])); }, 250);
      return () => clearTimeout(t);
    }, [q, modo]);
    const agendar = async () => {
      setErr('');
      if (modo === 'buscar') { setErr('Elige un paciente o agrega uno nuevo.'); return; }
      if (modo === 'nuevo') {
        if (nuevo.nombre.trim().split(/\s+/).length < 2) { setErr('Escribe el nombre y el apellido del peque.'); return; }
        if (!parseIso(nuevo.nac)) { setErr('Escribe la fecha de nacimiento.'); return; }
        if (nuevo.rep.trim().split(/\s+/).length < 2) { setErr('Escribe el nombre y el apellido del representante.'); return; }
        if (digitos(nuevo.tel).length < 10) { setErr('Escribe el teléfono del representante.'); return; }
      }
      if (!sel.min) { setErr('Elige el día y la hora.'); return; }
      setBusy(true);
      try {
        const r = await api('st_agendar', {
          p_paciente: modo === 'existente' ? elegido.id : null,
          p_nuevo: modo === 'nuevo' ? { nombre: titleCase(nuevo.nombre.trim()), nacimiento: nuevo.nac, parentesco: nuevo.par, legal: nuevo.par === 'Mamá' || nuevo.par === 'Papá' } : null,
          p_contacto: modo === 'nuevo' ? { nombre: titleCase(nuevo.rep.trim()), telefono: nuevo.tel, canal: nuevo.canal } : null,
          p_motivo: motivo, p_detalle: detalle, p_fecha: sel.dia, p_minuto: sel.min, p_pagado: pagado
        });
        setHecho({ enlace: r.enlace ? conOrigen(r.enlace) : null, nuevo: modo === 'nuevo', dia: sel.dia, min: sel.min });
        act.bump();
      } catch (e) { setErr(e.message); setBusy(false); if (/ocupada/.test(e.message)) { setSel({ dia: sel.dia, min: null }); setRonda(ronda + 1); } }
    };
    if (hecho) {
      return html`<${Modal} act=${act} label="Cita agendada">
        <div class="modal-h"><span class="wa-ic" aria-hidden="true">${I.check(18)}</span><span class="grow"><b>Cita agendada</b><span class="mh-sub">${nb(cap(longIso(hecho.dia)) + ' ' + alas(hecho.min))}</span></span></div>
        <p class="m0">${pagado ? 'La cita quedó confirmada.' : 'La hora queda apartada por 24 horas mientras llega el abono.'} ${hecho.nuevo ? 'El mensaje de bienvenida con el enlace de la familia quedó en los WhatsApp por enviar.' : 'El aviso para la familia quedó en los WhatsApp por enviar.'}</p>
        ${hecho.enlace && hecho.nuevo ? html`<div class="okbox"><span class="lbl">Enlace de la familia</span><div class="row"><span class="grow brk">${hecho.enlace}</span><${CopyBtn} text=${hecho.enlace} label="Enlace" act=${act} /></div></div>` : null}
        <div class="actions"><button type="button" class="btn primary" onClick=${() => { act.cerrarModal(); act.go('mensajes'); }}>Ir a los mensajes</button><button type="button" class="btn" onClick=${act.cerrarModal}>Cerrar</button></div>
      </${Modal}>`;
    }
    const setN = (k, v) => { setNuevo(Object.assign({}, nuevo, { [k]: v })); setErr(''); };
    return html`<${Modal} act=${act} label="Agendar una cita" wide=${true}>
      <div class="modal-h"><span class="wa-ic" aria-hidden="true">${I.plus(18)}</span><span class="grow"><b>Agendar una cita</b><span class="mh-sub">Desde el consultorio, para una familia que escribió o llamó</span></span></div>
      ${modo === 'existente' ? html`<div class="row"><span class="grow"><span class="flabel">Paciente</span><br />${elegido.nombre}</span>${pac ? null : html`<button type="button" class="btn ghost" onClick=${() => { setModo('buscar'); setElegido(null); }}>Cambiar</button>`}</div>`
        : modo === 'buscar' ? html`<div class="field"><label for="ag-q">Paciente</label><input id="ag-q" class="input" type="search" placeholder="Busca por nombre del peque o del representante" value=${q} onInput=${(e) => setQ(e.target.value)} /></div>
          ${lista.length ? html`<ul class="mini">${lista.map((p) => html`<li key=${p.id}><div class="top"><b>${p.nombre}</b><button type="button" class="btn" onClick=${() => { setElegido({ id: p.id, nombre: p.nombre }); setModo('existente'); setMotivo('control'); setErr(''); }}>Elegir</button></div><span class="sub">${ageLabel(p.nacimiento)} · ${nombresDe(p.personas)}</span></li>`)}</ul>` : q.trim().length >= 2 ? html`<p class="empty">No hay pacientes con ese nombre.</p>` : null}
          <button type="button" class="link self-start" onClick=${() => { setModo('nuevo'); setMotivo('primera'); }}>${I.plus(16)} Es un paciente nuevo</button>`
        : html`<div class="stack gap12"><div class="row"><span class="flabel grow">Paciente nuevo</span><button type="button" class="btn ghost" onClick=${() => setModo('buscar')}>Buscar uno existente</button></div>
          <div class="grid2"><div class="field"><label for="ag-n">Nombre y apellido del peque</label><input id="ag-n" class="input" type="text" value=${nuevo.nombre} onInput=${(e) => setN('nombre', e.target.value)} /></div><div class="field"><label for="ag-nac">Fecha de nacimiento</label><input id="ag-nac" class="input" type="date" max=${HOY} value=${nuevo.nac} onInput=${(e) => setN('nac', e.target.value)} /></div></div>
          <div class="grid2"><div class="field"><label for="ag-rep">Representante</label><input id="ag-rep" class="input" type="text" value=${nuevo.rep} onInput=${(e) => setN('rep', e.target.value)} /></div><div class="field"><label for="ag-tel">Teléfono con WhatsApp</label><input id="ag-tel" class="input" type="tel" inputmode="tel" value=${nuevo.tel} onInput=${(e) => setN('tel', e.target.value)} /></div></div>
          <div class="grid2"><div class="field"><label for="ag-par">Parentesco</label><select id="ag-par" class="select" value=${nuevo.par} onChange=${(e) => setN('par', e.target.value)}>${['Mamá', 'Papá', 'Abuela', 'Abuelo', 'Tía', 'Tío', 'Otro'].map((x) => html`<option value=${x}>${x}</option>`)}</select></div><div class="field"><label for="ag-canal">Avisos por</label><select id="ag-canal" class="select" value=${nuevo.canal} onChange=${(e) => setN('canal', e.target.value)}><option value="wa">WhatsApp</option><option value="web">Solo en su enlace</option></select></div></div>
        </div>`}
      <div class="grid2"><div class="field"><label for="ag-mot">Motivo</label><select id="ag-mot" class="select" value=${motivo} onChange=${(e) => setMotivo(e.target.value)}>${Object.keys(MOTIVOS).map((k) => html`<option value=${k}>${MOTIVOS[k]}</option>`)}</select></div><div class="field"><label for="ag-det">Detalle (opcional)</label><input id="ag-det" class="input" type="text" maxlength="120" placeholder="Por ejemplo, sellantes, sesión 1 de 2" value=${detalle} onInput=${(e) => setDetalle(e.target.value)} /></div></div>
      <div class="field"><span class="flabel">Día y hora</span><${Picker} h=${h} dia=${sel.dia} min=${sel.min} onPick=${(d, m) => { setSel({ dia: d, min: m }); setErr(''); }} /></div>
      <label class="check" for="ag-pag"><input id="ag-pag" type="checkbox" checked=${pagado} onChange=${(e) => setPagado(e.target.checked)} /><span><b>El abono ya está pagado</b><small>Si no, la hora queda apartada por 24 horas mientras llega.</small></span></label>
      ${err ? html`<p class="err" role="alert">${err}</p>` : null}
      <div class="actions"><button type="button" class="btn primary" disabled=${busy} onClick=${agendar}>${busy ? 'Agendando…' : sel.min ? nb('Agendar para el ' + shortIso(sel.dia) + ', ' + fmt(sel.min)) : 'Agendar'}</button><button type="button" class="btn" onClick=${act.cerrarModal}>Cancelar</button></div>
    </${Modal}>`;
  }

  /* ---------- Entrada ---------- */
  function LoginCard({ children }) {
    return html`<div class="login"><div class="login-card"><div class="brand">${Stars()}${Word()}</div>${children}</div></div>`;
  }
  function Login({ onOk }) {
    const [email, setEmail] = useState('');
    const [pass, setPass] = useState('');
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);
    const entrar = async (e) => {
      e.preventDefault();
      if (!email.trim() || !pass) { setErr('Escribe tu correo y tu contraseña.'); return; }
      setBusy(true); setErr('');
      const r = await sb.auth.signInWithPassword({ email: email.trim(), password: pass });
      if (r.error) {
        setBusy(false);
        const m = String(r.error.message || '');
        setErr(/invalid login|credentials/i.test(m) ? 'El correo o la contraseña no coinciden.' : /confirm/i.test(m) ? 'Esta cuenta todavía no está confirmada en Supabase.' : /rate|too many/i.test(m) ? 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.' : /fetch|network/i.test(m) ? 'No hay conexión. Revisa el internet e inténtalo de nuevo.' : 'No se pudo entrar. ' + m);
        return;
      }
      onOk();
    };
    return html`<${LoginCard}>
      <div><h1>Consola del consultorio</h1><p>Entra con tu correo y tu contraseña.</p></div>
      <form class="stack gap12" onSubmit=${entrar}>
        <div class="field"><label for="lg-email">Correo</label><input id="lg-email" class="input" type="email" autocomplete="username" value=${email} onInput=${(e) => { setEmail(e.target.value); setErr(''); }} /></div>
        <div class="field"><label for="lg-pass">Contraseña</label><input id="lg-pass" class="input" type="password" autocomplete="current-password" value=${pass} onInput=${(e) => { setPass(e.target.value); setErr(''); }} /></div>
        ${err ? html`<p class="err" role="alert">${err}</p>` : null}
        <button type="submit" class="btn primary big block" disabled=${busy}>${busy ? 'Entrando…' : 'Entrar'}</button>
      </form>
      <p class="small">¿Olvidaste la contraseña? Quien administra el proyecto en Supabase la cambia desde Authentication, Users.</p>
    </${LoginCard}>`;
  }
  function MfaReto({ onOk, salir }) {
    const [code, setCode] = useState('');
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);
    const verificar = async (e) => {
      e.preventDefault();
      if (!/^\d{6}$/.test(code)) { setErr('Escribe los seis dígitos.'); return; }
      setBusy(true); setErr('');
      const f = await sb.auth.mfa.listFactors();
      const fac = f.data && f.data.totp && f.data.totp.find((x) => x.status === 'verified');
      if (!fac) { setBusy(false); onOk(); return; }
      const r = await sb.auth.mfa.challengeAndVerify({ factorId: fac.id, code: code });
      setBusy(false);
      if (r.error) { setErr('El código no coincide. Escribe el que se ve ahora en la app.'); setCode(''); return; }
      onOk();
    };
    return html`<${LoginCard}>
      <div><h1>Código de seguridad</h1><p>Escribe el código de seis dígitos de tu app autenticadora.</p></div>
      <form class="stack gap12" onSubmit=${verificar}>
        <input class="input code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" aria-label="Código de seis dígitos" value=${code} onInput=${(e) => { setCode(e.target.value.replace(/\D/g, '')); setErr(''); }} />
        ${err ? html`<p class="err" role="alert">${err}</p>` : null}
        <button type="submit" class="btn primary big block" disabled=${busy}>${busy ? 'Verificando…' : 'Entrar'}</button>
      </form>
      <button type="button" class="link self-start" onClick=${salir}>Entrar con otra cuenta</button>
    </${LoginCard}>`;
  }
  function Reclamar({ yo, onOk, salir }) {
    const [nombre, setNombre] = useState(yo.nombre_invitado || '');
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);
    const go = async (e) => {
      e.preventDefault();
      setBusy(true); setErr('');
      try { await api('st_reclamar', { p_nombre: nombre.trim() }); onOk(); } catch (x) { setErr(x.message); setBusy(false); }
    };
    const doc = yo.rol_reclamo === 'doctora';
    return html`<${LoginCard}>
      <div><h1>${doc ? 'Bienvenida, doctora' : 'Bienvenida al equipo'}</h1><p>${doc ? 'Es la primera vez que alguien entra a esta consola. Tu cuenta quedará como la de la doctora, con acceso completo, y desde Seguridad invitas al resto del equipo.' : 'La doctora te invitó como asistente. Confirma tu nombre, tal como aparecerá en el registro de actividad.'}</p></div>
      <form class="stack gap12" onSubmit=${go}>
        <div class="field"><label for="rc-nombre">Tu nombre</label><input id="rc-nombre" class="input" type="text" placeholder=${doc ? 'Dra. Kelia Mendoza' : ''} value=${nombre} onInput=${(e) => { setNombre(e.target.value); setErr(''); }} /></div>
        ${err ? html`<p class="err" role="alert">${err}</p>` : null}
        <button type="submit" class="btn primary big block" disabled=${busy || nombre.trim().length < 3}>Entrar a la consola</button>
      </form>
      <button type="button" class="link self-start" onClick=${salir}>Entrar con otra cuenta</button>
    </${LoginCard}>`;
  }
  function SinAcceso({ yo, reintentar, salir }) {
    return html`<${LoginCard}>
      <div><h1>${yo.staff && !yo.staff.activo ? 'Tu acceso está cerrado' : 'Todavía no tienes acceso'}</h1><p>${yo.staff && !yo.staff.activo ? 'La doctora quitó el acceso de esta cuenta a la consola.' : 'Pídele a la doctora que te invite desde Seguridad con este correo: ' + (yo.correo || '') + '. Después vuelve a entrar.'}</p></div>
      <div class="actions"><button type="button" class="btn primary" onClick=${reintentar}>Ya me invitó: entrar</button><button type="button" class="btn" onClick=${salir}>Entrar con otra cuenta</button></div>
    </${LoginCard}>`;
  }
  function MfaObligatorio({ act, onOk, salir }) {
    return html`<${LoginCard}>
      <div><h1>Activa tu segundo factor</h1><p>La doctora pidió que todo el equipo entre con un código de la app autenticadora. Actívalo una vez y sigues a la consola.</p></div>
      <${MfaPanel} act=${act} onListo=${onOk} compacto=${true} />
      <button type="button" class="link self-start" onClick=${salir}>Entrar con otra cuenta</button>
    </${LoginCard}>`;
  }

  /* ---------- Marco ---------- */
  function useMedia(q) {
    const get = () => { try { return window.matchMedia(q).matches; } catch (e) { return false; } };
    const [m, setM] = useState(get);
    useEffect(() => {
      let mq;
      try { mq = window.matchMedia(q); } catch (e) { return undefined; }
      const on = () => setM(mq.matches);
      on();
      if (mq.addEventListener) mq.addEventListener('change', on); else mq.addListener(on);
      return () => { if (mq.removeEventListener) mq.removeEventListener('change', on); else mq.removeListener(on); };
    }, [q]);
    return m;
  }
  const viewFromHash = () => { try { const h = (window.location.hash || '').replace('#', ''); return VIEWS.some((v) => v.id === h) ? h : 'hoy'; } catch (e) { return 'hoy'; } };

  function App() {
    const [fase, setFase] = useState('cargando');
    const [yoInfo, setYoInfo] = useState(null);
    const [s, setS] = useState(() => ({ view: viewFromHash(), rev: 0, pacSel: null, tab: 'resumen', q: '', seg: 'todos', tplSel: null, tplSeg: 'todos', modal: null, resumen: null, resumenErr: '', yo: null }));
    const sRef = useRef(s);
    sRef.current = s;
    const [toast, setToast] = useState(null);
    const narrow = useMedia('(max-width: 900px)');
    useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(null), 4200); return () => clearTimeout(t); }, [toast]);
    const say = (text) => setToast({ text: text, n: Date.now() });
    const set = (patch) => setS((p) => Object.assign({}, p, patch));
    const bump = () => setS((p) => Object.assign({}, p, { rev: p.rev + 1 }));

    async function arrancar() {
      try {
        const ses = await sb.auth.getSession();
        if (!ses.data || !ses.data.session) { setFase('login'); return; }
        const aal = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aal.data && aal.data.nextLevel === 'aal2' && aal.data.currentLevel !== 'aal2') { setFase('mfa'); return; }
        const yo = await api('st_yo');
        setYoInfo(yo);
        if (!yo.staff) { setFase(yo.puede_reclamar ? 'reclamar' : 'sinacceso'); return; }
        if (!yo.staff.activo) { setFase('sinacceso'); return; }
        if (yo.mfa.exigir && !yo.mfa.verificado) { setFase('mfa-obligatorio'); return; }
        set({ yo: { nombre: yo.staff.nombre, rol: yo.staff.rol, correo: yo.correo } });
        api('st_sitio', { p_url: window.location.origin }).catch(() => {});
        setFase('app');
      } catch (e) {
        setYoInfo({ error: e.message });
        setFase('error');
      }
    }
    const salir = async () => { await sb.auth.signOut().catch(() => {}); setS((p) => Object.assign({}, p, { resumen: null, yo: null, modal: null, pacSel: null })); setFase('login'); };
    onAuthProblem = () => { arrancar(); };
    useEffect(() => {
      arrancar();
      const sub = sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') setFase('login'); });
      return () => { try { sub.data.subscription.unsubscribe(); } catch (e) { /* nada */ } };
    }, []);
    // Resumen del día: alimenta Hoy y los contadores del menú.
    useEffect(() => {
      if (fase !== 'app') return undefined;
      let vivo = true;
      const cargar = () => api('st_hoy').then((h) => { if (!vivo) return; setHoy(h.hoy); setS((p) => Object.assign({}, p, { resumen: h, resumenErr: '' })); }, (e) => { if (vivo) setS((p) => Object.assign({}, p, { resumenErr: e.message })); });
      cargar();
      return () => { vivo = false; };
    }, [fase, s.rev]);
    useEffect(() => {
      if (fase !== 'app') return undefined;
      const tick = () => { if (document.visibilityState === 'visible' && !sRef.current.modal) bump(); };
      const t = setInterval(tick, 60000);
      return () => clearInterval(t);
    }, [fase]);
    useEffect(() => {
      const on = () => setS((p) => Object.assign({}, p, { view: viewFromHash(), pacSel: null }));
      window.addEventListener('hashchange', on);
      return () => window.removeEventListener('hashchange', on);
    }, []);
    useEffect(() => {
      const onKey = (e) => { if (e.key === 'Escape' && sRef.current.modal) setS((p) => Object.assign({}, p, { modal: null })); };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }, []);

    const act = {
      say: say, set: set, bump: bump,
      go: (view) => {
        setS((p) => Object.assign({}, p, { view: view, pacSel: null, modal: null }));
        try { if (window.location.hash !== '#' + view) window.history.replaceState(null, '', '#' + view); } catch (e) { /* sin hash */ }
        window.scrollTo(0, 0);
      },
      abrirPac: (id) => { setS((p) => Object.assign({}, p, { view: 'pacientes', pacSel: id, tab: 'resumen', modal: null })); try { window.history.replaceState(null, '', '#pacientes'); } catch (e) { /* sin hash */ } window.scrollTo(0, 0); },
      cerrarPac: () => set({ pacSel: null }),
      modal: (kind, data) => set({ modal: Object.assign({ kind: kind }, data || {}) }),
      cerrarModal: () => set({ modal: null }),
      run: async (fn, okMsg) => {
        try {
          const r = await fn();
          if (okMsg) say(typeof okMsg === 'function' ? okMsg(r || {}) : okMsg);
          bump();
          return r === undefined || r === null ? true : r;
        } catch (e) { say(e.message); return undefined; }
      }
    };

    if (fase === 'cargando') return html`<${LoginCard}><p class="empty">Cargando…</p></${LoginCard}>`;
    if (fase === 'login') return html`<${Login} onOk=${arrancar} />`;
    if (fase === 'mfa') return html`<${MfaReto} onOk=${arrancar} salir=${salir} />`;
    if (fase === 'reclamar') return html`<${Reclamar} yo=${yoInfo} onOk=${arrancar} salir=${salir} />`;
    if (fase === 'sinacceso') return html`<${SinAcceso} yo=${yoInfo} reintentar=${arrancar} salir=${salir} />`;
    if (fase === 'mfa-obligatorio') return html`<div>${html`<${MfaObligatorio} act=${act} onOk=${arrancar} salir=${salir} />`}${toast ? html`<div class="toast" role="status" key=${toast.n}>${nb(toast.text)}</div>` : null}</div>`;
    if (fase === 'error') return html`<${LoginCard}><div><h1>No se pudo abrir la consola</h1><p>${yoInfo && yoInfo.error}</p></div><div class="actions"><button type="button" class="btn primary" onClick=${arrancar}>Intentar de nuevo</button><button type="button" class="btn" onClick=${salir}>Entrar con otra cuenta</button></div></${LoginCard}>`;

    const r = s.resumen;
    const badges = { mensajes: r ? r.cola.length : 0, pagos: r ? r.pagos.length : 0, seguridad: r && r.alerta_2fa ? 1 : 0 };
    const navBtns = VIEWS.map((v) => html`<button type="button" key=${v.id} class="nav-btn" aria-current=${s.view === v.id ? 'page' : 'false'} onClick=${() => act.go(v.id)}><span class=${'nav-ic t-' + NAV_TONE[v.id]} aria-hidden="true">${I[v.id](17)}</span><span>${v.label}</span>${badges[v.id] ? html`<span class="badge">${badges[v.id]}</span>` : null}</button>`);
    const content = s.view === 'pacientes' ? html`<${Pacientes} s=${s} act=${act} />`
      : s.view === 'mensajes' ? html`<${Mensajes} s=${s} act=${act} />`
      : s.view === 'plantillas' ? html`<${Plantillas} s=${s} act=${act} />`
      : s.view === 'pagos' ? html`<${Pagos} s=${s} act=${act} />`
      : s.view === 'seguridad' ? html`<${Seguridad} s=${s} act=${act} />`
      : s.view === 'ajustes' ? html`<${Ajustes} s=${s} act=${act} />`
      : html`<${Hoy} s=${s} act=${act} />`;
    const md = s.modal;
    return html`<div class="app">
      <aside class="side" aria-label="Navegación">
        <div class="brand">${Word()}<span class="brand-cap"><b>Dientario</b> · consultorio de Lechería</span></div>
        <nav class="nav" aria-label="Áreas">${navBtns}</nav>
        <div class="userbox"><div class="row">${Av(s.yo.correo, s.yo.nombre)}<span class="grow"><b>${s.yo.nombre}</b><small>${s.yo.rol === 'doctora' ? 'Doctora' : 'Asistente'}</small></span></div><button type="button" class="btn" onClick=${salir}>${I.out(15)} Cerrar sesión</button></div>
      </aside>
      <div class="main">
        ${narrow ? html`<header class="mtop">
          <div class="mtop-row"><div class="brand">${Stars()}${Word()}</div><button type="button" class="userbtn" onClick=${salir} aria-label="Cerrar sesión">${first(s.yo.nombre)} · Salir</button></div>
          <nav class="mnav" aria-label="Áreas">${navBtns}</nav>
        </header>` : null}
        <main class="view" key=${s.view + (s.pacSel || '')}>${content}</main>
      </div>
      ${md && md.kind === 'wa' ? html`<${WaModal} key=${'wa' + md.m.id} s=${s} act=${act} m=${md.m} />` : null}
      ${md && md.kind === 'cobro' ? html`<${CobroModal} key=${'cb' + md.c.id} s=${s} act=${act} c=${md.c} tipo=${md.tipo} />` : null}
      ${md && md.kind === 'informe' ? html`<${InformeModal} key=${'in' + md.c.id} s=${s} act=${act} c=${md.c} />` : null}
      ${md && md.kind === 'mover' ? html`<${MoverModal} key=${'mv' + md.c.id} s=${s} act=${act} c=${md.c} />` : null}
      ${md && md.kind === 'agendar' ? html`<${AgendarModal} s=${s} act=${act} pac=${md.pac || null} />` : null}
      ${toast ? html`<div class="toast" role="status" key=${toast.n}>${nb(toast.text)}</div>` : null}
    </div>`;
  }

  render(html`<${App} />`, rootEl);
})();
