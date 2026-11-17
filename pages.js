'use strict';
const { esc, plain } = require('./util');
const { renderBlocks } = require('./blocks');

const rid = (() => { let n = 0; return () => 'x' + (++n); })();
const blk = (type, props) => ({ id: rid(), type, props });

function metaList(p) {
  const rows = [];
  if (p.client) rows.push(`<li><b><span class="ar">العميل</span><span class="en">Client</span></b><span>${esc(p.client)}</span></li>`);
  if (p.year) rows.push(`<li><b><span class="ar">السنة</span><span class="en">Year</span></b><span>${esc(p.year)}</span></li>`);
  const tags = String(p.tags || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (tags.length) rows.push(`<li><b><span class="ar">الخدمات</span><span class="en">Services</span></b><span>${tags.map(esc).join(' · ')}</span></li>`);
  return rows.length ? `<div class="wrap"><ul class="meta">${rows.join('')}</ul></div>` : '';
}

function projectBlocks(p, all) {
  const gallery = (Array.isArray(p.gallery) ? p.gallery : []).map((x) => (typeof x === 'string' ? { url: x } : x));
  const idx = all.findIndex((x) => x.id === p.id);
  const next = all.length > 1 ? all[(idx + 1) % all.length] : null;
  const blocks = [
    blk('hero', { eyebrow_ar: p.category_ar, eyebrow_en: p.category_en, title_ar: p.title_ar, title_en: p.title_en, text_ar: p.summary_ar, text_en: p.summary_en, image: p.cover, cta_ar: p.link ? 'زيارة المشروع' : '', cta_en: p.link ? 'Visit project' : '', cta_url: p.link || '', align: 'start' }),
    blk('html', { code: metaList(p) }),
    blk('text', { title_ar: '', title_en: '', body_ar: p.body_ar, body_en: p.body_en, width: 'narrow' }),
    blk('stats', { title_ar: 'النتائج', title_en: 'Results', items: (Array.isArray(p.results) ? p.results : []) }),
    blk('video', { title_ar: '', title_en: '', url: p.video, caption_ar: '', caption_en: '' }),
    blk('gallery', { title_ar: '', title_en: '', images: gallery, columns: 3 }),
  ];
  if (next && next.id !== p.id) {
    blocks.push(blk('cta', { title_ar: 'المشروع اللي بعده', title_en: 'Next project', text_ar: next.title_ar, text_en: next.title_en, button_ar: 'شوف المشروع', button_en: 'View project', url: '/work/' + encodeURIComponent(next.slug), style: 'dark' }));
  }
  return blocks;
}

function serviceBlocks(s) {
  return [
    blk('hero', { eyebrow_ar: 'خدمة', eyebrow_en: 'Service', title_ar: s.title_ar, title_en: s.title_en, text_ar: s.short_ar, text_en: s.short_en, image: s.image, cta_ar: 'ابدأ معانا', cta_en: 'Start with us', cta_url: '/contact', align: 'start' }),
    blk('text', { title_ar: '', title_en: '', body_ar: s.body_ar, body_en: s.body_en, width: 'narrow' }),
    blk('services', { title_ar: 'خدمات تانية', title_en: 'More services', text_ar: '', text_en: '', layout: 'grid', limit: 0 }),
    blk('cta', { title_ar: 'جاهز نبدأ؟', title_en: 'Ready to start?', text_ar: 'احكيلنا عن فكرتك وإحنا نرد عليك.', text_en: 'Tell us about your idea and we will get back to you.', button_ar: 'تواصل معانا', button_en: 'Contact us', url: '/contact', style: 'accent' }),
  ];
}

function notFoundBlocks() {
  return [blk('hero', { eyebrow_ar: '404', eyebrow_en: '404', title_ar: 'المشهد ده مش موجود.', title_en: 'This scene does not exist.', text_ar: 'الرابط ممكن يكون اتغير أو اتشال.', text_en: 'The link may have changed or been removed.', cta_ar: 'ارجع للرئيسية', cta_en: 'Back to home', cta_url: '/', align: 'start' })];
}

const urlTag = (loc, last) => `<url><loc>${esc(loc)}</loc>${last ? `<lastmod>${esc(String(last).slice(0, 10))}</lastmod>` : ''}</url>`;
function sitemapXml(origin, pages, projects, services) {
  const u = [urlTag(origin + '/')];
  pages.filter((p) => p.slug && p.slug[0] !== '_').forEach((p) => u.push(urlTag(`${origin}/${encodeURIComponent(p.slug)}`, p.updated_at)));
  projects.forEach((p) => u.push(urlTag(`${origin}/work/${encodeURIComponent(p.slug)}`, p.updated_at)));
  services.forEach((p) => u.push(urlTag(`${origin}/services/${encodeURIComponent(p.slug)}`, p.updated_at)));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${u.join('')}</urlset>`;
}
function robotsTxt(origin, index) {
  return index === false ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nDisallow: /admin\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`;
}

module.exports = { projectBlocks, serviceBlocks, notFoundBlocks, sitemapXml, robotsTxt, renderBlocks, plain };
