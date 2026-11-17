'use strict';
// End-to-end test: mock Supabase + dev server + a real browser (Playwright).
// Run: node test/run.js   (needs the playwright package; Three.js is stubbed because the CDN is not reachable in tests)
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/usr/lib/node_modules/playwright')); }
const path = require('path');
const mock = require('./mock-supabase').create();
const B = 'http://localhost:3100';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL:', m); } };
const shot = (page, n) => page.screenshot({ path: path.join(__dirname, 'shots', n + '.png'), fullPage: false });

(async () => {
  await new Promise((r) => mock.server.listen(54321, r));
  process.env.SUPABASE_URL = 'http://localhost:54321'; process.env.SUPABASE_ANON_KEY = 'anon'; process.env.SD_NO_CACHE = '1';
  const dev = await require('../dev-server').start(3100);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'ar-EG', deviceScaleFactor: 1 });
  await ctx.route(/cdnjs\.cloudflare\.com/, (r) => r.abort());
  const errors = [];
  const watch = (p) => { p.on('pageerror', (e) => errors.push(p.url() + ' :: ' + e.message)); };
  const field = (page, label) => page.locator('.f', { has: page.locator('label', { hasText: label }) }).first();
  const inp = (page, label) => field(page, label).locator('input:not([type=checkbox]),textarea,select').first();

  /* ================= public site ================= */
  console.log('Public site');
  const page = await ctx.newPage(); watch(page);
  await page.goto(B + '/');
  await page.waitForTimeout(600);
  ok(await page.locator('.scene').count() === 8, 'home has 8 scenes');
  ok(await page.locator('.cr').count() === 10, 'credits list shows 10 services');
  ok(await page.locator('#nav a').count() === 4, 'header has 4 links (Home + 3 pages)');
  ok((await page.locator('.st b').first().textContent()) !== null, 'stats counter exists');
  await page.waitForTimeout(2500);
  await shot(page, 'home-desktop');
  await page.locator('#lang').click();
  ok(await page.locator('#app').getAttribute('dir') === 'ltr', 'language toggle switches to LTR/English');
  await page.locator('button#theme').click();
  ok(['dark', 'light'].includes(await page.locator('html').getAttribute('data-theme')), 'theme toggle sets data-theme');
  await page.locator('#lang').click();

  await page.goto(B + '/contact');
  await page.fill('#cform [name=name]', 'Test User');
  await page.fill('#cform [name=email]', 'a@b.co');
  await page.fill('#cform [name=message]', 'مرحبا، عايز عرض سعر');
  await page.click('#cform button[type=submit]');
  await page.waitForSelector('.cmsg.ok', { timeout: 4000 }).catch(() => {});
  ok(mock.db.tables.messages.length === 1 && mock.db.tables.messages[0].name === 'Test User', 'contact form saved a message in the database');
  await page.fill('#cform [name=name]', 'Bot'); await page.fill('#cform [name=message]', 'spam');
  await page.evaluate(() => { document.querySelector('#cform [name=website]').value = 'http://spam'; });
  await page.click('#cform button[type=submit]'); await page.waitForTimeout(400);
  ok(mock.db.tables.messages.length === 1, 'honeypot message is dropped');

  /* mobile view */
  const mob = await browser.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ar-EG' });
  await mob.route(/cdnjs\.cloudflare\.com/, (r) => r.abort());
  const mp = await mob.newPage(); watch(mp);
  await mp.goto(B + '/'); await mp.waitForTimeout(3000);
  ok(await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'mobile home has no horizontal overflow');
  await mp.click('#burger'); await mp.waitForTimeout(400);
  ok(await mp.locator('.bar.menu #nav').isVisible(), 'mobile burger opens the menu');
  await shot(mp, 'home-mobile-menu');

  /* ================= admin: login ================= */
  console.log('Admin login');
  const ap = await ctx.newPage(); watch(ap);
  ap.on('dialog', (d) => d.accept());
  await ap.goto(B + '/admin');
  await ap.waitForSelector('form input[type=email]');
  const login = async (e, p) => { await ap.fill('input[type=email]', e); await ap.fill('input[type=password]', p); await ap.click('button[type=submit]'); };
  await login('one@test.dev', 'wrong');
  await ap.waitForSelector('.note:visible'); ok(/غلط/.test(await ap.locator('.note').first().textContent()), 'wrong password is rejected');
  await login('nobody@test.dev', 'pass-no');
  await ap.waitForSelector('.note:visible'); ok(/مش مضاف/.test(await ap.locator('.note').first().textContent()), 'non-admin account is rejected');
  await ap.fill('input[type=email]', 'one@test.dev'); await ap.fill('input[type=password]', 'pass-one'); await ap.click('button[type=submit]');
  await ap.waitForSelector('.layout');
  ok(true, 'admin one can log in');
  await shot(ap, 'admin-dash');
  await ap.reload(); await ap.waitForSelector('.layout'); ok(true, 'session survives reload');

  /* ================= create a page that shows in the header ================= */
  console.log('Pages & header');
  await ap.goto(B + '/admin#/pages/new'); await ap.waitForTimeout(500); await ap.waitForSelector('[data-k=title_ar]');
  await ap.fill('[data-k=title_ar]', 'من نحن');
  await ap.fill('[data-k=title_en]', 'About Us');
  ok((await inp(ap, 'الرابط (slug)').inputValue()) === 'about-us', 'slug auto-fills from the English title');
  // fill first two default blocks: hero + text
  const blocks = ap.locator('.blk');
  ok(await blocks.count() === 2, 'new page starts with hero + text blocks');
  await blocks.nth(0).locator('[data-k=title_ar]').fill('حكايتنا [[بدأت]] هنا');
  await blocks.nth(0).locator('[data-k=title_en]').fill('Our story [[started]] here');
  await blocks.nth(1).locator('textarea').first().fill('## نبذة\nإحنا **وكالة** إبداعية.');
  await ap.locator('.add-blk button', { hasText: 'أسئلة شائعة' }).click();
  await ap.locator('.blk').nth(2).locator('button', { hasText: '+ إضافة سؤال' }).click();
  await ap.locator('.blk').nth(2).locator('.rep-i [data-k=q_ar]').fill('بتشتغلوا إزاي؟');
  await ap.locator('.blk').nth(2).locator('.rep-i textarea').first().fill('على مراحل.');
  await ap.locator('.add-blk button', { hasText: 'مسافة' }).click();
  await ap.click('.bar button.pri'); await ap.waitForTimeout(700);
  const pg = mock.db.tables.pages.find((p) => p.slug === 'about-us');
  ok(!!pg && pg.blocks.length === 4 && pg.show_in_nav === true, 'page saved with 4 blocks and show_in_nav');
  const pub = await ctx.newPage(); watch(pub);
  await pub.goto(B + '/about-us');
  ok(await pub.locator('#nav a[href="/about-us"]').count() === 1, 'new page appears in the public header');
  ok((await pub.locator('h1').first().innerHTML()).includes('<mark>'), 'hero highlight [[ ]] renders as <mark>');
  ok(await pub.locator('.prose h3').count() >= 1 && (await pub.locator('.prose strong').count()) >= 1, 'markdown renders (heading + bold)');
  ok(await pub.locator('.faq details').count() === 1, 'FAQ block renders');
  await shot(pub, 'page-about');
  // reorder: change nav order so it goes first
  await ap.goto(B + '/admin#/nav'); await ap.waitForTimeout(500); await ap.waitForSelector('table');
  ok(/من نحن/.test(await ap.locator('table').textContent()), 'nav manager lists the page');
  // unpublish
  await ap.goto(B + '/admin#/pages/' + pg.id); await ap.waitForTimeout(500); await ap.waitForSelector('[data-k=title_ar]');
  await field(ap, 'منشورة').locator('input').uncheck();
  await ap.click('.bar button.pri'); await ap.waitForTimeout(500);
  ok((await fetch(B + '/about-us')).status === 404, 'unpublished page returns 404');
  ok(!(await (await fetch(B + '/')).text()).includes('href="/about-us"'), 'unpublished page disappears from header');

  /* ================= services ================= */
  console.log('Services');
  await ap.goto(B + '/admin#/services/new'); await ap.waitForTimeout(500); await ap.waitForSelector('[data-k=title_ar]');
  await ap.fill('[data-k=title_ar]', 'إنتاج بودكاست'); await ap.fill('[data-k=title_en]', 'Podcast Production');
  await field(ap, 'وصف مختصر').locator('textarea').nth(0).fill('تسجيل ومونتاج'); await field(ap, 'وصف مختصر').locator('textarea').nth(1).fill('Recording and editing');
  await ap.locator('.chk label').nth(4).locator('input').check();
  await ap.click('.bar button.pri'); await ap.waitForTimeout(600);
  ok(mock.db.tables.services.some((s) => s.slug === 'podcast-production' && s.scenes.length === 1), 'service saved with a scene');
  const home = await (await fetch(B + '/')).text();
  ok(home.includes('Podcast Production') && home.includes('/services/podcast-production'), 'service appears in home credits with link');
  ok((await fetch(B + '/services/podcast-production')).status === 200, 'service detail page exists');

  /* ================= projects ================= */
  console.log('Projects');
  await ap.goto(B + '/admin#/projects/new'); await ap.waitForTimeout(500); await ap.waitForSelector('[data-k=title_ar]');
  await ap.fill('[data-k=title_ar]', 'حملة رمضان'); await ap.fill('[data-k=title_en]', 'Ramadan Campaign');
  await ap.fill('[data-k=category_ar]', 'سوشيال'); await ap.fill('[data-k=category_en]', 'Social');
  await inp(ap, 'العميل').fill('براند تجريبي');
  await field(ap, 'ملخص').locator('textarea').nth(0).fill('حملة ناجحة');
  await ap.click('.bar button.pri'); await ap.waitForTimeout(600);
  ok(mock.db.tables.projects.length === 1, 'project saved');
  const wk = await (await fetch(B + '/work')).text();
  ok(wk.includes('Ramadan Campaign') && wk.includes('/work/ramadan-campaign'), 'project listed on /work');
  ok((await fetch(B + '/work/ramadan-campaign')).status === 200, 'project detail page exists');

  /* ================= media ================= */
  console.log('Media');
  await ap.goto(B + '/admin#/media'); await ap.waitForTimeout(500); await ap.waitForSelector('input[type=file]', { state: 'attached' });
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await ap.locator('input[type=file]').first().setInputFiles({ name: 'pixel.png', mimeType: 'image/png', buffer: png });
  await ap.waitForTimeout(900);
  ok(mock.db.files.size === 1, 'file uploaded to storage');
  const fname = [...mock.db.files.keys()][0];
  ok((await fetch('http://localhost:54321/storage/v1/object/public/media/' + fname)).status === 200, 'uploaded file has a public URL');

  /* ================= settings ================= */
  console.log('Settings');
  await ap.goto(B + '/admin#/settings'); await ap.waitForTimeout(500); await ap.waitForSelector('.f');
  await ap.locator('a,button', { hasText: 'بيانات التواصل' }).first().click(); await ap.waitForTimeout(300);
  await inp(ap, 'واتساب').fill('201001234567');
  await ap.click('.bar button.pri'); await ap.waitForTimeout(600);
  ok((mock.db.tables.settings.find((s) => s.key === 'contact') || { value: {} }).value.whatsapp === '201001234567', 'contact settings saved');
  ok((await (await fetch(B + '/')).text()).includes('wa.me/201001234567'), 'WhatsApp button uses the saved number');
  await ap.locator('a,button', { hasText: 'الألوان' }).first().click(); await ap.waitForTimeout(300);
  await ap.locator('.colr input[type=text]').first().fill('#0A7C66');
  await ap.click('.bar button.pri'); await ap.waitForTimeout(600);
  ok((await (await fetch(B + '/')).text()).includes('#0A7C66'), 'theme color change reaches the public CSS');

  /* ================= messages ================= */
  console.log('Messages');
  await ap.goto(B + '/admin#/messages'); await ap.waitForTimeout(500); await ap.waitForSelector('details.msg');
  ok(/Test User/.test(await ap.locator('main').textContent()), 'inbox shows the contact message');
  await ap.locator('details.msg summary').click(); await ap.waitForTimeout(500);
  ok(mock.db.tables.messages[0].read === true, 'opening a message marks it as read');
  await ap.locator('details.msg button', { hasText: '★' }).click(); await ap.waitForTimeout(500);
  ok(mock.db.tables.messages[0].starred === true, 'message can be starred');

  /* ================= admins ================= */
  console.log('Admins');
  await ap.goto(B + '/admin#/admins'); await ap.waitForTimeout(500); await ap.waitForSelector('input[type=email]');
  await ap.fill('input[type=email]', 'nobody@test.dev');
  await ap.locator('button', { hasText: /إضافة/ }).first().click(); await ap.waitForTimeout(600);
  ok(mock.db.tables.admins.length === 3, 'second-level: admin added through add_admin');
  await ap.fill('input[type=email]', 'ghost@test.dev'); await ap.locator('button', { hasText: /إضافة/ }).first().click(); await ap.waitForTimeout(500);
  ok(mock.db.tables.admins.length === 3, 'unknown email is refused');

  /* second admin works too */
  const ctx2 = await browser.newContext({ locale: 'ar-EG' }); const p2 = await ctx2.newPage(); watch(p2);
  await p2.goto(B + '/admin'); await p2.fill('input[type=email]', 'two@test.dev'); await p2.fill('input[type=password]', 'pass-two'); await p2.click('button[type=submit]');
  await p2.waitForSelector('.layout'); ok(true, 'admin two can log in');

  /* ================= redirects + 404 + sitemap ================= */
  console.log('Misc');
  ok((await fetch(B + '/old-page', { redirect: 'manual' })).status === 301, 'redirect works');
  ok((await (await fetch(B + '/sitemap.xml')).text()).includes('/work/ramadan-campaign'), 'sitemap lists projects');
  ok((await fetch(B + '/admin/admin.js')).headers.get('cache-control') === 'no-cache', 'admin assets are not cached');

  const real = errors.filter((e) => !/THREE|three/i.test(e));
  ok(real.length === 0, 'no JavaScript errors on any page' + (real.length ? '\n    ' + real.join('\n    ') : ''));
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close(); dev.close(); mock.server.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
