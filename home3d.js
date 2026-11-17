(function(){
  'use strict';
  var app = document.getElementById('app');
  var intro = document.getElementById('intro'), flash = null;
  if (document.documentElement.classList.contains('no-intro')) {
    ['intro', 'wipe'].forEach(function(id){ var el = document.getElementById(id); if (el && el.parentNode) el.parentNode.removeChild(el); });
    intro = null;
  }
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var HAS3D = typeof THREE !== 'undefined';
  var TAU = Math.PI * 2;
  function clamp(x, a, b){ return x < a ? a : x > b ? b : x; }
  function ease(x){ return 1 - Math.pow(1 - x, 3); }
  function pad(n){ return (n < 10 ? '0' : '') + n; }
  function tcText(sec){ var f = Math.floor(sec * 25), s = Math.floor(f / 25); return '00:' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60) + ':' + pad(f % 25); }

  /* ================= renderer ================= */
  var canvas, renderer;
  if (HAS3D) {
    try {
      canvas = document.createElement('canvas');
      canvas.id = 'gl';
      document.body.appendChild(canvas);
      renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.autoClear = false;
      renderer.setClearColor(0x000000, 0);
    } catch (err) {
      HAS3D = false;
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }
  }

  /* ================= scene helpers ================= */
  var C = { pink:0xD6065F, hot:0xFF5C9E, yellow:0xFFEB6E, sky:0xA8DDE9, skyD:0x1E86A3, violet:0xB04BB5, leaf:0x5DAA73,
            ink:0x1A1A22, dark:0x2A2A34, white:0xF8F8FB, gold:0xF5C33B, steel:0xC4C9D6 };
  (function(){
    var sc = (window.SD && window.SD.colors) || {};
    function hx(v, d){ return /^#[0-9a-f]{6}$/i.test(v || '') ? parseInt(v.slice(1), 16) : d; }
    C.pink = hx(sc.accent, C.pink); C.hot = hx(sc.accent_dark, C.hot); C.yellow = hx(sc.pop, C.yellow);
    C.sky = hx(sc.sky, C.sky); C.violet = hx(sc.violet, C.violet); C.leaf = hx(sc.leaf, C.leaf);
  })();
  function mat(c, o){
    o = o || {};
    return new THREE.MeshStandardMaterial({ color:c, roughness:o.r == null ? .55 : o.r, metalness:o.m || 0, emissive:o.e || 0, emissiveIntensity:o.ei == null ? 1 : o.ei });
  }
  function put(o, x, y, z){ o.position.set(x || 0, y || 0, z || 0); return o; }
  function box(w, h, d, m, x, y, z){ return put(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m), x, y, z); }
  function cyl(rt, rb, h, m, x, y, z, seg){ return put(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 32), m), x, y, z); }
  function sph(r, m, x, y, z){ return put(new THREE.Mesh(new THREE.SphereGeometry(r, 24, 18), m), x, y, z); }
  function tor(R, r, m, x, y, z, arc){ return put(new THREE.Mesh(new THREE.TorusGeometry(R, r, 12, 40, arc || TAU), m), x, y, z); }
  function tex(w, h, draw){
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
  }
  function heartGeo(){
    var s = new THREE.Shape();
    s.moveTo(0, -.55); s.bezierCurveTo(-.9, .05, -.55, .75, 0, .4); s.bezierCurveTo(.55, .75, .9, .05, 0, -.55);
    var g = new THREE.ExtrudeGeometry(s, { depth:.25, bevelEnabled:true, bevelThickness:.06, bevelSize:.06, bevelSegments:3, curveSegments:16 });
    g.center(); return g;
  }
  function starGeo(R, r){
    var s = new THREE.Shape();
    for (var i = 0; i < 10; i++) {
      var a = Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R, x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      if (i) s.lineTo(x, y); else s.moveTo(x, y);
    }
    s.closePath();
    var g = new THREE.ExtrudeGeometry(s, { depth:.18, bevelEnabled:true, bevelThickness:.04, bevelSize:.04, bevelSegments:2 });
    g.center(); return g;
  }
  function flangeGeo(R){
    var s = new THREE.Shape(); s.absarc(0, 0, R, 0, TAU, false);
    for (var i = 0; i < 5; i++) {
      var a = i / 5 * TAU, h = new THREE.Path();
      h.absarc(Math.cos(a) * R * .6, Math.sin(a) * R * .6, R * .24, 0, TAU, true); s.holes.push(h);
    }
    var c = new THREE.Path(); c.absarc(0, 0, R * .11, 0, TAU, true); s.holes.push(c);
    return new THREE.ExtrudeGeometry(s, { depth:.08, bevelEnabled:false, curveSegments:32 });
  }
  function lights(s){
    s.add(new THREE.HemisphereLight(0xffffff, 0x8a8aa6, .95));
    var d = new THREE.DirectionalLight(0xffffff, 1.15); d.position.set(3, 5, 6); s.add(d);
    var r = new THREE.DirectionalLight(0xFF7DB5, .7); r.position.set(-5, 2, -3); s.add(r);
    var f = new THREE.DirectionalLight(0xA8DDE9, .45); f.position.set(-3, -3, 4); s.add(f);
  }

  function pen(color){
    var p = new THREE.Group(), body = mat(color, { r:.35 }), steel = mat(C.steel, { m:.35, r:.4 });
    p.add(cyl(.09, .09, 1.7, body, 0, 0, 0, 20));
    p.add(cyl(.09, .04, .35, mat(C.dark), 0, -1.02, 0, 20));
    p.add(cyl(.04, .005, .28, steel, 0, -1.33, 0, 16));
    p.add(cyl(.098, .098, .12, steel, 0, .82, 0, 20));
    p.add(box(.04, .7, .03, steel, .115, .45, 0));
    return p;
  }

  /* ================= object builders ================= */
  function build(name){
    var g = new THREE.Group(), fl = [];
    g.userData.fl = fl; g.userData.tk = null;
    function F(o, ph, amp){ o.userData.by = o.position.y; o.userData.ph = ph; o.userData.amp = amp || .1; fl.push(o); return o; }

    if (name === 'notebook') {
      var nb = new THREE.Group(), cover = mat(C.pink, { r:.5 }), paper = mat(C.white, { r:.9 });
      nb.add(box(2.2, .14, 2.9, cover, 0, -.2, 0));
      nb.add(box(2.08, .22, 2.76, paper, .04, -.02, 0));
      nb.add(box(2.2, .14, 2.9, cover, 0, .16, 0));
      nb.add(box(1.2, .02, .55, mat(C.yellow), .15, .24, -.8));
      nb.add(box(.8, .02, .06, mat(C.dark), .15, .255, -.86));
      nb.add(box(.55, .02, .05, mat(C.dark), .0, .255, -.72));
      nb.add(box(.07, .5, 2.92, mat(C.dark), .8, -.02, 0));
      for (var i = 0; i < 9; i++) nb.add(tor(.22, .035, mat(C.steel, { m:.35, r:.4 }), -1.1, -.02, -1.2 + i * .3));
      nb.rotation.set(.85, 0, 0); nb.position.set(0, -.5, 0);
      g.add(nb);
      var p1 = pen(C.yellow); p1.position.set(1.0, .95, .9); p1.rotation.z = -.95; p1.rotation.x = .2;
      g.add(F(p1, 0, .12));
      var bulb = new THREE.Group();
      bulb.add(sph(.42, mat(C.yellow, { e:0xFFD84A, ei:.7, r:.2 }), 0, 0, 0));
      bulb.add(cyl(.2, .17, .22, mat(C.steel, { m:.35, r:.4 }), 0, -.5, 0, 16));
      bulb.add(cyl(.17, .12, .12, mat(C.dark), 0, -.66, 0, 16));
      for (var k = 0; k < 7; k++) {
        var a = Math.PI * (.12 + k * .126), ray = box(.05, .24, .05, mat(C.yellow, { e:0xFFD84A, ei:.8 }), Math.cos(a) * .78, Math.sin(a) * .78, 0);
        ray.rotation.z = a - Math.PI / 2; bulb.add(ray);
      }
      bulb.position.set(-1.0, 1.45, .3);
      g.add(F(bulb, 1.4, .14));
    }

    if (name === 'palette') {
      var pal = new THREE.Group();
      pal.add(cyl(1.5, 1.5, .16, mat(0xF1E6CE, { r:.7 }), 0, 0, 0, 48));
      var cols = [C.pink, C.yellow, C.sky, C.violet, C.leaf, C.ink];
      for (var j = 0; j < 6; j++) {
        var an = j / 6 * TAU - .5, d = sph(.26, mat(cols[j], { r:.35 }), Math.cos(an) * .95, .13, Math.sin(an) * .95);
        d.scale.y = .42; pal.add(d);
      }
      pal.rotation.set(.95, 0, 0); pal.position.set(-.1, -.3, 0);
      g.add(pal);
      var sw = [[C.pink, -1.4, 1.35, .6, .3], [C.yellow, 1.5, 1.2, .3, 1.8], [C.sky, 1.45, -1.25, .7, 3.1]];
      sw.forEach(function(s){
        var c = box(.5, .5, .5, mat(s[0], { r:.4 }), s[1], s[2], s[3]); c.rotation.set(.5, .6, .2);
        g.add(F(c, s[4], .12));
      });
      var st = pen(C.skyD); st.position.set(.9, .25, 1.0); st.rotation.z = -.85; st.rotation.x = .25;
      g.add(F(st, 2, .1));
    }

    if (name === 'calendar') {
      var cal = new THREE.Group();
      cal.add(box(2.4, 2.6, .2, mat(C.white, { r:.8 }), 0, 0, 0));
      cal.add(box(2.4, .62, .24, mat(C.pink, { r:.45 }), 0, 1.0, 0));
      cal.add(cyl(.06, .06, .42, mat(C.steel, { m:.35, r:.4 }), -.6, 1.38, 0, 12));
      cal.add(cyl(.06, .06, .42, mat(C.steel, { m:.35, r:.4 }), .6, 1.38, 0, 12));
      var tile = mat(0xDDE1EC, { r:.8 }), mc = [C.pink, C.yellow, C.sky, C.violet, C.leaf], n = 0;
      for (var r = 0; r < 4; r++) for (var c = 0; c < 5; c++) {
        var hit = (r * 5 + c) % 6 === 1, t = box(.32, .32, .04, hit ? mat(mc[n++ % 5], { r:.4 }) : tile, -.88 + c * .44, .42 - r * .44, .12);
        cal.add(t);
      }
      cal.position.set(-.55, .1, 0); cal.rotation.set(.1, 0, 0);
      g.add(cal);
      var mg = new THREE.Group(), yel = mat(C.yellow, { r:.4 });
      var horn = cyl(.75, .26, .95, yel, 0, 0, 0, 32); horn.rotation.z = -Math.PI / 2; mg.add(horn);
      var rim = tor(.75, .05, mat(C.steel, { m:.35, r:.4 }), .48, 0, 0); rim.rotation.y = Math.PI / 2; mg.add(rim);
      mg.add(cyl(.28, .28, .4, mat(C.dark), -.62, 0, 0, 20));
      var hd = box(.18, .5, .2, mat(C.dark), -.35, -.55, 0); hd.rotation.z = .3; mg.add(hd);
      var waves = [];
      for (var w = 0; w < 3; w++) {
        var wv = tor(.5 + w * .28, .035, mat(C.pink, { e:0xD6065F, ei:.6 }), .72, 0, 0, Math.PI * .6); wv.rotation.z = -Math.PI * .3; mg.add(wv); waves.push(wv);
      }
      mg.position.set(1.2, -.85, .7); mg.rotation.set(0, -.3, .35); mg.scale.setScalar(.85);
      g.add(F(mg, 1, .08));
      g.userData.tk = function(t){ waves.forEach(function(w, i){ var s = 1 + .08 * Math.sin(t * 3 - i * .9); w.scale.set(s, s, 1); }); };
    }

    if (name === 'laptop') {
      var lap = new THREE.Group(), alu = mat(0xC9CCD6, { m:.35, r:.4 }), dk = mat(0x1C1C24, { r:.6 });
      lap.add(box(3, .14, 2.1, alu, 0, 0, 0));
      lap.add(box(2.7, .02, 1.2, dk, 0, .08, -.25));
      var kg = new THREE.BoxGeometry(.2, .03, .2), km = mat(0x3A3A46, { r:.5 });
      for (var r2 = 0; r2 < 4; r2++) for (var c2 = 0; c2 < 10; c2++) lap.add(put(new THREE.Mesh(kg, km), -1.17 + c2 * .26, .11, -.7 + r2 * .25));
      lap.add(box(.9, .02, .55, mat(0xA9ADBA, { m:.2 }), 0, .085, .62));
      var lid = new THREE.Group(); lid.position.set(0, .07, -1.05); lid.rotation.x = -.28;
      lid.add(box(3, 2, .08, alu, 0, 1, 0));
      var screen = tex(512, 320, function(c, w, h){
        c.fillStyle = '#14141c'; c.fillRect(0, 0, w, h);
        ['#FF5F57', '#FEBC2E', '#28C840'].forEach(function(k, i){ c.fillStyle = k; c.beginPath(); c.arc(22 + i * 20, 20, 6, 0, TAU); c.fill(); });
        var gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#D6065F'); gr.addColorStop(1, '#B04BB5');
        c.fillStyle = gr; c.fillRect(24, 44, w - 48, 100);
        c.fillStyle = 'rgba(255,255,255,.92)'; c.fillRect(44, 66, 190, 14);
        c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(44, 92, 270, 8); c.fillRect(44, 108, 210, 8);
        c.fillStyle = '#FFEB6E'; c.fillRect(w - 150, 100, 100, 26);
        var lc = ['#FF8FBF', '#FFEB6E', '#8FD9A0', '#A8DDE9'];
        for (var i = 0; i < 7; i++) { c.fillStyle = lc[i % 4]; c.fillRect(24 + (i % 3) * 22, 168 + i * 20, 60 + ((i * 53) % 190), 9); }
      });
      var sc = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.8), new THREE.MeshBasicMaterial({ map:screen })); sc.position.set(0, 1, .045); lid.add(sc);
      lap.add(lid);
      lap.position.set(-.3, -.85, 0); lap.rotation.set(.38, 0, 0);
      g.add(lap);
      var bag = new THREE.Group();
      bag.add(box(.8, .95, .42, mat(C.pink, { r:.5 }), 0, 0, 0));
      bag.add(box(.4, .14, .02, mat(C.yellow), 0, -.1, .22));
      var hdl = tor(.2, .035, mat(C.dark), 0, .48, 0, Math.PI); bag.add(hdl);
      bag.position.set(1.65, .35, .85); bag.rotation.set(.15, -.45, .08);
      g.add(F(bag, .8, .1));
    }

    if (name === 'camera') {
      var cam = new THREE.Group(), body = mat(0x2D2D2D, { r:.55, m:.15 }), skin = mat(0x15151c, { r:.8 }), steel = mat(C.steel, { m:.35, r:.4 }), pk = mat(C.pink, { r:.4 });
      cam.add(box(2.5, 1.45, 1.3, body, 0, 0, 0));
      cam.add(box(2.5, .18, .02, pk, 0, .5, .66));
      cam.add(box(1.0, .38, .6, skin, -.5, .9, -.1));
      cam.add(box(.5, .12, .5, steel, .5, .78, 0));
      cam.add(cyl(.13, .13, .1, pk, .95, .78, .15, 20));
  cam.add(sph(.09, mat(C.violet, { r:.4 }), -.8, 1.13, -.1));
  cam.add(sph(.09, mat(C.leaf, { r:.4 }), -.55, 1.13, -.1));
  [C.sky, C.pink, C.yellow, 0x111111].forEach(function(c, i){ cam.add(box(.36, .1, .02, mat(c, { r:.4 }), -.66 + i * .44, -.5, .66)); });
      cam.add(box(.55, 1.2, .75, skin, 1.2, -.1, .1));
      var lens = new THREE.Group(); lens.position.set(0, 0, .65);
      var barrel = cyl(.66, .66, .7, mat(0x101016, { r:.5, m:.2 }), 0, 0, .35); barrel.rotation.x = Math.PI / 2; lens.add(barrel);
      lens.add(tor(.67, .06, steel, 0, 0, .12));
      lens.add(tor(.67, .05, steel, 0, 0, .55));
      var hood = new THREE.Mesh(new THREE.CylinderGeometry(.8, .67, .36, 40, 1, true), new THREE.MeshStandardMaterial({ color:0x15151c, roughness:.8, side:THREE.DoubleSide }));
      hood.rotation.x = Math.PI / 2; hood.position.set(0, 0, .88); lens.add(hood);
      var glassM = mat(0x0E4B63, { r:.1, m:.2, e:0x0A2A3A, ei:.8 });
      var glass = cyl(.55, .55, .06, glassM, 0, 0, .78); glass.rotation.x = Math.PI / 2; lens.add(glass);
      lens.add(tor(.55, .04, mat(C.yellow, { r:.4 }), 0, 0, .83));
      var hl = sph(.09, mat(0xffffff, { e:0xffffff, ei:.9, r:.2 }), -.2, .2, .86); hl.scale.z = .3; lens.add(hl);
      cam.add(lens);
      var lamp = sph(.07, mat(0xff2a2a, { e:0xff2a2a, ei:1 }), -1.0, .55, .67); cam.add(lamp);
      cam.position.set(.35, .15, 0); cam.rotation.set(.18, 0, 0);
      g.add(cam);
      var cl = new THREE.Group();
      cl.add(box(1.5, 1.0, .1, mat(C.ink, { r:.6 }), 0, 0, 0));
      var top = new THREE.Group(); top.position.set(-.75, .52, .07); top.rotation.z = .3;
      for (var s = 0; s < 6; s++) top.add(box(.25, .2, .1, s % 2 ? mat(C.white) : mat(C.dark), .125 + s * .25, .1, 0));
      cl.add(top);
      for (var q = 0; q < 2; q++) cl.add(box(1.3, .04, .02, mat(C.white), 0, -.08 - q * .28, .06));
      cl.position.set(-1.6, -1.2, .9); cl.rotation.set(-.1, .4, .1); cl.scale.setScalar(.8);
      g.add(F(cl, 1.3, .06));
      g.userData.glass = glassM;
      g.userData.tk = function(t){ lamp.visible = Math.floor(t * 2) % 2 === 0; };
    }

    if (name === 'reel') {
      var reel = new THREE.Group(), fm = mat(0x23232c, { r:.5, m:.15 });
      var f1 = new THREE.Mesh(flangeGeo(1.2), fm); f1.position.z = -.26; reel.add(f1);
      var f2 = new THREE.Mesh(flangeGeo(1.2), fm); f2.position.z = .18; reel.add(f2);
      var core = cyl(.95, .95, .34, mat(0x2b1d1d, { r:.8 }), 0, 0, 0); core.rotation.x = Math.PI / 2; reel.add(core);
      var hub = cyl(.3, .3, .56, mat(C.steel, { m:.35, r:.4 }), 0, 0, 0, 24); hub.rotation.x = Math.PI / 2; reel.add(hub);
      reel.add(tor(1.2, .04, mat(C.pink, { r:.4 }), 0, 0, .27));
      reel.position.set(-.3, .5, 0);
      g.add(reel);
      var strip = new THREE.Group(), fc = [C.pink, C.sky, C.yellow, C.violet];
      strip.add(box(2.8, .64, .03, mat(0x15151c, { r:.6 }), 0, 0, 0));
      for (var f = 0; f < 4; f++) strip.add(box(.5, .36, .035, mat(fc[f], { r:.5 }), -1.05 + f * .7, 0, .01));
      var pm = mat(0xE8E8F0, { r:.6 }), pgm = new THREE.BoxGeometry(.08, .08, .04);
      for (var p = 0; p < 13; p++) { strip.add(put(new THREE.Mesh(pgm, pm), -1.3 + p * .22, .26, .005)); strip.add(put(new THREE.Mesh(pgm, pm), -1.3 + p * .22, -.26, .005)); }
      strip.position.set(1.0, -1.15, .15); strip.rotation.z = .3;
      g.add(F(strip, .6, .07));
      var hp = new THREE.Group(), hm = mat(C.dark, { r:.5 });
      hp.add(tor(.75, .07, hm, 0, 0, 0, Math.PI));
      [-1, 1].forEach(function(sd){ var cup = cyl(.3, .3, .24, mat(C.pink, { r:.45 }), sd * .75, 0, 0, 24); cup.rotation.z = Math.PI / 2; hp.add(cup); });
      hp.position.set(-1.6, -1.1, .6); hp.rotation.set(.1, .5, .15); hp.scale.setScalar(.85);
      g.add(F(hp, 1.9, .09));
      g.userData.tk = function(t){ reel.rotation.z = -t * .9; };
    }

    if (name === 'phone') {
      var ph = new THREE.Group();
      ph.add(box(1.5, 3.0, .14, mat(0x15151c, { r:.4, m:.2 }), 0, 0, 0));
      var ptex = tex(256, 512, function(c, w, h){
        var gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#D6065F'); gr.addColorStop(.6, '#B04BB5'); gr.addColorStop(1, '#FFEB6E');
        c.fillStyle = gr; c.fillRect(0, 0, w, h);
        c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.moveTo(w / 2 - 22, h / 2 - 34); c.lineTo(w / 2 + 34, h / 2); c.lineTo(w / 2 - 22, h / 2 + 34); c.closePath(); c.fill();
        c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(24, 28, 70, 24);
        c.fillStyle = '#fff'; c.fillRect(34, 36, 50, 8);
        c.fillStyle = 'rgba(255,255,255,.85)'; c.fillRect(24, h - 96, 150, 10); c.fillRect(24, h - 76, 100, 8);
        c.beginPath(); c.arc(w - 40, h - 150, 14, 0, TAU); c.fill(); c.beginPath(); c.arc(w - 40, h - 108, 14, 0, TAU); c.fill();
      });
      var scr = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 2.84), new THREE.MeshBasicMaterial({ map:ptex })); scr.position.z = .075; ph.add(scr);
      ph.add(box(.5, .06, .02, mat(0x000000), 0, 1.32, .08));
      ph.position.set(0, 0, 0); ph.rotation.set(.1, 0, 0);
      g.add(ph);
      var h1 = new THREE.Mesh(heartGeo(), mat(C.hot, { r:.35, e:0xD6065F, ei:.3 })); h1.position.set(1.25, .9, .6); h1.scale.setScalar(.8); h1.rotation.z = .25;
      g.add(F(h1, 0, .13));
      var h2 = new THREE.Mesh(heartGeo(), mat(C.violet, { r:.35, e:0x5a1a60, ei:.3 })); h2.position.set(-1.3, -.6, .5); h2.scale.setScalar(.55); h2.rotation.z = -.2;
      g.add(F(h2, 2.1, .1));
      var bub = new THREE.Group();
      var bb = sph(.4, mat(C.white, { r:.5 }), 0, 0, 0); bb.scale.set(1.3, .85, .5); bub.add(bb);
      for (var dd = -1; dd <= 1; dd++) bub.add(sph(.06, mat(C.dark), dd * .2, 0, .2));
      bub.position.set(-1.25, 1.2, .5);
      g.add(F(bub, 1.1, .1));
    }

    if (name === 'trophy') {
      var tr = new THREE.Group(), gold = mat(C.gold, { r:.35, m:.3, e:0x4a3000, ei:.35 });
      tr.add(box(1.3, .3, 1.3, mat(C.ink, { r:.5 }), 0, -1.4, 0));
      tr.add(cyl(.55, .7, .2, gold, 0, -1.15, 0));
      tr.add(cyl(.16, .16, .7, gold, 0, -.7, 0, 20));
      tr.add(cyl(.85, .45, 1.3, gold, 0, .3, 0));
      tr.add(cyl(.8, .8, .02, mat(0x8a6a10, { r:.5 }), 0, .95, 0));
      var hR = tor(.45, .07, gold, .8, .4, 0, Math.PI); hR.rotation.z = -Math.PI / 2; tr.add(hR);
      var hL = tor(.45, .07, gold, -.8, .4, 0, Math.PI); hL.rotation.z = Math.PI / 2; tr.add(hL);
      tr.add(box(.5, .3, .02, mat(C.pink), 0, -.05, .86));
      tr.position.set(0, -.5, 0);
      g.add(tr);
      var star = new THREE.Mesh(starGeo(.5, .22), mat(C.yellow, { e:0xFFD84A, ei:.7, r:.3 })); star.position.set(0, 1.85, 0);
      g.add(F(star, 0, .1));
      var conf = [], cc = [C.pink, C.yellow, C.sky, C.violet, C.leaf];
      for (var i2 = 0; i2 < 14; i2++) {
        var cf = box(.14, .14, .03, mat(cc[i2 % 5], { r:.5 }), 0, 0, 0);
        cf.userData = { a:Math.random() * TAU, rad:1.5 + Math.random() * .7, y:-.9 + Math.random() * 2.8, sp:.4 + Math.random() * .6 };
        g.add(cf); conf.push(cf);
      }
      g.userData.tk = function(t){
        star.rotation.y = t * 1.6;
        conf.forEach(function(c){ var u = c.userData, a = u.a + t * u.sp; c.position.set(Math.cos(a) * u.rad, u.y + Math.sin(t + u.a) * .12, Math.sin(a) * u.rad); c.rotation.set(t * 2 + u.a, t * 1.3, 0); });
      };
    }
    return g;
  }

  /* ================= slots ================= */
  var items = [];
  var ids = { s1:'notebook', s2:'palette', s3:'calendar', s4:'laptop', s5:'camera', s6:'reel', s7:'phone', s8:'trophy' };
  if (HAS3D) {
    Array.prototype.forEach.call(document.querySelectorAll('.scene'), function(sc){
      var VIS = { idea:'notebook', design:'palette', planning:'calendar', build:'laptop', shoot:'camera', edit:'reel', publish:'phone', success:'trophy' };
      var name = VIS[sc.getAttribute('data-visual')] || ids[sc.id], vis = sc.querySelector('.visual');
      if (!name || !vis) return;
      var w = document.createElement('div'); w.className = 'vwrap' + (sc.classList.contains('flip') ? ' s-start' : '');
      vis.parentNode.insertBefore(w, vis); w.appendChild(vis);
      var slot = document.createElement('div'); slot.className = 'slot3d'; slot.setAttribute('aria-hidden', 'true'); w.appendChild(slot);
      items.push({ el:slot, name:name });
    });
  }
  function ensure(it){
    if (it.sc) return;
    it.sc = new THREE.Scene(); lights(it.sc);
    it.obj = build(it.name);
    it.root = new THREE.Group(); it.root.add(it.obj); it.sc.add(it.root);
    it.cam = new THREE.PerspectiveCamera(32, 1, .1, 60); it.cam.position.set(0, 0, 10);
  }
  function pose(it, p, t){
    var e = ease(clamp(p / .3, 0, 1)), r = it.root;
    r.rotation.y = (p - .5) * Math.PI * 1.1 + Math.sin(t * .7) * .16 + ptr.sx * .35 + kick;
    r.rotation.x = Math.sin(t * .5) * .05 + ptr.sy * .18;
    r.scale.setScalar(.82 * (.25 + .75 * e));
    r.position.y = (1 - e) * -1.4;
    var fl = it.obj.userData.fl;
    for (var i = 0; i < fl.length; i++) { var o = fl[i]; o.position.y = o.userData.by + Math.sin(t * 1.4 + o.userData.ph) * o.userData.amp; }
    if (it.obj.userData.tk) it.obj.userData.tk(t, p);
  }
  function drawIn(it, rect){
    it.cam.aspect = rect.width / rect.height; it.cam.updateProjectionMatrix();
    var x = rect.left, y = lastH - rect.bottom;
    renderer.setViewport(x, y, rect.width, rect.height);
    renderer.setScissor(x, y, rect.width, rect.height);
    renderer.render(it.sc, it.cam);
  }

  /* ================= intro ================= */
  var wipe = document.getElementById('wipe');
  var introGL = false, introItem = null, introT0 = performance.now(), phase = intro ? 'play' : 'done', tmrs = [];
  function T(fn, ms){ tmrs.push(setTimeout(fn, ms)); }
  function lock(on){ document.documentElement.style.overflow = on ? 'hidden' : ''; }
  function ready(){ window.__sdReady = true; document.dispatchEvent(new Event('sd:ready')); }
  function toPage(){
    phase = 'page'; introGL = false;
    if (canvas) canvas.style.zIndex = '';
    lock(false); ready();
  }
  function finish(){
    phase = 'done';
    [intro, wipe].forEach(function(el){ if (el && el.parentNode) el.parentNode.removeChild(el); });
  }
  function fadeOut(){
    if (phase === 'page' || phase === 'done') return;
    toPage(); intro.classList.add('out'); T(finish, 950);
  }
  function startWipe(){
    wipe.classList.add('go');
    T(function(){
      introGL = false;
      if (canvas) canvas.style.zIndex = '';
      intro.classList.add('logo');
    }, 700);
  }
  if (!intro) ready();
  else {
    var logoSrc = document.querySelector('.logo-plate img');
    if (logoSrc) document.getElementById('iLogo').src = logoSrc.src;
    if (reduce) { finish(); ready(); }
    else {
      lock(true); window.scrollTo(0, 0);
      T(startWipe, 1900);
      T(fadeOut, 4500);
      T(fadeOut, 8000);
      var itc = document.getElementById('itc');
      var tci = setInterval(function(){ if (phase !== 'play') { clearInterval(tci); return; } itc.textContent = tcText((performance.now() - introT0) / 1000); }, 40);
      if (HAS3D) {
        var fb = document.getElementById('iFallback'); if (fb) fb.parentNode.removeChild(fb);
        introItem = { el:document.getElementById('introSlot'), name:'camera' };
        ensure(introItem);
        introGL = true; canvas.style.zIndex = '101';
      }
    }
  }
  function poseIntro(it, s){
    var e1 = ease(clamp(s / 1.2, 0, 1)), r = it.root;
    var dolly = s > 1.7 ? 1 + ease(clamp((s - 1.7) / .45, 0, 1)) * 1.4 : 1;
    r.rotation.y = -1.7 * (1 - e1) + .5 + Math.sin(s * 1.3) * .1;
    r.rotation.x = .08 + Math.sin(s * .9) * .04;
    r.position.y = (1 - e1) * -1.2;
    r.scale.setScalar(.95 * (.35 + .65 * e1) * dolly);
    if (it.obj.userData.tk) it.obj.userData.tk(s, 0);
    var gm = it.obj.userData.glass; if (gm) gm.emissiveIntensity = s > 1.2 ? .8 + Math.sin((s - 1.2) * 6) * .5 : .8;
  }

  /* ================= loop ================= */
  var lastW = 0, lastH = 0, dirty = true;
  var ptr = { x:0, y:0, sx:0, sy:0 }, kick = 0, lastY = window.scrollY;
  if (!reduce) {
    window.addEventListener('pointermove', function(e){ ptr.x = e.clientX / window.innerWidth * 2 - 1; ptr.y = e.clientY / window.innerHeight * 2 - 1; }, { passive:true });
    window.addEventListener('scroll', function(){ var y = window.scrollY; kick = clamp(kick + (y - lastY) * .0045, -2.2, 2.2); lastY = y; }, { passive:true });
  }
  window.addEventListener('scroll', function(){ dirty = true; }, { passive:true });
  window.addEventListener('resize', function(){ dirty = true; });
  function frame(now){
    requestAnimationFrame(frame);
    if (document.hidden || !renderer) return;
    if (reduce && !dirty) return;
    dirty = false;
    var t = reduce ? 0 : now / 1000;
    ptr.sx += (ptr.x - ptr.sx) * .08; ptr.sy += (ptr.y - ptr.sy) * .08; kick *= .93;
    var W = canvas.clientWidth, H = canvas.clientHeight;
    if (W !== lastW || H !== lastH) { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(W, H, false); lastW = W; lastH = H; }
    renderer.setScissorTest(false); renderer.clear(); renderer.setScissorTest(true);
    if (phase === 'play' || phase === 'logo') {
      if (introGL && introItem) {
        var s = (now - introT0) / 1000;
        poseIntro(introItem, s);
        drawIn(introItem, introItem.el.getBoundingClientRect());
      }
      return;
    }
    for (var i = 0; i < items.length; i++) {
      var it = items[i], rect = it.el.getBoundingClientRect();
      if (rect.bottom < -20 || rect.top > H + 20 || rect.width < 4) continue;
      ensure(it);
      pose(it, 1 - (rect.top + rect.height / 2) / H, t);
      drawIn(it, rect);
    }
  }
  if (renderer) requestAnimationFrame(frame);
})();
