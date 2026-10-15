/* 角落小盆栽：點一下澆水，澆兩次長大一階；開花後再點一下收成。
   進度存在 localStorage 的 fd-plant：{ water, harvest, mini }。 */
(function () {
  'use strict';
  if (window.__fdPlant) return;
  window.__fdPlant = true;

  var STAGES = ['一顆種子', '冒芽了', '長葉子了', '有花苞了', '開花了'];
  var PER_STAGE = 2;          // 澆幾次長一階
  var MAX = 4;                // 0 種子 … 4 開花
  var SLEEP_AFTER = 20000;    // 多久沒動就睡著（毫秒）
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  var state = { water: 0, harvest: 0, mini: false };
  var isNew = true;
  try {
    var raw = localStorage.getItem('fd-plant');
    if (raw) { var s = JSON.parse(raw); isNew = false; state.water = +s.water || 0; state.harvest = +s.harvest || 0; state.mini = !!s.mini; }
  } catch (e) {}
  function save() { try { localStorage.setItem('fd-plant', JSON.stringify(state)); } catch (e) {} }
  function stage() { return Math.min(MAX, Math.floor(state.water / PER_STAGE)); }

  var svg =
    '<svg viewBox="0 0 120 150" aria-hidden="true">' +
      '<g class="drops"><path class="drop" d="M50 8c2 3 3.5 5 3.5 6.6a3.5 3.5 0 0 1-7 0C46.5 13 48 11 50 8Z"/>' +
        '<path class="drop" d="M61 2c2 3 3.5 5 3.5 6.6a3.5 3.5 0 0 1-7 0C57.5 7 59 5 61 2Z"/>' +
        '<path class="drop" d="M71 10c2 3 3.5 5 3.5 6.6a3.5 3.5 0 0 1-7 0C67.5 15 69 13 71 10Z"/></g>' +
      '<g class="lean"><g class="sway">' +
        '<path class="stem" pathLength="100" d="M60 93C60 82 57.5 74 59.5 64C61.5 54 58.5 44 60 32"/>' +
        '<g class="s1 l"><path class="leaf" d="M59 80C54 74 47 74 44 77C47 82 54 83 59 80Z"/></g>' +
        '<g class="s1 r"><path class="leaf" d="M61 80C66 74 73 74 76 77C73 82 66 83 61 80Z"/></g>' +
        '<g class="s2 l"><path class="leaf" d="M59.5 66C52 58 41 59 37 66C43 72 53 72 59.5 66Z"/><path class="leaf-vein" d="M58 66C52 65 46 65 41 66"/></g>' +
        '<g class="s2 r"><path class="leaf" d="M60.5 56C68 48 79 49 83 56C77 62 67 62 60.5 56Z"/><path class="leaf-vein" d="M62 56C68 55 74 55 79 56"/></g>' +
        '<g class="bud"><path class="sepal" d="M60 34c-5-1-8 1-9 4 4 1 7 0 9-4Zm0 0c5-1 8 1 9 4-4 1-7 0-9-4Z"/><ellipse class="bud-body" cx="60" cy="25" rx="6.5" ry="9.5"/></g>' +
        '<g class="flower"><g class="flower-spin">' +
          '<circle class="petal" cx="60" cy="16" r="7.5"/><circle class="petal alt" cx="70.5" cy="23.6" r="7.5"/>' +
          '<circle class="petal" cx="66.5" cy="36" r="7.5"/><circle class="petal alt" cx="53.5" cy="36" r="7.5"/>' +
          '<circle class="petal" cx="49.5" cy="23.6" r="7.5"/></g>' +
          '<circle class="flower-center" cx="60" cy="27.5" r="6.5"/>' +
          '<circle class="flower-face" cx="57.6" cy="26.6" r="1"/><circle class="flower-face" cx="62.4" cy="26.6" r="1"/>' +
        '</g>' +
      '</g></g>' +
      '<ellipse class="seed" cx="60" cy="89.5" rx="5.2" ry="3.8"/>' +
      '<g class="pot">' +
        '<path class="pot-body" d="M33 104h54l-5.6 38.5a4.5 4.5 0 0 1-4.4 3.8H43a4.5 4.5 0 0 1-4.4-3.8Z"/>' +
        '<rect class="pot-rim" x="27" y="91" width="66" height="15" rx="6"/>' +
        '<ellipse class="soil" cx="60" cy="93.5" rx="29" ry="3.6"/>' +
        '<rect class="pot-shine" x="32" y="94" width="14" height="4" rx="2"/>' +
        '<g class="eyes"><circle class="eye" cx="51" cy="120" r="2.8"/><circle class="eye" cx="69" cy="120" r="2.8"/></g>' +
        '<path class="eye-closed" d="M47.5 120q3.5 2.6 7 0M65.5 120q3.5 2.6 7 0"/>' +
        '<ellipse class="blush" cx="44.5" cy="126" rx="4.4" ry="2.5"/><ellipse class="blush" cx="75.5" cy="126" rx="4.4" ry="2.5"/>' +
        '<path class="mouth" d="M56.5 125.5q3.5 3.4 7 0"/>' +
      '</g>' +
      '<text class="zzz" x="84" y="86">z</text><text class="zzz" x="90" y="78">z</text><text class="zzz" x="96" y="70">Z</text>' +
    '</svg>';

  var wrap = document.createElement('div');
  wrap.className = 'fd-plant';
  wrap.innerHTML =
    '<p class="fd-plant-bubble" role="status" aria-live="polite"></p>' +
    '<button class="fd-plant-btn" type="button">' + svg + '</button>' +
    '<button class="fd-plant-min" type="button" aria-label="把小盆栽收起來">×</button>';
  document.body.appendChild(wrap);

  var btn = wrap.querySelector('.fd-plant-btn');
  var minBtn = wrap.querySelector('.fd-plant-min');
  var bubble = wrap.querySelector('.fd-plant-bubble');
  var lean = wrap.querySelector('.lean');

  function render() {
    var st = stage();
    for (var i = 1; i <= MAX; i++) wrap.classList.toggle('g' + i, st >= i);
    wrap.classList.toggle('mini', state.mini);
    btn.setAttribute('aria-label', state.mini
      ? '把小盆栽拉出來'
      : '小盆栽（' + STAGES[st] + '）：' + (st === MAX ? '點一下收成' : '點一下澆水'));
  }

  var bubbleT = 0;
  function say(text, ms) {
    bubble.textContent = text;
    bubble.classList.add('show');
    clearTimeout(bubbleT);
    bubbleT = setTimeout(function () { bubble.classList.remove('show'); }, ms || 2200);
  }

  /* 睡覺：一段時間沒動作就閉眼冒 z */
  var lastActive = Date.now();
  function wake() {
    lastActive = Date.now();
    if (wrap.classList.contains('sleeping')) wrap.classList.remove('sleeping');
  }
  setInterval(function () {
    if (!state.mini && Date.now() - lastActive > SLEEP_AFTER) wrap.classList.add('sleeping');
  }, 2000);
  ['pointerdown', 'keydown', 'scroll'].forEach(function (ev) { addEventListener(ev, wake, { passive: true }); });

  /* 歪頭：滑鼠靠近時，植物往游標那邊斜 */
  if (fine && !reduced) {
    addEventListener('pointermove', function (e) {
      var r = btn.getBoundingClientRect();
      var cx = r.left + r.width / 2, cy = r.top + r.height * .45;
      var dx = e.clientX - cx, dy = e.clientY - cy;
      var near = Math.hypot(dx, dy) < 320;
      if (near) wake();
      var deg = near ? Math.max(-14, Math.min(14, dx / 14)) : 0;
      lean.style.setProperty('--lean', deg.toFixed(1) + 'deg');
    }, { passive: true });
  }

  var busy = false;
  btn.addEventListener('click', function () {
    wake();
    if (state.mini) { state.mini = false; save(); render(); say('我回來了 🌱'); return; }
    if (busy) return;
    var st = stage();
    if (st === MAX) {
      busy = true;
      wrap.classList.add('harvest');
      state.harvest++;
      say('收成 +1 🌸 已經收成 ' + state.harvest + ' 朵', 2800);
      setTimeout(function () {
        wrap.classList.remove('harvest');
        state.water = 0; save(); render();
        busy = false;
      }, reduced ? 0 : 750);
      return;
    }
    busy = true;
    wrap.classList.remove('watering');
    void wrap.offsetWidth;            // 重新觸發水滴動畫
    wrap.classList.add('watering');
    setTimeout(function () {
      state.water++;
      var next = stage();
      save(); render();
      if (next !== st) say(next === MAX ? '開花了！再點一下收成 🌸' : STAGES[next] + '！');
      else say('咕嘟咕嘟 💧');
      busy = false;
    }, reduced ? 0 : 650);
    setTimeout(function () { wrap.classList.remove('watering'); }, 1400);
  });

  minBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    state.mini = true; save(); render();
    btn.focus();
  });

  render();
  if (isNew && !state.mini) setTimeout(function () { say('點我澆水 💧', 4500); }, 2500);
})();
