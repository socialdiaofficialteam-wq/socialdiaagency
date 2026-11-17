const mock = require('./mock-supabase').create();
(async () => {
  await new Promise((r) => mock.server.listen(54321, r));
  process.env.SUPABASE_URL = 'http://localhost:54321'; process.env.SUPABASE_ANON_KEY = 'a'; process.env.SD_NO_CACHE = '1';
  const dev = await require('../dev-server').start(3100);
  const t = mock.db.tables;
  const cases = {
    'external nav item': () => t.nav_items.push({ id: 'n1', sort: 5, visible: true, label_ar: 'إنستجرام', label_en: 'Instagram', href: 'https://instagram.com/x', new_tab: true }),
    'nav null fields': () => t.nav_items.push({ id: 'n2', sort: null, visible: true, label_ar: null, label_en: null, href: null, new_tab: null }),
    'nav no sort/href keys': () => t.nav_items.push({ id: 'n3', visible: true }),
    'nav weird href': () => t.nav_items.push({ id: 'n4', sort: 1, visible: true, label_ar: 'x', label_en: 'x', href: 'javascript:alert(1)', new_tab: false }),
    'page null title/blocks': () => t.pages.push({ id: 'p1', slug: 'ext', published: true, title_ar: null, title_en: null, blocks: null, show_in_nav: true, nav_sort: null }),
    'page blocks not array': () => t.pages.push({ id: 'p2', slug: 'bad', published: true, title_ar: 'a', title_en: 'a', blocks: { x: 1 }, show_in_nav: true, nav_sort: 3 }),
    'page unknown block / null props': () => t.pages.push({ id: 'p3', slug: 'ub', published: true, title_ar: 'a', title_en: 'a', blocks: [{ id: 'z', type: 'nope' }, { id: 'y', type: 'text' }, null, { type: 'image', props: null }, { type: 'cta', props: { url: 'https://x.com' } }], show_in_nav: true, nav_sort: 4 }),
    'service null fields': () => t.services.push({ id: 's9', slug: 'sv', visible: true, sort: null, title_ar: null, title_en: null, scenes: null }),
    'home blocks not array': () => t.pages.find((x) => x.slug === '_home').blocks = { a: 1 },
    'home blocks junk': () => t.pages.find((x) => x.slug === '_home').blocks = [null, 5, { type: 'projects', props: 'str' }, { type: 'cta', props: { url: 'https://x.com', button_ar: null } }],
    'settings garbage': () => t.settings.push({ key: 'theme', value: 'oops' }, { key: 'features', value: null }, { key: 'general', value: [] }),
  };
  for (const [name, fn] of Object.entries(cases)) {
    fn();
    const out = [];
    for (const p of ['/', '/ext', '/bad', '/ub', '/services', '/work']) { const r = await fetch('http://localhost:3100' + p); out.push(p + ':' + r.status); }
    console.log(name.padEnd(34), out.join(' '));
  }
  dev.close(); mock.server.close();
})();
