'use strict';
const { esc, url, bi, hl } = require('./util');
const visuals = require('./visuals');
const { arrow, BLOBS } = require('./blocks');

const pad = (n) => (n < 10 ? '0' : '') + n;

function introHtml(s) {
  return `<div class="intro" id="intro" role="presentation">
  <div class="ui" aria-hidden="true">
    <div class="thirds"></div>
    <span class="br tl"></span><span class="br tr"></span><span class="br bl"></span><span class="br brr"></span>
    <span class="rec"><i></i>REC</span><span class="vf-tc" id="itc">00:00:00:00</span>
    <div id="introSlot"></div>
    <svg class="i-fallback" id="iFallback" viewBox="0 0 120 90" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"><rect x="8" y="22" width="80" height="52" rx="8"/><path d="M88 40l24-12v34L88 52z"/><circle cx="46" cy="48" r="14"/></svg>
    <div class="ifocus"></div>
    <p class="i-cap">${esc(s.general.brand_short || s.general.brand_name)} · Take 1</p>
    <div class="i-bars"><i style="--c:#A8DDE9;--t:.4s"></i><i style="--c:#D6065F;--t:.8s"></i><i style="--c:#FFE96B;--t:1.2s"></i><i style="--c:#2D2D2D;--t:1.6s"></i></div>
    <div class="vf-info"><span>ISO 400</span><span>f/2.8</span><span>1/50</span><span>25 fps</span></div>
  </div>
  <img class="i-logo" id="iLogo" src="${esc(s.general.logo)}" alt="${esc(s.general.brand_name)}">
</div>
<div class="wipe" id="wipe" aria-hidden="true"><i style="--c:#A8DDE9;--k:0"></i><i style="--c:#D6065F;--k:1"></i><i style="--c:#FFE96B;--k:2"></i><i style="--c:#2D2D2D;--k:3"></i></div>`;
}

