const mock = require('./mock-supabase').create();
(async () => {
  await new Promise((r) => mock.server.listen(54321, r));
  process.env.SUPABASE_URL = 'http://localhost:54321'; process.env.SUPABASE_ANON_KEY = 'anon'; process.env.SD_NO_CACHE = '1';
  const dev = await require('../dev-server').start(3100);
  const get = async (p) => { const r = await fetch('http://localhost:3100' + p, { redirect: 'manual' }); return { s: r.status, t: await r.text(), h: r.headers }; };
  for (const p of ['/', '/services', '/work', '/contact', '/services/graphic-design', '/nope', '/old-page', '/sitemap.xml', '/robots.txt', '/api/config', '/admin']) {
    const r = await get(p);
    console.log(p, r.s, r.t.length, (r.t.match(/<title>(.*?)<\/title>/) || [])[1] || '', r.h.get('location') || '');
  }
  const h = (await get('/')).t;
  console.log('nav:', (h.match(/<nav[\s\S]*?<\/nav>/) || [''])[0].replace(/<span class="(ar|en)">/g, '[').replace(/<\/span>/g, ']').slice(0, 700));
  console.log('scenes', (h.match(/class="scene/g) || []).length, 'credits', (h.match(/class="cr"/g) || []).length);
  dev.close(); mock.server.close();
})().catch((e) => { console.error(e); process.exit(1); });
