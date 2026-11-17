'use strict';

const ENT = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ENT[c]);

// Only allow safe link targets.
function url(u) {
  u = String(u == null ? '' : u).trim();
  if (!u) return '';
  if (/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(u)) return u;
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return ''; // javascript:, data:, etc.
  if (/^[\w-]+(\.[\w-]+)+(\/|$)/.test(u)) return 'https://' + u;
  return u;
}

// Same text in both languages, switched by CSS. Falls back to the other language.
function bi(row, key, opts) {
  opts = opts || {};
  const ar = String((row && row[key + '_ar']) || '').trim();
  const en = String((row && row[key + '_en']) || '').trim();
  if (!ar && !en) return '';
  const f = opts.fmt || esc;
  return `<span class="ar">${f(ar || en)}</span><span class="en">${f(en || ar)}</span>`;
}
// Block-level version (for markdown bodies).
function bidiv(row, key, cls) {
  const ar = String((row && row[key + '_ar']) || '').trim();
  const en = String((row && row[key + '_en']) || '').trim();
  if (!ar && !en) return '';
  return `<div class="ar ${cls || ''}">${md(ar || en)}</div><div class="en ${cls || ''}">${md(en || ar)}</div>`;
}
// Plain text for <title> and meta tags.
const plain = (row, key, lang) => String((row && (row[key + '_' + (lang || 'ar')] || row[key + '_ar'] || row[key + '_en'])) || '').trim();

// Highlight: "text [[marked part]] text"
const hl = (t) => esc(t).replace(/\[\[(.+?)\]\]/g, '<mark>$1</mark>');

function inline(t) {
  return esc(t)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)([^*]+?)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, href) => {
      const safe = url(href.replace(/&amp;/g, '&'));
      return safe ? `<a href="${esc(safe)}">${text}</a>` : text;
    });
}
// Small, safe markdown: paragraphs, ## headings, lists, bold, italics, links.
function md(src) {
  const lines = String(src || '').replace(/\r/g, '').split('\n');
  const out = [];
  let para = [], list = null;
  const flushP = () => { if (para.length) { out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; } };
  const flushL = () => { if (list) { out.push(`<${list.t}>` + list.items.map((i) => '<li>' + inline(i) + '</li>').join('') + `</${list.t}>`); list = null; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    let m;
    if (!line.trim()) { flushP(); flushL(); continue; }
    if ((m = /^(#{2,3})\s+(.*)$/.exec(line))) { flushP(); flushL(); out.push(`<h${m[1].length + 1}>${inline(m[2])}</h${m[1].length + 1}>`); continue; }
    if ((m = /^\s*[-*]\s+(.*)$/.exec(line))) { flushP(); if (!list || list.t !== 'ul') { flushL(); list = { t: 'ul', items: [] }; } list.items.push(m[1]); continue; }
    if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(line))) { flushP(); if (!list || list.t !== 'ol') { flushL(); list = { t: 'ol', items: [] }; } list.items.push(m[1]); continue; }
    flushL(); para.push(line);
  }
  flushP(); flushL();
  return out.join('\n');
}

// Video link -> embeddable HTML
function video(u) {
  u = url(u);
  if (!u) return '';
  let m;
  if ((m = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i.exec(u)))
    return `<div class="embed"><iframe src="https://www.youtube-nocookie.com/embed/${esc(m[1])}" title="video" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`;
  if ((m = /vimeo\.com\/(?:video\/)?(\d+)/i.exec(u)))
    return `<div class="embed"><iframe src="https://player.vimeo.com/video/${esc(m[1])}" title="video" loading="lazy" allow="fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(u)) return `<div class="embed"><video src="${esc(u)}" controls playsinline preload="metadata"></video></div>`;
  return `<p><a class="btn ghost" href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a></p>`;
}

const slugify = (s) => String(s || '').toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
const jsonForScript = (o) => JSON.stringify(o).replace(/</g, '\\u003c').split('\u2028').join('').split('\u2029').join('');

module.exports = { esc, url, bi, bidiv, plain, hl, md, video, slugify, jsonForScript };