function renderHome(site, extraBlocksHtml) {
  const { s, scenes, services } = site;
  const h = s.home;
  const total = scenes.length;
  const sceneNum = {};
  scenes.forEach((sc, i) => { sceneNum[sc.key] = i + 1; });

  // --- hero
  const toc = scenes.map((sc, i) => `<a href="#s${i + 1}" data-go="s${i + 1}"><i>${pad(i + 1)}</i><span>${bi(sc, 'name')}</span></a>`).join('');
  const heroLede = (h.hero_lede_ar || h.hero_lede_en) ? `<p class="lede"><span class="ar">${esc(h.hero_lede_ar || h.hero_lede_en)}</span><span class="en">${esc(h.hero_lede_en || h.hero_lede_ar)}</span></p>` : '';
  const heroBtn = (h.hero_cta_ar || h.hero_cta_en) && total
    ? `<div class="cta-row"><a class="btn" href="#s1" data-go="s1"><span class="ar">${esc(h.hero_cta_ar || h.hero_cta_en)}</span><span class="en">${esc(h.hero_cta_en || h.hero_cta_ar)}</span>${arrow}</a></div>` : '';
  const hero = `<section class="hero on" data-title="1">
  ${BLOBS.replace('hero-bg', 'hero-bg')}
  <div class="wrap">
    <div class="hero-grid">
      <div class="hero-copy">
        <p class="slate"><span>${esc(h.hero_slate)}</span><span>${esc(h.hero_reel)}</span></p>
        <h1><span class="ar">${hl(h.hero_title_ar || h.hero_title_en)}</span><span class="en">${hl(h.hero_title_en || h.hero_title_ar)}</span></h1>
        ${heroLede}
        ${heroBtn}
      </div>
      <div class="leader" aria-hidden="true"><span class="orbit"><i></i><i></i><i></i><i></i></span><b id="count">3</b><small>${esc(s.general.brand_short || s.general.brand_name)} · Take 1</small></div>
    </div>
    ${toc ? `<nav class="toc" aria-label="Scenes">${toc}</nav>` : ''}
  </div>
</section>`;

  // --- marquee of services
  const en = services.map((x) => x.title_en || x.title_ar).filter(Boolean);
  const ul = (items, hidden) => `<ul${hidden ? ' aria-hidden="true"' : ''}>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  const half = Math.ceil(en.length / 2);
  const row2 = en.slice(half).concat(en.slice(0, half));
  const marq = en.length ? `<section class="marq" aria-label="Services"><div class="mq">${ul(en)}${ul(en, true)}</div><div class="mq out rev">${ul(row2)}${ul(row2, true)}</div></section>` : '';

  // --- stats
  const stats = (h.stats || []).filter((x) => x && String(x.value).trim() !== '');
  const statsHtml = stats.length ? `<section class="stats"><div class="wrap"><ul class="st-row">${stats.map((x) => {
    const n = /^\d+$/.test(String(x.value).trim()) ? parseInt(x.value, 10) : null;
    return `<li class="st"><b${n !== null ? ` data-n="${n}"` : ''}>${esc(x.value)}</b><span>${bi(x, 'label')}</span></li>`;
  }).join('')}</ul></div></section>` : '';

  // --- scenes
  const scenesHtml = scenes.map((sc, i) => {
    const n = i + 1, even = n % 2 === 0;
    const chips = services.filter((x) => Array.isArray(x.scenes) && x.scenes.includes(sc.key)).map((x) => `<li><a href="/services/${encodeURIComponent(x.slug)}">${bi(x, 'title')}</a></li>`);
    const link = (sc.link_label_ar || sc.link_label_en) && url(sc.link_href)
      ? `<a href="${esc(url(sc.link_href))}"${/^#/.test(sc.link_href) ? ` data-go="${esc(sc.link_href.slice(1))}"` : ''}>${bi(sc, 'link_label')}</a>` : '';
    const vis = visuals[sc.key] || '';
    return `<section class="scene${even ? ' alt flip' : ''}" id="s${n}" data-ar="${esc(sc.name_ar)}" data-en="${esc(sc.name_en)}" data-visual="${esc(sc.key)}">
  <div class="wrap"><div class="scene-grid">
    <div class="copy">
      <div class="num" aria-hidden="true">${pad(n)}</div>
      <p class="slate"><span>Scene ${pad(n)}/${pad(total)}</span><span>${esc(sc.slate || sc.name_en)}</span></p>
      <h2>${bi(sc, 'title')}</h2>
      ${(sc.lede_ar || sc.lede_en) ? `<p class="lede">${bi(sc, 'lede')}</p>` : ''}
      ${(chips.length || link) ? `<ul class="chips">${chips.join('')}${link ? `<li class="lk">${link}</li>` : ''}</ul>` : ''}
    </div>
    ${vis}
  </div></div>
</section>`;
  }).join('\n<div class="perf" aria-hidden="true" style="margin-top:0"></div>\n');

  // --- credits
  const rank = (x) => {
    const first = (Array.isArray(x.scenes) ? x.scenes : []).map((k) => sceneNum[k]).filter(Boolean).sort((a, b) => a - b)[0];
    return first || 99;
  };
  const credits = services.slice().sort((a, b) => rank(a) - rank(b) || a.sort - b.sort);
  const creditsHtml = credits.length ? `<section class="credits" id="credits" data-ar="التترات" data-en="Credits" data-credits="1">
  <div class="wrap">
    <p class="slate"><span>End credits</span><span>Services</span></p>
    <h2>${bi(h, 'credits_title')}</h2>
    <div class="cr-list">
      ${credits.map((x) => { const r = rank(x); return `<a class="cr" href="/services/${encodeURIComponent(x.slug)}"><span class="cr-s">${r < 99 ? 'Scene ' + pad(r) : 'Service'}</span><div><span class="cr-n">${esc(x.title_en || x.title_ar)}</span>${x.title_ar && x.title_en ? `<span class="cr-a ar">${esc(x.title_ar)}</span>` : ''}</div></a>`; }).join('\n      ')}
    </div>
  </div>
</section>` : '';

  // --- finale
  const b1 = url(h.finale_btn_url) && (h.finale_btn_ar || h.finale_btn_en) ? `<a class="btn" href="${esc(url(h.finale_btn_url))}"><span class="ar">${esc(h.finale_btn_ar || h.finale_btn_en)}</span><span class="en">${esc(h.finale_btn_en || h.finale_btn_ar)}</span>${arrow}</a>` : '';
  const b2 = (h.finale_btn2_ar || h.finale_btn2_en) ? `<a class="btn ghost" href="#top" data-go="top"><span class="ar">${esc(h.finale_btn2_ar || h.finale_btn2_en)}</span><span class="en">${esc(h.finale_btn2_en || h.finale_btn2_ar)}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg></a>` : '';
  const finale = `<section class="finale">
  <div class="wrap">
    <h2>${bi(h, 'finale_title')}</h2>
    <div class="cta-row">${b1}${b2}</div>
    <div class="logo-plate"><img src="${esc(s.general.logo)}" alt="${esc(s.general.brand_name)}" loading="lazy"></div>
  </div>
</section>`;

  const intro = s.features.intro !== 'off' ? introHtml(s) : '';
  return { intro, body: [hero, marq, statsHtml, scenes.length ? '<div class="perf" aria-hidden="true"></div>' : '', scenesHtml, creditsHtml, extraBlocksHtml ? `<div class="home-extra">${extraBlocksHtml}</div>` : '', finale].join('\n') };
}

module.exports = { renderHome };
