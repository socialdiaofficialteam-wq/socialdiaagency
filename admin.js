/* Socialdia admin: single-file vanilla SPA over Supabase (Auth + PostgREST + Storage). */
(function () {
  'use strict';
  var cfg = null, S = { token: '', refresh: '', user: null };
  var root = document.getElementById('root');
  var ICONS = ['spark','megaphone','camera','video','pen','code','cart','star','phone','chart','users','heart','globe','target','layers','shield','clock','mail','pin','arrow','check'];

  /* ---------------- helpers ---------------- */
  function h(tag, a, kids) {
    var e = document.createElement(tag);
    if (a) for (var k in a) {
      var v = a[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else if (k === 'value') e.value = v;
      else if (k === 'checked') e.checked = !!v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    (function add(list) {
      (Array.isArray(list) ? list : list != null ? [list] : []).forEach(function (c) {
        if (c == null || c === false) return;
        if (Array.isArray(c)) return add(c);
        e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
      });
    })(kids);
    return e;
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function toast(m, err) { var t = h('div', { class: 'toast' + (err ? ' err' : ''), text: m }); document.getElementById('toasts').appendChild(t); setTimeout(function () { t.remove(); }, err ? 6000 : 2800); }
  function uid() { return 'b' + Math.random().toString(36).slice(2, 9); }
  function clone(x) { return JSON.parse(JSON.stringify(x == null ? null : x)); }
  function slugify(s) { return String(s || '').toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 80); }
  function confirmP(m) { return Promise.resolve(window.confirm(m)); }
  function fmtDate(s) { try { return new Date(s).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return s || ''; } }

  /* ---------------- api ---------------- */
  function saveSession() { try { localStorage.setItem('sd-admin', JSON.stringify({ t: S.token, r: S.refresh, u: S.user })); } catch (e) {} }
  function loadSession() { try { var j = JSON.parse(localStorage.getItem('sd-admin') || 'null'); if (j) { S.token = j.t; S.refresh = j.r; S.user = j.u; } } catch (e) {} }
  function dropSession() { S = { token: '', refresh: '', user: null }; try { localStorage.removeItem('sd-admin'); } catch (e) {} }

  function parseErr(j, status) { return (j && (j.message || j.msg || j.error_description || j.error || j.hint)) || ('HTTP ' + status); }
  async function req(path, o, retry) {
    o = o || {};
    var hd = { apikey: cfg.anonKey, Authorization: 'Bearer ' + (S.token || cfg.anonKey) };
    if (o.prefer) hd.Prefer = o.prefer;
    if (o.headers) for (var k in o.headers) hd[k] = o.headers[k];
    var body = o.body;
    if (o.json !== undefined) { hd['Content-Type'] = 'application/json'; body = JSON.stringify(o.json); }
    var r = await fetch(cfg.url + path, { method: o.method || 'GET', headers: hd, body: body });
    if (r.status === 401 && S.refresh && !retry && path.indexOf('/auth/v1/token') !== 0) {
      if (await refreshTok()) return req(path, o, true);
      dropSession(); showLogin('انتهت الجلسة. سجّل الدخول من جديد.'); throw new Error('session');
    }
    var txt = await r.text(), j = null;
    try { j = txt ? JSON.parse(txt) : null; } catch (e) { j = txt; }
    if (!r.ok) throw new Error(parseErr(j, r.status));
    return j;
  }
  async function refreshTok() {
    try {
      var j = await req('/auth/v1/token?grant_type=refresh_token', { method: 'POST', json: { refresh_token: S.refresh } }, true);
      S.token = j.access_token; S.refresh = j.refresh_token || S.refresh; S.user = j.user || S.user; saveSession(); return true;
    } catch (e) { return false; }
  }
  var db = {
    sel: function (t, qs) { return req('/rest/v1/' + t + (qs ? '?' + qs : '')); },
    ins: function (t, row) { return req('/rest/v1/' + t, { method: 'POST', json: row, prefer: 'return=representation' }); },
    upd: function (t, col, id, patch) { return req('/rest/v1/' + t + '?' + col + '=eq.' + encodeURIComponent(id), { method: 'PATCH', json: patch, prefer: 'return=representation' }); },
    del: function (t, col, id) { return req('/rest/v1/' + t + '?' + col + '=eq.' + encodeURIComponent(id), { method: 'DELETE' }); },
    ups: function (t, rows, on) { return req('/rest/v1/' + t + (on ? '?on_conflict=' + on : ''), { method: 'POST', json: rows, prefer: 'resolution=merge-duplicates,return=representation' }); },
    rpc: function (fn, args) { return req('/rest/v1/rpc/' + fn, { method: 'POST', json: args }); }
  };
  var publicUrl = function (name) { return cfg.url + '/storage/v1/object/public/media/' + name.split('/').map(encodeURIComponent).join('/'); };

  /* ---------------- form builder ---------------- */
  /* field: {k,t,label,hint,opts,sub,from,rows,ph,ltr,itemLabel,addLabel}
     t: text bi bia bimd area code num bool select color image images slug scenes list */
  var CTX = { scenes: [] };
  function labelled(f, ctrl) { return h('div', { class: 'f' }, [h('label', { text: f.label || '' }), ctrl, f.hint ? h('span', { class: 'hint', text: f.hint }) : null]); }
  function buildForm(fields, data, onChange) {
    var el = h('div'), getters = [];
    data = data || {};
    var chg = function () { if (onChange) onChange(); };
    fields.forEach(function (f) {
      var f1 = build1(f, data, chg);
      el.appendChild(f1.el); getters.push(f1.get);
    });
    return { el: el, read: function () { var o = {}; getters.forEach(function (g) { g(o); }); return o; } };
  }
  function build1(f, data, chg) {
    var t = f.t || 'text', v = data[f.k], inp, w;
    var wire = function (n) { n.addEventListener('input', chg); n.addEventListener('change', chg); return n; };
    if (t === 'text' || t === 'url') {
      inp = wire(h('input', { type: 'text', value: v == null ? '' : v, class: f.ltr || t === 'url' ? 'ltr' : '', placeholder: f.ph || '', dir: f.ltr || t === 'url' ? 'ltr' : null }));
      return { el: labelled(f, inp), get: function (o) { o[f.k] = inp.value.trim(); } };
    }
    if (t === 'slug') {
      inp = wire(h('input', { type: 'text', value: v || '', class: 'ltr', dir: 'ltr' }));
      var touched = !!v;
      inp.addEventListener('input', function () { touched = true; });
      if (f.from) setTimeout(function () {
        var src = inp.closest('form,.card,body').querySelector('[data-k="' + f.from + '"]');
        if (src) src.addEventListener('input', function () { if (!touched || !inp.value) { inp.value = slugify(src.value); } });
      }, 0);
      return { el: labelled(f, inp), get: function (o) { o[f.k] = slugify(inp.value); } };
    }
    if (t === 'num') {
      inp = wire(h('input', { type: 'number', value: v == null ? '' : v, class: 'ltr', dir: 'ltr' }));
      return { el: labelled(f, inp), get: function (o) { o[f.k] = inp.value === '' ? 0 : Number(inp.value); } };
    }
    if (t === 'area' || t === 'code') {
      inp = wire(h('textarea', { class: t === 'code' ? 'code' : '', rows: f.rows || 4, text: v == null ? '' : v }));
      inp.value = v == null ? '' : v;
      return { el: labelled(f, inp), get: function (o) { o[f.k] = inp.value; } };
    }
    if (t === 'bi' || t === 'bia' || t === 'bimd') {
      var mk = function (suffix, lab) {
        var val = data[f.k + '_' + suffix];
        var c = t === 'bi' ? h('input', { type: 'text', value: val || '', 'data-k': f.k + '_' + suffix }) : h('textarea', { rows: f.rows || (t === 'bimd' ? 8 : 3) });
        if (t !== 'bi') c.value = val || '';
        if (suffix === 'en') c.setAttribute('dir', 'ltr'), c.style.textAlign = 'left';
        wire(c);
        return h('div', null, [h('div', { class: 'tag', text: lab }), c]);
      };
      var a = mk('ar', 'عربي'), e = mk('en', 'English');
      var hint = f.hint || (t === 'bimd' ? 'يدعم: ## عنوان، **غامق**، *مائل*، - قوائم، [نص](رابط)' : '');
      return {
        el: h('div', { class: 'f' }, [h('label', { text: f.label || '' }), h('div', { class: 'bi' }, [a, e]), hint ? h('span', { class: 'hint', text: hint }) : null]),
        get: function (o) { o[f.k + '_ar'] = a.lastChild.value.trim(); o[f.k + '_en'] = e.lastChild.value.trim(); }
      };
    }
    if (t === 'bool') {
      inp = wire(h('input', { type: 'checkbox', checked: v === undefined ? !!f.def : !!v }));
      return { el: h('div', { class: 'f' }, [h('label', { class: 'sw' }, [inp, h('span', { text: f.label })]), f.hint ? h('span', { class: 'hint', text: f.hint }) : null]), get: function (o) { o[f.k] = inp.checked; } };
    }
    if (t === 'select') {
      inp = wire(h('select', null, (f.opts || []).map(function (p) { return h('option', { value: p[0], text: p[1] }); })));
      inp.value = v == null ? (f.def != null ? f.def : (f.opts[0] || [''])[0]) : v;
      return { el: labelled(f, inp), get: function (o) { o[f.k] = inp.value; } };
    }
    if (t === 'color') {
      var cc = h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(v || '') ? v : '#000000' }), tx = h('input', { type: 'text', value: v || '', class: 'ltr', dir: 'ltr' });
      cc.addEventListener('input', function () { tx.value = cc.value; chg(); });
      tx.addEventListener('input', function () { if (/^#[0-9a-f]{6}$/i.test(tx.value)) cc.value = tx.value; chg(); });
      return { el: labelled(f, h('div', { class: 'colr' }, [cc, tx])), get: function (o) { o[f.k] = tx.value.trim(); } };
    }
    if (t === 'image') {
      var pv = h('img', { class: 'pv', alt: '' });
      inp = h('input', { type: 'text', value: v || '', class: 'ltr', dir: 'ltr', placeholder: 'https://… أو اختر من المكتبة' });
      var sync = function () { if (inp.value) { pv.src = inp.value; pv.style.display = ''; } else pv.style.display = 'none'; };
      inp.addEventListener('input', function () { sync(); chg(); }); sync();
      pv.onerror = function () { pv.style.display = 'none'; };
      var pick = h('button', { type: 'button', class: 'btn sm', text: 'اختر / ارفع', onclick: function () { openPicker(function (u) { inp.value = u; sync(); chg(); }); } });
      var rm = h('button', { type: 'button', class: 'btn sm', text: '✕', title: 'مسح', onclick: function () { inp.value = ''; sync(); chg(); } });
      return { el: labelled(f, h('div', { class: 'imgf' }, [pv, inp, pick, rm])), get: function (o) { o[f.k] = inp.value.trim(); } };
    }
    if (t === 'scenes') {
      var cur = Array.isArray(v) ? v : [];
      var boxes = CTX.scenes.map(function (s) { var c = wire(h('input', { type: 'checkbox', value: s.key, checked: cur.indexOf(s.key) > -1 })); return h('label', null, [c, h('span', { text: s.name_ar || s.key })]); });
      return { el: labelled(f, h('div', { class: 'chk' }, boxes)), get: function (o) { o[f.k] = boxes.filter(function (b) { return b.firstChild.checked; }).map(function (b) { return b.firstChild.value; }); } };
    }
    if (t === 'images' || t === 'list') {
      var sub = t === 'images' ? [{ k: 'url', t: 'image', label: 'الصورة' }, { k: 'caption', t: 'bi', label: 'تعليق (اختياري)' }] : f.sub;
      var items = (Array.isArray(v) ? v : []).map(function (x) { return typeof x === 'string' ? { url: x } : x; });
      var list = h('div', { class: 'rep' }), rows = [];
      var renum = function () { rows.forEach(function (r, i) { r.num.textContent = (f.itemLabel || 'عنصر') + ' ' + (i + 1); }); };
      var addRow = function (d) {
        var form = buildForm(sub, d, chg), num = h('b');
        var row = { form: form, num: num };
        var box = h('div', { class: 'rep-i' }, [h('div', { class: 'rep-h' }, [num,
          h('button', { type: 'button', class: 'btn sm', text: '↑', onclick: function () { var i = rows.indexOf(row); if (i > 0) { rows.splice(i - 1, 0, rows.splice(i, 1)[0]); list.insertBefore(box, rows[i].box); renum(); chg(); } } }),
          h('button', { type: 'button', class: 'btn sm', text: '↓', onclick: function () { var i = rows.indexOf(row); if (i < rows.length - 1) { rows.splice(i + 1, 0, rows.splice(i, 1)[0]); list.insertBefore(rows[i].box, box); renum(); chg(); } } }),
          h('button', { type: 'button', class: 'btn sm dng', text: 'حذف', onclick: function () { rows.splice(rows.indexOf(row), 1); box.remove(); renum(); chg(); } })]), form.el]);
        row.box = box; rows.push(row); list.appendChild(box); renum();
      };
      items.forEach(addRow);
      var addBtn = h('button', { type: 'button', class: 'btn sm', text: '+ ' + (f.addLabel || 'إضافة'), onclick: function () { addRow({}); chg(); } });
      var multi = t === 'images' ? h('button', { type: 'button', class: 'btn sm', text: '+ إضافة عدة صور من المكتبة', onclick: function () { openPicker(function (urls) { urls.forEach(function (u) { addRow({ url: u }); }); chg(); }, true); } }) : null;
      return {
        el: labelled(f, h('div', null, [list, h('div', { style: 'margin-top:8px;display:flex;gap:8px;flex-wrap:wrap' }, [addBtn, multi])])),
        get: function (o) { o[f.k] = rows.map(function (r) { return r.form.read(); }).filter(function (x) { return t === 'images' ? x.url : true; }); }
      };
    }
    return { el: h('div'), get: function () {} };
  }

  /* ---------------- media picker / library ---------------- */
  async function listMedia() {
    var j = await req('/storage/v1/object/list/media', { method: 'POST', json: { prefix: '', limit: 500, offset: 0, sortBy: { column: 'created_at', order: 'desc' } } });
    return (j || []).filter(function (x) { return x.name && x.id !== null; });
  }
  async function upload(file) {
    var base = file.name.replace(/\.[^.]+$/, ''), ext = (file.name.match(/\.[^.]+$/) || [''])[0].toLowerCase();
    var name = Date.now().toString(36) + '-' + (slugify(base) || 'file') + ext;
    await req('/storage/v1/object/media/' + encodeURIComponent(name), { method: 'POST', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'false' } });
    return name;
  }
  var isImg = function (n) { return /\.(png|jpe?g|gif|webp|svg|avif|ico)$/i.test(n); };
  var isVid = function (n) { return /\.(mp4|webm|mov)$/i.test(n); };
  function mediaGrid(files, mode, onPick, refresh) {
    var picked = {};
    var grid = h('div', { class: 'media' }, files.map(function (f) {
      var u = publicUrl(f.name);
      var im = h('div', { class: 'im' }, isImg(f.name) ? h('img', { src: u, alt: '', loading: 'lazy' }) : isVid(f.name) ? h('video', { src: u, muted: true, preload: 'metadata' }) : h('span', { text: '📄' }));
      var card = h('div', { class: 'mi' + (mode ? ' pick' : '') }, [im, h('div', { class: 'nm', text: f.name, title: f.name })]);
      if (mode === 'multi') card.addEventListener('click', function () { picked[u] = !picked[u]; card.style.outline = picked[u] ? '3px solid var(--acc)' : ''; });
      else if (mode === 'one') card.addEventListener('click', function () { onPick(u); });
      else card.appendChild(h('div', { class: 'ac' }, [
        h('button', { class: 'btn sm', text: 'نسخ الرابط', onclick: function () { (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(function () { toast('تم نسخ الرابط'); }, function () { prompt('انسخ الرابط', u); }); } }),
        h('button', { class: 'btn sm dng', text: 'حذف', onclick: async function () { if (!await confirmP('حذف الملف نهائيًا؟ أي صفحة بتستخدمه هتفقد الصورة.')) return; try { await req('/storage/v1/object/media', { method: 'DELETE', json: { prefixes: [f.name] } }); toast('تم الحذف'); refresh(); } catch (e) { toast(e.message, true); } } })]));
      return card;
    }));
    grid.getPicked = function () { return Object.keys(picked).filter(function (k) { return picked[k]; }); };
    return grid;
  }
  function uploader(done) {
    var fi = h('input', { type: 'file', multiple: true, accept: 'image/*,video/mp4,video/webm,application/pdf', style: 'display:none' });
    var drop = h('div', { class: 'drop' }, ['اسحب الملفات هنا أو ', h('button', { type: 'button', class: 'btn sm', text: 'اختر ملفات', onclick: function () { fi.click(); } }), h('div', { class: 'hint', style: 'font-size:.78rem', text: 'الحد المقترح 5 ميجا للصورة. استخدم صور مضغوطة (webp / jpg) للسرعة.' }), fi]);
    var go = async function (files) {
      var okc = 0;
      for (var i = 0; i < files.length; i++) { try { await upload(files[i]); okc++; } catch (e) { toast(files[i].name + ': ' + e.message, true); } }
      if (okc) { toast('تم رفع ' + okc + ' ملف'); done(); }
    };
    fi.addEventListener('change', function () { go(fi.files); fi.value = ''; });
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', function () { drop.classList.remove('over'); });
    drop.addEventListener('drop', function (e) { e.preventDefault(); drop.classList.remove('over'); go(e.dataTransfer.files); });
    return drop;
  }
  function openPicker(cb, multi) {
    var body = h('div'), m = h('div', { class: 'modal', onclick: function (e) { if (e.target === m) m.remove(); } }, h('div', null, [h('h3', { text: multi ? 'اختر صور' : 'اختر صورة' }), body]));
    document.body.appendChild(m);
    var load = async function () {
      clear(body);
      body.appendChild(uploader(load));
      try {
        var files = (await listMedia()).filter(function (f) { return isImg(f.name) || isVid(f.name); });
        if (!files.length) { body.appendChild(h('div', { class: 'empty', text: 'المكتبة فاضية. ارفع أول صورة.' })); return; }
        var g = mediaGrid(files, multi ? 'multi' : 'one', function (u) { m.remove(); cb(u); });
        body.appendChild(g);
        if (multi) body.appendChild(h('div', { class: 'bar' }, [h('button', { class: 'btn pri', text: 'إضافة المحدد', onclick: function () { var p = g.getPicked(); m.remove(); if (p.length) cb(p); } }), h('button', { class: 'btn', text: 'إلغاء', onclick: function () { m.remove(); } })]));
      } catch (e) { body.appendChild(h('div', { class: 'note', text: 'تعذّر تحميل المكتبة: ' + e.message + ' (تأكد إنك شغّلت schema.sql كامل)' })); }
    };
    load();
  }

  /* ---------------- schemas ---------------- */
  var SETTINGS = {
    general: { title: 'عام والهوية', fields: [
      { k: 'brand_name', label: 'اسم البراند الكامل' }, { k: 'brand_short', label: 'الاسم المختصر (الهيدر)' },
      { k: 'tagline', t: 'bi', label: 'الشعار / Tagline' }, { k: 'country', t: 'bi', label: 'الدولة' },
      { k: 'logo', t: 'image', label: 'اللوجو الأساسي' }, { k: 'logo_mark', t: 'image', label: 'أيقونة اللوجو (الهيدر)' },
      { k: 'footer_text', t: 'bia', label: 'نص الفوتر' }, { k: 'copyright', label: 'حقوق النشر' }] },
    contact: { title: 'بيانات التواصل', fields: [
      { k: 'whatsapp', label: 'واتساب (رقم بكود الدولة)', ltr: true, ph: '201001234567', hint: 'أرقام بس بدون + أو مسافات. بيشغّل زر واتساب العائم.' },
      { k: 'phone', label: 'تليفون', ltr: true }, { k: 'email', label: 'الإيميل', ltr: true },
      { k: 'address', t: 'bi', label: 'العنوان' }, { k: 'hours', t: 'bi', label: 'مواعيد العمل' }, { k: 'map_url', t: 'url', label: 'رابط الخريطة' }] },
    social: { title: 'السوشيال ميديا', fields: ['instagram', 'facebook', 'tiktok', 'youtube', 'linkedin', 'x', 'behance', 'snapchat', 'telegram'].map(function (k) { return { k: k, t: 'url', label: k, ph: 'https://' }; }) },
    theme: { title: 'الألوان', fields: [
      { k: 'accent', t: 'color', label: 'اللون الأساسي' }, { k: 'accent_dark', t: 'color', label: 'الأساسي في الوضع الداكن' }, { k: 'pop', t: 'color', label: 'الأصفر / المميز' },
      { k: 'sky', t: 'color', label: 'سماوي' }, { k: 'violet', t: 'color', label: 'بنفسجي' }, { k: 'leaf', t: 'color', label: 'أخضر' }] },
    features: { title: 'المميزات والتشغيل', fields: [
      { k: 'intro', t: 'select', label: 'مقدمة الكاميرا', opts: [['session', 'مرة في الجلسة'], ['always', 'كل زيارة'], ['off', 'بدون مقدمة']] },
      { k: 'enable_3d', t: 'bool', label: 'تشغيل مجسمات 3D', def: true }, { k: 'effects', t: 'bool', label: 'تشغيل حركات التأثيرات', def: true },
      { k: 'whatsapp_button', t: 'bool', label: 'زر واتساب العائم', def: true }, { k: 'theme_toggle', t: 'bool', label: 'زر الوضع الفاتح/الداكن', def: true },
      { k: 'lang_toggle', t: 'bool', label: 'زر اللغة', def: true }, { k: 'scene_bar', t: 'bool', label: 'شريط المشهد في الهيدر', def: true },
      { k: 'default_lang', t: 'select', label: 'اللغة الافتراضية', opts: [['ar', 'العربية'], ['en', 'English']] },
      { k: 'default_theme', t: 'select', label: 'الوضع الافتراضي', opts: [['system', 'حسب جهاز الزائر'], ['light', 'فاتح'], ['dark', 'داكن']] }] },
    seo: { title: 'SEO ومحركات البحث', fields: [
      { k: 'title', t: 'bi', label: 'عنوان الموقع' }, { k: 'desc', t: 'bia', label: 'وصف الموقع' }, { k: 'og_image', t: 'image', label: 'صورة المشاركة (OG)' },
      { k: 'site_url', t: 'url', label: 'رابط الموقع الكامل', ph: 'https://yourdomain.com', hint: 'مهم للـ sitemap وروابط المشاركة.' },
      { k: 'index', t: 'bool', label: 'السماح لمحركات البحث بأرشفة الموقع', def: true }] },
    announcement: { title: 'شريط الإعلان', fields: [
      { k: 'enabled', t: 'bool', label: 'إظهار الشريط أعلى الموقع' }, { k: 'text', t: 'bi', label: 'النص' }, { k: 'url', t: 'url', label: 'رابط (اختياري)' }] },
    code: { title: 'أكواد مخصصة', fields: [
      { k: 'head', t: 'code', label: 'داخل <head> (Analytics, Pixel…)', rows: 6 }, { k: 'body_end', t: 'code', label: 'قبل </body>', rows: 6 }, { k: 'css', t: 'code', label: 'CSS إضافي', rows: 8 }],
      note: 'تنبيه: الأكواد دي بتتنفذ في كل صفحة. حط أكواد من مصادر موثوقة بس.' }
  };
  var HOME = [
    { k: 'hero_slate', label: 'لافتة الهيرو (Title card)', t: 'text' }, { k: 'hero_reel', label: 'نص الشريط (Reel)', t: 'text' },
    { k: 'hero_title', t: 'bia', label: 'عنوان الهيرو', hint: 'حط الكلمات المميزة بين [[ ]] علشان تتلوّن.', rows: 3 },
    { k: 'hero_lede', t: 'bia', label: 'وصف الهيرو' }, { k: 'hero_cta', t: 'bi', label: 'زرار الهيرو' },
    { k: 'stats', t: 'list', label: 'الأرقام (Counters)', itemLabel: 'رقم', addLabel: 'إضافة رقم', sub: [{ k: 'value', label: 'القيمة', t: 'text', ltr: true }, { k: 'label', t: 'bi', label: 'الوصف' }] },
    { k: 'credits_title', t: 'bi', label: 'عنوان قسم الخدمات (التترات)' },
    { k: 'finale_title', t: 'bi', label: 'عنوان الختام' }, { k: 'finale_btn', t: 'bi', label: 'زرار الختام الأول' }, { k: 'finale_btn_url', t: 'text', label: 'رابط زرار الختام', ltr: true }, { k: 'finale_btn2', t: 'bi', label: 'زرار الختام الثاني' }];

  var ENT = {
    services: { title: 'الخدمات', one: 'خدمة', table: 'services', main: 'title_ar', order: 'sort.asc', create: true, url: function (r) { return '/services/' + r.slug; },
      def: { visible: true, icon: 'spark', scenes: [], sort: 999 }, fields: function () { return [
        { k: 'title', t: 'bi', label: 'اسم الخدمة' }, { k: 'slug', t: 'slug', label: 'الرابط (slug)', from: 'title_en' },
        { k: 'short', t: 'bia', label: 'وصف مختصر (يظهر في الكروت)', rows: 2 }, { k: 'body', t: 'bimd', label: 'التفاصيل الكاملة (صفحة الخدمة)' },
        { k: 'icon', t: 'select', label: 'الأيقونة', opts: ICONS.map(function (i) { return [i, i]; }) }, { k: 'image', t: 'image', label: 'صورة (اختياري)' },
        { k: 'scenes', t: 'scenes', label: 'تظهر في أي مشاهد من القصة؟' }, { k: 'sort', t: 'num', label: 'الترتيب' }, { k: 'visible', t: 'bool', label: 'ظاهرة في الموقع', def: true }]; } },
    projects: { title: 'الأعمال السابقة', one: 'عمل', table: 'projects', main: 'title_ar', order: 'sort.asc,created_at.desc', create: true, thumb: 'cover', url: function (r) { return '/work/' + r.slug; },
      def: { visible: true, featured: false, gallery: [], results: [], sort: 999 }, fields: function () { return [
        { k: 'title', t: 'bi', label: 'اسم العمل' }, { k: 'slug', t: 'slug', label: 'الرابط (slug)', from: 'title_en' },
        { k: 'client', t: 'text', label: 'العميل' }, { k: 'category', t: 'bi', label: 'التصنيف (للفلتر)' }, { k: 'year', t: 'text', label: 'السنة', ltr: true },
        { k: 'tags', t: 'text', label: 'الخدمات المنفذة (بفاصلة)' }, { k: 'summary', t: 'bia', label: 'ملخص (يظهر في الكارت)', rows: 2 },
        { k: 'body', t: 'bimd', label: 'القصة / التفاصيل' }, { k: 'cover', t: 'image', label: 'صورة الغلاف' },
        { k: 'gallery', t: 'images', label: 'معرض الصور', itemLabel: 'صورة', addLabel: 'إضافة صورة' },
        { k: 'video', t: 'url', label: 'فيديو (YouTube / Vimeo / mp4)' }, { k: 'link', t: 'url', label: 'رابط المشروع' },
        { k: 'results', t: 'list', label: 'النتائج / الأرقام', itemLabel: 'نتيجة', addLabel: 'إضافة نتيجة', sub: [{ k: 'value', label: 'الرقم', t: 'text', ltr: true }, { k: 'label', t: 'bi', label: 'الوصف' }] },
        { k: 'featured', t: 'bool', label: 'عمل مميز' }, { k: 'sort', t: 'num', label: 'الترتيب' }, { k: 'visible', t: 'bool', label: 'ظاهر في الموقع', def: true }]; } },
    testimonials: { title: 'آراء العملاء', one: 'رأي', table: 'testimonials', main: 'name', order: 'sort.asc', create: true, thumb: 'avatar', def: { visible: true, sort: 999 }, fields: function () { return [
      { k: 'name', label: 'اسم العميل' }, { k: 'role', t: 'bi', label: 'الوظيفة / الشركة' }, { k: 'text', t: 'bia', label: 'الرأي', rows: 4 },
      { k: 'avatar', t: 'image', label: 'صورة' }, { k: 'sort', t: 'num', label: 'الترتيب' }, { k: 'visible', t: 'bool', label: 'ظاهر', def: true }]; } },
    clients: { title: 'العملاء (اللوجوهات)', one: 'عميل', table: 'clients', main: 'name', order: 'sort.asc', create: true, thumb: 'logo', def: { visible: true, sort: 999 }, fields: function () { return [
      { k: 'name', label: 'اسم العميل' }, { k: 'logo', t: 'image', label: 'اللوجو' }, { k: 'url', t: 'url', label: 'رابط (اختياري)' },
      { k: 'sort', t: 'num', label: 'الترتيب' }, { k: 'visible', t: 'bool', label: 'ظاهر', def: true }]; } },
    scenes: { title: 'مشاهد القصة (الصفحة الرئيسية)', one: 'مشهد', table: 'scenes', pk: 'key', main: 'name_ar', order: 'sort.asc', create: false, fields: function () { return [
      { k: 'name', t: 'bi', label: 'اسم المشهد (في القائمة)' }, { k: 'slate', label: 'نص اللافتة (Slate)' }, { k: 'title', t: 'bi', label: 'العنوان' }, { k: 'lede', t: 'bia', label: 'الوصف', rows: 4 },
      { k: 'link_label', t: 'bi', label: 'نص الرابط (اختياري)' }, { k: 'link_href', t: 'text', label: 'الرابط', ltr: true },
      { k: 'sort', t: 'num', label: 'الترتيب' }, { k: 'visible', t: 'bool', label: 'ظاهر', def: true }]; },
      note: 'المشاهد الثمانية ليها مجسمات 3D ثابتة في الكود، فهنا بتعدّل النصوص والترتيب والإظهار بس.' },
    nav_items: { title: 'روابط مخصصة في الهيدر', one: 'رابط', table: 'nav_items', main: 'label_ar', order: 'sort.asc', create: true, def: { visible: true, sort: 999, href: '/' }, fields: function () { return [
      { k: 'label', t: 'bi', label: 'نص الرابط' }, { k: 'href', t: 'text', label: 'الرابط', ltr: true, hint: '/contact أو https://…' },
      { k: 'new_tab', t: 'bool', label: 'يفتح في تبويب جديد' }, { k: 'sort', t: 'num', label: 'الترتيب' }, { k: 'visible', t: 'bool', label: 'ظاهر', def: true }]; },
      note: 'الصفحات اللي بتفعّل فيها "إظهار في الهيدر" بتظهر تلقائيًا. الروابط هنا للروابط الإضافية (مثلاً صفحة خارجية).' },
    redirects: { title: 'التحويلات (Redirects)', one: 'تحويل', table: 'redirects', main: 'from_path', order: 'created_at.desc', create: true, def: { permanent: true }, fields: function () { return [
      { k: 'from_path', t: 'text', label: 'من (مسار)', ltr: true, ph: '/old-page' }, { k: 'to_url', t: 'text', label: 'إلى', ltr: true, ph: '/new-page أو https://…' }, { k: 'permanent', t: 'bool', label: 'دائم (301)', def: true }]; } }
  };
  var BLOCKS = {
    hero: { name: 'هيرو / غلاف', hint: 'عنوان كبير مع زرارين وصورة', fields: [
      { k: 'eyebrow', t: 'bi', label: 'سطر صغير أعلى العنوان' }, { k: 'title', t: 'bi', label: 'العنوان', hint: '[[كلمة]] لتلوين كلمة' }, { k: 'text', t: 'bia', label: 'الوصف', rows: 2 },
      { k: 'cta', t: 'bi', label: 'الزرار الأول' }, { k: 'cta_url', t: 'text', label: 'رابط الأول', ltr: true }, { k: 'cta2', t: 'bi', label: 'الزرار الثاني' }, { k: 'cta2_url', t: 'text', label: 'رابط الثاني', ltr: true },
      { k: 'image', t: 'image', label: 'صورة' }, { k: 'align', t: 'select', label: 'المحاذاة', opts: [['start', 'عادي'], ['center', 'منتصف']] }] },
    text: { name: 'نص', hint: 'عنوان وفقرات منسقة', fields: [{ k: 'title', t: 'bi', label: 'العنوان' }, { k: 'body', t: 'bimd', label: 'النص' }, { k: 'width', t: 'select', label: 'العرض', opts: [['normal', 'عادي'], ['wide', 'عريض']] }] },
    columns: { name: 'نص + صورة', hint: 'عمودين', fields: [{ k: 'title', t: 'bi', label: 'العنوان' }, { k: 'body', t: 'bimd', label: 'النص', rows: 6 }, { k: 'image', t: 'image', label: 'الصورة' }, { k: 'cta', t: 'bi', label: 'زرار' }, { k: 'cta_url', t: 'text', label: 'رابط الزرار', ltr: true }, { k: 'flip', t: 'bool', label: 'الصورة على الجانب الآخر' }] },
    image: { name: 'صورة', hint: 'صورة كبيرة', fields: [{ k: 'image', t: 'image', label: 'الصورة' }, { k: 'caption', t: 'bi', label: 'تعليق' }] },
    gallery: { name: 'معرض صور', hint: 'شبكة صور مع تكبير', fields: [{ k: 'title', t: 'bi', label: 'العنوان' }, { k: 'text', t: 'bia', label: 'وصف', rows: 2 }, { k: 'columns', t: 'select', label: 'الأعمدة', opts: [['3', '3'], ['2', '2'], ['4', '4']] }, { k: 'images', t: 'images', label: 'الصور', itemLabel: 'صورة', addLabel: 'إضافة صورة' }] },
    video: { name: 'فيديو', hint: 'YouTube / Vimeo / mp4', fields: [{ k: 'title', t: 'bi', label: 'العنوان' }, { k: 'url', t: 'url', label: 'رابط الفيديو' }, { k: 'caption', t: 'bi', label: 'تعليق' }] },
    services: { name: 'الخدمات', hint: 'كروت الخدمات تلقائيًا', fields: [{ k: 'title', t: 'bi', label: 'العنوان' }, { k: 'text', t: 'bia', label: 'وصف', rows: 2 }, { k: 'layout', t: 'select', label: 'الشكل', opts: [['grid', 'شبكة'], ['list', 'قائمة']] }, { k: 'limit', t: 'num', label: 'الحد الأقصى (0 = الكل)' }] },
    projects: { name: 'الأعمال', hint: 'كروت الأعمال تلقائيًا', fields: [{ k: 'title', t: 'bi', label: 'العنوان' }, { k: 'text', t: 'bia', label: 'وصف', rows: 2 }, { k: 'filter', t: 'select', label: 'العرض', opts: [['all', 'الكل'], ['featured', 'المميزة فقط'], ['category', 'تصنيف معين']] }, { k: 'category', t: 'text', label: 'التصنيف (لو اخترت تصنيف)' }, { k: 'limit', t: 'num', label: 'الحد الأقصى (0 = الكل)' }, { k: 'show_filters', t: 'bool', label: 'إظهار أزرار الفلتر', def: true }] },
    features: { name: 'مميزات', hint: 'كروت بأيقونات', fields: [{ k: 'title', t: 'bi', label: 'العنوان' }, { k: 'text', t: 'bia', label: 'وصف', rows: 2 }, { k: 'items', t: 'list', label: 'العناصر', itemLabel: 'ميزة', addLabel: 'إضافة ميزة', sub: [{ k: 'icon', t: 'select', label: 'الأيقونة', opts: ICONS.map(function (i) { return [i, i]; }) }, { k: 'title', t: 'bi', label: 'العنوان' }, { k: 'text', t: 'bia', label: 'الوصف', rows: 2 }] }] },
    stats: { name: 'أرقام', hint: 'عدادات متحركة', fields: [{ k: 'title', t: 'bi', label: 'العنوان' }, { k: 'items', t: 'list', label: 'الأرقام', itemLabel: 'رقم', addLabel: 'إضافة رقم', sub: [{ k: 'value', label: 'القيمة', t: 'text', ltr: true }, { k: 'label', t: 'bi', label: 'الوصف' }] }] },
    faq: { name: 'أسئلة شائعة', hint: 'أسئلة وأجوبة', fields: [{ k: 'title', t: 'bi', label: 'العنوان' }, { k: 'items', t: 'list', label: 'الأسئلة', itemLabel: 'سؤال', addLabel: 'إضافة سؤال', sub: [{ k: 'q', t: 'bi', label: 'السؤال' }, { k: 'a', t: 'bimd', label: 'الإجابة', rows: 3 }] }] },
    testimonials: { name: 'آراء العملاء', hint: 'من قسم آراء العملاء', fields: [{ k: 'title', t: 'bi', label: 'العنوان' }, { k: 'limit', t: 'num', label: 'الحد الأقصى (0 = الكل)' }] },
    clients: { name: 'لوجوهات العملاء', hint: 'من قسم العملاء', fields: [{ k: 'title', t: 'bi', label: 'العنوان' }] },
    cta: { name: 'دعوة لإجراء (CTA)', hint: 'شريط ملون بزرار', fields: [{ k: 'title', t: 'bi', label: 'العنوان' }, { k: 'text', t: 'bia', label: 'نص', rows: 2 }, { k: 'button', t: 'bi', label: 'نص الزرار' }, { k: 'url', t: 'text', label: 'الرابط', ltr: true }, { k: 'style', t: 'select', label: 'اللون', opts: [['accent', 'أساسي'], ['dark', 'داكن'], ['yellow', 'أصفر']] }] },
    contact: { name: 'نموذج تواصل', hint: 'فورم + بيانات التواصل', fields: [{ k: 'title', t: 'bi', label: 'العنوان' }, { k: 'text', t: 'bia', label: 'وصف', rows: 2 }, { k: 'show_info', t: 'bool', label: 'إظهار بيانات التواصل بجانب الفورم', def: true }] },
    html: { name: 'كود HTML', hint: 'للمتقدمين', fields: [{ k: 'code', t: 'code', label: 'HTML', rows: 8, hint: 'بيتعرض زي ما هو. استخدمه بحذر.' }] },
    spacer: { name: 'مسافة', hint: 'فراغ بين الأقسام', fields: [{ k: 'height', t: 'num', label: 'الارتفاع (px)' }] }
  };

  /* ---------------- shell / routing ---------------- */
  var NAV = [
    ['dash', 'الرئيسية', '▦'], ['g', 'المحتوى'],
    ['pages', 'الصفحات', '▤'], ['nav', 'قائمة الهيدر', '☰'], ['home', 'الصفحة الرئيسية', '⌂'], ['scenes', 'مشاهد القصة', '▶'],
    ['services', 'الخدمات', '✦'], ['projects', 'الأعمال السابقة', '▣'], ['testimonials', 'آراء العملاء', '❝'], ['clients', 'العملاء', '◍'],
    ['g', 'التفاعل'], ['messages', 'الرسائل', '✉'], ['media', 'مكتبة الميديا', '▨'],
    ['g', 'الإعدادات'], ['settings', 'إعدادات الموقع', '⚙'], ['redirects', 'التحويلات', '⇄'], ['admins', 'المديرين', '☺'], ['backup', 'نسخ احتياطي', '⇩']];
  var main, side, unread = 0, dirty = false;

  function route() { var r = (location.hash || '#/dash').slice(2).split('/'); return { page: r[0] || 'dash', arg: r[1] ? decodeURIComponent(r[1]) : '', arg2: r[2] || '' }; }
  function go(p) { location.hash = '#/' + p; }
  window.addEventListener('hashchange', function () { if (S.user && root.querySelector('.layout')) render(); });
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  function guard() { return !dirty || window.confirm('فيه تعديلات لسه ما اتحفظتش. تكمل بدون حفظ؟'); }

  async function boot() {
    try { cfg = await (await fetch('/api/config')).json(); } catch (e) { cfg = null; }
    if (!cfg || !cfg.url || !cfg.anonKey) { root.innerHTML = ''; root.appendChild(h('div', { class: 'login' }, h('div', { class: 'card' }, [h('h3', { text: 'الموقع لسه مش متوصّل بـ Supabase' }), h('p', { text: 'ضيف SUPABASE_URL و SUPABASE_ANON_KEY في Environment Variables على Vercel، وبعدين اعمل Redeploy. التفاصيل في ملف README.' })]))); return; }
    loadSession();
    if (S.token) { try { await checkAdmin(); return start(); } catch (e) { if (e.message !== 'session') dropSession(); } }
    showLogin();
  }
  async function checkAdmin() {
    var u = await req('/auth/v1/user'); S.user = u; saveSession();
    var rows = await db.sel('admins', 'select=user_id&user_id=eq.' + u.id);
    if (!rows || !rows.length) { var em = u.email; dropSession(); throw new Error('الحساب ' + em + ' مش مضاف كمدير. نفّذ جزء الأدمن في schema.sql.'); }
  }
  function showLogin(msg) {
    var em = h('input', { type: 'email', required: true, class: 'ltr', dir: 'ltr', autocomplete: 'username' }), pw = h('input', { type: 'password', required: true, class: 'ltr', dir: 'ltr', autocomplete: 'current-password' });
    var err = h('div', { class: 'note', style: msg ? '' : 'display:none', text: msg || '' }), btn = h('button', { class: 'btn pri', type: 'submit', text: 'دخول' });
    var f = h('form', { onsubmit: async function (e) {
      e.preventDefault(); btn.disabled = true; err.style.display = 'none';
      try {
        var j = await req('/auth/v1/token?grant_type=password', { method: 'POST', json: { email: em.value.trim(), password: pw.value } });
        S.token = j.access_token; S.refresh = j.refresh_token; S.user = j.user; saveSession();
        await checkAdmin(); start();
      } catch (x) { err.textContent = /Invalid login/i.test(x.message) ? 'الإيميل أو الباسورد غلط.' : x.message; err.style.display = ''; btn.disabled = false; }
    } }, [h('img', { src: '/assets/logo.jpg', alt: '' }), h('h1', { text: 'لوحة تحكم Socialdia' }), err, h('div', { class: 'f' }, [h('label', { text: 'الإيميل' }), em]), h('div', { class: 'f' }, [h('label', { text: 'الباسورد' }), pw]), btn]);
    clear(root); root.appendChild(h('div', { class: 'login' }, f));
  }
  async function start() {
    clear(root);
    side = h('aside', { class: 'side' });
    main = h('main', { class: 'main' });
    root.appendChild(h('div', { class: 'layout' }, [side, main]));
    try { CTX.scenes = await db.sel('scenes', 'select=key,name_ar&order=sort.asc'); } catch (e) {}
    try { var m = await req('/rest/v1/messages?select=id&read=eq.false', { headers: { Prefer: 'count=exact', Range: '0-0' } }); unread = (m || []).length; var c = await db.sel('messages', 'select=id&read=eq.false'); unread = c.length; } catch (e) {}
    if (!location.hash) location.hash = '#/dash';
    render();
  }
  function drawSide(cur) {
    clear(side);
    side.appendChild(h('div', { class: 'brand' }, [h('img', { src: '/assets/logo-mark.jpg', alt: '' }), h('span', { text: 'Socialdia' })]));
    NAV.forEach(function (n) {
      if (n[0] === 'g') { side.appendChild(h('div', { class: 'grp', text: n[1] })); return; }
      var a = h('a', { class: 'nv' + (cur === n[0] ? ' on' : ''), href: '#/' + n[0], onclick: function (e) { if (!guard()) { e.preventDefault(); return; } dirty = false; side.classList.remove('open'); } }, [h('span', { text: n[2] }), h('span', { text: n[1] })]);
      if (n[0] === 'messages' && unread) a.appendChild(h('span', { class: 'badge', text: String(unread) }));
      side.appendChild(a);
    });
    side.appendChild(h('div', { class: 'sp' }));
    side.appendChild(h('a', { class: 'nv', href: '/', target: '_blank', rel: 'noopener' }, [h('span', { text: '↗' }), h('span', { text: 'فتح الموقع' })]));
    side.appendChild(h('div', { class: 'grp', text: S.user && S.user.email || '' }));
    side.appendChild(h('a', { class: 'nv', onclick: async function () { if (!guard()) return; try { await req('/auth/v1/logout', { method: 'POST' }); } catch (e) {} dropSession(); dirty = false; showLogin(); } }, [h('span', { text: '⎋' }), h('span', { text: 'تسجيل خروج' })]));
  }
  function top(title, actions) {
    return h('div', { class: 'top' }, [h('button', { class: 'btn menu-btn', text: '☰', onclick: function () { side.classList.toggle('open'); } }), h('h1', { text: title }), actions]);
  }
  async function render() {
    var r = route(), tok = (render.tok = (render.tok || 0) + 1); dirty = false; drawSide(r.page); clear(main);
    var map = { dash: pDash, pages: pPages, nav: pNav, home: pHome, scenes: pEnt, services: pEnt, projects: pEnt, testimonials: pEnt, clients: pEnt, redirects: pEnt, messages: pMessages, media: pMedia, settings: pSettings, admins: pAdmins, backup: pBackup };
    var fn = map[r.page] || pDash;
    main.appendChild(h('p', { class: 'boot', text: 'جاري التحميل…' }));
    try { var out = await fn(r); if (tok !== render.tok) return; clear(main); main.appendChild(out); } catch (e) { if (e.message === 'session') return; clear(main); main.appendChild(h('div', { class: 'note', text: 'حصل خطأ: ' + e.message })); }
  }
  function saveBar(onSave, extra) {
    var st = h('span', { class: 'dirty' }), btn = h('button', { class: 'btn pri', type: 'button', text: 'حفظ' });
    btn.addEventListener('click', async function () { btn.disabled = true; try { await onSave(); dirty = false; st.textContent = ''; toast('تم الحفظ ✓'); } catch (e) { toast(e.message, true); } btn.disabled = false; });
    var bar = h('div', { class: 'bar' }, [btn, st, h('span', { class: 'sp' }), extra]);
    bar.mark = function () { dirty = true; st.textContent = '● تعديلات غير محفوظة'; };
    return bar;
  }

  /* ---------------- pages ---------------- */
  async function pDash() {
    var c = {}; var tbl = ['pages', 'services', 'projects', 'testimonials', 'clients', 'messages'];
    await Promise.all(tbl.map(async function (t) { try { c[t] = (await db.sel(t, 'select=' + (t === 'scenes' ? 'key' : 'id'))).length; } catch (e) { c[t] = '–'; } }));
    var recent = []; try { recent = await db.sel('messages', 'select=id,name,message,created_at,read&order=created_at.desc&limit=5'); } catch (e) {}
    var stat = function (n, l, to) { return h('a', { class: 'card stat', href: '#/' + to, style: 'text-decoration:none;color:inherit;margin:0' }, [h('b', { text: String(n) }), h('span', { text: l })]); };
    return h('div', null, [top('أهلاً 👋'),
      h('div', { class: 'grid g2' }, [stat(c.pages, 'صفحة', 'pages'), stat(c.services, 'خدمة', 'services'), stat(c.projects, 'عمل سابق', 'projects'), stat(c.testimonials, 'رأي عميل', 'testimonials'), stat(c.clients, 'عميل', 'clients'), stat(unread + ' / ' + c.messages, 'رسائل جديدة / الكل', 'messages')]),
      h('div', { class: 'card', style: 'margin-top:16px' }, [h('h3', { text: 'أحدث الرسائل' }), recent.length ? h('div', null, recent.map(function (m) { return h('p', { style: 'margin:6px 0' }, [h('b', { text: (m.read ? '' : '● ') + m.name }), ' — ', (m.message || '').slice(0, 90), h('span', { class: 'pill', style: 'margin-inline-start:8px', text: fmtDate(m.created_at) })]); })) : h('div', { class: 'empty', text: 'لسه مفيش رسائل.' })]),
      h('div', { class: 'card' }, [h('h3', { text: 'ملاحظات' }), h('p', { text: 'التعديلات بتظهر على الموقع خلال حوالي 30 ثانية (كاش). افتح الموقع في تبويب جديد وحدّث بعد نصف دقيقة.' })])]);
  }

  /* generic entity manager */
  async function pEnt(r) {
    var E = ENT[r.page]; if (!E) return h('div', { class: 'empty', text: 'غير موجود' });
    if (r.arg) return entForm(r, E);
    var pk = E.pk || 'id', rows = await db.sel(E.table, 'select=*&order=' + E.order);
    var addBtn = E.create !== false ? h('a', { class: 'btn pri', href: '#/' + r.page + '/new', text: '+ إضافة ' + E.one }) : null;
    var move = async function (i, d) {
      var j = i + d; if (j < 0 || j >= rows.length) return;
      var a = rows[i], b = rows[j];
      var na = (j + 1) * 10, nb = (i + 1) * 10;
      try { await Promise.all([db.upd(E.table, pk, a[pk], { sort: na }), db.upd(E.table, pk, b[pk], { sort: nb })]); render(); } catch (e) { toast(e.message, true); }
    };
    var body = rows.length ? h('div', { class: 'scroll' }, h('table', { class: 'tbl' }, [
      h('thead', null, h('tr', null, ['', 'الاسم', 'الحالة', ''].map(function (x) { return h('th', { text: x }); }))),
      h('tbody', null, rows.map(function (row, i) {
        var title = row[E.main] || row.title_en || row.name || row.from_path || row.key || '(بدون اسم)';
        var visible = row.visible !== undefined ? row.visible : true;
        return h('tr', null, [
          h('td', { style: 'width:60px' }, E.thumb && row[E.thumb] ? h('img', { class: 'thumb', src: row[E.thumb], alt: '' }) : null),
          h('td', null, [h('a', { href: '#/' + r.page + '/' + encodeURIComponent(row[pk]), text: title, style: 'font-weight:600' }), row.to_url ? h('div', { class: 'ltr', dir: 'ltr', style: 'color:var(--mute);font-size:.82rem', text: '→ ' + row.to_url }) : null, row.href ? h('div', { class: 'ltr', dir: 'ltr', style: 'color:var(--mute);font-size:.82rem', text: row.href }) : null]),
          h('td', null, row.visible !== undefined ? h('span', { class: 'pill ' + (visible ? 'ok' : 'off'), text: visible ? 'ظاهر' : 'مخفي' }) : null),
          h('td', null, h('div', { class: 'act' }, [
            row.sort !== undefined && E.order.indexOf('sort') === 0 ? [h('button', { class: 'btn sm', text: '↑', onclick: function () { move(i, -1); } }), h('button', { class: 'btn sm', text: '↓', onclick: function () { move(i, 1); } })] : null,
            E.url && row.slug ? h('a', { class: 'btn sm', href: E.url(row), target: '_blank', rel: 'noopener', text: 'عرض' }) : null,
            h('a', { class: 'btn sm', href: '#/' + r.page + '/' + encodeURIComponent(row[pk]), text: 'تعديل' }),
            E.create !== false ? h('button', { class: 'btn sm dng', text: 'حذف', onclick: async function () { if (!await confirmP('حذف "' + title + '" نهائيًا؟')) return; try { await db.del(E.table, pk, row[pk]); toast('تم الحذف'); render(); } catch (e) { toast(e.message, true); } } }) : null].flat()))]);
      }))])) : h('div', { class: 'empty', text: 'لسه مفيش ' + E.title + '. اضغط "إضافة".' });
    return h('div', null, [top(E.title, addBtn), E.note ? h('div', { class: 'note', text: E.note }) : null, body]);
  }
  async function entForm(r, E) {
    var pk = E.pk || 'id', isNew = r.arg === 'new', row;
    if (isNew) row = clone(E.def || {});
    else { var q = await db.sel(E.table, 'select=*&' + pk + '=eq.' + encodeURIComponent(r.arg)); row = q[0]; if (!row) return h('div', { class: 'empty', text: 'مش موجود' }); }
    var bar, form = buildForm(E.fields(), row, function () { bar.mark(); });
    bar = saveBar(async function () {
      var v = form.read();
      if (!isNew) { delete v[pk]; await db.upd(E.table, pk, row[pk], v); }
      else {
        if (E.fields().some(function (f) { return f.t === 'slug'; }) && !v.slug) throw new Error('اكتب الرابط (slug)');
        var made = await db.ins(E.table, v); dirty = false; go(r.page + '/' + encodeURIComponent(made[0][pk])); return;
      }
    }, h('a', { class: 'btn', href: '#/' + r.page, text: 'رجوع للقائمة', onclick: function (e) { if (!guard()) e.preventDefault(); else dirty = false; } }));
    return h('div', null, [top((isNew ? 'إضافة ' : 'تعديل ') + E.one), E.note ? h('div', { class: 'note', text: E.note }) : null, h('div', { class: 'card' }, form.el), bar]);
  }

  /* settings */
  async function loadSettings() { var rows = await db.sel('settings', 'select=key,value'); var o = {}; rows.forEach(function (x) { o[x.key] = x.value || {}; }); return o; }
  function splitBi(obj, fields) { return obj; }
  async function pSettings(r) {
    var all = await loadSettings(), keys = Object.keys(SETTINGS), cur = SETTINGS[r.arg] ? r.arg : keys[0];
    var tabs = h('div', { class: 'tabs' }, keys.map(function (k) { return h('button', { class: k === cur ? 'on' : '', text: SETTINGS[k].title, onclick: function () { if (guard()) { dirty = false; go('settings/' + k); } } }); }));
    var S1 = SETTINGS[cur], bar, form = buildForm(S1.fields, all[cur] || {}, function () { bar.mark(); });
    bar = saveBar(async function () { var v = Object.assign({}, all[cur] || {}, form.read()); await db.ups('settings', [{ key: cur, value: v }], 'key'); all[cur] = v; });
    return h('div', null, [top('إعدادات الموقع'), tabs, S1.note ? h('div', { class: 'note', text: S1.note }) : null, h('div', { class: 'card' }, form.el), bar]);
  }
  async function pHome() {
    var all = await loadSettings(), bar, form = buildForm(HOME, all.home || {}, function () { bar.mark(); });
    bar = saveBar(async function () { var v = Object.assign({}, all.home || {}, form.read()); await db.ups('settings', [{ key: 'home', value: v }], 'key'); all.home = v; },
      h('a', { class: 'btn', href: '#/pages/_home', text: 'أقسام إضافية في الرئيسية ←', onclick: function (e) { if (!guard()) e.preventDefault(); else dirty = false; } }));
    return h('div', null, [top('الصفحة الرئيسية'), h('div', { class: 'note', text: 'نصوص الهيرو والأرقام والختام هنا. نصوص المشاهد من "مشاهد القصة". وتقدر تضيف أقسام إضافية (من أي نوع) قبل الختام من "أقسام إضافية".' }), h('div', { class: 'card' }, form.el), bar]);
  }

  /* pages + block builder */
  async function pPages(r) {
    if (r.arg) return pageEditor(r);
    var rows = await db.sel('pages', 'select=id,slug,title_ar,title_en,published,show_in_nav,nav_sort&order=nav_sort.asc,created_at.asc');
    return h('div', null, [top('الصفحات', h('a', { class: 'btn pri', href: '#/pages/new', text: '+ صفحة جديدة' })),
      h('div', { class: 'note', text: 'الصفحة اللي بتفعّل فيها "إظهار في الهيدر" بتتضاف لقائمة الموقع تلقائيًا بنفس الستايل. صفحة "_home" هي الأقسام الإضافية اللي بتظهر في الرئيسية.' }),
      h('div', { class: 'scroll' }, h('table', { class: 'tbl' }, [h('thead', null, h('tr', null, ['الصفحة', 'الرابط', 'الحالة', ''].map(function (x) { return h('th', { text: x }); }))),
        h('tbody', null, rows.map(function (p) { var sp = p.slug === '_home';
          return h('tr', null, [h('td', null, h('a', { href: '#/pages/' + p.id, style: 'font-weight:600', text: sp ? 'أقسام الرئيسية الإضافية' : (p.title_ar || p.title_en || p.slug) })), h('td', { class: 'ltr', dir: 'ltr', text: sp ? '/' : '/' + p.slug }),
            h('td', null, [h('span', { class: 'pill ' + (p.published ? 'ok' : 'off'), text: p.published ? 'منشورة' : 'مسودة' }), ' ', p.show_in_nav ? h('span', { class: 'pill ok', text: 'في الهيدر' }) : null]),
            h('td', null, h('div', { class: 'act' }, [h('a', { class: 'btn sm', href: sp ? '/' : '/' + p.slug, target: '_blank', rel: 'noopener', text: 'عرض' }), h('a', { class: 'btn sm', href: '#/pages/' + p.id, text: 'تعديل' }),
              sp ? null : h('button', { class: 'btn sm dng', text: 'حذف', onclick: async function () { if (!await confirmP('حذف الصفحة نهائيًا؟')) return; try { await db.del('pages', 'id', p.id); toast('تم الحذف'); render(); } catch (e) { toast(e.message, true); } } })]))]); }))]))]);
  }
  var PAGE_META = [
    { k: 'title', t: 'bi', label: 'عنوان الصفحة' }, { k: 'slug', t: 'slug', label: 'الرابط (slug)', from: 'title_en', hint: 'مثال: about يعني /about' },
    { k: 'published', t: 'bool', label: 'منشورة (ظاهرة للزوار)', def: true },
    { k: 'show_in_nav', t: 'bool', label: 'إظهار في الهيدر (قائمة الموقع)' }, { k: 'nav_label', t: 'bi', label: 'اسم الصفحة في الهيدر', hint: 'اتركه فاضي لاستخدام عنوان الصفحة.' }, { k: 'nav_sort', t: 'num', label: 'ترتيبها في الهيدر', hint: 'الأصغر أولاً.' },
    { k: 'seo_title', t: 'bi', label: 'عنوان SEO (اختياري)' }, { k: 'seo_desc', t: 'bia', label: 'وصف SEO (اختياري)', rows: 2 }, { k: 'og_image', t: 'image', label: 'صورة المشاركة (اختياري)' }];
  async function pageEditor(r) {
    var isNew = r.arg === 'new', row;
    if (isNew) row = { published: true, show_in_nav: true, nav_sort: 100, blocks: [{ id: uid(), type: 'hero', props: {} }, { id: uid(), type: 'text', props: {} }] };
    else { var q = await db.sel('pages', 'select=*&' + (/^[0-9a-f-]{36}$/i.test(r.arg) ? 'id' : 'slug') + '=eq.' + encodeURIComponent(r.arg)); row = q[0]; if (!row) return h('div', { class: 'empty', text: 'الصفحة مش موجودة' }); }
    var isHome = row.slug === '_home', bar;
    var chg = function () { bar.mark(); };
    var meta = isHome ? null : buildForm(PAGE_META, row, chg);
    var blocks = (Array.isArray(row.blocks) ? row.blocks : []).map(function (b) { return { id: b.id || uid(), type: b.type, props: b.props || {} }; });
    var listEl = h('div'), rows = [];
    function addBlock(b, collapsed) {
      var def = BLOCKS[b.type]; if (!def) return;
      var form = buildForm(def.fields.map(function (f) { return f.t === 'select' && f.k === 'columns' ? Object.assign({}, f) : f; }), Object.assign({}, b.props, b.props.columns != null ? { columns: String(b.props.columns) } : {}), chg);
      var title = h('b', { text: def.name });
      var item = { id: b.id, type: b.type, form: form }, box;
      var body = h('div', { class: 'blk-b' }, form.el);
      var toggle = function () { box.classList.toggle('c'); };
      title.onclick = toggle;
      var mv = function (d) { var i = rows.indexOf(item), j = i + d; if (j < 0 || j >= rows.length) return; rows.splice(j, 0, rows.splice(i, 1)[0]); redraw(); chg(); };
      box = h('div', { class: 'blk' + (collapsed ? ' c' : '') }, [h('div', { class: 'blk-h' }, [h('span', { text: '▦' }), title,
        h('button', { type: 'button', class: 'btn sm', text: '↑', onclick: function () { mv(-1); } }), h('button', { type: 'button', class: 'btn sm', text: '↓', onclick: function () { mv(1); } }),
        h('button', { type: 'button', class: 'btn sm', text: 'تكرار', onclick: function () { var p = item.form.read(); var i = rows.indexOf(item); var nb = { id: uid(), type: item.type, props: p }; mkRow(nb, true, i + 1); redraw(); chg(); } }),
        h('button', { type: 'button', class: 'btn sm', text: 'طي/فتح', onclick: toggle }),
        h('button', { type: 'button', class: 'btn sm dng', text: 'حذف', onclick: function () { if (!window.confirm('حذف القسم؟')) return; rows.splice(rows.indexOf(item), 1); redraw(); chg(); } })]), body]);
      item.box = box; return item;
    }
    function mkRow(b, collapsed, at) { var it = addBlock(b, collapsed); if (!it) return; if (at == null) rows.push(it); else rows.splice(at, 0, it); }
    function redraw() { clear(listEl); if (!rows.length) listEl.appendChild(h('div', { class: 'empty', text: 'الصفحة فاضية. ضيف أول قسم من تحت.' })); rows.forEach(function (it) { listEl.appendChild(it.box); }); }
    blocks.forEach(function (b) { mkRow(b, blocks.length > 3); }); redraw();
    var adder = h('div', { class: 'add-blk' }, Object.keys(BLOCKS).map(function (t) {
      return h('button', { type: 'button', onclick: function () { mkRow({ id: uid(), type: t, props: {} }, false); redraw(); chg(); rows[rows.length - 1].box.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }, [h('b', { text: '+ ' + BLOCKS[t].name }), h('small', { text: BLOCKS[t].hint })]);
    }));
    bar = saveBar(async function () {
      var out = { blocks: rows.map(function (it) { var p = it.form.read(); if (p.columns != null) p.columns = Number(p.columns); return { id: it.id, type: it.type, props: p }; }) };
      if (meta) { Object.assign(out, meta.read()); if (!out.slug) throw new Error('اكتب الرابط (slug)'); if (/^(admin|api|assets|work|services|_home|sitemap|robots|favicon)$/i.test(out.slug) && out.slug !== row.slug) throw new Error('الرابط ده محجوز. اختار غيره.'); }
      if (isNew) { var made = await db.ins('pages', out); dirty = false; go('pages/' + made[0].id); }
      else await db.upd('pages', 'id', row.id, out);
    }, h('a', { class: 'btn', href: '#/pages', text: 'رجوع', onclick: function (e) { if (!guard()) e.preventDefault(); else dirty = false; } }));
    return h('div', null, [top(isHome ? 'أقسام الصفحة الرئيسية الإضافية' : isNew ? 'صفحة جديدة' : 'تعديل الصفحة'),
      isHome ? h('div', { class: 'note', text: 'الأقسام دي بتظهر في الرئيسية بعد قسم الخدمات وقبل الختام.' }) : h('div', { class: 'card' }, meta.el),
      h('h3', { class: 'sub-t', text: 'أقسام الصفحة' }), listEl, h('h3', { class: 'sub-t', text: 'إضافة قسم' }), adder, bar]);
  }

  /* nav manager */
  async function pNav(r) {
    if (r.arg) return entForm({ page: 'nav_items', arg: r.arg }, ENT.nav_items);
    var pages = await db.sel('pages', 'select=id,slug,title_ar,title_en,nav_label_ar,show_in_nav,nav_sort,published&order=nav_sort.asc');
    var links = await db.sel('nav_items', 'select=*&order=sort.asc');
    var items = [];
    pages.filter(function (p) { return p.slug !== '_home'; }).forEach(function (p) { items.push({ kind: 'page', sort: p.nav_sort, label: p.nav_label_ar || p.title_ar || p.slug, row: p, on: p.show_in_nav, sub: '/' + p.slug + (p.published ? '' : ' (مسودة)') }); });
    links.forEach(function (l) { items.push({ kind: 'link', sort: l.sort, label: l.label_ar || l.label_en, row: l, on: l.visible, sub: l.href }); });
    items.sort(function (a, b) { return a.sort - b.sort; });
    var tr = function (it, i) {
      var tbl = it.kind === 'page' ? 'pages' : 'nav_items', col = it.kind === 'page' ? 'nav_sort' : 'sort', flag = it.kind === 'page' ? 'show_in_nav' : 'visible';
      var shift = async function (d) { var j = i + d; if (j < 0 || j >= items.length) return; var ops = []; items.splice(j, 0, items.splice(i, 1)[0]); items.forEach(function (x, n) { var t2 = x.kind === 'page' ? 'pages' : 'nav_items', c2 = x.kind === 'page' ? 'nav_sort' : 'sort'; var p = {}; p[c2] = (n + 1) * 10; ops.push(db.upd(t2, 'id', x.row.id, p)); }); try { await Promise.all(ops); render(); } catch (e) { toast(e.message, true); } };
      return h('tr', null, [h('td', null, [h('b', { text: it.label }), h('div', { class: 'ltr', dir: 'ltr', style: 'color:var(--mute);font-size:.82rem', text: it.sub })]), h('td', null, h('span', { class: 'pill', text: it.kind === 'page' ? 'صفحة' : 'رابط' })),
        h('td', null, h('label', { class: 'sw' }, [h('input', { type: 'checkbox', checked: it.on, onchange: async function (e) { var p = {}; p[flag] = e.target.checked; try { await db.upd(tbl, 'id', it.row.id, p); toast('تم'); } catch (x) { toast(x.message, true); e.target.checked = !e.target.checked; } } }), h('span', { text: 'ظاهر' })])),
        h('td', null, h('div', { class: 'act' }, [h('button', { class: 'btn sm', text: '↑', onclick: function () { shift(-1); } }), h('button', { class: 'btn sm', text: '↓', onclick: function () { shift(1); } }), h('a', { class: 'btn sm', href: it.kind === 'page' ? '#/pages/' + it.row.id : '#/nav/' + it.row.id, text: 'تعديل' })]))]);
    };
    return h('div', null, [top('قائمة الهيدر', [h('a', { class: 'btn', href: '#/pages/new', text: '+ صفحة جديدة' }), h('a', { class: 'btn pri', href: '#/nav/new', text: '+ رابط مخصص' })]),
      h('div', { class: 'note', text: 'دي القائمة اللي بتظهر في الهيدر: الصفحات (اللي مفعّل فيها "إظهار في الهيدر") مع الروابط المخصصة. غيّر الترتيب بالأسهم أو أخفي أي عنصر.' }),
      items.length ? h('div', { class: 'scroll' }, h('table', { class: 'tbl' }, h('tbody', null, items.map(tr)))) : h('div', { class: 'empty', text: 'القائمة فاضية.' })]);
  }

  /* messages */
  async function pMessages(r) {
    var rows = await db.sel('messages', 'select=*&order=created_at.desc&limit=500');
    var filter = r.arg === 'starred' ? 'starred' : r.arg === 'unread' ? 'unread' : 'all';
    var show = rows.filter(function (m) { return filter === 'all' || (filter === 'starred' ? m.starred : !m.read); });
    unread = rows.filter(function (m) { return !m.read; }).length; drawSide('messages');
    var csv = function () { var q = function (x) { return '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"'; }; var t = '﻿' + ['التاريخ', 'الاسم', 'الإيميل', 'التليفون', 'الموضوع', 'الرسالة'].join(',') + '\n' + rows.map(function (m) { return [m.created_at, m.name, m.email, m.phone, m.subject, m.message].map(q).join(','); }).join('\n'); var a = h('a', { href: URL.createObjectURL(new Blob([t], { type: 'text/csv;charset=utf-8' })), download: 'messages.csv' }); document.body.appendChild(a); a.click(); a.remove(); };
    var tabs = h('div', { class: 'tabs' }, [['all', 'الكل'], ['unread', 'غير مقروءة'], ['starred', 'المميزة']].map(function (t) { return h('button', { class: filter === t[0] ? 'on' : '', text: t[1], onclick: function () { go('messages/' + t[0]); } }); }));
    var list = show.length ? show.map(function (m) {
      var d = h('details', { class: 'msg' + (m.read ? '' : ' unread') }, [
        h('summary', null, [h('b', { text: (m.starred ? '★ ' : '') + m.name }), h('span', { class: 'pill', text: fmtDate(m.created_at) }), m.subject ? h('span', { text: m.subject }) : null, h('span', { style: 'color:var(--mute);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap', text: m.message })]),
        h('div', { class: 'bd', text: m.message }),
        h('div', { class: 'mt' }, [m.email ? h('a', { class: 'btn sm', href: 'mailto:' + m.email, text: m.email }) : null, m.phone ? h('a', { class: 'btn sm', href: 'tel:' + m.phone, text: m.phone }) : null,
          m.phone ? h('a', { class: 'btn sm', target: '_blank', rel: 'noopener', href: 'https://wa.me/' + m.phone.replace(/\D/g, ''), text: 'واتساب' }) : null,
          h('button', { class: 'btn sm', text: m.starred ? 'إلغاء التمييز' : '★ تمييز', onclick: async function () { try { await db.upd('messages', 'id', m.id, { starred: !m.starred }); render(); } catch (e) { toast(e.message, true); } } }),
          h('button', { class: 'btn sm', text: m.read ? 'علّم كغير مقروءة' : 'علّم كمقروءة', onclick: async function () { try { await db.upd('messages', 'id', m.id, { read: !m.read }); render(); } catch (e) { toast(e.message, true); } } }),
          h('button', { class: 'btn sm dng', text: 'حذف', onclick: async function () { if (!await confirmP('حذف الرسالة؟')) return; try { await db.del('messages', 'id', m.id); render(); } catch (e) { toast(e.message, true); } } })])]);
      d.addEventListener('toggle', async function () { if (d.open && !m.read) { m.read = true; d.classList.remove('unread'); try { await db.upd('messages', 'id', m.id, { read: true }); unread = Math.max(0, unread - 1); drawSide('messages'); } catch (e) {} } });
      return d;
    }) : [h('div', { class: 'empty', text: 'مفيش رسائل هنا.' })];
    return h('div', null, [top('الرسائل', rows.length ? h('button', { class: 'btn', text: 'تصدير CSV', onclick: csv }) : null), tabs].concat(list));
  }

  /* media */
  async function pMedia() {
    var box = h('div');
    var load = async function () {
      clear(box); box.appendChild(uploader(load));
      var files = await listMedia();
      box.appendChild(files.length ? mediaGrid(files, null, null, load) : h('div', { class: 'empty', text: 'المكتبة فاضية.' }));
    };
    await load();
    return h('div', null, [top('مكتبة الميديا'), box]);
  }

  /* admins */
  async function pAdmins() {
    var rows = await db.sel('admins', 'select=*&order=created_at.asc');
    var em = h('input', { type: 'email', class: 'ltr', dir: 'ltr', placeholder: 'email@example.com' });
    return h('div', null, [top('المديرين'),
      h('div', { class: 'note', text: 'كل المديرين ليهم صلاحيات كاملة. لإضافة مدير: اعمل له حساب الأول من Supabase → Authentication → Users، وبعدين اكتب إيميله هنا.' }),
      h('div', { class: 'card' }, h('table', { class: 'tbl' }, h('tbody', null, rows.map(function (a) { return h('tr', null, [h('td', { class: 'ltr', dir: 'ltr', text: a.email || a.user_id }), h('td', null, a.user_id === S.user.id ? h('span', { class: 'pill ok', text: 'أنت' }) : null),
        h('td', null, a.user_id === S.user.id ? null : h('button', { class: 'btn sm dng', text: 'إزالة', onclick: async function () { if (!await confirmP('إزالة صلاحيات ' + a.email + '؟')) return; try { await db.rpc('remove_admin', { p_user: a.user_id }); toast('تمت الإزالة'); render(); } catch (e) { toast(e.message, true); } } }))]); })))),
      h('div', { class: 'card' }, [h('h3', { text: 'إضافة مدير' }), h('div', { class: 'f' }, [h('label', { text: 'الإيميل' }), em]), h('button', { class: 'btn pri', text: 'إضافة', onclick: async function () { if (!em.value.trim()) return; try { await db.rpc('add_admin', { p_email: em.value.trim() }); toast('تمت الإضافة'); render(); } catch (e) { toast(e.message, true); } } })]),
      h('div', { class: 'card' }, [h('h3', { text: 'تغيير الباسورد' }), pwForm()])]);
  }
  function pwForm() {
    var p1 = h('input', { type: 'password', class: 'ltr', dir: 'ltr', autocomplete: 'new-password' });
    return h('div', null, [h('div', { class: 'f' }, [h('label', { text: 'باسورد جديد (8 حروف على الأقل)' }), p1]), h('button', { class: 'btn', text: 'تغيير', onclick: async function () { if (p1.value.length < 8) return toast('الباسورد قصير', true); try { await req('/auth/v1/user', { method: 'PUT', json: { password: p1.value } }); p1.value = ''; toast('تم تغيير الباسورد'); } catch (e) { toast(e.message, true); } } })]);
  }

  /* backup */
  var BK = ['settings', 'scenes', 'services', 'projects', 'pages', 'nav_items', 'testimonials', 'clients', 'redirects'];
  async function pBackup() {
    var fi = h('input', { type: 'file', accept: 'application/json', style: 'display:none' });
    fi.addEventListener('change', async function () {
      var f = fi.files[0]; if (!f) return;
      try {
        var j = JSON.parse(await f.text());
        if (!j || !j.tables || !await confirmP('هيتم استبدال/دمج البيانات من الملف في الموقع الحالي. متأكد؟')) return;
        var pkOf = { settings: 'key', scenes: 'key', redirects: 'from_path' };
        for (var i = 0; i < BK.length; i++) { var t = BK[i], rows = j.tables[t]; if (Array.isArray(rows) && rows.length) await db.ups(t, rows, pkOf[t] || 'id'); }
        toast('تم الاستيراد'); render();
      } catch (e) { toast('فشل: ' + e.message, true); }
      fi.value = '';
    });
    return h('div', null, [top('نسخ احتياطي'),
      h('div', { class: 'card' }, [h('h3', { text: 'تصدير' }), h('p', { text: 'بيحمّل ملف JSON فيه كل المحتوى (الصفحات والخدمات والأعمال والإعدادات…). الصور والملفات المرفوعة بتفضل في Supabase Storage.' }),
        h('button', { class: 'btn pri', text: 'تحميل نسخة احتياطية', onclick: async function () { try { var out = { exported: new Date().toISOString(), tables: {} }; for (var i = 0; i < BK.length; i++) out.tables[BK[i]] = await db.sel(BK[i], 'select=*'); var a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' })), download: 'socialdia-backup-' + new Date().toISOString().slice(0, 10) + '.json' }); document.body.appendChild(a); a.click(); a.remove(); } catch (e) { toast(e.message, true); } } })]),
      h('div', { class: 'card' }, [h('h3', { text: 'استيراد' }), h('p', { text: 'بيرفع محتوى من نسخة احتياطية سابقة (بيدمج بالـ id، يعني بيحدّث الموجود ويضيف الناقص).' }), h('button', { class: 'btn', text: 'اختيار ملف', onclick: function () { fi.click(); } }), fi])]);
  }

  boot();
})();
