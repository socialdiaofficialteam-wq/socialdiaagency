'use strict';
const { esc, url, bi, bidiv, md, video, hl } = require('./util');
const { icon } = require('./icons');
const { contactLines, socialLinks, digits } = require('./shell');

const enc = encodeURIComponent;
const arrow = '<svg class="dir" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const BLOBS = '<div class="hero-bg" aria-hidden="true"><i class="blob" style="--w:520px;--x:-8%;--y:-30%;--c:rgba(168,221,233,.95);--t:19s;--m:26"></i><i class="blob" style="--w:440px;--x:62%;--y:10%;--c:rgba(255,233,107,.9);--t:23s;--m:-34"></i><i class="blob" style="--w:380px;--x:30%;--y:50%;--c:rgba(214,6,95,.28);--t:27s;--m:20"></i></div>';

const has = (p, k) => !!((p[k + '_ar'] && String(p[k + '_ar']).trim()) || (p[k + '_en'] && String(p[k + '_en']).trim()));
function head(p) {
  if (!has(p, 'title') && !has(p, 'text')) return '';
  return `<div class="sec-head">${has(p, 'title') ? `<h2>${bi(p, 'title', { fmt: hl })}</h2>` : ''}${has(p, 'text') ? `<p class="lede">${bi(p, 'text')}</p>` : ''}</div>`;
}
function btn(p, k, cls) {
  const u = url(p[k + '_url'] || p[k === 'cta' ? 'cta_url' : 'url']);
  if (!has(p, k) || !u) return '';
  return `<a class="btn${cls ? ' ' + cls : ''}" href="${esc(u)}"><span class="ar">${esc(p[k + '_ar'] || p[k + '_en'])}</span><span class="en">${esc(p[k + '_en'] || p[k + '_ar'])}</span>${arrow}</a>`;
}
const section = (type, inner, extra) => `<section class="blk blk-${type}"${extra || ''}>${inner}</section>`;
const wrap = (inner) => `<div class="wrap">${inner}</div>`;
const num = (v) => { const n = parseInt(String(v).replace(/[^\d-]/g, ''), 10); return Number.isFinite(n) && /^\s*\d+\s*$/.test(String(v)) ? n : null; };

function projectCard(p) {
  const catKey = String(p.category_en || p.category_ar || '').trim();
  const img = p.cover ? `<img src="${esc(p.cover)}" alt="" loading="lazy">` : `<span class="ph-i">${esc(String(p.title_en || p.title_ar || '?').trim().charAt(0).toUpperCase())}</span>`;
  return `<a class="pcard" href="/work/${enc(p.slug)}" data-cat="${esc(catKey)}"><div class="pimg">${img}</div><div class="pmeta">${has(p, 'category') ? `<span class="pcat">${bi(p, 'category')}</span>` : ''}<h3>${bi(p, 'title')}</h3>${has(p, 'summary') ? `<p>${bi(p, 'summary')}</p>` : ''}</div></a>`;
}
function serviceCard(s) {
  return `<a class="scard" href="/services/${enc(s.slug)}">${icon(s.icon)}<h3>${bi(s, 'title')}</h3>${has(s, 'short') ? `<p>${bi(s, 'short')}</p>` : ''}<span class="more">${arrow}</span></a>`;
}

