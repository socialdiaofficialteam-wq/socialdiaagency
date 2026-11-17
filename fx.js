(function(){
  'use strict';
  var app = document.getElementById('app');
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var fine = !!(window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches) && !reduce;
  var $ = function(s, r){ return (r || document).querySelector(s); };
  var $$ = function(s, r){ return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function clamp(x, a, b){ return x < a ? a : x > b ? b : x; }
  var vh = window.innerHeight;

  /* ---------- hero entrance ---------- */
  var hero = $('.hero');
  function splitWords(el){
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), nodes = [], n, k = 0;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function(tn){
      if (!tn.nodeValue.trim()) return;
      var frag = document.createDocumentFragment();
      tn.nodeValue.split(/(\s+)/).forEach(function(p){
        if (!p) return;
        if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
        var w = document.createElement('span'); w.className = 'w';
        var i = document.createElement('span'); i.textContent = p; i.style.setProperty('--k', k++);
        w.appendChild(i); frag.appendChild(w);
      });
      tn.parentNode.replaceChild(frag, tn);
    });
  }
  if (hero) {
    $$('h1 .ar, h1 .en', hero).forEach(splitWords);
    [['.slate', '0s'], ['.lede', '.55s'], ['.cta-row', '.7s']].forEach(function(a){
      var el = $(a[0], hero); if (el) { el.classList.add('hx'); el.style.setProperty('--hd', a[1]); }
    });
    $$('.toc a', hero).forEach(function(a, i){ a.classList.add('hx'); a.style.setProperty('--hd', (1.1 + i * .06) + 's'); });
    hero.classList.add('h-prep');
    void hero.offsetWidth;
    var started = false;
    var go = function(){
      if (started) return; started = true; hero.classList.remove('h-prep'); hero.classList.add('h-go');
      setTimeout(function(){ $$('.hx', hero).forEach(function(el){ el.classList.remove('hx'); el.style.removeProperty('--hd'); }); }, 3200);
    };
    if (window.__sdReady) go(); else document.addEventListener('sd:ready', go, { once:true });
    setTimeout(go, 9500);
  }

  /* ---------- scroll reveal ---------- */
  var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function(es){
    es.forEach(function(e){
      if (!e.isIntersecting) return;
      var el = e.target; io.unobserve(el); el.classList.add('in');
      setTimeout(function(){ el.classList.remove('rv', 'in'); el.style.removeProperty('--d'); }, 1500);
    });
  }, { threshold:.12, rootMargin:'0px 0px -6% 0px' }) : null;
  function reveal(list, step){
    if (!io) return;
    list.forEach(function(el, i){
      if (el.getBoundingClientRect().top < vh * .92) return;
      el.classList.add('rv'); el.style.setProperty('--d', ((i % (step || 5)) * .09) + 's'); io.observe(el);
    });
  }
  $$('.scene').forEach(function(sc){ reveal($$('.copy > *', sc), 5); });
  reveal($$('.marq, .stats .st'), 3);
  reveal($$('.cr'), 4);
  reveal($$('.blk .sec-head, .pcard, .scard, .quote, .cta-band, .prose, .cols, .fig, .gal, .faq, .logos, .cgrid, .embed'), 6);
  reveal($$('.finale h2, .finale .cta-row, .finale .logo-plate'), 3);
  var credH = $('.credits h2'); if (credH) reveal([credH], 1);

  /* ---------- counters ---------- */
  var counters = $$('.st b');
  function countTo(b){
    var n = parseInt(b.getAttribute('data-n'), 10) || 0, t0 = performance.now(), dur = 1400;
    (function step(now){
      var p = clamp((now - t0) / dur, 0, 1), e = 1 - Math.pow(1 - p, 3);
      b.textContent = String(Math.round(n * e));
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }
  if (counters.length && io && !reduce) {
    var cio = new IntersectionObserver(function(es){
      es.forEach(function(e){ if (e.isIntersecting) { cio.unobserve(e.target); countTo(e.target); } });
    }, { threshold:.6 });
    counters.forEach(function(b){ b.textContent = '0'; cio.observe(b); });
  }

  /* ---------- decorative shapes per scene ---------- */
  var scenes = $$('.scene');
  var shapes = [
    [['ring', '3%', '4%', 52, 90, 80], ['dot', '95%', '88%', 20, -70, 0], ['bar', '46%', '3%', 70, 50, -30]],
    [['arc', '90%', '4%', 70, -80, 40], ['dot', '4%', '88%', 16, 60, 0], ['ring', '48%', '88%', 38, -50, 120]],
    [['bar', '5%', '4%', 76, 60, 20], ['ring', '94%', '4%', 46, -90, -60], ['dot', '48%', '90%', 22, 70, 0]],
    [['dot', '95%', '5%', 26, -60, 0], ['arc', '3%', '84%', 66, 80, -50], ['bar', '55%', '3%', 60, -40, 30]],
    [['ring', '4%', '5%', 44, 70, 90], ['bar', '88%', '90%', 76, -60, -20], ['dot', '52%', '4%', 18, 50, 0]],
    [['arc', '92%', '4%', 62, -70, 60], ['dot', '3%', '90%', 24, 60, 0], ['ring', '58%', '88%', 38, -80, -90]],
    [['bar', '3%', '4%', 66, 50, 25], ['dot', '96%', '8%', 18, -60, 0], ['arc', '46%', '84%', 66, 70, -40]],
    [['ring', '92%', '4%', 48, -80, 80], ['bar', '4%', '90%', 76, 60, -25], ['dot', '50%', '4%', 22, -50, 0]]
  ];
  var SDc = (window.SD && window.SD.colors) || {};
  var pal = [SDc.sky || '#A8DDE9', SDc.accent || '#D6065F', SDc.pop || '#FFE96B', SDc.violet || '#B04BB5', SDc.leaf || '#5DAA73'];
  scenes.forEach(function(sc, i){
    (shapes[i % shapes.length] || []).forEach(function(d, j){
      var el = document.createElement('i'); el.className = 'deco ' + d[0]; el.setAttribute('aria-hidden', 'true');
      el.style.setProperty('--x', d[1]); el.style.setProperty('--y', d[2]); el.style.setProperty('--s', d[3] + 'px');
      el.style.setProperty('--k', d[4]); el.style.setProperty('--r', d[5]); el.style.setProperty('--c', pal[(i * 2 + j * 3) % pal.length]);
      sc.appendChild(el);
    });
  });

  /* ---------- scroll-linked values ---------- */
  var bar = $('.bar'), ticking = false;
  function onScroll(){
    ticking = false;
    if (bar) bar.classList.toggle('scrolled', window.scrollY > 8);
    scenes.forEach(function(sc){
      var r = sc.getBoundingClientRect();
      if (r.bottom < -240 || r.top > vh + 240) return;
      sc.style.setProperty('--sp', clamp((vh - r.top) / (vh + r.height), 0, 1).toFixed(3));
      var num = $('.num', sc);
      if (num) num.style.setProperty('--fill', (clamp((vh * .88 - r.top) / (r.height * .7), 0, 1) * 100).toFixed(1) + '%');
    });
  }
  window.addEventListener('scroll', function(){ if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive:true });
  window.addEventListener('resize', function(){ vh = window.innerHeight; onScroll(); });
  onScroll();

  /* ---------- pointer effects (desktop only) ---------- */
  if (fine) {
    $$('.btn').forEach(function(b){
      b.addEventListener('pointermove', function(e){
        var r = b.getBoundingClientRect();
        b.style.transform = 'translate(' + ((e.clientX - r.left - r.width / 2) * .22).toFixed(1) + 'px,' + ((e.clientY - r.top - r.height / 2) * .3).toFixed(1) + 'px)';
      });
      b.addEventListener('pointerleave', function(){ b.style.transform = ''; });
    });
    $$('.vwrap').forEach(function(w){
      var v = $('.visual', w); if (!v) return;
      w.addEventListener('pointermove', function(e){
        var r = v.getBoundingClientRect();
        var px = clamp((e.clientX - r.left) / r.width, 0, 1), py = clamp((e.clientY - r.top) / r.height, 0, 1);
        v.style.setProperty('--ry', ((px - .5) * 9).toFixed(2) + 'deg');
        v.style.setProperty('--rx', ((.5 - py) * 7).toFixed(2) + 'deg');
        v.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
        v.style.setProperty('--my', (py * 100).toFixed(1) + '%');
      });
      w.addEventListener('pointerleave', function(){ v.style.setProperty('--rx', '0deg'); v.style.setProperty('--ry', '0deg'); });
    });
    if (hero) hero.addEventListener('pointermove', function(e){
      var r = hero.getBoundingClientRect();
      hero.style.setProperty('--px', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
      hero.style.setProperty('--py', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
    });
  }
})();
