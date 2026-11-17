'use strict';
// A tiny in-memory imitation of Supabase (PostgREST + Auth + Storage), used only for local testing.
const http = require('http');
const crypto = require('crypto');
const path = require('path');

const uid = () => crypto.randomUUID();
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function seed() {
  const scenes = require('./scenes_seed.json').map((s, i) => ({ link_label_ar: '', link_label_en: '', link_href: '', slate: 'Scene ' + (i + 1), visible: true, ...s, sort: i + 1 }));
  const credits = require('./credits_seed.json');
  const services = credits.map((c, i) => ({ id: uid(), slug: slug(c[1]), sort: i + 1, visible: true, title_en: c[1], title_ar: c[2], short_ar: 'وصف ' + c[2], short_en: 'About ' + c[1], body_ar: '', body_en: '', icon: 'spark', image: '', scenes: [['idea', 'design', 'planning', 'build'][Math.floor(i / 3)] || 'success'] }));
  const A = uid(), B = uid();
  return {
    users: [{ id: A, email: 'one@test.dev', password: 'pass-one' }, { id: B, email: 'two@test.dev', password: 'pass-two' }, { id: uid(), email: 'nobody@test.dev', password: 'pass-no' }],
    tables: {
      admins: [{ user_id: A, email: 'one@test.dev' }, { user_id: B, email: 'two@test.dev' }],
      settings: [{ key: 'contact', value: { email: 'hello@test.dev', whatsapp: '+20 100 000 0000' } }, { key: 'home', value: { stats: [{ value: '120', label_ar: 'مشروع', label_en: 'Projects' }] } }],
      scenes, services, projects: [], testimonials: [], clients: [], messages: [], redirects: [{ id: uid(), from_path: 'old-page', to_url: '/about', permanent: true }],
      nav_items: [{ id: uid(), sort: 0, visible: true, label_ar: 'الرئيسية', label_en: 'Home', href: '/', new_tab: false }],
      pages: [
        { id: uid(), slug: '_home', published: true, title_ar: 'home', title_en: 'home', blocks: [], show_in_nav: false, nav_sort: 100 },
        { id: uid(), slug: 'services', published: true, title_ar: 'خدماتنا', title_en: 'Services', show_in_nav: true, nav_label_ar: '', nav_label_en: '', nav_sort: 10, blocks: [{ id: 'a1', type: 'services', props: { title_ar: 'خدماتنا', title_en: 'Our services' } }] },
        { id: uid(), slug: 'work', published: true, title_ar: 'أعمالنا', title_en: 'Work', show_in_nav: true, nav_sort: 20, blocks: [{ id: 'a2', type: 'projects', props: { title_ar: 'أعمالنا', title_en: 'Our work', show_filters: true } }] },
        { id: uid(), slug: 'contact', published: true, title_ar: 'تواصل', title_en: 'Contact', show_in_nav: true, nav_sort: 30, blocks: [{ id: 'a3', type: 'contact', props: { title_ar: 'كلمنا', title_en: 'Talk to us' } }] },
      ].map((p) => ({ seo_title_ar: '', seo_title_en: '', seo_desc_ar: '', seo_desc_en: '', og_image: '', nav_label_ar: '', nav_label_en: '', ...p })),
    },
    files: new Map(),
  };
}