const R = {
  hero(p) {
    const img = url(p.image) ? `<div class="bh-img"><img src="${esc(url(p.image))}" alt="" loading="lazy"></div>` : '';
    const ctas = btn(p, 'cta') + btn(p, 'cta2', 'ghost');
    return section('hero', BLOBS + wrap(`<div class="bh-grid${img ? ' has-img' : ''} ${p.align === 'center' ? 'center' : ''}"><div class="bh-copy">
      ${has(p, 'eyebrow') ? `<p class="slate"><span>${bi(p, 'eyebrow')}</span></p>` : ''}
      ${has(p, 'title') ? `<h1>${bi(p, 'title', { fmt: hl })}</h1>` : ''}
      ${has(p, 'text') ? `<p class="lede">${bi(p, 'text')}</p>` : ''}
      ${ctas ? `<div class="cta-row">${ctas}</div>` : ''}</div>${img}</div>`));
  },
  text(p) {
    return section('text', wrap(`<div class="prose ${p.width === 'wide' ? 'wide' : ''}">${has(p, 'title') ? `<h2>${bi(p, 'title')}</h2>` : ''}${bidiv(p, 'body', 'md')}</div>`));
  },
  columns(p) {
    const img = url(p.image) ? `<div class="col-img"><img src="${esc(url(p.image))}" alt="" loading="lazy"></div>` : '';
    return section('columns', wrap(`<div class="cols ${p.flip ? 'flip' : ''}${img ? '' : ' one'}"><div class="col-copy">${has(p, 'title') ? `<h2>${bi(p, 'title')}</h2>` : ''}${bidiv(p, 'body', 'md')}${btn(p, 'cta') ? `<div class="cta-row">${btn(p, 'cta')}</div>` : ''}</div>${img}</div>`));
  },
  image(p) {
    if (!url(p.image)) return '';
    return section('image', wrap(`<figure class="fig${p.full ? ' full' : ''}"><img src="${esc(url(p.image))}" alt="${esc(p.caption_en || p.caption_ar || '')}" loading="lazy">${has(p, 'caption') ? `<figcaption>${bi(p, 'caption')}</figcaption>` : ''}</figure>`));
  },
  gallery(p) {
    const items = (Array.isArray(p.images) ? p.images : []).map((x) => (typeof x === 'string' ? { url: x } : x)).filter((x) => x && url(x.url));
    if (!items.length) return '';
    const cols = [2, 3, 4].includes(Number(p.columns)) ? Number(p.columns) : 3;
    return section('gallery', wrap(head(p) + `<div class="gal c${cols}">${items.map((x) => `<a href="${esc(url(x.url))}" data-lb${has(x, 'caption') ? ` data-cap-ar="${esc(x.caption_ar || x.caption_en)}" data-cap-en="${esc(x.caption_en || x.caption_ar)}"` : ''}><img src="${esc(url(x.url))}" alt="" loading="lazy"></a>`).join('')}</div>`));
  },
  video(p) {
    const v = video(p.url);
    if (!v) return '';
    return section('video', wrap(head(p) + v + (has(p, 'caption') ? `<p class="cap">${bi(p, 'caption')}</p>` : '')));
  },
  services(p, c) {
    let list = c.services || [];
    if (Number(p.limit) > 0) list = list.slice(0, Number(p.limit));
    if (!list.length) return '';
    return section('services', wrap(head(p) + `<div class="cards ${p.layout === 'list' ? 'list' : 'grid'}">${list.map(serviceCard).join('')}</div>`));
  },
  projects(p, c) {
    let list = c.projects || [];
    if (p.filter === 'featured') list = list.filter((x) => x.featured);
    const cat = String(p.category || '').trim().toLowerCase();
    if (cat) list = list.filter((x) => String(x.category_en || '').toLowerCase() === cat || String(x.category_ar || '').toLowerCase() === cat);
    if (Number(p.limit) > 0) list = list.slice(0, Number(p.limit));
    if (!list.length) {
      if (c.home) return '';
      return section('projects', wrap(head(p) + `<p class="empty"><span class="ar">لسه مفيش أعمال مضافة. هتظهر هنا قريبًا.</span><span class="en">No work added yet. It will appear here soon.</span></p>`));
    }
    let filters = '';
    if (p.show_filters) {
      const seen = new Map();
      list.forEach((x) => { const k = String(x.category_en || x.category_ar || '').trim(); if (k && !seen.has(k)) seen.set(k, x); });
      if (seen.size > 1) {
        filters = `<div class="filters" role="group"><button type="button" class="on" data-filter="*"><span class="ar">الكل</span><span class="en">All</span></button>${[...seen].map(([k, x]) => `<button type="button" data-filter="${esc(k)}">${bi(x, 'category')}</button>`).join('')}</div>`;
      }
    }
    return section('projects', wrap(head(p) + filters + `<div class="cards grid pgrid">${list.map(projectCard).join('')}</div>`));
  },
  features(p) {
    const items = Array.isArray(p.items) ? p.items : [];
    if (!items.length) return '';
    return section('features', wrap(head(p) + `<div class="cards grid">${items.map((x) => `<div class="scard flat">${icon(x.icon)}<h3>${bi(x, 'title')}</h3>${has(x, 'text') ? `<p>${bi(x, 'text')}</p>` : ''}</div>`).join('')}</div>`));
  },
  stats(p) {
    const items = (Array.isArray(p.items) ? p.items : []).filter((x) => x && String(x.value).trim() !== '');
    if (!items.length) return '';
    return section('stats stats', wrap(head(p) + `<ul class="st-row">${items.map((x) => { const n = num(x.value); return `<li class="st"><b${n !== null ? ` data-n="${n}"` : ''}>${esc(x.value)}</b><span>${bi(x, 'label')}</span></li>`; }).join('')}</ul>`));
  },
  faq(p) {
    const items = Array.isArray(p.items) ? p.items : [];
    if (!items.length) return '';
    return section('faq', wrap(head(p) + `<div class="faq">${items.map((x) => `<details><summary>${bi({ q_ar: x.q_ar, q_en: x.q_en }, 'q')}</summary>${bidiv({ a_ar: x.a_ar, a_en: x.a_en }, 'a', 'md')}</details>`).join('')}</div>`));
  },
  testimonials(p, c) {
    let list = c.testimonials || [];
    if (Number(p.limit) > 0) list = list.slice(0, Number(p.limit));
    if (!list.length) return '';
    return section('testimonials', wrap(head(p) + `<div class="cards grid t3">${list.map((x) => `<figure class="quote"><blockquote>${bi(x, 'text')}</blockquote><figcaption>${x.avatar ? `<img src="${esc(x.avatar)}" alt="" loading="lazy">` : ''}<span><b>${esc(x.name)}</b>${has(x, 'role') ? `<small>${bi(x, 'role')}</small>` : ''}</span></figcaption></figure>`).join('')}</div>`));
  },
  clients(p, c) {
    const list = (c.clients || []).filter((x) => x.logo);
    if (!list.length) return '';
    return section('clients', wrap(head(p) + `<div class="logos">${list.map((x) => { const img = `<img src="${esc(x.logo)}" alt="${esc(x.name)}" loading="lazy">`; return url(x.url) ? `<a href="${esc(url(x.url))}" target="_blank" rel="noopener">${img}</a>` : `<span>${img}</span>`; }).join('')}</div>`));
  },
  cta(p) {
    const style = ['accent', 'dark', 'yellow'].includes(p.style) ? p.style : 'accent';
    return section('cta', wrap(`<div class="cta-band ${style}">${has(p, 'title') ? `<h2>${bi(p, 'title', { fmt: hl })}</h2>` : ''}${has(p, 'text') ? `<p>${bi(p, 'text')}</p>` : ''}${ctaBtn(p)}</div>`));
  },
  contact(p, c) {
    const s = c.site.s;
    const info = p.show_info === false ? '' : (() => {
      const ct = s.contact, rows = [];
      if (ct.phone) rows.push(`<li>${icon('phone')}<a href="tel:${esc(ct.phone.replace(/\s+/g, ''))}" dir="ltr">${esc(ct.phone)}</a></li>`);
      if (digits(ct.whatsapp)) rows.push(`<li>${icon('megaphone')}<a href="https://wa.me/${digits(ct.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a></li>`);
      if (ct.email) rows.push(`<li>${icon('mail')}<a href="mailto:${esc(ct.email)}" dir="ltr">${esc(ct.email)}</a></li>`);
      if (has(ct, 'address')) rows.push(`<li>${icon('pin')}<span>${bi(ct, 'address')}</span></li>`);
      if (has(ct, 'hours')) rows.push(`<li>${icon('clock')}<span>${bi(ct, 'hours')}</span></li>`);
      const soc = socialLinks(s.social);
      const map = url(ct.map_url) ? `<a class="btn ghost" href="${esc(url(ct.map_url))}" target="_blank" rel="noopener"><span class="ar">افتح الخريطة</span><span class="en">Open map</span></a>` : '';
      if (!rows.length && !soc) return '';
      return `<aside class="cinfo"><ul>${rows.join('')}</ul>${soc ? `<div class="f-soc">${soc}</div>` : ''}${map}</aside>`;
    })();
    const f = (name, ar, en, extra) => `<label class="fld"><span class="lab"><span class="ar">${ar}</span><span class="en">${en}</span></span>${extra}</label>`;
    return section('contact', wrap(head(p) + `<div class="cgrid${info ? '' : ' one'}">
      <form class="cform" id="cform" novalidate>
        <input type="text" name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
        <input type="hidden" name="page" value="${esc(c.path || '')}">
        <div class="row2">${f('name', 'الاسم *', 'Name *', '<input name="name" type="text" required maxlength="200" autocomplete="name">')}${f('phone', 'رقم الموبايل', 'Phone', '<input name="phone" type="tel" maxlength="60" autocomplete="tel" dir="ltr">')}</div>
        ${f('email', 'الإيميل', 'Email', '<input name="email" type="email" maxlength="200" autocomplete="email" dir="ltr">')}
        ${f('subject', 'الموضوع', 'Subject', '<input name="subject" type="text" maxlength="200">')}
        ${f('message', 'رسالتك *', 'Your message *', '<textarea name="message" rows="6" required maxlength="5000"></textarea>')}
        <div class="cta-row"><button class="btn" type="submit"><span class="ar">ابعت الرسالة</span><span class="en">Send message</span>${arrow}</button></div>
        <p class="cmsg" role="status" aria-live="polite"></p>
      </form>${info}</div>`));
  },
  html(p) { return p.code ? section('html', String(p.code)) : ''; },
  spacer(p) { return `<div class="blk blk-spacer" style="height:${Math.max(0, Math.min(400, Number(p.height) || 40))}px" aria-hidden="true"></div>`; },
};
function ctaBtn(p) {
  const u = url(p.url);
  if (!u || !has(p, 'button')) return '';
  return `<a class="btn" href="${esc(u)}"><span class="ar">${esc(p.button_ar || p.button_en)}</span><span class="en">${esc(p.button_en || p.button_ar)}</span>${arrow}</a>`;
}

const TYPES = Object.keys(R);
function needs(blocks) {
  const t = new Set((Array.isArray(blocks) ? blocks : []).map((b) => b && b.type));
  return { projects: t.has('projects'), services: t.has('services'), testimonials: t.has('testimonials'), clients: t.has('clients') };
}
function renderBlocks(blocks, ctx) {
  return (Array.isArray(blocks) ? blocks : []).map((b) => {
    if (!b || !R[b.type]) return '';
    try { return R[b.type](b.props || {}, ctx); } catch (e) { return ''; }
  }).join('\n');
}

module.exports = { renderBlocks, needs, projectCard, serviceCard, TYPES, BLOBS, arrow, btn, has, head };
