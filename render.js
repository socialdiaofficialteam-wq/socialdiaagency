'use strict';
// One function renders every public page. Vercel sends all non-file URLs here (see vercel.json).
const D = require('../lib/data');
const { rest } = require('../lib/supa');
const { page: shell } = require('../lib/render/shell');
const { renderBlocks, needs } = require('../lib/render/blocks');
const { renderHome } = require('../lib/render/home');
const P = require('../lib/render/pages');
const { esc, plain } = require('../lib/render/util');

function send(res, status, type, body, cache) {
  res.statusCode = status;
  res.setHeader('Content-Type', type + '; charset=utf-8');
  res.setHeader('Cache-Control', cache || 'public, s-maxage=30, stale-while-revalidate=120');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(body);
}

function originOf(req, site) {
  const fixed = String(site.s.seo.site_url || '').trim().replace(/\/+$/, '');
  if (/^https?:\/\//i.test(fixed)) return fixed;
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const proto = req.headers['x-forwarded-proto'] || (/^(localhost|127\.)/.test(host) ? 'http' : 'https');
  return `${proto}://${host}`;
}

async function blocksData(blocks, site) {
  const n = needs(blocks);
  const [projects, testimonials, clients] = await Promise.all([
    n.projects ? D.loadProjects() : [], n.testimonials ? D.loadTestimonials() : [], n.clients ? D.loadClients() : [],
  ]);
  return { site, services: site.services, projects, testimonials, clients };
}

const titleOf = (site, name) => (name ? `${name} | ${site.s.general.brand_name}` : site.s.seo.title_ar || site.s.general.brand_name);

async function handler(req, res) {
  let site;
  try {
    const u = new URL(req.url, 'http://localhost');
    let p = u.searchParams.get('p');
    if (p === null) {
      // Vercel drops an empty ?p= on the home page, so the function sees /api/render: that means "home".
      if (/^\/api\/render\/?$/.test(u.pathname)) p = '';
      else { try { p = decodeURIComponent(u.pathname); } catch (e) { p = u.pathname; } }
    }
    if (p === ':path*') p = '';
    p = String(p).replace(/^\/+|\/+$/g, '');
    if (p.includes('..') || p.split('/').length > 2) p = '__bad__';
    const path = '/' + p;

    site = await D.loadSite();
    const origin = originOf(req, site);

    if (p === 'robots.txt') return send(res, 200, 'text/plain', P.robotsTxt(origin, site.s.seo.index), 'public, s-maxage=300');
    if (p === 'favicon.ico') { res.statusCode = 302; res.setHeader('Location', site.s.general.logo_mark); return res.end(); }
    if (p === 'sitemap.xml') {
      const [pages, projects] = await Promise.all([rest('pages', 'select=slug,updated_at'), D.loadProjects()]);
      return send(res, 200, 'application/xml', P.sitemapXml(origin, pages, projects, site.services), 'public, s-maxage=300');
    }

    // ---- home
    if (p === '') {
      const hp = await D.loadPage('_home').catch(() => null);
      const blocks = hp && Array.isArray(hp.blocks) ? hp.blocks : [];
      const data = await blocksData(blocks, site).catch((e) => { console.error('home blocks data error:', e && e.message); return { site, services: site.services, projects: [], testimonials: [], clients: [] }; });
      data.home = true; data.path = '/';
      const extra = renderBlocks(blocks, data);
      const h = renderHome(site, extra);
      const html = shell(site, {
        path: '/', origin, home: true, title: titleOf(site, ''), desc: plain(site.s.seo, 'desc', 'ar'),
        beforeHeader: h.intro, body: h.body, label: { ar: 'بطاقة العنوان', en: 'Title card', num: '00' },
      });
      return send(res, 200, 'text/html', html);
    }

    // ---- project / service detail
    const parts = p.split('/');
    if (parts.length === 2 && (parts[0] === 'work' || parts[0] === 'services')) {
      if (parts[0] === 'work') {
        const projects = await D.loadProjects();
        const pr = projects.find((x) => x.slug === parts[1]);
        if (pr) {
          const blocks = P.projectBlocks(pr, projects);
          const data = await blocksData(blocks, site); data.path = path;
          return send(res, 200, 'text/html', shell(site, {
            path, origin, title: titleOf(site, plain(pr, 'title', 'ar')), desc: plain(pr, 'summary', 'ar'), og: pr.cover,
            body: renderBlocks(blocks, data), label: { ar: pr.title_ar || pr.title_en, en: pr.title_en || pr.title_ar, num: 'WORK' },
          }));
        }
      } else {
        const sv = site.services.find((x) => x.slug === parts[1]);
        if (sv) {
          const blocks = P.serviceBlocks(sv);
          const data = await blocksData(blocks, site); data.path = path;
          return send(res, 200, 'text/html', shell(site, {
            path, origin, title: titleOf(site, plain(sv, 'title', 'ar')), desc: plain(sv, 'short', 'ar'), og: sv.image,
            body: renderBlocks(blocks, data), label: { ar: sv.title_ar || sv.title_en, en: sv.title_en || sv.title_ar, num: 'SERVICE' },
          }));
        }
      }
    }

    // ---- custom page
    if (parts.length === 1 && p[0] !== '_' && p !== '__bad__') {
      const pg = await D.loadPage(p);
      if (pg) {
        const data = await blocksData(pg.blocks, site); data.path = path;
        const first = Array.isArray(pg.blocks) && pg.blocks[0] && pg.blocks[0].type === 'hero';
        const body = (first ? '' : `<section class="blk blk-hero"><div class="wrap"><div class="bh-grid"><div class="bh-copy"><h1>${renderTitle(pg)}</h1></div></div></div></section>`) + renderBlocks(pg.blocks, data);
        return send(res, 200, 'text/html', shell(site, {
          path, origin, title: titleOf(site, plain({ t_ar: pg.seo_title_ar || pg.title_ar, t_en: pg.seo_title_en || pg.title_en }, 't', 'ar')),
          desc: pg.seo_desc_ar || plain(site.s.seo, 'desc', 'ar'), og: pg.og_image, body,
          label: { ar: pg.title_ar || pg.title_en, en: pg.title_en || pg.title_ar, num: 'PAGE' },
        }));
      }
    }

    // ---- redirects, then 404
    const rd = await D.loadRedirect(path).catch(() => null);
    if (rd && rd.to_url) {
      res.statusCode = rd.permanent ? 301 : 302;
      res.setHeader('Location', rd.to_url); res.setHeader('Cache-Control', 'public, s-maxage=60');
      return res.end();
    }
    const nf = P.notFoundBlocks();
    return send(res, 404, 'text/html', shell(site, {
      path, origin, noindex: true, title: titleOf(site, '404'), desc: '', body: renderBlocks(nf, { site, services: site.services, projects: [], testimonials: [], clients: [], path }),
      label: { ar: '404', en: '404', num: '404' },
    }), 'public, s-maxage=10');
  } catch (e) {
    if (e && e.code === 'NOT_CONFIGURED') {
      return send(res, 503, 'text/html', `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Setup needed</title><body style="font-family:system-ui;max-width:560px;margin:12vh auto;padding:0 20px;line-height:1.8"><h1>الموقع لسه محتاج إعداد</h1><p>ضيف المتغيّرين <b>SUPABASE_URL</b> و <b>SUPABASE_ANON_KEY</b> في إعدادات Vercel ثم أعد النشر. الخطوات في ملف README.</p><p dir="ltr">Add <b>SUPABASE_URL</b> and <b>SUPABASE_ANON_KEY</b> in the Vercel project settings, then redeploy.</p></body>`, 'no-store');
    }
    console.error('render error:', e && e.stack || e);
    const dbg = process.env.SD_DEBUG === '1' ? `<pre dir="ltr" style="white-space:pre-wrap;font-size:12px;background:#eee;padding:10px">${String((e && e.stack) || e).replace(/[<&]/g, ' ').slice(0, 1500)}</pre>` : '';
    return send(res, 500, 'text/html', '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Error</title><body style="font-family:system-ui;max-width:560px;margin:12vh auto;padding:0 20px"><h1>حصلت مشكلة مؤقتة</h1><p>جرّب تعمل تحديث للصفحة بعد شوية.</p>' + dbg + '</body>', 'no-store');
  }
}
function renderTitle(pg) { return require('../lib/render/util').bi(pg, 'title'); }

module.exports = handler;