function create() {
  const db = seed();
  const pub = { services: 'visible', projects: 'visible', testimonials: 'visible', clients: 'visible', scenes: 'visible', nav_items: 'visible', pages: 'published' };
  const log = [];

  function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
  function match(row, f) {
    const [col, expr] = f; const i = expr.indexOf('.'), op = expr.slice(0, i), val = expr.slice(i + 1), cur = row[col];
    const norm = (v) => (v === 'true' ? true : v === 'false' ? false : v);
    if (op === 'eq') return String(cur) === String(val);
    if (op === 'neq') return String(cur) !== String(val);
    if (op === 'in') return val.replace(/^\(|\)$/g, '').split(',').map((x) => x.replace(/^"|"$/g, '')).includes(String(cur));
    if (op === 'is') return val === 'null' ? cur == null : cur === norm(val);
    if (op === 'gt') return cur > val; if (op === 'lt') return cur < val;
    if (op === 'ilike') return new RegExp('^' + val.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*|%/g, '.*') + '$', 'i').test(String(cur));
    return true;
  }
  const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict']);
  function filters(sp) { const out = []; for (const [k, v] of sp) if (!RESERVED.has(k)) out.push([k, v]); return out; }

  function body(req) { return new Promise((r) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => r(Buffer.concat(c))); }); }
  function who(req) { const m = /^Bearer tok-(.+)$/.exec(req.headers.authorization || ''); return m ? db.users.find((u) => u.id === m[1]) : null; }
  const isAdmin = (u) => !!u && db.tables.admins.some((a) => a.user_id === u.id);

  async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'authorization, apikey, content-type, prefer, range, x-upsert, x-client-info, cache-control');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    const url = new URL(req.url, 'http://x');
    const send = (code, obj, headers) => { res.writeHead(code, { 'Content-Type': 'application/json', ...(headers || {}) }); res.end(obj === undefined ? '' : JSON.stringify(obj)); };
    const u = who(req), adm = isAdmin(u);
    const p = url.pathname;
    log.push(req.method + ' ' + p);
    try {
      /* ---- auth ---- */
      if (p === '/auth/v1/token') {
        const b = JSON.parse((await body(req)).toString() || '{}');
        if (url.searchParams.get('grant_type') === 'password') {
          const us = db.users.find((x) => x.email === b.email && x.password === b.password);
          if (!us) return send(400, { error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials' });
          return send(200, { access_token: 'tok-' + us.id, refresh_token: 'ref-' + us.id, expires_in: 3600, user: { id: us.id, email: us.email } });
        }
        const us = db.users.find((x) => 'ref-' + x.id === b.refresh_token);
        if (!us) return send(400, { msg: 'bad refresh' });
        return send(200, { access_token: 'tok-' + us.id, refresh_token: b.refresh_token, expires_in: 3600, user: { id: us.id, email: us.email } });
      }
      if (p === '/auth/v1/user') return u ? send(200, { id: u.id, email: u.email }) : send(401, { msg: 'invalid JWT' });
      if (p === '/auth/v1/logout') return send(204);

      /* ---- rpc ---- */
      if (p.startsWith('/rest/v1/rpc/')) {
        if (!adm) return send(403, { message: 'not allowed' });
        const b = JSON.parse((await body(req)).toString() || '{}'), fn = p.split('/').pop();
        if (fn === 'add_admin') {
          const us = db.users.find((x) => x.email.toLowerCase() === String(b.p_email).toLowerCase().trim());
          if (!us) return send(400, { message: 'user not found: create this user in Authentication > Users first' });
          if (!db.tables.admins.some((a) => a.user_id === us.id)) db.tables.admins.push({ user_id: us.id, email: us.email });
          return send(200, null);
        }
        if (fn === 'remove_admin') {
          if (b.p_user === u.id) return send(400, { message: 'you cannot remove yourself' });
          db.tables.admins = db.tables.admins.filter((a) => a.user_id !== b.p_user); return send(200, null);
        }
        return send(404, { message: 'no rpc' });
      }

      /* ---- tables ---- */
      if (p.startsWith('/rest/v1/')) {
        const t = p.slice(9);
        if (!db.tables[t]) return send(404, { message: 'no table ' + t });
        const f = filters(url.searchParams), prefer = req.headers.prefer || '';
        // row level security
        const canRead = (row) => {
          if (adm) return true;
          if (t === 'admins') return u && row.user_id === u.id;
          if (t === 'messages') return false;
          if (pub[t]) return row[pub[t]] === true;
          return true;
        };
        if (req.method === 'GET') {
          let rows = db.tables[t].filter(canRead).filter((r) => f.every((x) => match(r, x)));
          const ord = url.searchParams.get('order');
          if (ord) { const parts = ord.split(',').map((s) => s.split('.')); rows = rows.slice().sort((a, b) => { for (const [c, d] of parts) { const r = cmp(a[c], b[c]); if (r) return d === 'desc' ? -r : r; } return 0; }); }
          const total = rows.length;
          const lim = parseInt(url.searchParams.get('limit'), 10); if (lim) rows = rows.slice(0, lim);
          const range = req.headers.range;
          if (range && /^\d+-\d+$/.test(range)) { const [a, b] = range.split('-').map(Number); rows = rows.slice(a, b + 1); }
          return send(200, rows, { 'Content-Range': `0-${Math.max(0, rows.length - 1)}/${total}` });
        }
        if (!adm && !(req.method === 'POST' && t === 'messages')) return send(u ? 403 : 401, { message: 'row-level security: not allowed' });
        const raw = (await body(req)).toString();
        if (req.method === 'POST') {
          let b = JSON.parse(raw || '{}'); const arr = Array.isArray(b) ? b : [b]; const out = [];
          const pk = { settings: 'key', scenes: 'key', admins: 'user_id' }[t] || 'id';
          const conflict = url.searchParams.get('on_conflict') || pk, merge = /merge-duplicates/.test(prefer);
          for (const row of arr) {
            const ex = merge ? db.tables[t].find((r) => r[conflict] === row[conflict]) : null;
            if (ex) { Object.assign(ex, row); out.push(ex); continue; }
            const n = { ...row };
            if (pk === 'id' && !n.id) n.id = uid();
            if (!('created_at' in n)) n.created_at = new Date().toISOString();
            if (t === 'messages') { n.read = false; n.starred = false; if (!n.name || !n.message) return send(400, { message: 'null value in column' }); }
            if (['services', 'projects', 'testimonials', 'clients', 'nav_items', 'scenes'].includes(t)) { if (!('visible' in n)) n.visible = true; if (!('sort' in n)) n.sort = 0; }
            if (t === 'pages' && !('published' in n)) n.published = true;
            if (['services', 'projects', 'pages'].includes(t) && db.tables[t].some((r) => r.slug === n.slug)) return send(409, { code: '23505', message: 'duplicate key value violates unique constraint' });
            db.tables[t].push(n); out.push(n);
          }
          return /return=representation/.test(prefer) ? send(201, out) : send(201);
        }
        if (req.method === 'PATCH') {
          const b = JSON.parse(raw || '{}'); const rows = db.tables[t].filter((r) => f.every((x) => match(r, x)));
          rows.forEach((r) => Object.assign(r, b, { updated_at: new Date().toISOString() }));
          return /return=representation/.test(prefer) ? send(200, rows) : send(204);
        }
        if (req.method === 'DELETE') {
          const keep = db.tables[t].filter((r) => !f.every((x) => match(r, x))); db.tables[t] = keep; return send(204);
        }
      }

      /* ---- storage ---- */
      if (p.startsWith('/storage/v1/object/list/media')) {
        if (!adm) return send(403, { message: 'no' });
        return send(200, [...db.files.keys()].map((name) => ({ name, id: name, created_at: new Date().toISOString(), metadata: { size: db.files.get(name).length, mimetype: 'image/png' } })));
      }
      if (p.startsWith('/storage/v1/object/public/media/')) {
        const name = decodeURIComponent(p.slice('/storage/v1/object/public/media/'.length)); const f = db.files.get(name);
        if (!f) return send(404, { message: 'nf' }); res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(f);
      }
      if (p.startsWith('/storage/v1/object/media')) {
        if (!adm) return send(403, { message: 'row-level security' });
        if (req.method === 'POST') { const name = decodeURIComponent(p.slice('/storage/v1/object/media/'.length)); db.files.set(name, await body(req)); return send(200, { Key: 'media/' + name }); }
        if (req.method === 'DELETE') { const b = JSON.parse((await body(req)).toString() || '{}'); (b.prefixes || []).forEach((x) => db.files.delete(x)); return send(200, []); }
      }
      send(404, { message: 'not found ' + p });
    } catch (e) { send(500, { message: String(e.stack || e) }); }
  }

  const server = http.createServer(handler);
  return { server, db, log };
}
module.exports = { create };
