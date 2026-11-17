'use strict';
const { rest } = require('./supa');
const DEFAULTS = require('./defaults');

const FALLBACK_WHEN_EMPTY = new Set(['logo', 'logo_mark', 'brand_name', 'brand_short', 'accent', 'accent_dark', 'pop', 'sky', 'violet', 'leaf', 'og_image', 'intro', 'default_lang', 'default_theme']);
function merge(def, val) {
  const out = Object.assign({}, def);
  if (val && typeof val === 'object') {
    for (const k of Object.keys(val)) {
      const v = val[k];
      if (v === null || v === undefined) continue;
      if (v === '' && FALLBACK_WHEN_EMPTY.has(k)) continue;
      out[k] = v;
    }
  }
  return out;
}

// Everything the header, footer and home page need.
async function loadSite() {
  // A failure in one part (for example a table that was edited badly) must not take the whole site down.
  const part = (q) => q.then((v) => (Array.isArray(v) ? v : [])).catch((e) => { if (e && e.code === 'NOT_CONFIGURED') throw e; console.error('site data error:', e && e.message); return []; });
  const [settingsRows, scenes, services, navItems, navPages] = await Promise.all([
    part(rest('settings', 'select=key,value')),
    part(rest('scenes', 'select=*&order=sort.asc')),
    part(rest('services', 'select=*&order=sort.asc')),
    part(rest('nav_items', 'select=*&order=sort.asc')),
    part(rest('pages', 'select=slug,title_ar,title_en,nav_label_ar,nav_label_en,nav_sort&show_in_nav=eq.true&slug=neq._home&order=nav_sort.asc')),
  ]);
  const raw = {};
  for (const r of settingsRows) raw[r.key] = r.value;
  const s = {};
  for (const g of Object.keys(DEFAULTS)) s[g] = merge(DEFAULTS[g], raw[g]);
  if (!Array.isArray(s.home.stats)) s.home.stats = [];

  const nav = [];
  for (const n of navItems) nav.push({ sort: n.sort, ar: n.label_ar, en: n.label_en, href: n.href, newTab: n.new_tab });
  for (const p of navPages) nav.push({ sort: p.nav_sort, ar: p.nav_label_ar || p.title_ar, en: p.nav_label_en || p.title_en, href: '/' + p.slug, newTab: false });
  nav.sort((a, b) => (a.sort - b.sort));
  return { s, scenes, services, nav };
}

async function loadPage(slug) {
  const rows = await rest('pages', `select=*&slug=eq.${encodeURIComponent(slug)}&limit=1`);
  return rows[0] || null;
}
const loadProjects = () => rest('projects', 'select=*&order=sort.asc,created_at.desc');
const loadTestimonials = () => rest('testimonials', 'select=*&order=sort.asc');
const loadClients = () => rest('clients', 'select=*&order=sort.asc');
async function loadRedirect(path) {
  const rows = await rest('redirects', `select=*&from_path=in.(${encodeURIComponent('"' + path + '"')},${encodeURIComponent('"' + path.replace(/^\/+/, '') + '"')})&limit=1`);
  return rows[0] || null;
}

module.exports = { loadSite, loadPage, loadProjects, loadTestimonials, loadClients, loadRedirect };
