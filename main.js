(function () {
  var root = document.documentElement;
  var mqMobile = window.matchMedia('(max-width: 767px)');
  var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var unit = 1, lastWidth = 0;

  // 1u = 1px макета: ширина экрана / 1200 (десктоп) или / 320 (мобилка).
  // Пересчитываем только при смене ширины — на iPhone высота окна «прыгает» вместе с адресной строкой.
  function setUnit() {
    var w = root.clientWidth;
    if (w === lastWidth) return false;
    lastWidth = w;
    unit = w / (mqMobile.matches ? 320 : 1200);
    root.style.setProperty('--u', unit + 'px');
    return true;
  }

  // Стабильная высота экрана (без учёта прячущейся адресной строки)
  var probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100vh;height:100lvh;visibility:hidden;pointer-events:none';
  document.body.appendChild(probe);
  function vh() { return probe.offsetHeight || window.innerHeight; }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function ease(t) { return 1 - Math.pow(1 - t, 3); }
  function activeTree() { return document.querySelector(mqMobile.matches ? '.m' : '.d'); }

  // ---------- «Чем я могу быть полезна?»: экран замирает, карточки въезжают по одной снизу ----------
  var CARD_START = 0.1, CARD_STEP = 0.17, CARD_SLIDE = 0.11;
  function renderHelp(tree, H) {
    var t = tree.querySelector('.help-track');
    var stage = t.firstElementChild;
    var dist = t.offsetHeight - stage.offsetHeight;
    var p = clamp(-t.getBoundingClientRect().top / dist, 0, 1);
    var cards = t.querySelectorAll('.card');
    for (var i = 0; i < cards.length; i++) {
      var k = clamp((p - (CARD_START + i * CARD_STEP)) / CARD_SLIDE, 0, 1);
      if (mqReduce.matches) k = k > 0.5 ? 1 : 0;   // без движения — просто смена
      var par = cards[i].offsetParent;
      var top = cards[i].offsetTop + (par && par !== stage ? par.offsetTop : 0);
      var off = stage.offsetHeight - top + 10;   // целиком ниже края сцены
      cards[i].style.transform = 'translateY(' + ((1 - ease(k)) * off) + 'px)';
    }
  }

  // ---------- Кейсы: раскрываются, когда доходят до середины экрана; закрываются, когда наезжает следующий ----------
  function renderCases(tree, H) {
    var cs = tree.querySelectorAll('.case');
    var tops = [];
    for (var i = 0; i < cs.length; i++) tops.push(cs[i].getBoundingClientRect().top);
    for (var j = 0; j < cs.length; j++) {
      var next = j + 1 < cs.length ? tops[j + 1] : Infinity;
      var open = tops[j] < H * 0.55 && next > H * 0.4;
      if (cs[j].classList.contains('open') !== open) cs[j].classList.toggle('open', open);
      cs[j]._visible = tops[j] < H && next > 0;
    }
  }

  // ---------- Смена фото в кейсах: каждый слот раз в 3 с, нижний со сдвигом 1,5 с; только кейсы на экране ----------
  var tick = 0;
  function showPhoto(slot, n) {
    var imgs = slot.querySelectorAll('img');
    var cur = slot.querySelector('img.on');
    var nxt = imgs[n % imgs.length];
    if (!nxt || nxt === cur) return;
    if (cur) { cur.classList.remove('on'); cur.classList.add('was'); }
    nxt.classList.remove('was');
    nxt.classList.add('on');
    if (!nxt.alt && cur) { nxt.alt = cur.alt; cur.alt = ''; }
    setTimeout(function () { if (cur && !cur.classList.contains('on')) cur.classList.remove('was'); }, 1000);
  }
  setInterval(function () {
    if (document.hidden || mqReduce.matches) return;
    tick++;
    var slotIdx = tick % 2;                  // по очереди: верхний, через 1,5 с нижний
    activeTree().querySelectorAll('.case').forEach(function (c) {
      if (!c._visible) return;
      var slots = c.querySelectorAll('.ph');
      var slot = slots[slotIdx];
      if (!slot) return;
      c._step = c._step || [0, 0];
      c._step[slotIdx] += 2;
      showPhoto(slot, slotIdx + c._step[slotIdx]);
    });
  }, 1500);

  // ---------- Появления: каждый блок проигрывается один раз, когда въезжает в экран ----------
  if (mqReduce.matches) root.classList.add('rm');

  function countUp(sec) {
    var c = sec.querySelector('.cnt'), plus = sec.querySelector('.plus');
    if (!c || c._done) return; c._done = true;
    var to = parseInt(c.dataset.to, 10), t0 = null, dur = 1100;
    if (mqReduce.matches) { c.textContent = to; plus.classList.add('on'); return; }
    c.textContent = '0';
    function step(ts) {
      if (!t0) t0 = ts;
      var k = Math.min(1, (ts - t0) / dur);
      c.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step); else plus.classList.add('on');
    }
    setTimeout(function () { requestAnimationFrame(step); }, 250);
  }
  // до появления на экране «40+» показывает 0
  document.querySelectorAll('.base .cnt').forEach(function (c) { if (!mqReduce.matches) c.textContent = '0'; });

  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      en.target.classList.add('in');
      if (en.target.classList.contains('base')) countUp(en.target);
      io.unobserve(en.target);
    });
  }, { rootMargin: '0px 0px -20% 0px', threshold: 0 }) : null;
  document.querySelectorAll('.rv').forEach(function (el) {
    if (io) io.observe(el); else { el.classList.add('in'); if (el.classList.contains('base')) countUp(el); }
  });

  // Первый экран собирается после загрузки шрифтов (не дольше 0,6 с ожидания)

  // Голубые плашки в «Обо мне»: подгоняем под реальную ширину выделенных слов.
  // На Mac (Helvetica Neue) получается ровно как в Figma, на Windows — по запасному шрифту.
  function fitHL() {
    document.querySelectorAll('.about').forEach(function (sec) {
      var rs = sec.querySelectorAll('.hlr'), hs = sec.querySelectorAll('.hl');
      for (var i = 0; i < rs.length && i < hs.length; i++) {
        var r = rs[i], box = hs[i].getClientRects()[0], par = r.offsetParent;
        if (!box || !par) continue;
        var pl = parseFloat(r.getAttribute('data-pl')) || 0, pr = parseFloat(r.getAttribute('data-pr')) || 0;
        var x = (box.left - par.getBoundingClientRect().left - par.clientLeft) / unit - pl;
        var w = box.width / unit + pl + pr;
        r.style.left = 'calc(' + x.toFixed(2) + ' * var(--u))';
        r.style.width = 'calc(' + w.toFixed(2) + ' * var(--u))';
      }
    });
  }
  function intro() { document.querySelectorAll('.rv-intro').forEach(function (h) { h.classList.add('in'); }); }
  var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  Promise.race([fontsReady, new Promise(function (r) { setTimeout(r, 600); })]).then(function () { fitHL(); requestAnimationFrame(intro); });
  fontsReady.then(fitHL);

  var ticking = false;
  function render() {
    ticking = false;
    var tree = activeTree(), H = vh();
    renderHelp(tree, H);
    renderCases(tree, H);
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(render); } }
  function onResize() { if (setUnit()) fitHL(); render(); }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  setUnit();
  fitHL();
  render();
})();
