'use strict';
const { esc, url, bi, jsonForScript } = require('./util');
const { icon } = require('./icons');

const BUILD = process.env.VERCEL_GIT_COMMIT_SHA ? String(process.env.VERCEL_GIT_COMMIT_SHA).slice(0, 8) : 'dev';
const FONTS = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=IBM+Plex+Mono:wght@400;500&family=Readex+Pro:wght@300..700&display=swap';

const hex = (v, d) => (/^#[0-9a-f]{6}$/i.test(String(v || '')) ? v : d);

function themeCss(t) {
  const a = hex(t.accent, '#D6065F'), ad = hex(t.accent_dark, '#FF5C9E');
  const pop = hex(t.pop, '#FFEB6E'), sky = hex(t.sky, '#A8DDE9'), vio = hex(t.violet, '#B04BB5'), leaf = hex(t.leaf, '#5DAA73');
  return `:root{--accent:${a};--pop:${pop};--sky:${sky};--violet:${vio};--leaf:${leaf}}` +
    `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--accent:${ad}}}` +
    `:root[data-theme="dark"]{--accent:${ad}}`;
}

function normPath(p) { return String(p || '/').split('#')[0].split('?')[0].replace(/\/+$/, '') || '/'; }

function brandHtml(g) {
  const parts = String(g.brand_name || '').trim().split(/\s+/);
  const first = parts.shift() || '';
  const rest = parts.join(' ');
  return `<a class="brand" href="/"><img class="mark" src="${esc(g.logo_mark)}" alt="" width="34" height="34">${esc(first)}${rest ? `<small>${esc(rest)}</small>` : ''}</a>`;
}

function navHtml(nav, path, cls) {
  const cur = normPath(path);
  return nav.map((n) => {
    const href = url(n.href) || '/';
    const ext = /^https?:\/\//i.test(href);
    const hp = normPath(href);
    const on = !ext && !/#/.test(href) && (hp === '/' ? cur === '/' : (cur === hp || cur.startsWith(hp + '/')));
    return `<a href="${esc(href)}"${n.newTab || ext ? ' target="_blank" rel="noopener"' : ''}${on ? ' class="on" aria-current="page"' : ''}>${bi({ label_ar: n.ar, label_en: n.en }, 'label')}</a>`;
  }).join('');
}

function socialLinks(soc) {
  const names = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', youtube: 'YouTube', linkedin: 'LinkedIn', x: 'X', behance: 'Behance', snapchat: 'Snapchat', telegram: 'Telegram' };
  return Object.keys(names).filter((k) => url(soc[k])).map((k) => `<a href="${esc(url(soc[k]))}" target="_blank" rel="noopener">${names[k]}</a>`).join('');
}
const digits = (s) => String(s || '').replace(/[^\d]/g, '');

function contactLines(c) {
  const out = [];
  if (c.phone) out.push(`<a href="tel:${esc(c.phone.replace(/\s+/g, ''))}" dir="ltr">${esc(c.phone)}</a>`);
  if (c.email) out.push(`<a href="mailto:${esc(c.email)}" dir="ltr">${esc(c.email)}</a>`);
  if (c.address_ar || c.address_en) out.push(`<span>${bi(c, 'address')}</span>`);
  if (c.hours_ar || c.hours_en) out.push(`<span>${bi(c, 'hours')}</span>`);
  return out;
}

function header(site, ctx) {
  const { s, nav } = site;
  const f = s.features;
  const label = ctx.label || { ar: '', en: '', num: '00' };
  return `<header class="bar">
  <div class="wrap">
    <div class="bar-row">
      ${brandHtml(s.general)}
      <nav class="nav" id="nav" aria-label="Main">${navHtml(nav, ctx.path)}</nav>
      <div class="ctl">
        ${f.theme_toggle ? `<button class="theme" id="theme" type="button" aria-label="Dark / Light" title="Dark / Light"><svg class="moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg><svg class="sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg></button>` : ''}
        ${f.lang_toggle ? `<button class="lang" id="lang" type="button" aria-label="Switch language"><span class="ar">EN</span><span class="en">عربي</span></button>` : ''}
        <button class="burger" id="burger" type="button" aria-label="Menu" aria-expanded="false" aria-controls="nav"><i></i><i></i><i></i></button>
      </div>
    </div>
    ${f.scene_bar ? `<div class="bar-sub">
      <span class="where"><b id="scNum">${esc(label.num)}</b><span class="ar" id="scAr">${esc(label.ar)}</span><span class="en" id="scEn">${esc(label.en)}</span></span>
      <span class="tc" id="tc">00:00:00:00</span>
    </div>` : ''}
  </div>
  <div class="prog"><i id="prog"></i></div>
</header>`;
}

function footer(site) {
  const { s, nav } = site;
  const g = s.general;
  const links = navHtml(nav, '');
  const cl = contactLines(s.contact);
  const soc = socialLinks(s.social);
  return `<footer class="foot2">
  <div class="wrap">
    <div class="f-grid">
      <div class="f-brand">
        <a class="f-logo" href="/"><img src="${esc(g.logo)}" alt="${esc(g.brand_name)}" loading="lazy"></a>
        <p class="f-tag">${bi(g, 'tagline')}</p>
        ${g.footer_text_ar || g.footer_text_en ? `<p class="f-text">${bi(g, 'footer_text')}</p>` : ''}
      </div>
      <div class="f-col"><h4><span class="ar">روابط سريعة</span><span class="en">Quick links</span></h4><div class="f-links">${links}</div></div>
      <div class="f-col"><h4><span class="ar">تواصل</span><span class="en">Contact</span></h4><div class="f-links">${cl.join('') || '<a href="/contact"><span class="ar">ابعتلنا رسالة</span><span class="en">Send us a message</span></a>'}</div>${soc ? `<div class="f-soc">${soc}</div>` : ''}</div>
    </div>
    <div class="f-bar"><span>${esc(g.copyright)}</span><a href="#top" data-go="top" aria-label="Top">${icon('arrow', 'up')}</a></div>
  </div>
</footer>`;
}

function page(site, ctx) {
  const { s } = site;
  const f = s.features, g = s.general, seo = s.seo;
  const origin = ctx.origin || '';
  const title = ctx.title || seo.title_ar || g.brand_name;
  const desc = ctx.desc || seo.desc_ar || '';
  const ogRaw = ctx.og || seo.og_image || g.logo;
  const abs = (u) => (/^https?:/i.test(u) ? u : origin + (String(u).startsWith('/') ? '' : '/') + u);
  const canonical = origin ? origin + (ctx.path === '/' ? '/' : ctx.path) : '';
  const robots = ctx.noindex || seo.index === false ? '<meta name="robots" content="noindex,nofollow">' : '';
  const intro = ctx.home && f.intro !== 'off' ? f.intro : 'off';

  const SD = {
    home: !!ctx.home, intro, enable3d: !!f.enable_3d, effects: !!f.effects, lang: f.default_lang === 'en' ? 'en' : 'ar', theme: f.default_theme || 'system',
    colors: { accent: hex(s.theme.accent, '#D6065F'), accent_dark: hex(s.theme.accent_dark, '#FF5C9E'), pop: hex(s.theme.pop, '#FFEB6E'), sky: hex(s.theme.sky, '#A8DDE9'), violet: hex(s.theme.violet, '#B04BB5'), leaf: hex(s.theme.leaf, '#5DAA73') },
  };
  const wa = digits(s.contact.whatsapp);
  const annc = s.announcement.enabled && (s.announcement.text_ar || s.announcement.text_en)
    ? `<div class="annc">${url(s.announcement.url) ? `<a href="${esc(url(s.announcement.url))}">` : '<span>'}${bi(s.announcement, 'text')}${url(s.announcement.url) ? '</a>' : '</span>'}</div>` : '';
  const scripts = [`<script src="/assets/site.js?v=${BUILD}" defer></script>`];
  if (f.effects) scripts.push(`<script src="/assets/fx.js?v=${BUILD}" defer></script>`);
  if (ctx.home) {
    if (f.enable_3d) scripts.push('<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js" defer></script>');
    scripts.push(`<script src="/assets/home3d.js?v=${BUILD}" defer></script>`);
    scripts.push(`<script src="/assets/home.js?v=${BUILD}" defer></script>`);
  }

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="claude:viewport-fit-sides" content="cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${robots}
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ''}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(g.brand_name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(abs(ogRaw))}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${esc(g.logo_mark)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<link rel="stylesheet" href="/assets/site.css?v=${BUILD}">
<style id="sd-theme">${themeCss(s.theme)}</style>
${s.code.css ? `<style id="custom-css">${String(s.code.css).replace(/<\/style/gi, '<\\/style')}</style>` : ''}
<script>window.SD=${jsonForScript(SD)};(function(){var c=window.SD,d=document.documentElement,off=c.intro==='off';try{if(c.intro==='session'&&sessionStorage.getItem('sd-intro'))off=true}catch(e){}try{if(matchMedia('(prefers-reduced-motion: reduce)').matches)off=true}catch(e){}if(off){d.classList.add('no-intro')}else if(c.intro==='session'){try{sessionStorage.setItem('sd-intro','1')}catch(e){}}})();</script>
${s.code.head || ''}
</head>
<body>
<div id="app" dir="rtl" lang="ar" data-lang="ar">
<script>(function(){var a=document.getElementById('app'),d=document.documentElement,c=window.SD||{},l=c.lang||'ar',t=null;try{var sl=localStorage.getItem('sd-lang');if(sl==='ar'||sl==='en')l=sl;t=localStorage.getItem('sd-theme')}catch(e){}a.setAttribute('data-lang',l);a.setAttribute('lang',l);a.setAttribute('dir',l==='ar'?'rtl':'ltr');d.lang=l;d.dir=l==='ar'?'rtl':'ltr';if(t!=='dark'&&t!=='light'&&c.theme&&c.theme!=='system')t=c.theme;if(t==='dark'||t==='light')d.setAttribute('data-theme',t)})();</script>
${ctx.beforeHeader || ''}
${annc}
${header(site, ctx)}
<main id="top" data-ar="${esc(ctx.label ? ctx.label.ar : '')}" data-en="${esc(ctx.label ? ctx.label.en : '')}">
${ctx.body}
</main>
${footer(site)}
${f.whatsapp_button && wa ? `<a class="wa" href="https://wa.me/${wa}" target="_blank" rel="noopener" aria-label="WhatsApp"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.6.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.1 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.3.7a2.8 2.8 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.6-.3z"/></svg></a>` : ''}
</div>
${s.code.body_end || ''}
${scripts.join('\n')}
</body>
</html>`;
}

module.exports = { page, themeCss, navHtml, contactLines, socialLinks, digits };
