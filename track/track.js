/* 軌道車模擬器：照實體原型的狀態機（等待起點 → 前進中 → 後退中 → 任務完成）
   顏色感測、盲跑、可疑二次確認、取樣次數都照報告裡的做法模擬。 */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var $ = function (id) { return document.getElementById(id); };

  /* ── 尺寸（單位：mm，畫面上乘 K） ── */
  var SEG = 400;            // 一段軌道 40 cm
  var K = 0.45;             // mm → 畫面單位
  var X0 = 112;             // 軌道起點（左邊是補給站）
  var BEAM_Y = 118;         // 軌道頂面
  var GROUND_Y = 296;
  var STICKER = 20;         // 貼紙寬 2 cm
  var START_AT = 30, END_GAP = 30;
  var PLANTS = ['番茄', '九層塔', '薄荷'];
  var COLORS = { g: '綠 起點', y: '黃 中繼站', r: '紅 終點', w: '木頭 背景', '?': '混色 無法判斷' };
  var RGB = { g: [62, 171, 98], y: [231, 206, 58], r: [219, 61, 64], w: [196, 160, 118], '?': [150, 130, 100] };

  var layout = { segs: 5, stations: [1, 2, 3] };   // 第一段是起點段、最後一段是終點段，不放中繼站
  var svg = $('scene');
  var el = {};               // 動態元素
  var sim = null;            // 這一趟的狀態
  var stats = { runs: 0, oks: 0 };

  function mk(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function trackLen() { return layout.segs * SEG; }
  function sx(mm) { return X0 + mm * K; }
  function stationPos() {
    return layout.stations.slice().sort(function (a, b) { return a - b; })
      .map(function (i, k) { return { seg: i, at: i * SEG + SEG / 2, plant: PLANTS[k % PLANTS.length], idx: k }; });
  }

  /* ── 畫場景 ── */
  function draw() {
    var L = trackLen(), W = sx(L) + 40;
    svg.setAttribute('viewBox', '0 8 ' + W + ' 328');
    svg.innerHTML = '';
    var defs = mk('defs', {}, svg);
    var g = mk('radialGradient', { id: 'sensorGlow', cx: '50%', cy: '0%', r: '80%' }, defs);
    mk('stop', { offset: '0%', 'stop-color': '#c9a6ff', 'stop-opacity': '.9' }, g);
    mk('stop', { offset: '100%', 'stop-color': '#c9a6ff', 'stop-opacity': '0' }, g);

    mk('rect', { class: 'ground', x: 0, y: GROUND_Y, width: W, height: 40 }, svg);
    // 補給站
    mk('rect', { class: 'depot', x: 18, y: 70, width: 82, height: GROUND_Y - 70, rx: 8 }, svg);
    var t1 = mk('text', { class: 'depot-t', x: 59, y: 160, 'text-anchor': 'middle' }, svg); t1.textContent = '補給站';
    var t2 = mk('text', { class: 'lbl', x: 59, y: 178, 'text-anchor': 'middle' }, svg); t2.textContent = '起點/終點';
    // 支架
    for (var i = 0; i <= layout.segs; i++) {
      mk('rect', { class: 'support', x: sx(i * SEG) - 5, y: BEAM_Y + 14, width: 10, height: GROUND_Y - BEAM_Y - 14 }, svg);
    }
    // 軌道本體
    mk('rect', { class: 'beam', x: X0, y: BEAM_Y, width: L * K, height: 14, rx: 2 }, svg);
    mk('rect', { class: 'beam-top', x: X0, y: BEAM_Y, width: L * K, height: 4 }, svg);
    mk('rect', { class: 'rail', x: X0, y: BEAM_Y + 14, width: L * K, height: 2 }, svg);
    for (i = 1; i < layout.segs; i++) mk('rect', { class: 'joint', x: sx(i * SEG) - 6, y: BEAM_Y + 4, width: 12, height: 10, rx: 2 }, svg);
    // 每段可點：新增／拿掉中繼站
    var t0 = mk('text', { class: 'lbl', x: sx(SEG / 2), y: BEAM_Y - 34, 'text-anchor': 'middle' }, svg); t0.textContent = '起點段';
    var t9 = mk('text', { class: 'lbl', x: sx(L - SEG / 2), y: BEAM_Y - 34, 'text-anchor': 'middle' }, svg); t9.textContent = '終點段';
    for (i = 1; i < layout.segs - 1; i++) {
      var hit = mk('rect', { class: 'seg-hit', x: sx(i * SEG) + 2, y: BEAM_Y - 26, width: SEG * K - 4, height: 60, rx: 6, 'data-seg': i, tabindex: 0, role: 'button' }, svg);
      hit.setAttribute('aria-label', '第 ' + (i + 1) + ' 段軌道：' + (layout.stations.indexOf(i) >= 0 ? '拿掉中繼站' : '加一個中繼站'));
    }
    // 貼紙
    function sticker(at, c) { mk('rect', { class: 'sticker ' + c, x: sx(at) - STICKER * K / 2, y: BEAM_Y - 1, width: STICKER * K, height: 5, rx: 1 }, svg); }
    sticker(START_AT, 'g');
    sticker(L - END_GAP, 'r');
    // 中繼站＋植物
    el.plants = [];
    stationPos().forEach(function (st) {
      sticker(st.at, 'y');
      var x = sx(st.at);
      var big = mk('g', { transform: 'translate(' + x + ',' + GROUND_Y + ') scale(1.35) translate(' + (-x) + ',' + (-GROUND_Y) + ')' }, svg);
      var p = mk('g', { class: 'plant thirsty' }, big);
      drawPlant(p, st.plant, x);
      mk('rect', { class: 'pot', x: x - 15, y: GROUND_Y - 24, width: 30, height: 24, rx: 3 }, big);
      mk('rect', { class: 'pot-rim', x: x - 17, y: GROUND_Y - 26, width: 34, height: 6, rx: 2 }, big);
      var tt = mk('text', { class: 'ptxt', x: x, y: GROUND_Y + 16, 'text-anchor': 'middle' }, svg); tt.textContent = st.plant;
      mk('rect', { class: 'meter-bg', x: x - 18, y: GROUND_Y + 22, width: 36, height: 4, rx: 2 }, svg);
      var m = mk('rect', { class: 'meter', x: x - 18, y: GROUND_Y + 22, width: 0, height: 4, rx: 2 }, svg);
      el.plants.push({ g: p, meter: m, at: st.at, name: st.plant, water: 0 });
    });
    // 車
    el.cart = mk('g', { class: 'cart' }, svg);
    var cart = mk('g', { transform: 'translate(0,' + BEAM_Y + ') scale(1.45) translate(0,' + (-BEAM_Y) + ')' }, el.cart);
    mk('path', { class: 'beamlight', d: 'M-6 0 L6 0 L14 24 L-14 24 Z', transform: 'translate(0,' + (BEAM_Y - 4) + ') scale(1,-1) translate(0,-4)' }, cart);
    el.pipe = mk('line', { class: 'nozzle', x1: 8, y1: BEAM_Y - 30, x2: 8, y2: BEAM_Y + 26 }, cart);
    mk('rect', { class: 'cart-body', x: -38, y: BEAM_Y - 34, width: 76, height: 32, rx: 4 }, cart);
    mk('rect', { class: 'cart-tank', x: -14, y: BEAM_Y - 54, width: 28, height: 20, rx: 3 }, cart);
    mk('rect', { class: 'cart-tank-o', x: -14, y: BEAM_Y - 54, width: 28, height: 20, rx: 3 }, cart);
    mk('rect', { class: 'sensor', x: -5, y: BEAM_Y - 4, width: 10, height: 4, rx: 1 }, cart);
    [-28, 28].forEach(function (dx) {
      mk('circle', { class: 'wheel', cx: dx, cy: BEAM_Y - 2, r: 5 }, cart);
      mk('circle', { class: 'wheel-hub', cx: dx, cy: BEAM_Y - 2, r: 1.6 }, cart);
      mk('circle', { class: 'wheel', cx: dx - 5, cy: BEAM_Y + 13, r: 3.4 }, cart);
      mk('circle', { class: 'wheel', cx: dx + 5, cy: BEAM_Y + 13, r: 3.4 }, cart);
    });
    el.arrow = mk('path', { class: 'arrow', d: 'M0 0 L10 6 L0 12 Z', transform: 'translate(-5,' + (BEAM_Y - 74) + ')', style: 'display:none' }, cart);
    el.drops = mk('g', {}, svg);
    el.alert = mk('text', { class: 'alert', x: 0, y: BEAM_Y - 64, 'text-anchor': 'middle' }, svg);
    placeCart(sim ? sim.s : START_AT - 7);
    svg.querySelectorAll('.seg-hit').forEach(function (h) {
      h.addEventListener('click', function () { toggleStation(+h.getAttribute('data-seg')); });
      h.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleStation(+h.getAttribute('data-seg')); } });
    });
    $('btnAdd').disabled = layout.segs >= 8;
    $('btnRemove').disabled = layout.segs <= 3;
  }

  function drawPlant(p, kind, x) {
    var top = GROUND_Y - 24;
    if (kind === '番茄') {
      mk('path', { class: 'stem', d: 'M' + x + ' ' + top + ' C' + (x - 2) + ' ' + (top - 20) + ' ' + (x + 3) + ' ' + (top - 34) + ' ' + x + ' ' + (top - 52) }, p);
      [[-9, -26, -30], [9, -38, 30], [-8, -46, -25]].forEach(function (l) { mk('ellipse', { class: 'lf', cx: x + l[0], cy: top + l[1], rx: 8, ry: 4, transform: 'rotate(' + l[2] + ' ' + (x + l[0]) + ' ' + (top + l[1]) + ')' }, p); });
      [[5, -22], [-5, -36], [6, -48]].forEach(function (f) { mk('circle', { class: 'fruit', cx: x + f[0], cy: top + f[1], r: 4.2 }, p); });
    } else if (kind === '九層塔') {
      mk('path', { class: 'stem', d: 'M' + x + ' ' + top + ' L' + x + ' ' + (top - 46) }, p);
      for (var i = 0; i < 4; i++) {
        var y = top - 12 - i * 10, w = 11 - i * 2;
        mk('ellipse', { class: 'basil', cx: x - w / 2 - 1, cy: y, rx: w / 2 + 2, ry: 3.6, transform: 'rotate(-18 ' + (x - w / 2) + ' ' + y + ')' }, p);
        mk('ellipse', { class: 'basil', cx: x + w / 2 + 1, cy: y, rx: w / 2 + 2, ry: 3.6, transform: 'rotate(18 ' + (x + w / 2) + ' ' + y + ')' }, p);
      }
    } else {
      [[-7, -8], [7, -8], [0, -18], [-9, -22], [9, -22], [-4, -32], [5, -32], [0, -40]].forEach(function (c) {
        mk('circle', { class: 'mint', cx: x + c[0], cy: top + c[1], r: 6 }, p);
      });
      mk('path', { class: 'stem', d: 'M' + x + ' ' + top + ' L' + x + ' ' + (top - 30), 'stroke-width': 2 }, p);
    }
  }

  var wrapEl = svg.parentNode;
  function placeCart(s) {
    var x = sx(s);
    el.cart.setAttribute('transform', 'translate(' + x.toFixed(1) + ',0)');
    el.alert.setAttribute('x', x.toFixed(1));
    // 手機上畫面比軌道窄：讓視窗跟著車子走
    if (sim && sim.running && wrapEl.scrollWidth > wrapEl.clientWidth + 4) {
      var px = x / svg.viewBox.baseVal.width * wrapEl.scrollWidth;
      wrapEl.scrollLeft = px - wrapEl.clientWidth / 2;
    }
  }

  function toggleStation(i) {
    if (sim && sim.running) return;
    var k = layout.stations.indexOf(i);
    if (k >= 0) layout.stations.splice(k, 1); else layout.stations.push(i);
    sim = null; draw(); setState('idle'); verdict('軌道改好了，按 RESET 跑跑看', '');
  }

  /* ── 介面 ── */
  var logEl = $('log');
  function log(msg, cls) {
    var t = sim ? (sim.t / 1000).toFixed(2) : '0.00';
    var line = document.createElement('span');
    if (cls) line.className = cls;
    line.textContent = '[' + ('      ' + t).slice(-6) + 's] ' + msg + '\n';
    logEl.appendChild(line);
    while (logEl.childNodes.length > 120) logEl.removeChild(logEl.firstChild);
    logEl.scrollTop = logEl.scrollHeight;
  }
  function setState(st, sub, err) {
    document.querySelectorAll('.st').forEach(function (s) {
      var on = s.getAttribute('data-st') === st;
      s.classList.toggle('on', on && !err);
      s.classList.toggle('err', on && !!err);
    });
    $('subState').textContent = sub || '';
  }
  function verdict(text, kind) {
    var v = $('verdict');
    v.textContent = text;
    v.className = 'verdict' + (kind ? ' ' + kind : '');
  }
  function opts() {
    return {
      blind: $('optBlind').checked,
      check: $('optCheck').checked,
      samples: $('optSamples').checked ? 3 : 5,
      noise: $('optNoise').checked,
      scale: $('optFast').checked ? 2 : 1,
      speed: +$('speed').value
    };
  }
  function lockUI(running) {
    svg.classList.toggle('running', running);
    $('btnAdd').disabled = running || layout.segs >= 8;
    $('btnRemove').disabled = running || layout.segs <= 3;
    $('btnReset').textContent = running ? '↺ RESET 重來' : '▶ RESET 開始任務';
  }

  /* ── 感測 ── */
  function colorAt(s) {
    var L = trackLen();
    if (Math.abs(s - START_AT) <= STICKER / 2) return 'g';
    if (Math.abs(s - (L - END_GAP)) <= STICKER / 2) return 'r';
    var st = stationPos();
    for (var i = 0; i < st.length; i++) if (Math.abs(s - st[i].at) <= STICKER / 2) return 'y';
    return 'w';
  }
  function rgbOf(c) {
    var b = RGB[c];
    return b.map(function (v) { return Math.max(0, Math.min(255, Math.round(v + (Math.random() - .5) * 16))); });
  }
  // 一個取樣窗結束：看這段時間感測器底下最多的是什麼顏色
  function finishWindow() {
    var w = sim.win, total = 0, best = 'w', bestV = 0;
    for (var c in w.acc) { total += w.acc[c]; if (w.acc[c] > bestV) { bestV = w.acc[c]; best = c; } }
    var read = total && bestV / total >= .7 ? best : '?';
    var still = sim.state === 'check';           // 停下來讀比較穩
    if (sim.o.noise) {
      if (read !== 'w' && read !== '?' && Math.random() < (still ? .06 : .14)) read = pick(['g', 'y', 'r', 'w'].filter(function (x) { return x !== read; }));
      else if (read === 'w' && Math.random() < (still ? .005 : .02)) read = pick(['g', 'y', 'r']);
    }
    if (sim.o.noise && Math.random() < .015) log('RGB(1436, 88, 91) 超過上限，丟掉這筆', 'd');
    sim.win = { t: 0, acc: {} };
    return read;
  }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  /* ── 一趟任務 ── */
  function start() {
    draw();
    var o = opts();
    sim = {
      running: true, t: 0, s: START_AT - 7, dir: 0, state: 'idle', o: o,
      win: { t: 0, acc: {} }, blindT: 0, timer: 0, check: null,
      reachedEnd: false, wasted: 0, fail: null, lastRead: null
    };
    el.plants.forEach(function (p) { p.water = 0; p.g.classList.add('thirsty'); p.meter.setAttribute('width', 0); });
    logEl.textContent = '';
    log('Arduino 重新啟動，TCS3200 LED 亮度 PWM=90', 's');
    log('取樣 ' + o.samples + ' 次／盲跑 ' + (o.blind ? '開' : '關') + '／二次確認 ' + (o.check ? '開' : '關') + (o.noise ? '／光線干擾中' : ''), 'd');
    setState('idle', '等待起點貼紙…');
    verdict('跑步中…', '');
    lockUI(true);
    last = 0;
    requestAnimationFrame(loop);
  }
  function stop(msg) {
    if (!sim) return;
    sim.running = false;
    el.cart.classList.remove('reading');
    lockUI(false);
    if (msg) { log(msg, 'w'); setState('idle', '已停止'); verdict('手動停止', ''); }
  }

  function move(dir) { sim.dir = dir; el.arrow.setAttribute('transform', 'translate(' + (dir < 0 ? 5 : -5) + ',' + (BEAM_Y - 74) + ') scale(' + (dir < 0 ? -1 : 1) + ',1)'); el.arrow.style.display = dir ? '' : 'none'; }

  function act(read) {
    var S = sim;
    if (read === '?' || read === 'w') return;
    var rgb = rgbOf(read);
    if (S.state === 'fwd' || S.state === 'back') {
      if (S.blindT > 0) return;
      if (S.state === 'back' && read !== 'g') return;          // 回程略過中繼站
      log('RGB(' + rgb.join(', ') + ') → ' + COLORS[read]);
      if (S.o.check) {
        // 剎車：感測器停回剛剛讀到貼紙的位置（取樣窗的中間）
        S.s -= S.dir * S.o.speed * S.o.samples * 25 / 2000;
        move(0); S.check = { first: read, votes: [read], need: 2, from: S.state };
        S.prev = S.state; S.state = 'check';
        setState(S.prev, '停車確認中…');
        log('可疑停點，停車再讀一次', 'w');
        return;
      }
      decide(read, S.state);
    } else if (S.state === 'idle' && read === 'g') {
      log('RGB(' + rgb.join(', ') + ') → ' + COLORS.g);
      log('確認起點，出發！', 's');
      S.state = 'fwd'; setState('fwd', S.o.blind ? '盲跑 1.5 秒' : ''); move(1);
      if (S.o.blind) S.blindT = 1500;
    }
  }

  function decide(c, from) {
    var S = sim;
    if (from === 'fwd') {
      if (c === 'y') { S.state = 'water'; S.timer = 3000; move(0); setState('fwd', '澆水 3 秒 💧'); log('中繼站，抽水馬達 ON（PUMP_RUN_MS=3000）', 's'); return; }
      if (c === 'r') { S.reachedEnd = true; S.state = 'back'; setState('back', S.o.blind ? '盲跑 1.5 秒' : ''); move(-1); if (S.o.blind) S.blindT = 1500; log('到達終點，轉為後退模式', 's'); return; }
      if (c === 'g') { finish('偵測到起點，判定任務完成'); return; }
    } else if (from === 'back') {
      if (c === 'g') { finish('回到起點，任務完成'); return; }
    }
    resume(from);
  }
  function resume(from) {
    var S = sim;
    S.state = from; move(from === 'back' ? -1 : 1);
    setState(from, S.o.blind ? '盲跑 1.5 秒' : '');
    if (S.o.blind) S.blindT = 1500;
  }

  function finish(msg, crash) {
    var S = sim;
    move(0);
    S.state = 'done';
    log(msg, crash ? 'e' : 's');
    stop();
    var problems = [];
    if (crash) problems.push(crash);
    if (!S.reachedEnd && !crash) problems.push('還沒到終點就結束了');
    el.plants.forEach(function (p) {
      if (p.water === 0) problems.push(p.name + '沒澆到水');
      else if (p.water > 1) problems.push(p.name + '澆了 ' + p.water + ' 次');
    });
    if (S.wasted) problems.push('有 ' + S.wasted + ' 次澆到空地');
    stats.runs++;
    if (!problems.length) {
      stats.oks++;
      verdict('成功！每個中繼站都剛好澆一次 🌱', 'ok');
      setState('done', (S.t / 1000).toFixed(1) + ' 秒完成');
    } else {
      verdict('失敗：' + problems.join('、'), 'bad');
      setState('done', '有問題', true);
    }
    $('runs').textContent = stats.runs;
    $('oks').textContent = stats.oks;
    $('rate').textContent = Math.round(stats.oks / stats.runs * 100) + '%';
  }

  var last = 0;
  function loop(now) {
    if (!sim || !sim.running) return;
    var total = (last ? Math.min(50, now - last) : 16) * sim.o.scale;
    last = now;
    // 切成 5 ms 的小步來算，畫面卡頓或快轉時感測才不會跳過貼紙
    while (total > 0 && sim && sim.running) {
      var step = Math.min(5, total);
      total -= step;
      tick(step);
    }
    if (sim && sim.running) { placeCart(sim.s); requestAnimationFrame(loop); }
  }

  function tick(dt) {
    var S = sim;
    S.t += dt;

    // 移動
    if (S.dir) {
      S.s += S.dir * S.o.speed * dt / 1000;
      var L = trackLen();
      if (S.s >= L - 4) { S.s = L - 4; placeCart(S.s); finish('沒偵測到終點，衝出軌道末端！', '衝出軌道末端'); return; }
      if (S.s <= -30) { S.s = -30; placeCart(S.s); finish('沒偵測到起點，撞上補給站！', '撞上補給站'); return; }
    }
    if (S.blindT > 0) { S.blindT -= dt; if (S.blindT <= 0) { S.blindT = 0; $('subState').textContent = ''; } }

    // 澆水
    if (S.state === 'water') {
      S.timer -= dt;
      spray(true);
      if (S.timer <= 0) {
        spray(false);
        var near = el.plants.filter(function (p) { return Math.abs(p.at - S.s) < 45; })[0];
        if (near) {
          near.water++;
          near.g.classList.remove('thirsty');
          near.meter.setAttribute('width', Math.min(36, near.water * 26));
          log('抽水馬達 OFF，' + near.name + '澆好了' + (near.water > 1 ? '（第 ' + near.water + ' 次）' : ''), near.water > 1 ? 'w' : 's');
        } else { S.wasted++; log('抽水馬達 OFF……但下面沒有植物', 'e'); }
        resume('fwd');
      }
    }

    // 感測：停車確認時讀得比較準（靜止不動）
    var reading = S.state !== 'water' && S.state !== 'done';
    el.cart.classList.toggle('reading', reading && S.blindT <= 0);
    if (reading) {
      var c = colorAt(S.s);
      S.win.acc[c] = (S.win.acc[c] || 0) + dt;
      S.win.t += dt;
      if (S.win.t >= S.o.samples * 25) {
        var r = finishWindow();
        if (S.state === 'check') {
          S.check.votes.push(r);
          if (S.check.votes.length > S.check.need) {
            var cnt = {}; S.check.votes.forEach(function (v) { cnt[v] = (cnt[v] || 0) + 1; });
            var top = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; })[0];
            if (top === S.check.first) { log('二次確認：' + COLORS[top] + ' ✓', 's'); decide(top, S.check.from); }
            else if (top !== 'w' && top !== '?' && !(S.check.from === 'back' && top !== 'g')) { log('二次確認：其實是' + COLORS[top] + '，照多數的讀值走', 'w'); decide(top, S.check.from); }
            else { log('二次確認：其實是' + COLORS[top] + '，剛剛是誤判，繼續走', 'w'); S.state = S.check.from; move(S.check.from === 'back' ? -1 : 1); setState(S.check.from, ''); }
          }
        } else act(r);
      }
    }
  }

  // 水滴：從噴嘴往下掉到花盆
  var dropEls = [];
  function spray(on) {
    if (!on) { dropEls.forEach(function (d) { d.remove(); }); dropEls = []; return; }
    if (dropEls.length < 7 && Math.random() < .12) {
      dropEls.push(mk('circle', { class: 'drop', cx: sx(sim.s) + 8 * 1.45 + (Math.random() - .5) * 6, cy: BEAM_Y + 40, r: 2.6 }, el.drops));
    }
    dropEls = dropEls.filter(function (d) {
      var y = +d.getAttribute('cy') + 1.1;
      if (y > GROUND_Y - 36) { d.remove(); return false; }
      d.setAttribute('cy', y); return true;
    });
  }

  /* ── 綁定 ── */
  $('btnReset').addEventListener('click', function () { if (sim && sim.running) stop(); start(); });
  $('btnStop').addEventListener('click', function () { stop('手動停止'); spray(false); });
  $('btnAdd').addEventListener('click', function () { if (layout.segs < 8) { layout.segs++; layout.stations.push(layout.segs - 2); sim = null; draw(); log('接上第 ' + layout.segs + ' 段軌道（卡榫固定）', 'd'); } });
  $('btnRemove').addEventListener('click', function () {
    if (layout.segs > 3) {
      layout.segs--;
      layout.stations = layout.stations.filter(function (i) { return i < layout.segs - 1; });
      sim = null; draw(); log('拆掉最後一段軌道', 'd');
    }
  });
  $('speed').addEventListener('input', function () {
    $('speedOut').textContent = this.value + ' mm/s';
    if (sim) sim.o.speed = +this.value;
  });
  ['optBlind', 'optCheck', 'optSamples', 'optNoise', 'optFast'].forEach(function (id) {
    $(id).addEventListener('change', function () {
      if (sim && sim.running) { var o = opts(); sim.o.scale = o.scale; sim.o.noise = o.noise; }
    });
  });

  draw();
  setState('idle', '按 RESET 開始');
  log('準備好了，按「RESET 開始任務」', 'd');

  // 成本長條：捲到才長出來
  var cost = $('cost');
  if (cost && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { cost.classList.add('in'); io.disconnect(); } }); }, { threshold: .3 });
    io.observe(cost);
  } else if (cost) cost.classList.add('in');
})();
