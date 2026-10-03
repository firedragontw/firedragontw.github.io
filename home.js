(function () {
  'use strict';
  var root = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var A = window.anime || null;
  if (reduced) root.classList.add('reduced');
  if (!A) root.classList.add('no-js');
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ── 主題三態 ── */
  var themeBtns = $$('[data-set-theme]');
  function applyTheme(t) {
    if (t === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t);
    themeBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-set-theme') === t)); });
    try { localStorage.setItem('fd-theme', t); } catch (e) {}
  }
  var saved = 'system';
  try { saved = localStorage.getItem('fd-theme') || 'system'; } catch (e) {}
  if (saved !== 'system') applyTheme(saved);
  themeBtns.forEach(function (b) { b.addEventListener('click', function () { applyTheme(b.getAttribute('data-set-theme')); }); });

  /* ── 文字亂碼還原（reactbits Scrambled Text 風格） ── */
  var GLYPHS = 'abcdefghijklmnopqrstuvwxyz0123456789<>/_-+*#';
  function scramble(el) {
    if (reduced || el.__scr) return;
    var final = el.getAttribute('data-text') || el.textContent;
    el.setAttribute('data-text', final);
    el.__scr = true;
    var frame = 0, total = 18;
    (function tick() {
      var out = '';
      for (var i = 0; i < final.length; i++) {
        var ch = final[i];
        if (ch === ' ' || i < (frame / total) * final.length) out += ch;
        else out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
      el.textContent = out;
      if (frame++ < total) requestAnimationFrame(tick); else { el.textContent = final; el.__scr = false; }
    })();
  }
  $$('[data-scramble]').forEach(function (el) {
    var host = el.closest('a, button') || el;
    host.addEventListener('pointerenter', function () { scramble(el); });
    host.addEventListener('focus', function () { scramble(el); });
  });

  /* ── 聚光燈：游標位置寫進 CSS 變數 ── */
  function trackPointer(el, tilt) {
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      el.style.setProperty('--mx', x + 'px');
      el.style.setProperty('--my', y + 'px');
      if (tilt && !reduced) {
        el.style.setProperty('--ry', ((x / r.width - .5) * 16).toFixed(2) + 'deg');
        el.style.setProperty('--rx', (-(y / r.height - .5) * 16).toFixed(2) + 'deg');
      }
    });
    if (tilt) el.addEventListener('pointerleave', function () { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
  }
  if (fine) {
    $$('.spot').forEach(function (el) { trackPointer(el, false); });
    $$('.fd-tile').forEach(function (el) { trackPointer(el, true); });
  }

  /* ── 游標跟隨光暈 ── */
  var glow = $('.cursor-glow');
  if (glow && fine && !reduced) {
    var gx = innerWidth / 2, gy = innerHeight / 3, tx = gx, ty = gy;
    addEventListener('pointermove', function (e) { tx = e.clientX; ty = e.clientY; glow.classList.add('on'); }, { passive: true });
    document.addEventListener('pointerleave', function () { glow.classList.remove('on'); });
    (function loop() {
      gx += (tx - gx) * .12; gy += (ty - gy) * .12;
      glow.style.transform = 'translate3d(' + gx.toFixed(1) + 'px,' + gy.toFixed(1) + 'px,0)';
      requestAnimationFrame(loop);
    })();
  }

  /* ── 磁吸按鈕（aceternity / reactbits 風格） ── */
  if (A && fine && !reduced) {
    $$('[data-magnetic]').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        A.animate(el, { x: (e.clientX - r.left - r.width / 2) * .28, y: (e.clientY - r.top - r.height / 2) * .38, duration: 250, ease: 'outQuad' });
      });
      el.addEventListener('pointerleave', function () { A.animate(el, { x: 0, y: 0, duration: 800, ease: 'outElastic(1, .5)' }); });
    });
  }

  /* ── 捲動進度條 ── */
  var bar = $('.progress-top');
  function onScroll() {
    var h = document.documentElement.scrollHeight - innerHeight;
    if (bar) bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, scrollY / h) : 0) + ')';
  }
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* ── 跑馬燈：複製一份做無縫循環 ── */
  var track = $('.marquee-track');
  if (track) track.innerHTML += track.innerHTML;

  /* ── Hero 進場（anime.js） ── */
  var title = $('.hero-title');
  if (A && title && !reduced) {
    var split = A.splitText(title, { chars: true });
    var tl = A.createTimeline({ defaults: { ease: 'outExpo' } });
    tl.add('.hero-mark', { scale: [0, 1], rotate: [-25, 0], opacity: [0, 1], duration: 1100, ease: 'outElastic(1, .6)' }, 0)
      .add(split.chars, { translateY: ['1.1em', 0], opacity: [0, 1], rotateX: [-70, 0], duration: 1000, delay: A.stagger(45) }, 200)
      .add('.hero-sub', { opacity: [0, 1], translateY: [14, 0], duration: 800 }, 700)
      .add('.hero-cta > *', { opacity: [0, 1], translateY: [18, 0], duration: 800, delay: A.stagger(120) }, 850)
      .add('.marquee', { opacity: [0, 1], duration: 900 }, 1100);
    A.animate('.hero-mark img', { translateY: [-8, 8], rotate: [-2.5, 2.5], duration: 3200, alternate: true, loop: true, ease: 'inOutSine' });
    split.chars.forEach(function (ch, i) { ch.style.setProperty('--i', i); });
  }

  /* ── 副標題打字機 ── */
  var sub = $('.hero-sub .txt');
  if (sub) {
    var lines = ['偷吃步用網站', '大學與高中的小專案', '學經歷與部落格都在這裡'];
    if (reduced) sub.textContent = lines[0];
    else {
      var li = 0, ci = 0, del = false;
      (function typeTick() {
        var full = lines[li];
        ci += del ? -1 : 1;
        sub.textContent = full.slice(0, ci);
        var wait = del ? 28 : 70;
        if (!del && ci === full.length) { del = true; wait = 1500; }
        else if (del && ci === 0) { del = false; li = (li + 1) % lines.length; wait = 350; }
        setTimeout(typeTick, wait);
      })();
    }
  }

  /* ── 捲動進場：每個區塊、磁磚、時間軸依序出現 ── */
  var cards = $$('.reveal');
  function enter(card) {
    if (!A || reduced) { card.style.opacity = 1; card.style.transform = 'none'; return; }
    A.animate(card, { opacity: [0, 1], translateY: [24, 0], duration: 900, ease: 'outExpo' });
    var kids = $$('.link, .fd-tile, .timeline li, .post, .empty, .group-head', card);
    if (kids.length) A.animate(kids, { opacity: [0, 1], translateX: [-14, 0], duration: 700, delay: A.stagger(55, { start: 150 }), ease: 'outQuart' });
    if (card.id === 'edu') A.animate('.timeline', { '--tl': [0, 1], duration: 1400, ease: 'outQuart' });
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { enter(en.target); io.unobserve(en.target); } });
    }, { threshold: 0.12 });
    cards.forEach(function (c) { io.observe(c); });
  } else cards.forEach(enter);
  if (reduced) $('.timeline') && $('.timeline').style.setProperty('--tl', 1);

  /* ── 部落格文章清單：blog/posts.json ── */
  var host = $('#posts');
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function renderEmpty() {
    host.innerHTML = '<div class="empty"><b>還沒有文章</b><span>第一篇正在醞釀中，之後會放在這裡。</span><span class="fd-dots"><i class="fd-active"></i><i></i><i></i></span></div>';
  }
  fetch('/blog/posts.json', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (posts) {
      if (!Array.isArray(posts) || !posts.length) return renderEmpty();
      host.innerHTML = posts.slice(0, 3).map(function (p) {
        return '<a class="post" href="' + esc(p.url) + '"><b>' + esc(p.title) + '</b><div class="d">' + esc(p.date || '') + '</div>' + (p.summary ? '<p>' + esc(p.summary) + '</p>' : '') + '</a>';
      }).join('');
    })
    .catch(renderEmpty);

  /* ── Discord 點一下複製 ── */
  var dc = $('#discordLink'), tail = $('#discordTail');
  if (dc) dc.addEventListener('click', function (e) {
    e.preventDefault();
    function done(ok) { if (!ok) return; tail.classList.add('copied'); setTimeout(function () { tail.classList.remove('copied'); }, 1600); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText('yihsin725').then(function () { done(true); }, function () { done(false); });
    else done(false);
  });
})();
