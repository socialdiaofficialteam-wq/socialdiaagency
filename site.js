/* Shared behaviour for every page: language, theme, menu, header bar, filters, lightbox, contact form */
(function () {
  'use strict';
  var app = document.getElementById('app');
  if (!app) return;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var root = document.documentElement;
  var bar = $('.bar');

  /* ---- language ---- */
  function lang() { return app.getAttribute('data-lang') === 'en' ? 'en' : 'ar'; }
  function setLang(l) {
    app.setAttribute('data-lang', l); app.setAttribute('lang', l); app.setAttribute('dir', l === 'ar' ? 'rtl' : 'ltr');
    root.lang = l; root.dir = l === 'ar' ? 'rtl' : 'ltr';
    try { localStorage.setItem('sd-lang', l); } catch (e) {}
    update();
  }
  var langBtn = $('#lang');
  if (langBtn) langBtn.addEventListener('click', function () { setLang(lang() === 'ar' ? 'en' : 'ar'); });

  /* ---- theme: follows the device until the visitor chooses ---- */
  function sysDark() { return !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches); }
  function effective() { var t = root.getAttribute('data-theme'); return (t === 'dark' || t === 'light') ? t : (sysDark() ? 'dark' : 'light'); }
  function syncMode() { app.setAttribute('data-mode', effective()); }
  syncMode();
  var themeBtn = $('#theme');
  if (themeBtn) themeBtn.addEventListener('click', function () {
    var n = effective() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', n);
    try { localStorage.setItem('sd-theme', n); } catch (e) {}
    syncMode();
  });
  if (window.MutationObserver) new MutationObserver(syncMode).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  if (window.matchMedia) { var mq = matchMedia('(prefers-color-scheme: dark)'); if (mq.addEventListener) mq.addEventListener('change', syncMode); }

  /* ---- mobile menu ---- */
  var burger = $('#burger');
  function menu(open) { if (!bar) return; bar.classList.toggle('menu', open); if (burger) burger.setAttribute('aria-expanded', open ? 'true' : 'false'); }
  if (burger) burger.addEventListener('click', function (e) { e.stopPropagation(); menu(!bar.classList.contains('menu')); });
  $$('.nav a').forEach(function (a) { a.addEventListener('click', function () { menu(false); }); });
  document.addEventListener('click', function (e) { if (bar && bar.classList.contains('menu') && !bar.contains(e.target)) menu(false); });
  window.addEventListener('resize', function () { if (window.innerWidth > 899) menu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') menu(false); });

  /* ---- smooth anchors ---- */
  $$('[data-go]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('data-go');
      var el = id === 'top' ? null : document.getElementById(id);
      if (id !== 'top' && !el) return;
      e.preventDefault();
      window.scrollTo({ top: el ? el.getBoundingClientRect().top + window.scrollY - 80 : 0, behavior: reduce ? 'auto' : 'smooth' });
    });
  });

  /* ---- scenes appear when scrolled into view ---- */
  var scenes = $$('.scene');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); } }); }, { threshold: 0.22 });
    scenes.forEach(function (s) { io.observe(s); });
  } else { scenes.forEach(function (s) { s.classList.add('on'); }); }

  /* ---- header: progress, timecode, current scene ---- */
  var scNum = $('#scNum'), scAr = $('#scAr'), scEn = $('#scEn'), tc = $('#tc'), prog = $('#prog'), credits = $('#credits');
  var main = $('main');
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function update() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    if (prog) prog.style.width = (p * 100) + '%';
    if (tc) { var secs = p * 150; tc.textContent = '00:' + pad(Math.floor(secs / 60)) + ':' + pad(Math.floor(secs % 60)) + ':' + pad(Math.floor((secs % 1) * 25)); }
    if (!scenes.length || !scNum) return;
    var line = window.innerHeight * 0.45, cur = null, idx = 0;
    scenes.forEach(function (s, i) { if (s.getBoundingClientRect().top < line) { cur = s; idx = i + 1; } });
    if (credits && credits.getBoundingClientRect().top < line) { scNum.textContent = 'END'; scAr.textContent = 'التترات'; scEn.textContent = 'Credits'; }
    else if (cur) { scNum.textContent = pad(idx) + '/' + pad(scenes.length); scAr.textContent = cur.getAttribute('data-ar'); scEn.textContent = cur.getAttribute('data-en'); }
    else { scNum.textContent = '00'; scAr.textContent = main ? main.getAttribute('data-ar') : ''; scEn.textContent = main ? main.getAttribute('data-en') : ''; }
  }
  var ticking = false;
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(function () { update(); ticking = false; }); } }, { passive: true });
  window.addEventListener('resize', update);
  update();

  /* ---- project filters ---- */
  $$('.filters').forEach(function (box) {
    var grid = box.parentNode.querySelector('.pgrid');
    $$('button', box).forEach(function (b) {
      b.addEventListener('click', function () {
        $$('button', box).forEach(function (x) { x.classList.toggle('on', x === b); });
        var f = b.getAttribute('data-filter');
        if (grid) $$('.pcard', grid).forEach(function (c) { c.classList.toggle('hide', f !== '*' && c.getAttribute('data-cat') !== f); });
      });
    });
  });

  /* ---- lightbox ---- */
  var lbLinks = $$('[data-lb]');
  if (lbLinks.length) {
    var lb = null, cur = 0;
    var show = function (i) {
      cur = (i + lbLinks.length) % lbLinks.length;
      var a = lbLinks[cur], cap = a.getAttribute('data-cap-' + lang()) || '';
      lb.querySelector('img').src = a.getAttribute('href');
      lb.querySelector('figcaption').textContent = cap;
    };
    var close = function () { if (lb) { lb.remove(); lb = null; document.removeEventListener('keydown', key); } };
    var key = function (e) { if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') show(cur + (lang() === 'ar' ? -1 : 1)); else if (e.key === 'ArrowLeft') show(cur + (lang() === 'ar' ? 1 : -1)); };
    lbLinks.forEach(function (a, i) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        lb = document.createElement('div'); lb.className = 'lb'; lb.setAttribute('role', 'dialog');
        lb.innerHTML = '<figure><img alt=""><figcaption></figcaption></figure><button type="button" class="x" aria-label="Close">×</button><button type="button" class="pv nx" aria-label="Previous">‹</button><button type="button" class="nx" style="inset-inline-end:16px" aria-label="Next">›</button>';
        document.body.appendChild(lb);
        lb.addEventListener('click', function (ev) {
          if (ev.target === lb || ev.target.classList.contains('x')) close();
          else if (ev.target.classList.contains('pv')) show(cur - 1);
          else if (ev.target.classList.contains('nx')) show(cur + 1);
        });
        document.addEventListener('keydown', key);
        show(i);
      });
    });
  }

  /* ---- contact form ---- */
  var form = $('#cform');
  if (form) {
    var msg = $('.cmsg', form), sending = false;
    var T = {
      ok: { ar: 'وصلتنا رسالتك. هنرد عليك قريب.', en: 'Message received. We will get back to you soon.' },
      bad: { ar: 'اكتب اسمك ورسالتك من فضلك.', en: 'Please enter your name and message.' },
      mail: { ar: 'الإيميل مش مظبوط.', en: 'That email does not look right.' },
      err: { ar: 'حصلت مشكلة في الإرسال. جرّب تاني.', en: 'Something went wrong. Please try again.' },
      rate: { ar: 'رسائل كتير في وقت قصير. جرّب بعد شوية.', en: 'Too many messages. Please try again later.' }
    };
    var say = function (k, ok) { msg.textContent = T[k][lang()]; msg.className = 'cmsg ' + (ok ? 'ok' : 'err'); };
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (sending) return;
      var d = {}; $$('input,textarea', form).forEach(function (f) { if (f.name) d[f.name] = f.value; });
      if (!String(d.name || '').trim() || String(d.message || '').trim().length < 2) return say('bad');
      if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return say('mail');
      sending = true;
      fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { s: r.status, j: j }; }); })
        .then(function (x) { if (x.j && x.j.ok) { say('ok', true); form.reset(); } else say(x.s === 429 ? 'rate' : 'err'); })
        .catch(function () { say('err'); })
        .then(function () { sending = false; });
    });
  }
})();
