/* Alicerce — app.js
 * Orquestra a interface: projetos, telas, histórico (desfazer/refazer), persistência,
 * arquivos (File System Access), Clipboard, Web Share, Badging, temas, diálogos e PWA.
 */
(function () {
  'use strict';

  var E = window.AlicerceEngine;
  var S = window.AlicerceStorage;
  var COMPONENTS = E.COMPONENTS;
  var VIEWPORTS = E.VIEWPORTS;

  var $ = function (id) { return document.getElementById(id); };
  var clamp = function (v, a, b) { return Math.min(Math.max(v, a), b); };

  var THEMES = [
    { id: 'original', name: 'Original', sub: 'Harmonia análoga', grad: 'linear-gradient(135deg, #29243C 0%, #35243C 50%, #3C2437 100%)' },
    { id: 'sobrio', name: 'Sóbrio', sub: 'Harmonia monocromática', grad: 'linear-gradient(135deg, #2098AE 0%, #156372 50%, #3BC2DB 100%)' },
    { id: 'hawaii', name: 'Hawaii', sub: 'Harmonia análoga', grad: 'linear-gradient(135deg, #FF7800 0%, #FFF700 50%, #87FF00 100%)' },
    { id: 'groenlandia', name: 'Groenlândia', sub: 'Harmonia análoga', grad: 'linear-gradient(135deg, #007299 0%, #002699 50%, #270099 100%)' }
  ];

  var FILE_TYPES = [{
    description: 'Projeto Alicerce (.alicerce, .json)',
    accept: { 'application/json': ['.alicerce', '.json'] }
  }];

  var HISTORY_LIMIT = 100;

  var state = {
    snippets: [],
    project: null,
    hist: { stack: [], idx: 0 },
    lastTag: null,
    lastTagTime: 0,
    saveTimer: null,
    dirty: false,
    chain: Promise.resolve(),
    saveErrorShown: false,
    autoFit: true,
    fitting: false,
    handles: new Map(),
    clip: '',
    deferredPrompt: null,
    drawerOpen: false,
    suppressClick: false
  };

  var engine = null;

  /* ================================================================== utilidades */
  function ls(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) { /* localStorage indisponível */ }
    return null;
  }

  function toast(msg, kind) {
    var t = document.createElement('div');
    t.className = 'toast' + (kind === 'error' ? ' toast-error' : '');
    t.textContent = msg;
    $('toasts').appendChild(t);
    setTimeout(function () { t.remove(); }, kind === 'error' ? 7000 : 3600);
  }

  function announce(msg) {
    var r = $('sr-live');
    r.textContent = '';
    setTimeout(function () { r.textContent = msg; }, 30);
  }

  function slug(text) {
    return String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'projeto';
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function dateStamp(d) { d = d || new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }

  function svgIcon(id, cls) {
    var NS = 'http://www.w3.org/2000/svg';
    var sv = document.createElementNS(NS, 'svg');
    sv.setAttribute('class', cls || 'icon');
    sv.setAttribute('aria-hidden', 'true');
    var u = document.createElementNS(NS, 'use');
    u.setAttribute('href', '#' + id);
    sv.appendChild(u);
    return sv;
  }

  function setDisabled(id, v) { var n = $(id); if (n) n.disabled = !!v; }

  function downloadBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { a.remove(); URL.revokeObjectURL(url); }, 4000);
  }

  function canvasToBlob(canvas) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (b) { b ? resolve(b) : reject(new Error('Não foi possível gerar a imagem (projeto grande demais).')); }, 'image/png');
    });
  }

  function errMsg(e) { return (e && e.message) ? e.message : String(e); }

  /* ================================================================== modelo de projeto */
  function createProject(name, viewport) {
    var now = Date.now();
    var sid = E.uid();
    return {
      id: E.uid(),
      name: name,
      viewport: viewport === 'desktop' ? 'desktop' : 'mobile',
      screens: [{ id: sid, name: 'Home', elements: [] }],
      activeScreenId: sid,
      createdAt: now,
      updatedAt: now,
      version: 1
    };
  }

  function str(v, max, fallback) {
    v = typeof v === 'string' ? v.trim() : '';
    return v ? v.slice(0, max) : fallback;
  }
  function numIn(v, a, b, d) { v = Number(v); return isFinite(v) ? clamp(v, a, b) : d; }

  /* Valida e sanitiza qualquer projeto vindo de arquivo/backup */
  function normalizeProject(raw) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.screens) || !raw.screens.length) {
      throw new Error('o arquivo não contém um projeto do Alicerce (nenhuma tela encontrada).');
    }
    var now = Date.now();
    var usedScreens = new Set();
    var screens = raw.screens.slice(0, 200).map(function (sc, i) {
      sc = sc && typeof sc === 'object' ? sc : {};
      var id = str(sc.id, 100, '');
      if (!id || usedScreens.has(id)) id = E.uid();
      usedScreens.add(id);
      var usedEls = new Set();
      var els = (Array.isArray(sc.elements) ? sc.elements : []).slice(0, 5000).filter(function (e) {
        return e && typeof e === 'object' && COMPONENTS[e.type];
      }).map(function (e) {
        var eid = str(e.id, 100, '');
        if (!eid || usedEls.has(eid)) eid = E.uid();
        usedEls.add(eid);
        return {
          id: eid,
          type: e.type,
          x: numIn(e.x, -8000, 8000, 0),
          y: numIn(e.y, -8000, 8000, 0),
          w: numIn(e.w, E.MIN_SIZE, 8000, COMPONENTS[e.type].w),
          h: numIn(e.h, 4, 8000, COMPONENTS[e.type].h),
          text: typeof e.text === 'string' ? e.text.slice(0, 2000) : '',
          checked: !!e.checked,
          fill: E.normHex(e.fill),
          stroke: E.normHex(e.stroke),
          color: E.normHex(e.color),
          flipH: !!e.flipH,
          flipV: !!e.flipV,
          locked: !!e.locked,
          hidden: !!e.hidden,
          r: COMPONENTS[e.type].radius ? E.normR(e.r) : null,
          g: (typeof e.g === 'string' && e.g) ? e.g.slice(0, 40) : null,
          go: (typeof e.go === 'string' && e.go) ? e.go.slice(0, 100) : null,
          from: e.type === 'arrow' && typeof e.from === 'string' ? e.from.slice(0, 100) : null,
          to: e.type === 'arrow' && typeof e.to === 'string' ? e.to.slice(0, 100) : null,
          elbow: e.type === 'arrow' && !!e.elbow && !!e.from && !!e.to,
          fa: e.type === 'arrow' && /^[tblr]$/.test(e.fa) ? e.fa : null,
          ta: e.type === 'arrow' && /^[tblr]$/.test(e.ta) ? e.ta : null,
          bend: e.type === 'arrow' && typeof e.bend === 'number' && isFinite(e.bend) ? Math.max(0.05, Math.min(0.95, e.bend)) : null,
          ori: e.type === 'arrow' && (e.ori === 'h' || e.ori === 'v') ? e.ori : null,
          c: null,
          p: e.type === 'arrow' && Array.isArray(e.p) && e.p.length === 4 && e.p.every(function (v) { return typeof v === 'number' && isFinite(v); }) ? e.p.slice() : null
        };
      });
      E.syncConnectors(els);
      var gcnt = {};
      els.forEach(function (e) { if (e.g) gcnt[e.g] = (gcnt[e.g] || 0) + 1; });
      els.forEach(function (e) { if (e.g && gcnt[e.g] < 2) e.g = null; });
      return { id: id, name: str(sc.name, 60, 'Tela ' + (i + 1)), elements: els };
    });
    var sids = new Set(screens.map(function (x) { return x.id; }));
    screens.forEach(function (sc) { sc.elements.forEach(function (e) { if (e.go && !sids.has(e.go)) e.go = null; }); });
    var active = str(raw.activeScreenId, 100, '');
    if (!screens.some(function (s) { return s.id === active; })) active = screens[0].id;
    return {
      id: str(raw.id, 100, '') || E.uid(),
      name: str(raw.name, 80, 'Projeto importado'),
      viewport: raw.viewport === 'desktop' ? 'desktop' : 'mobile',
      screens: screens,
      activeScreenId: active,
      createdAt: numIn(raw.createdAt, 0, 8.64e15, now),
      updatedAt: numIn(raw.updatedAt, 0, 8.64e15, now),
      version: 1
    };
  }

  function cloneProject(p, newName) {
    var c = JSON.parse(JSON.stringify(p));
    var now = Date.now();
    c.id = E.uid();
    c.name = newName;
    c.createdAt = now;
    c.updatedAt = now;
    var map = {};
    c.screens.forEach(function (sc) {
      var old = sc.id;
      sc.id = E.uid();
      map[old] = sc.id;
      sc.elements.forEach(function (el) { el.id = E.uid(); });
    });
    c.screens.forEach(function (sc) { sc.elements.forEach(function (el) { if (el.go) el.go = map[el.go] || null; }); });
    c.activeScreenId = map[c.activeScreenId] || c.screens[0].id;
    return c;
  }

  function projectFileText(p) {
    return JSON.stringify({ app: 'alicerce', kind: 'project', version: 1, exportedAt: new Date().toISOString(), project: p }, null, 2);
  }

  function activeScreen() {
    var p = state.project;
    for (var i = 0; i < p.screens.length; i++) if (p.screens[i].id === p.activeScreenId) return p.screens[i];
    p.activeScreenId = p.screens[0].id;
    return p.screens[0];
  }

  /* ================================================================== histórico */
  function snap(p) {
    return JSON.stringify({ n: p.name, v: p.viewport, a: p.activeScreenId, s: p.screens });
  }
  function sigOf(p) { return JSON.stringify({ n: p.name, v: p.viewport, s: p.screens }); }

  function pushHistory(tag) {
    var h = state.hist, cur = snap(state.project), now = Date.now();
    var coalesce = tag && tag.charAt(0) === '~' && state.lastTag === tag && now - state.lastTagTime < 900 && h.idx === h.stack.length - 1;
    if (coalesce) {
      h.stack[h.idx] = cur;
    } else {
      if (h.stack[h.idx] === cur) { state.lastTag = null; return; }
      h.stack = h.stack.slice(0, h.idx + 1);
      h.stack.push(cur);
      if (h.stack.length > HISTORY_LIMIT) h.stack.shift();
      h.idx = h.stack.length - 1;
    }
    state.lastTag = tag || null;
    state.lastTagTime = now;
  }

  function updateUndoRedo() {
    setDisabled('tb-undo', state.hist.idx <= 0);
    setDisabled('tb-redo', state.hist.idx >= state.hist.stack.length - 1);
  }

  function applySnapshot(str) {
    var d = JSON.parse(str), p = state.project;
    var prevSel = engine.selection.slice();
    var prevVp = p.viewport;
    var hadFocus = $('workspace').contains(document.activeElement);
    p.name = d.n;
    p.viewport = d.v;
    p.screens = d.s;
    p.activeScreenId = d.s.some(function (s) { return s.id === d.a; }) ? d.a : d.s[0].id;
    p.updatedAt = Date.now();
    updateHeader();
    updateViewportButtons();
    renderTabs();
    engine.setScreen(activeScreen(), p.viewport);
    if (prevVp !== p.viewport || state.autoFit) fitView();
    engine.select(prevSel);
    if (hadFocus) engine.focusSelected();
    state.lastTag = null;
    updateUndoRedo();
    scheduleSave();
  }

  function undo() {
    if (state.hist.idx <= 0) return;
    state.hist.idx--;
    applySnapshot(state.hist.stack[state.hist.idx]);
    announce('Desfeito.');
  }
  function redo() {
    if (state.hist.idx >= state.hist.stack.length - 1) return;
    state.hist.idx++;
    applySnapshot(state.hist.stack[state.hist.idx]);
    announce('Refeito.');
  }

  /* ================================================================== persistência (autosave) */
  function setStatus(text) { $('save-status').textContent = text; }

  function scheduleSave() {
    state.dirty = true;
    setStatus('Salvando…');
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(doSave, 400);
  }

  function doSave() {
    clearTimeout(state.saveTimer);
    if (!state.dirty || !state.project) return state.chain;
    state.dirty = false;
    var p = state.project;
    var rec = { projectId: p.id, stack: state.hist.stack.slice(), idx: state.hist.idx, sig: sigOf(p) };
    state.chain = state.chain.then(function () {
      return S.putProject(p).then(function () { return S.putHistory(rec); });
    }).then(function () {
      var d = new Date();
      setStatus('Salvo às ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()));
      state.saveErrorShown = false;
    }).catch(function (e) {
      setStatus('Erro ao salvar');
      if (!state.saveErrorShown) {
        state.saveErrorShown = true;
        toast('Não foi possível salvar no navegador: ' + errMsg(e) + ' Exporte o projeto para não perder o trabalho.', 'error');
      }
    });
    return state.chain;
  }

  function flushSave() { return doSave(); }

  function commit(tag) {
    if (!state.project) return;
    state.project.updatedAt = Date.now();
    pushHistory(tag);
    updateUndoRedo();
    scheduleSave();
    syncInspector(false);
    schedulePositionSelBar();
  }

  /* ================================================================== diálogos */
  function showDialog(dlg) {
    return new Promise(function (resolve) {
      dlg.returnValue = '';
      var on = function () { dlg.removeEventListener('close', on); resolve(dlg.returnValue); };
      dlg.addEventListener('close', on);
      dlg.showModal();
    });
  }

  function promptDialog(o) {
    $('prompt-title').textContent = o.title;
    $('prompt-label').textContent = o.label;
    $('prompt-ok').textContent = o.okText || 'OK';
    var inp = $('prompt-input');
    inp.value = o.value || '';
    var p = showDialog($('dlg-prompt'));
    inp.focus();
    inp.select();
    return p.then(function (v) { return v === 'ok' ? inp.value.trim() : null; });
  }

  function confirmDialog(o) {
    $('confirm-title').textContent = o.title;
    $('confirm-msg').textContent = o.message;
    var ok = $('confirm-ok'), alt = $('confirm-alt');
    ok.textContent = o.ok || 'OK';
    ok.className = 'btn ' + (o.danger ? 'btn-danger' : 'btn-primary');
    $('confirm-cancel').textContent = o.cancel || 'Cancelar';
    alt.hidden = !o.alt;
    if (o.alt) alt.textContent = o.alt;
    var p = showDialog($('dlg-confirm'));
    if (o.danger) $('confirm-cancel').focus();
    return p.then(function (v) { return v === 'ok' ? 'ok' : v === 'alt' ? 'alt' : 'cancel'; });
  }

  function newProjectDialog() {
    $('new-name').value = 'Projeto ' + (state.projectCount + 1);
    var radios = document.getElementsByName('new-vp');
    radios[0].checked = true;
    var p = showDialog($('dlg-new'));
    $('new-name').focus();
    $('new-name').select();
    return p.then(function (v) {
      if (v !== 'ok') return null;
      var vp = 'mobile';
      for (var i = 0; i < radios.length; i++) if (radios[i].checked) vp = radios[i].value;
      return { name: $('new-name').value.trim(), viewport: vp };
    });
  }

  /* ================================================================== cabeçalho, abas, UI */
  function updateHeader() {
    var n = state.project ? state.project.name : 'Projeto';
    $('project-name-text').textContent = n;
    $('project-name').setAttribute('aria-label', 'Renomear projeto atual: ' + n);
    document.title = n + ' — Alicerce';
  }

  function updateViewportButtons() {
    var vp = state.project ? state.project.viewport : 'mobile';
    $('vp-mobile').setAttribute('aria-pressed', vp === 'mobile' ? 'true' : 'false');
    $('vp-desktop').setAttribute('aria-pressed', vp === 'desktop' ? 'true' : 'false');
  }

  function renderTabs(focusId) {
    var box = $('screen-tabs'), p = state.project;
    box.textContent = '';
    p.screens.forEach(function (sc) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tab';
      b.id = 'tab-' + sc.id;
      b.setAttribute('role', 'tab');
      b.dataset.screen = sc.id;
      var on = sc.id === p.activeScreenId;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
      b.textContent = sc.name;
      box.appendChild(b);
      if (on) b.scrollIntoView({ inline: 'nearest', block: 'nearest' });
    });
    if (focusId) { var f = $('tab-' + focusId); if (f) f.focus(); }
  }

  function switchScreen(id) {
    var p = state.project;
    if (!p.screens.some(function (s) { return s.id === id; })) return;
    p.activeScreenId = id;
    engine.setScreen(activeScreen(), p.viewport);
    renderTabs();
    if (state.preview) updatePreviewBar();
    scheduleSave();
    announce('Tela ' + activeScreen().name + '.');
  }

  /* No celular, o painel é uma folha inferior: rola a prancheta para o elemento ficar visível acima dela. */
  function revealSelection() {
    if (!document.body.classList.contains('inspector-open') || !engine.selection.length) return;
    var node = engine.nodes.get(engine.selection[0]);
    if (!node) return;
    var ws = $('workspace'), wr = ws.getBoundingClientRect(), r = node.getBoundingClientRect();
    var limit = $('inspector').getBoundingClientRect().top - 16;
    if (r.bottom > limit) {
      var shift = Math.min(r.bottom - limit, Math.max(0, r.top - wr.top - 8));
      ws.scrollTop += shift;
    }
  }

  function openInspector(open) {
    document.body.classList.toggle('inspector-open', !!open);
    schedulePositionSelBar();
    var b = $('el-props');
    b.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      setTimeout(function () { revealSelection(); var t = $('insp-x'); if (t && !$('insp-form').hidden) t.focus({ preventScroll: true }); }, 60);
    }
  }

  /* ---------- barra flutuante do elemento selecionado ---------- */
  function positionSelBar() {
    state.selBarRaf = 0;
    var bar = $('sel-bar');
    if (!bar || !engine) return;
    var busy = engine.mode === 'drag' || engine.mode === 'resize' || engine.mode === 'marquee' || engine.mode === 'pan' || engine.mode === 'pinch' || engine.editing;
    if (!engine.selection.length || busy) { bar.hidden = true; return; }
    var L = Infinity, T = Infinity, R = -Infinity, B = -Infinity;
    engine.selection.forEach(function (id) {
      var n = engine.nodes.get(id);
      if (!n || n.classList.contains('is-hidden')) return;
      var r = n.getBoundingClientRect();
      L = Math.min(L, r.left); T = Math.min(T, r.top); R = Math.max(R, r.right); B = Math.max(B, r.bottom);
    });
    if (L === Infinity) { bar.hidden = true; return; }
    var wr = $('workspace').getBoundingClientRect();
    var top = wr.top, bottom = wr.bottom;
    if (document.body.classList.contains('inspector-open') && window.matchMedia('(max-width: 899.98px)').matches) {
      bottom = Math.min(bottom, $('inspector').getBoundingClientRect().top);
    }
    if (R < wr.left || L > wr.right || B < top || T > bottom) { bar.hidden = true; return; }
    bar.hidden = false;
    bar.style.maxWidth = Math.max(240, Math.min(window.innerWidth - 16, wr.width - 16)) + 'px';
    var bw = bar.offsetWidth, bh = bar.offsetHeight, m = 8;
    var x = Math.min(Math.max((L + R) / 2 - bw / 2, wr.left + m), Math.max(wr.left + m, wr.right - bw - m));
    /* Escolhe o lado (abaixo, acima ou rodapé/topo da área visível) que cobre menos elementos. */
    var others = [];
    engine.nodes.forEach(function (n, id) {
      if (engine.selection.indexOf(id) > -1 || n.classList.contains('is-hidden')) return;
      others.push(n.getBoundingClientRect());
    });
    function cost(cy) {
      var c = 0;
      if (cy < top + 2 || cy + bh > bottom - 2) c += 1e9;
      var l = x, r = x + bw, t = cy, b2 = cy + bh;
      others.forEach(function (o) {
        var w = Math.min(r, o.right) - Math.max(l, o.left), h = Math.min(b2, o.bottom) - Math.max(t, o.top);
        if (w > 0 && h > 0) c += w * h;
      });
      return c;
    }
    var cands = [B + m, T - bh - m, bottom - bh - m, top + m];
    var y = cands[0], best = Infinity;
    cands.forEach(function (cy, i) {
      var c = cost(cy) + i * 0.5;
      if (c < best) { best = c; y = cy; }
    });
    y = Math.min(Math.max(y, top + m), Math.max(top + m, bottom - bh - m));
    bar.style.left = Math.round(x) + 'px';
    bar.style.top = Math.round(y) + 'px';
  }
  function schedulePositionSelBar() {
    if (state.selBarRaf) return;
    state.selBarRaf = requestAnimationFrame(function () { positionSelBar(); try { drawRulers(); } catch (e) {} });
  }

  function buildAlignInspector() {
    var src = $('sel-align'), row = $('insp-align-row');
    if (!src || !row) return;
    Array.prototype.forEach.call(src.querySelectorAll('button'), function (b) { row.appendChild(b.cloneNode(true)); });
  }

  function updateSelectionUI(ids) {
    var n = ids.length, els = engine.selectedElements();
    var single = n === 1 ? els[0] : null;
    ['el-copy', 'el-dup', 'el-front', 'el-back', 'el-delete'].forEach(function (id) { setDisabled(id, n < 1); });
    setDisabled('el-edit', !(single && COMPONENTS[single.type].editable));
    setDisabled('el-props', n < 1);
    setDisabled('el-colors', n < 1);
    setDisabled('el-flip-h', n < 1);
    setDisabled('el-flip-v', n < 1);
    setDisabled('el-lock', n < 1);
    var sa = $('saved-add'); if (sa) sa.disabled = n < 1;
    var al = $('sel-align'); if (al) al.hidden = n < 2;
    var ia = $('insp-align'); if (ia) ia.hidden = n < 2;
    var gsel = engine.selectedElements(), anyG = gsel.some(function (x) { return x.g; });
    var gb = $('sel-group'); if (gb) gb.hidden = n < 2 && !anyG;
    var nonArr = gsel.filter(function (x) { return x.type !== 'arrow'; }), anyB = gsel.some(E.isBound);
    var cb2 = $('sel-connect'); if (cb2) cb2.hidden = !(nonArr.length === 2 && n === 2) && !anyB;
    setDisabled('el-connect', !(nonArr.length === 2 && n === 2));
    setDisabled('el-disconnect', !anyB);
    setDisabled('el-group', n < 2);
    setDisabled('el-ungroup', !anyG);
    Array.prototype.forEach.call(document.querySelectorAll('[data-action="dist-h"],[data-action="dist-v"]'), function (b) { b.disabled = n < 3; });
    schedulePositionSelBar();
    if (n < 1 && $('inspector').dataset.tab !== 'layers') openInspector(false);
    syncInspector(true);
    setTimeout(revealSelection, 60);
  }

  function fillGoSelect(el) {
    var sel = $('insp-go'), p = state.project, cur = activeScreen().id;
    sel.textContent = '';
    var o0 = document.createElement('option'); o0.value = ''; o0.textContent = 'Nenhuma (não faz nada)'; sel.appendChild(o0);
    p.screens.forEach(function (sc) {
      if (sc.id === cur) return;
      var o = document.createElement('option'); o.value = sc.id; o.textContent = sc.name; sel.appendChild(o);
    });
    sel.value = el.go && p.screens.some(function (x) { return x.id === el.go; }) ? el.go : '';
  }

  /* ---- modo de teste do protótipo ---- */
  state.preview = null;
  function setPreview(on) {
    if (on === !!state.preview) return;
    document.body.classList.toggle('preview-on', on);
    $('preview-bar').hidden = !on;
    var tb = document.querySelector('[data-action="preview"]');
    if (tb) tb.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on) {
      openInspector(false);
      state.preview = { start: state.project.activeScreenId, stack: [] };
      engine.setPreview(true);
      updatePreviewBar();
      announce('Modo de teste ligado. Toque nos elementos com seta para navegar. Esc para sair.');
    } else {
      var start = state.preview.start;
      state.preview = null;
      engine.setPreview(false);
      if (state.project.screens.some(function (x) { return x.id === start; })) switchScreen(start);
    }
    schedulePositionSelBar();
  }
  function previewGo(id) {
    if (!state.preview || !state.project.screens.some(function (x) { return x.id === id; })) return;
    state.preview.stack.push(state.project.activeScreenId);
    switchScreen(id);
    updatePreviewBar();
  }
  function previewBack() {
    if (!state.preview || !state.preview.stack.length) return;
    switchScreen(state.preview.stack.pop());
    updatePreviewBar();
  }
  function updatePreviewBar() {
    $('preview-back').disabled = !state.preview || !state.preview.stack.length;
    $('preview-name').textContent = 'Testando: ' + activeScreen().name;
  }
  /* durante o teste, só a prancheta, as abas e a barra de teste respondem */
  ['pointerdown', 'click', 'keydown', 'dragstart', 'contextmenu'].forEach(function (t) {
    document.addEventListener(t, function (e) {
      if (!state.preview) return;
      var tg = e.target && e.target.closest ? e.target : null;
      if (e.type === 'keydown' && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setPreview(false); return; }
      if (tg && tg.closest('#workspace, #preview-bar, .tabs, dialog, [data-action="preview"]')) { if (e.type === 'keydown' && !tg.closest('.tabs, #preview-bar')) e.stopPropagation(); return; }
      e.stopPropagation(); e.preventDefault();
    }, true);
  });

  function syncInspector(force) {
    renderLayers();
    var els = engine.selectedElements();
    var empty = $('insp-empty'), form = $('insp-form');
    if (els.length !== 1) {
      form.hidden = true;
      empty.hidden = false;
      empty.textContent = els.length > 1 ? els.length + ' elementos selecionados. Use a barra ao lado da seleção para duplicar, copiar, ordenar, alinhar ou excluir, ou aplique cores abaixo.' : 'Selecione um elemento na prancheta para editar suas propriedades e cores.';
      syncColors(els, force);
      syncCorners(els, force);
      syncFlipButtons(els);
      syncLock(els);
      return;
    }
    var el = els[0], c = COMPONENTS[el.type];
    empty.hidden = true;
    form.hidden = false;
    $('insp-type').textContent = c.label;
    $('insp-text-field').hidden = !c.editable;
    $('insp-state-field').hidden = !c.hasState;
    if (c.hasState) $('insp-checked-label').textContent = c.stateLabel;
    var set = function (id, val) { var f = $(id); if (force || document.activeElement !== f) f.value = val; };
    set('insp-text', el.text || '');
    fillGoSelect(el);
    $('insp-elbow-field').hidden = !(el.type === 'arrow' && el.from && el.to);
    $('insp-elbow').checked = !!el.elbow;
    $('insp-anchor-field').hidden = $('insp-elbow-field').hidden;
    set('insp-fa', el.fa || '');
    set('insp-ta', el.ta || '');
    $('insp-route-field').hidden = $('insp-elbow-field').hidden || !el.elbow;
    set('insp-x', Math.round(el.x));
    set('insp-y', Math.round(el.y));
    set('insp-w', Math.round(el.w));
    set('insp-h', Math.round(el.h));
    ['x', 'y', 'w', 'h'].forEach(function (k) { $('insp-' + k).disabled = !!el.locked; });
    $('insp-checked').checked = !!el.checked;
    syncColors(els, force);
    syncCorners(els, force);
    syncFlipButtons(els);
    syncLock(els);
  }

  /* ---------- Camadas ---------- */
  var layersSig = '';

  function layerName(el) {
    var t = String(el.text || '').split('\n')[0].trim();
    return t ? (t.length > 24 ? t.slice(0, 23) + '…' : t) : COMPONENTS[el.type].label;
  }

  function setPanelTab(tab) {
    var insp = $('inspector');
    insp.dataset.tab = tab;
    ['props', 'layers'].forEach(function (t) {
      $('tab-' + t).setAttribute('aria-selected', t === tab ? 'true' : 'false');
    });
    $('inspector-title').textContent = tab === 'layers' ? 'Camadas' : 'Propriedades';
    $('el-layers').setAttribute('aria-pressed', tab === 'layers' ? 'true' : 'false');
    document.body.classList.toggle('layers-wide', tab === 'layers');
    layersSig = '';
    renderLayers();
  }

  function showLayers() {
    var narrow = window.matchMedia('(max-width: 899.98px)').matches;
    var onLayers = $('inspector').dataset.tab === 'layers';
    if (narrow) {
      if (onLayers && document.body.classList.contains('inspector-open')) { openInspector(false); setPanelTab('props'); return; }
      setPanelTab('layers');
      openInspector(true);
    } else {
      setPanelTab(onLayers ? 'props' : 'layers');
    }
  }

  function renderLayers() {
    var list = $('layers-list');
    if (!engine.screen || !list || $('inspector').dataset.tab !== 'layers') return;
    var els = engine.screen.elements, sel = engine.selection;
    var sig = els.map(function (e) { return [e.id, e.type, layerName(e), e.locked ? 1 : 0, e.hidden ? 1 : 0, e.g || ''].join('|'); }).join(';') + '#' + sel.join(',') + '#' + engine.screen.id;
    if (sig === layersSig) return;
    layersSig = sig;
    var act = document.activeElement, keep = act && list.contains(act) ? [act.closest('.layer-row').dataset.id, act.dataset.act || 'main'] : null;
    list.textContent = '';
    var gnum = {}, gn = 0;
    els.forEach(function (e) { if (e.g && !gnum[e.g]) { var c = 0; els.forEach(function (o) { if (o.g === e.g) c++; }); if (c > 1) gnum[e.g] = ++gn; } });
    $('layers-empty').hidden = els.length > 0;
    var n = els.length;
    for (var i = n - 1; i >= 0; i--) {
      (function (el, pos) {
        var c = COMPONENTS[el.type], name = layerName(el), isSel = sel.indexOf(el.id) > -1;
        var li = document.createElement('li');
        li.className = 'layer-row' + (el.hidden ? ' is-off' : '');
        li.dataset.id = el.id;
        li.draggable = true;
        li.setAttribute('aria-selected', isSel ? 'true' : 'false');
        var main = document.createElement('button');
        main.type = 'button';
        main.className = 'layer-main';
        main.dataset.act = 'main';
        main.setAttribute('aria-pressed', isSel ? 'true' : 'false');
        main.setAttribute('aria-label', 'Camada ' + pos + ' de ' + n + (pos === 1 ? ' (primeiro plano)' : '') + ': ' + c.label + (name !== c.label ? ', ' + name : '') + (el.hidden ? ', oculta' : '') + (el.locked ? ', travada' : '') + (gnum[el.g] ? ', grupo ' + gnum[el.g] : ''));
        var num = document.createElement('span'); num.className = 'layer-num'; num.textContent = pos; num.setAttribute('aria-hidden', 'true');
        main.appendChild(num);
        main.appendChild(svgIcon(c.icon, 'icon layer-ico'));
        var tx = document.createElement('span'); tx.className = 'layer-txt';
        var nm = document.createElement('span'); nm.className = 'layer-name'; nm.textContent = name;
        var ty = document.createElement('span'); ty.className = 'layer-type'; ty.textContent = c.label;
        tx.appendChild(nm); tx.appendChild(ty);
        main.appendChild(tx);
        if (gnum[el.g]) { var gb = document.createElement('span'); gb.className = 'layer-grp'; gb.textContent = 'G' + gnum[el.g]; gb.title = 'Grupo ' + gnum[el.g]; gb.setAttribute('aria-hidden', 'true'); main.appendChild(gb); }
        li.appendChild(main);
        function btn(act, icon, label, pressed, disabled) {
          var b = document.createElement('button');
          b.type = 'button'; b.className = 'layer-btn'; b.dataset.act = act;
          b.setAttribute('aria-label', label + ': ' + name);
          b.title = label;
          if (pressed !== null) b.setAttribute('aria-pressed', pressed ? 'true' : 'false');
          if (disabled) b.disabled = true;
          b.appendChild(svgIcon(icon));
          li.appendChild(b);
        }
        btn('hide', el.hidden ? 'i-eye-off' : 'i-eye', el.hidden ? 'Mostrar camada' : 'Ocultar camada', !!el.hidden, false);
        btn('lock', el.locked ? 'i-lock' : 'i-unlock', el.locked ? 'Destravar camada' : 'Travar camada', !!el.locked, false);
        btn('up', 'i-arrow-up', 'Subir uma camada (para a frente)', null, pos === 1);
        btn('down', 'i-arrow-down', 'Descer uma camada (para trás)', null, pos === n);
        list.appendChild(li);
      })(els[i], n - i);
    }
    if (keep) {
      var target = list.querySelector('.layer-row[data-id="' + keep[0] + '"] [data-act="' + keep[1] + '"]');
      if (target && !target.disabled) target.focus({ preventScroll: true });
      else { var m = list.querySelector('.layer-row[data-id="' + keep[0] + '"] [data-act="main"]'); if (m) m.focus({ preventScroll: true }); }
    }
    var cur = list.querySelector('.layer-row[aria-selected="true"]');
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
  }

  function bindLayers() {
    var list = $('layers-list'), dragId = null;
    $('tab-props').addEventListener('click', function () { setPanelTab('props'); });
    $('tab-layers').addEventListener('click', function () { setPanelTab('layers'); });
    list.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      var row = e.target.closest('.layer-row');
      if (!b || !row) return;
      var id = row.dataset.id, el = engine.find(id);
      if (!el) return;
      switch (b.dataset.act) {
        case 'main':
          if (e.shiftKey || e.ctrlKey || e.metaKey) {
            engine.select(engine.selection.indexOf(id) > -1 ? engine.selection.filter(function (x) { return x !== id; }) : engine.selection.concat([id]), false, true);
          } else engine.select([id], false, true);
          break;
        case 'hide': engine.setLayerProp(id, 'hidden', !el.hidden); break;
        case 'lock': engine.setLayerProp(id, 'locked', !el.locked); break;
        case 'up': engine.stepLayer(id, 1); break;
        case 'down': engine.stepLayer(id, -1); break;
      }
    });
    list.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      var row = e.target.closest('.layer-row');
      if (!row || !e.target.classList.contains('layer-main')) return;
      var next = e.key === 'ArrowUp' ? row.previousElementSibling : row.nextElementSibling;
      if (next) { e.preventDefault(); next.querySelector('.layer-main').focus(); }
    });
    list.addEventListener('dragstart', function (e) {
      var row = e.target.closest && e.target.closest('.layer-row');
      if (!row) return;
      dragId = row.dataset.id;
      row.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', dragId); } catch (x) { /* ignorado */ }
    });
    function clearMarks() { list.querySelectorAll('.drop-before,.drop-after,.is-dragging').forEach(function (r) { r.classList.remove('drop-before', 'drop-after', 'is-dragging'); }); }
    list.addEventListener('dragover', function (e) {
      if (!dragId) return;
      var row = e.target.closest('.layer-row');
      if (!row || row.dataset.id === dragId) return;
      e.preventDefault();
      var r = row.getBoundingClientRect(), before = e.clientY < r.top + r.height / 2;
      list.querySelectorAll('.drop-before,.drop-after').forEach(function (x) { x.classList.remove('drop-before', 'drop-after'); });
      row.classList.add(before ? 'drop-before' : 'drop-after');
    });
    list.addEventListener('drop', function (e) {
      if (!dragId) return;
      var row = e.target.closest('.layer-row');
      if (row && row.dataset.id !== dragId) {
        e.preventDefault();
        var r = row.getBoundingClientRect(), above = e.clientY < r.top + r.height / 2;
        var rest = engine.screen.elements.filter(function (x) { return x.id !== dragId; });
        var ri = rest.findIndex(function (x) { return x.id === row.dataset.id; });
        engine.moveLayer(dragId, above ? ri + 1 : ri);
      }
      dragId = null; clearMarks();
    });
    list.addEventListener('dragend', function () { dragId = null; clearMarks(); });
  }

  /* ---------- Cadeado ---------- */
  function syncLock(els) {
    var n = els.length, all = n > 0 && els.every(function (e) { return e.locked; });
    var some = els.some(function (e) { return e.locked; });
    var btn = $('el-lock');
    btn.setAttribute('aria-pressed', all ? 'true' : 'false');
    btn.setAttribute('aria-label', all ? 'Destravar posição do elemento' : 'Travar posição do elemento');
    btn.title = (all ? 'Destravar' : 'Travar') + ' posição (Shift+L)';
    $('el-lock-use').setAttribute('href', all ? '#i-lock' : '#i-unlock');
    $('insp-lock').hidden = n < 1;
    var cb = $('insp-locked');
    cb.checked = all;
    cb.indeterminate = some && !all;
  }

  /* ---------- Espelhar (Flip) ---------- */
  function syncFlipButtons(els) {
    var h = els.length > 0 && els.every(function (e) { return e.flipH; });
    var v = els.length > 0 && els.every(function (e) { return e.flipV; });
    $('el-flip-h').setAttribute('aria-pressed', h ? 'true' : 'false');
    $('el-flip-v').setAttribute('aria-pressed', v ? 'true' : 'false');
  }

  /* ---------- Cantos retos e arredondados ---------- */
  var RADIUS_PRESETS = [[0, 'Reto'], [4, 'Suave'], [8, 'Médio'], [16, 'Grande'], [999, 'Pílula']];
  var cornersIndep = false, cornersKey = '';

  function cornerIcon(r) {
    var ns = 'http://www.w3.org/2000/svg';
    var sv = document.createElementNS(ns, 'svg');
    sv.setAttribute('viewBox', '0 0 24 24');
    sv.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS(ns, 'path');
    var k = Math.min(r, 14);   // arco do canto superior esquerdo
    p.setAttribute('d', 'M3 21V' + (3 + k) + (k ? 'A' + k + ' ' + k + ' 0 0 1 ' + (3 + k) + ' 3' : '') + 'H21');
    sv.appendChild(p);
    return sv;
  }

  function cornerEls(els) { return els.filter(function (e) { return COMPONENTS[e.type].radius; }); }

  function syncCorners(els, force) {
    var sec = $('insp-corners'), list = cornerEls(els);
    if (!list.length) { sec.hidden = true; return; }
    sec.hidden = false;
    var key = list.map(function (e) { return e.id; }).join(',');
    var eff = list.map(function (e) { return E.radiusOf(e); });
    var uniform = null;
    var allEq = eff.every(function (r) { return r.every(function (v) { return v === r[0]; }); });
    if (allEq && eff.every(function (r) { return r[0] === eff[0][0]; })) uniform = eff[0][0];
    if (key !== cornersKey) {
      cornersKey = key;
      cornersIndep = list.length === 1 && uniform === null;
    }
    var max = Math.min.apply(null, list.map(E.maxRadius));
    var range = $('radius-range');
    range.max = max;
    if (force || document.activeElement !== range) range.value = uniform === null ? 0 : Math.min(Math.round(uniform), max);
    $('radius-out').textContent = uniform === null ? 'vários' : (uniform >= max ? 'máx. (' + max + ' px)' : Math.round(uniform) + ' px');
    range.setAttribute('aria-valuetext', $('radius-out').textContent);

    document.querySelectorAll('.radius-btn').forEach(function (b) {
      var v = Number(b.dataset.r), want = Math.min(v, max);
      b.setAttribute('aria-pressed', uniform !== null && Math.round(uniform) === want ? 'true' : 'false');
    });

    var single = list.length === 1;
    $('corners-indep-field').hidden = !single;
    $('corners-indep').checked = single && cornersIndep;
    $('corners-grid').hidden = !(single && cornersIndep);
    if (single) {
      var r = eff[0];
      [['tl', 0], ['tr', 1], ['br', 2], ['bl', 3]].forEach(function (c) {
        var f = $('corner-' + c[0]);
        f.max = maxCorner(list[0]);
        if (force || document.activeElement !== f) f.value = Math.round(r[c[1]]);
      });
    }
    // pré-visualização com proporção real do elemento
    var ref = list[0], scale = Math.min(120 / ref.w, 64 / ref.h);
    var pv = $('corner-preview');
    pv.style.width = Math.max(24, ref.w * scale) + 'px';
    pv.style.height = Math.max(24, ref.h * scale) + 'px';
    pv.style.borderRadius = eff[0].map(function (v) { return (v * scale) + 'px'; }).join(' ');
  }
  function maxCorner(el) { return Math.max(el.w, el.h); }

  function applyRadius(arr, tag, msg) {
    var ids = cornerEls(engine.selectedElements()).map(function (e) { return e.id; });
    if (!ids.length) return;
    engine.updateMany(ids, { r: arr }, tag || null);
    if (msg) announce(msg);
  }

  function buildCorners() {
    var box = $('radius-presets');
    RADIUS_PRESETS.forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'radius-btn';
      b.dataset.r = p[0];
      b.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-label', 'Cantos ' + p[1].toLowerCase());
      b.title = p[0] === 999 ? 'Pílula (máximo)' : p[1] + ' — ' + p[0] + ' px';
      b.appendChild(cornerIcon(p[0] === 999 ? 14 : p[0]));
      b.appendChild(document.createTextNode(p[1]));
      box.appendChild(b);
    });
    box.addEventListener('click', function (e) {
      var b = e.target.closest('.radius-btn');
      if (!b) return;
      var v = Number(b.dataset.r);
      applyRadius([v, v, v, v], null, 'Cantos: ' + b.textContent.toLowerCase() + '.');
    });
    var range = $('radius-range');
    range.addEventListener('input', function () {
      var v = Number(range.value), max = Number(range.max);
      var s = v >= max ? 999 : v;
      applyRadius([s, s, s, s], '~radius');
    });
    $('corners-indep').addEventListener('change', function (e) {
      cornersIndep = e.target.checked;
      syncCorners(engine.selectedElements(), true);
    });
    ['tl', 'tr', 'br', 'bl'].forEach(function (k, i) {
      var f = $('corner-' + k);
      f.addEventListener('input', function () {
        if (f.value === '' || !isFinite(Number(f.value))) return;
        var els = cornerEls(engine.selectedElements());
        if (els.length !== 1) return;
        var r = E.radiusOf(els[0]).slice();
        r[i] = Math.max(0, Math.min(999, Math.round(Number(f.value))));
        applyRadius(r, '~radius-corners');
      });
    });
    $('corners-reset').addEventListener('click', function () { applyRadius(null, null, 'Cantos restaurados ao padrão.'); });
  }

  /* ---------- Cores ---------- */
  var SWATCHES = [
    { name: 'Neutras', items: [['#FFFFFF', 'Branco'], ['#EEF0F4', 'Cinza névoa'], ['#C9CED8', 'Cinza claro'], ['#5B6270', 'Cinza médio'], ['#1F2430', 'Grafite'], ['#000000', 'Preto']] },
    { name: 'Original', items: [['#29243C', 'Ameixa escura'], ['#5C3F69', 'Roxo'], ['#955A89', 'Orquídea'], ['#F07DDC', 'Rosa']] },
    { name: 'Sóbrio', items: [['#156372', 'Petróleo'], ['#2098AE', 'Turquesa'], ['#3BC2DB', 'Ciano'], ['#ABE5EF', 'Gelo']] },
    { name: 'Hawaii', items: [['#703500', 'Marrom'], ['#FF7800', 'Laranja'], ['#FFF700', 'Amarelo'], ['#87FF00', 'Lima']] },
    { name: 'Groenlândia', items: [['#002699', 'Azul real'], ['#007299', 'Azul glacial'], ['#00A8E0', 'Céu'], ['#270099', 'Índigo']] }
  ];
  var COLOR_LABEL = { fill: 'Fundo', stroke: 'Borda', color: 'Texto' };
  var colorTarget = 'fill';

  function defaultColorFor(el, target) {
    var ci = E.colorInfo(el);
    if (target === 'fill') return ci.bg;
    if (target === 'color') return ci.text;
    return '#1F2430';
  }

  function syncColors(els, force) {
    var sec = $('insp-colors');
    if (!els.length) { sec.hidden = true; return; }
    sec.hidden = false;
    var ok = { fill: false, stroke: true, color: false };
    els.forEach(function (el) {
      if (el.type !== 'divider' && el.type !== 'arrow') ok.fill = true;
      if (COMPONENTS[el.type].editable) ok.color = true;
    });
    ['fill', 'stroke', 'color'].forEach(function (k) { $('seg-' + k).hidden = !ok[k]; });
    if (!ok[colorTarget]) colorTarget = ok.fill ? 'fill' : 'stroke';
    document.querySelectorAll('input[name="color-target"]').forEach(function (r) { r.checked = r.value === colorTarget; });

    ['fill', 'stroke', 'color'].forEach(function (k) {
      var vals = els.map(function (e) { return e[k] || ''; });
      var same = vals.every(function (v) { return v === vals[0]; });
      var chip = $('chip-' + k), val = $('val-' + k);
      if (!same) { chip.style.background = ''; chip.classList.add('is-default'); val.textContent = 'vários'; }
      else if (vals[0] === '') { chip.style.background = ''; chip.classList.add('is-default'); val.textContent = k === 'color' ? 'automático' : 'padrão'; }
      else { chip.classList.remove('is-default'); chip.style.background = vals[0]; val.textContent = vals[0]; }
    });

    var cur = els.map(function (e) { return e[colorTarget] || ''; });
    var curVal = cur.every(function (v) { return v === cur[0]; }) ? cur[0] : null;
    document.querySelectorAll('.swatch-btn').forEach(function (b) {
      b.setAttribute('aria-pressed', curVal && b.dataset.hex === curVal ? 'true' : 'false');
      b.setAttribute('aria-label', COLOR_LABEL[colorTarget] + ': ' + b.dataset.name + ' ' + b.dataset.hex);
    });
    var inp = $('color-custom');
    if (force || document.activeElement !== inp) inp.value = (curVal || defaultColorFor(els[0], colorTarget)).toLowerCase();
    $('color-reset').textContent = colorTarget === 'color' ? 'Texto automático' : colorTarget === 'fill' ? 'Fundo padrão' : 'Borda padrão';

    var info = $('color-info');
    if (els.length === 1 && COMPONENTS[els[0].type].editable) {
      var r = E.colorInfo(els[0]).ratio;
      var level = r >= 7 ? 'AAA ✓' : r >= 4.5 ? 'AA ✓' : r >= 3 ? 'só para texto grande ⚠' : 'abaixo do mínimo WCAG ✗';
      info.textContent = 'Contraste texto/fundo: ' + r.toFixed(2) + ':1 — ' + level + (r < 4.5 ? '. Use "Texto automático" para corrigir.' : '');
      info.classList.toggle('is-bad', r < 4.5);
      info.hidden = false;
    } else if (els.length > 1) {
      info.textContent = 'Cores aplicadas a ' + els.length + ' elementos.';
      info.classList.remove('is-bad');
      info.hidden = false;
    } else {
      info.hidden = true;
    }
  }

  function applyColor(target, hex, tag) {
    if (!engine.selection.length) return;
    var patch = {};
    patch[target] = hex;
    engine.updateMany(engine.selection.slice(), patch, tag || null);
    var names = { fill: 'Fundo', stroke: 'Borda', color: 'Texto' };
    announce(names[target] + (hex ? ' alterado para ' + hex + '.' : ' restaurado ao padrão.'));
  }

  function buildSwatches() {
    var box = $('swatches');
    SWATCHES.forEach(function (g) {
      var t = document.createElement('p');
      t.className = 'sw-group';
      t.textContent = g.name;
      var row = document.createElement('div');
      row.className = 'sw-row';
      row.setAttribute('role', 'group');
      row.setAttribute('aria-label', 'Cores ' + g.name);
      g.items.forEach(function (it) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'swatch-btn';
        b.dataset.hex = it[0];
        b.dataset.name = it[1];
        b.style.background = it[0];
        b.style.color = E.autoText(it[0]);
        b.title = it[1] + ' ' + it[0];
        b.setAttribute('aria-pressed', 'false');
        b.appendChild(svgIcon('i-check'));
        row.appendChild(b);
      });
      box.appendChild(t);
      box.appendChild(row);
    });
    box.addEventListener('click', function (e) {
      var b = e.target.closest('.swatch-btn');
      if (b) applyColor(colorTarget, b.dataset.hex, null);
    });
    $('color-targets').addEventListener('change', function (e) {
      if (e.target.name !== 'color-target') return;
      colorTarget = e.target.value;
      syncColors(engine.selectedElements(), true);
    });
    $('color-custom').addEventListener('input', function (e) {
      applyColor(colorTarget, e.target.value, '~color-' + colorTarget);
    });
    $('color-reset').addEventListener('click', function () { applyColor(colorTarget, '', null); });
  }

  function openColors() {
    if (!engine.selection.length) return;
    if (window.matchMedia('(max-width: 899.98px)').matches) {
      document.body.classList.add('inspector-open');
      $('el-props').setAttribute('aria-expanded', 'true');
    }
    setTimeout(function () {
      revealSelection();
      var r = document.querySelector('input[name="color-target"]:checked');
      if (r) { r.scrollIntoView({ block: 'nearest' }); r.focus({ preventScroll: true }); }
    }, 80);
  }

  function bindInspector() {
    var single = function () { var e = engine.selectedElements(); return e.length === 1 ? e[0] : null; };
    $('insp-text').addEventListener('input', function (ev) {
      var el = single(); if (!el) return;
      engine.updateElement(el.id, { text: ev.target.value }, '~insp-text');
    });
    var ratioOn = ls('alicerce.ratio') === '1', ratio0 = 1;
    $('insp-ratio').checked = ratioOn; engine.setRatio(ratioOn);
    $('insp-ratio').addEventListener('change', function (ev) {
      ratioOn = ev.target.checked; engine.setRatio(ratioOn);
      try { localStorage.setItem('alicerce.ratio', ratioOn ? '1' : '0'); } catch (e) {}
    });
    ['w', 'h'].forEach(function (k) { $('insp-' + k).addEventListener('focus', function () { var el = single(); if (el) ratio0 = el.w / el.h; }); });
    ['x', 'y', 'w', 'h'].forEach(function (k) {
      var inp = $('insp-' + k);
      inp.addEventListener('input', function () {
        var el = single(); if (!el) return;
        if (inp.value === '' || !isFinite(Number(inp.value))) return;
        var patch = {}; patch[k] = Number(inp.value);
        if (ratioOn && (k === 'w' || k === 'h')) {
          var vpz = E.VIEWPORTS[state.project.viewport] || E.VIEWPORTS.mobile, r0 = document.activeElement === inp ? (ratio0 || (el.w / el.h)) : (el.w / el.h);
          var nw = k === 'w' ? patch.w : patch.h * r0, nh = k === 'h' ? patch.h : patch.w / r0;
          var lim = Math.min(1, (vpz.w - el.x) / nw, (vpz.h - el.y) / nh); if (lim < 1) { nw *= lim; nh *= lim; }
          patch.w = Math.max(16, Math.round(nw)); patch.h = Math.max(16, Math.round(nh));
        }
        engine.updateElement(el.id, patch, '~insp-' + k);
      });
      inp.addEventListener('change', function () { syncInspector(true); });
    });
    $('insp-locked').addEventListener('change', function (ev) { engine.toggleLockSelected(ev.target.checked); });
    ['fa', 'ta'].forEach(function (k) {
      $('insp-' + k).addEventListener('change', function (ev) {
        var el = single(); if (!el) return;
        var patch = {}; patch[k] = ev.target.value || null;
        engine.updateElement(el.id, patch, null);
      });
    });
    $('insp-route-reset').addEventListener('click', function () {
      var el = single(); if (!el) return;
      engine.updateElement(el.id, { bend: null, ori: null }, null);
    });
    $('insp-elbow').addEventListener('change', function (ev) {
      var el = single(); if (!el) return;
      engine.updateElement(el.id, { elbow: ev.target.checked }, null);
    });
    $('insp-go').addEventListener('change', function (ev) {
      var el = single(); if (!el) return;
      engine.updateElement(el.id, { go: ev.target.value || null }, null);
    });
    $('insp-checked').addEventListener('change', function (ev) {
      var el = single(); if (!el) return;
      engine.updateElement(el.id, { checked: ev.target.checked }, null);
    });
  }

  /* ================================================================== zoom */
  function fitView() {
    state.fitting = true;
    engine.fit();
    state.fitting = false;
    state.autoFit = true;
  }
  function onZoom(z) {
    if (!state.fitting) state.autoFit = false;
    var pct = Math.round(z * 100);
    var b = $('tb-zoom-label');
    b.textContent = pct + '%';
    b.setAttribute('aria-label', 'Zoom atual ' + pct + '%. Ativar para voltar a 100%');
    schedulePositionSelBar();
  }

  /* ================================================================== telas */
  /* ================================================================== modelos de tela */
  /* Cada modelo gera os elementos para a largura/altura da moldura (Mobile ou Desktop). */
  function tEl(type, x, y, w, h, text, extra) {
    var c = COMPONENTS[type];
    return Object.assign({ type: type, x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h),
      text: text == null ? (c.text || '') : text, checked: false, fill: '', stroke: '', color: '', flipH: false, flipV: false, r: null, locked: false, hidden: false, g: null }, extra || {});
  }
  function tLayout(W, H) {
    var desk = W >= 900;
    var cw = desk ? 420 : W - 48;
    return { desk: desk, W: W, H: H, cw: cw, cx: Math.round((W - cw) / 2),
      sbw: 240, ax: desk ? 272 : 16, aw: desk ? W - 272 - 32 : W - 32 };
  }
  function tFrame(L, title, items, nav) {
    var out = [tEl('navbar', 0, 0, L.W, 56, title)];
    if (L.desk) {
      out.push(tEl('sidebar', 0, 56, L.sbw, L.H - 56, 'Alicerce\n' + items));
    } else {
      out.push(tEl('hamburger', 8, 6, 44, 44));
      if (nav !== false) out.push(tEl('bottomnav', 0, L.H - 64, L.W, 64, 'Início\nBuscar\nPerfil'));
    }
    return out;
  }

  var TEMPLATES = [
    { id: 'blank', name: 'Em branco', desc: 'Tela vazia, para montar do zero.', build: function () { return []; } },
    { id: 'login', name: 'Login', desc: 'Logo, e-mail, senha, lembrar de mim, entrar e criar conta.', build: function (W, H) {
      var L = tLayout(W, H), y = L.desk ? 90 : 72, x = L.cx, cw = L.cw;
      return [
        tEl('image', (W - 96) / 2, y, 96, 96),
        tEl('text', x, y + 112, cw, 36, 'Entrar na sua conta'),
        tEl('input', x, y + 160, cw, 44, 'E-mail'),
        tEl('input', x, y + 216, cw, 44, 'Senha'),
        tEl('checkbox', x, y + 272, cw, 32, 'Lembrar de mim', { checked: true }),
        tEl('button', x, y + 320, cw, 48, 'Entrar'),
        tEl('text', x, y + 384, cw, 28, 'Esqueci minha senha'),
        tEl('divider', x, y + 424, cw, 12),
        tEl('button', x, y + 452, cw, 48, 'Criar conta')
      ];
    } },
    { id: 'signup', name: 'Cadastro', desc: 'Formulário longo com campos, país, termos e botão de envio.', build: function (W, H) {
      var L = tLayout(W, H), x = L.cx, cw = L.cw, y = 88;
      var out = [tEl('navbar', 0, 0, W, 56, 'Criar conta')];
      if (!L.desk) out.push(tEl('hamburger', 8, 6, 44, 44));
      return out.concat([
        tEl('text', x, y, cw, 48, 'Preencha seus dados para começar.'),
        tEl('input', x, y + 64, cw, 44, 'Nome completo'),
        tEl('input', x, y + 120, cw, 44, 'E-mail'),
        tEl('select', x, y + 176, cw, 44, 'País'),
        tEl('input', x, y + 232, cw, 44, 'Senha'),
        tEl('input', x, y + 288, cw, 44, 'Confirmar senha'),
        tEl('checkbox', x, y + 348, cw, 32, 'Li e aceito os termos de uso'),
        tEl('button', x, y + 396, cw, 48, 'Cadastrar'),
        tEl('text', x, y + 460, cw, 28, 'Já tem conta? Entrar')
      ]);
    } },
    { id: 'list', name: 'Lista com busca', desc: 'Cabeçalho, busca, abas, lista de itens e botão flutuante.', build: function (W, H) {
      var L = tLayout(W, H), x = L.ax, w = L.aw;
      return tFrame(L, 'Mensagens', 'Início\nMensagens\nContatos\nAjustes').concat([
        tEl('input', x, 72, w, 44, 'Buscar mensagens'),
        tEl('tabs', x, 128, w, 44, 'Todas\nNão lidas\nArquivadas'),
        tEl('list', x, 184, w, L.desk ? 380 : 380, 'Ana Souza\nBruno Lima\nCarla Dias\nDiego Rocha\nElisa Prado\nFábio Nunes'),
        tEl('fab', W - 72, H - (L.desk ? 72 : 64 + 72), 56, 56)
      ]);
    } },
    { id: 'dashboard', name: 'Painel', desc: 'Indicadores, gráfico, meta com progresso e atividade recente.', build: function (W, H) {
      var L = tLayout(W, H), x = L.ax, w = L.aw, out = tFrame(L, 'Painel', 'Início\nPainel\nRelatórios\nAjustes');
      if (L.desk) {
        var kw = Math.round((w - 32) / 3);
        out.push(tEl('container', x, 80, kw, 96, 'Usuários: 1.248'), tEl('container', x + kw + 16, 80, kw, 96, 'Receita: R$ 8,4 mil'), tEl('container', x + 2 * (kw + 16), 80, kw, 96, 'Conversão: 3,2%'));
        var gw = Math.round(w * 0.6);
        out.push(tEl('image', x, 192, gw, 260), tEl('list', x + gw + 16, 192, w - gw - 16, 260, 'Novo cadastro\nPagamento aprovado\nRelatório gerado\nUsuário removido\nMeta atingida'));
        out.push(tEl('text', x, 472, w, 32, 'Meta do mês'), tEl('progress', x, 512, w, 16));
      } else {
        var hw = Math.round((w - 16) / 2);
        out.push(tEl('container', x, 72, hw, 96, 'Usuários: 1.248'), tEl('container', x + hw + 16, 72, hw, 96, 'Receita: R$ 8,4 mil'));
        out.push(tEl('text', x, 184, w, 28, 'Meta do mês'), tEl('progress', x, 220, w, 16));
        out.push(tEl('image', x, 252, w, 150), tEl('text', x, 414, w, 28, 'Atividade recente'), tEl('list', x, 446, w, 150, 'Novo cadastro\nPagamento aprovado\nRelatório gerado\nMeta atingida'));
      }
      return out;
    } },
    { id: 'onboarding', name: 'Boas-vindas', desc: 'Ilustração, título, texto, indicador de passo e botões Continuar e Pular.', build: function (W, H) {
      var L = tLayout(W, H), x = L.cx, cw = L.cw, y = L.desk ? 70 : 90, iw = L.desk ? 360 : cw;
      return [
        tEl('image', (W - iw) / 2, y, iw, L.desk ? 280 : 260),
        tEl('text', x, y + (L.desk ? 304 : 284), cw, 40, 'Bem-vindo ao app'),
        tEl('text', x, y + (L.desk ? 348 : 328), cw, 72, 'Em poucos passos você configura tudo e começa a usar.'),
        tEl('progress', x + cw / 2 - 60, y + (L.desk ? 436 : 436), 120, 12),
        tEl('button', x, y + (L.desk ? 468 : 468), cw, 48, 'Continuar'),
        tEl('text', x, y + (L.desk ? 532 : 532), cw, 28, 'Pular')
      ];
    } },
    { id: 'checkout', name: 'Pagamento', desc: 'Resumo do pedido, dados do cartão, parcelas, total e botão Pagar.', build: function (W, H) {
      var L = tLayout(W, H), x = L.cx, cw = L.cw, out = [tEl('navbar', 0, 0, W, 56, 'Pagamento')];
      if (!L.desk) out.push(tEl('hamburger', 8, 6, 44, 44));
      return out.concat([
        tEl('list', x, 76, cw, 112, 'Camiseta básica — R$ 59,90\nBoné — R$ 39,90\nFrete — R$ 12,00'),
        tEl('divider', x, 200, cw, 12),
        tEl('input', x, 224, cw, 44, 'Número do cartão'),
        tEl('input', x, 280, (cw - 12) / 2, 44, 'Validade'),
        tEl('input', x + (cw + 12) / 2, 280, (cw - 12) / 2, 44, 'CVV'),
        tEl('select', x, 336, cw, 44, 'Parcelas: 1x sem juros'),
        tEl('text', x, 396, cw, 36, 'Total: R$ 111,80'),
        tEl('checkbox', x, 444, cw, 32, 'Salvar cartão para as próximas compras'),
        tEl('button', x, 492, cw, 48, 'Pagar agora')
      ]);
    } },
    { id: 'settings', name: 'Configurações', desc: 'Opções com toggles, listas de conta, idioma e sair.', build: function (W, H) {
      var L = tLayout(W, H), x = L.ax, w = L.desk ? Math.min(L.aw, 520) : L.aw;
      return tFrame(L, 'Ajustes', 'Início\nPerfil\nAjustes\nAjuda').concat([
        tEl('text', x, 72, w, 28, 'Notificações'),
        tEl('toggle', x, 108, w, 32, 'Notificações push', { checked: true }),
        tEl('toggle', x, 148, w, 32, 'E-mails semanais'),
        tEl('toggle', x, 188, w, 32, 'Modo escuro'),
        tEl('divider', x, 232, w, 12),
        tEl('text', x, 252, w, 28, 'Conta'),
        tEl('list', x, 288, w, 150, 'Perfil\nSegurança\nPrivacidade\nPagamentos'),
        tEl('select', x, 454, w, 44, 'Idioma: Português'),
        tEl('button', x, 514, w, 48, 'Sair da conta')
      ]);
    } },
    { id: 'profile', name: 'Perfil', desc: 'Foto, nome, selo, abas e dados do usuário.', build: function (W, H) {
      var L = tLayout(W, H), x = L.ax, w = L.desk ? Math.min(L.aw, 520) : L.aw, mid = L.desk ? x + (w - 96) / 2 : (W - 96) / 2;
      return tFrame(L, 'Perfil', 'Início\nPerfil\nAjustes\nAjuda').concat([
        tEl('image', mid, 80, 96, 96),
        tEl('text', x, 188, w, 32, 'Maria Silva'),
        tEl('badge', x, 224, 64, 24, 'Pro'),
        tEl('tabs', x, 264, w, 44, 'Resumo\nAtividade\nAjustes'),
        tEl('list', x, 320, w, 150, 'E-mail\nTelefone\nLocalização\nMembro desde'),
        tEl('button', x, 486, w, 48, 'Editar perfil')
      ]);
    } }
  ];

  function templateThumb(tpl) {
    var NS = 'http://www.w3.org/2000/svg', W = 360, H = 800;
    var sv = document.createElementNS(NS, 'svg');
    sv.setAttribute('class', 'tpl-thumb'); sv.setAttribute('viewBox', '0 0 ' + W + ' ' + H); sv.setAttribute('aria-hidden', 'true');
    var fr = document.createElementNS(NS, 'rect');
    fr.setAttribute('x', 2); fr.setAttribute('y', 2); fr.setAttribute('width', W - 4); fr.setAttribute('height', H - 4); fr.setAttribute('rx', 14);
    fr.setAttribute('fill', 'none'); fr.setAttribute('stroke', 'currentColor'); fr.setAttribute('stroke-width', 8); fr.setAttribute('opacity', '.5');
    sv.appendChild(fr);
    tpl.build(W, H).forEach(function (e) {
      var r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', e.x); r.setAttribute('y', e.y); r.setAttribute('width', e.w); r.setAttribute('height', e.h); r.setAttribute('rx', 8);
      r.setAttribute('fill', 'currentColor'); r.setAttribute('fill-opacity', e.type === 'text' || e.type === 'divider' ? '.18' : '.3');
      r.setAttribute('stroke', 'currentColor'); r.setAttribute('stroke-width', 5);
      sv.appendChild(r);
    });
    return sv;
  }

  function uniqueScreenName(base) {
    var names = state.project.screens.map(function (x) { return x.name; }), n = base, i = 2;
    while (names.indexOf(n) > -1) n = base + ' ' + (i++);
    return n.slice(0, 60);
  }

  function newScreenDialog() {
    var box = $('ns-templates'), nameInp = $('ns-name'), hint = $('ns-hint'), dirty = false;
    if (!box.children.length) {
      TEMPLATES.forEach(function (t, i) {
        var lab = document.createElement('label'); lab.className = 'tpl-opt';
        var r = document.createElement('input'); r.type = 'radio'; r.name = 'ns-tpl'; r.value = t.id; r.checked = i === 0;
        lab.appendChild(r);
        lab.appendChild(templateThumb(t));
        var st = document.createElement('strong'); st.textContent = t.name; lab.appendChild(st);
        var sm = document.createElement('small'); sm.textContent = t.desc; lab.appendChild(sm);
        box.appendChild(lab);
      });
    }
    var radios = document.getElementsByName('ns-tpl');
    radios[0].checked = true;
    var sel = function () { for (var i = 0; i < radios.length; i++) if (radios[i].checked) return TEMPLATES[i]; return TEMPLATES[0]; };
    var def = 'Tela ' + (state.project.screens.length + 1);
    nameInp.value = def;
    hint.textContent = TEMPLATES[0].desc;
    nameInp.oninput = function () { dirty = true; };
    box.onchange = function () {
      var t = sel();
      hint.textContent = t.desc;
      if (!dirty) nameInp.value = t.id === 'blank' ? def : uniqueScreenName(t.name);
    };
    var p = showDialog($('dlg-newscreen'));
    nameInp.focus(); nameInp.select();
    return p.then(function (v) { return v === 'ok' ? { name: nameInp.value.trim(), tpl: sel() } : null; });
  }

  /* ================================================================== réguas */
  function rulerStep(z) {
    var steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000], i;
    for (i = 0; i < steps.length; i++) if (steps[i] * z >= 56) return steps[i];
    return 1000;
  }

  function drawRulers() {
    if (!document.body.classList.contains('rulers-on')) return;
    var ws = $('workspace'), st = $('stage'), wr = ws.getBoundingClientRect(), sr = st.getBoundingClientRect();
    var p = state.project; if (!p) return;
    var vp = E.VIEWPORTS[p.viewport] || E.VIEWPORTS.mobile, z = sr.width / vp.w || 1;
    var T = 18, dpr = window.devicePixelRatio || 1, cs = getComputedStyle(document.documentElement);
    var col = { bg: cs.getPropertyValue('--surface').trim() || '#F6F7F9', tx: cs.getPropertyValue('--text').trim() || '#10141D', bd: cs.getPropertyValue('--border').trim() || '#7B8394', ac: cs.getPropertyValue('--accent').trim() || '#2563EB' };
    var step = rulerStep(z), minor = step / (step % 5 === 0 && step >= 50 ? 5 : (step % 2 === 0 ? 2 : 1));
    var sel = engine.selectedElements(), bb = null;
    if (sel.length) {
      bb = { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity };
      sel.forEach(function (e) { bb.x1 = Math.min(bb.x1, e.x); bb.y1 = Math.min(bb.y1, e.y); bb.x2 = Math.max(bb.x2, e.x + e.w); bb.y2 = Math.max(bb.y2, e.y + e.h); });
    }
    function paint(id, horiz) {
      var cv = $(id), len = horiz ? wr.width : wr.height;
      var left = horiz ? wr.left : wr.left - T, top = horiz ? wr.top - T : wr.top;
      cv.style.left = left + 'px'; cv.style.top = top + 'px';
      cv.style.width = (horiz ? len : T) + 'px'; cv.style.height = (horiz ? T : len) + 'px';
      cv.width = Math.round((horiz ? len : T) * dpr); cv.height = Math.round((horiz ? T : len) * dpr);
      var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.fillStyle = col.bg; c.fillRect(0, 0, horiz ? len : T, horiz ? T : len);
      var origin = horiz ? sr.left - wr.left : sr.top - wr.top, max = horiz ? vp.w : vp.h;
      if (bb) {
        c.fillStyle = col.ac; c.globalAlpha = 0.28;
        var a = origin + (horiz ? bb.x1 : bb.y1) * z, b = origin + (horiz ? bb.x2 : bb.y2) * z;
        if (horiz) c.fillRect(a, 0, b - a, T); else c.fillRect(0, a, T, b - a);
        c.globalAlpha = 1;
      }
      c.strokeStyle = col.bd; c.fillStyle = col.tx; c.lineWidth = 1; c.font = '10px sans-serif'; c.textBaseline = 'top';
      c.beginPath();
      for (var u = 0; u <= max + 0.001; u += minor) {
        var pos = Math.round(origin + u * z) + 0.5;
        if (pos < 0 || pos > len) continue;
        var major = Math.abs(u / step - Math.round(u / step)) < 1e-6, tl = major ? T : T * 0.35;
        if (horiz) { c.moveTo(pos, T - tl); c.lineTo(pos, T); } else { c.moveTo(T - tl, pos); c.lineTo(T, pos); }
        if (major) {
          if (horiz) { c.textAlign = 'left'; c.fillText(String(Math.round(u)), pos + 2, 1); }
          else { c.save(); c.translate(1, pos + 2); c.rotate(-Math.PI / 2); c.textAlign = 'right'; c.fillText(String(Math.round(u)), 0, 0); c.restore(); }
        }
      }
      c.stroke();
      c.strokeStyle = col.bd; c.beginPath();
      if (horiz) { c.moveTo(0, T - 0.5); c.lineTo(len, T - 0.5); } else { c.moveTo(T - 0.5, 0); c.lineTo(T - 0.5, len); }
      c.stroke();
      var pt = state.rulerPt;
      if (pt) {
        var cp = (horiz ? pt.x - wr.left : pt.y - wr.top);
        if (cp >= 0 && cp <= len) { c.strokeStyle = col.ac; c.lineWidth = 2; c.beginPath(); if (horiz) { c.moveTo(cp, 0); c.lineTo(cp, T); } else { c.moveTo(0, cp); c.lineTo(T, cp); } c.stroke(); }
      }
    }
    paint('ruler-h', true); paint('ruler-v', false);
  }

  function setRulers(on, persist) {
    document.body.classList.toggle('rulers-on', !!on);
    $('tb-rulers').setAttribute('aria-pressed', on ? 'true' : 'false');
    if (persist) { try { localStorage.setItem('alicerce.rulers', on ? '1' : '0'); } catch (e) {} }
    schedulePositionSelBar();
    if (state.autoFit) setTimeout(function () { if (state.autoFit) fitView(); schedulePositionSelBar(); }, 60);
  }

  /* ================================================================== visão geral das telas */
  function moveScreen(from, to) {
    var p = state.project;
    if (to < 0 || to >= p.screens.length || from === to) return false;
    var sc = p.screens.splice(from, 1)[0];
    p.screens.splice(to, 0, sc);
    renderTabs();
    commit('screen-move');
    return true;
  }

  function renderOverview(focusId, focusBtn) {
    var p = state.project, grid = $('ov-grid'), n = p.screens.length, vp = E.VIEWPORTS[p.viewport] || E.VIEWPORTS.mobile;
    grid.textContent = '';
    var dragFrom = -1;
    p.screens.forEach(function (sc, i) {
      var li = document.createElement('li');
      li.className = 'ov-card' + (sc.id === p.activeScreenId ? ' is-current' : '');
      li.draggable = true;
      li.dataset.index = i;
      var open = document.createElement('button');
      open.type = 'button'; open.className = 'ov-open'; open.dataset.screen = sc.id;
      open.setAttribute('aria-label', 'Abrir a tela ' + (i + 1) + ', ' + sc.name);
      var cv = E.renderScreenCanvas(sc, p.viewport, Math.min(1, 380 / vp.w));
      cv.setAttribute('aria-hidden', 'true');
      open.appendChild(cv);
      li.appendChild(open);
      var meta = document.createElement('div'); meta.className = 'ov-meta';
      var nm = document.createElement('span'); nm.className = 'ov-name'; nm.textContent = (i + 1) + '. ' + sc.name; nm.title = sc.name;
      meta.appendChild(nm);
      [['left', 'Mover para antes', i - 1, '#i-chevron-left', i === 0], ['right', 'Mover para depois', i + 1, '#i-chevron-right', i === n - 1]].forEach(function (d) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'icon-btn'; b.dataset.move = d[0]; b.dataset.index = i;
        b.setAttribute('aria-label', d[1] + ': ' + sc.name); b.title = d[1]; b.disabled = d[4];
        b.innerHTML = '<svg class="icon" aria-hidden="true"><use href="' + d[3] + '"/></svg>';
        meta.appendChild(b);
      });
      li.appendChild(meta);
      li.addEventListener('dragstart', function (ev) { dragFrom = i; li.classList.add('is-drag'); ev.dataTransfer.effectAllowed = 'move'; try { ev.dataTransfer.setData('text/plain', String(i)); } catch (e) {} });
      li.addEventListener('dragend', function () { li.classList.remove('is-drag'); grid.querySelectorAll('.is-over').forEach(function (x) { x.classList.remove('is-over'); }); });
      li.addEventListener('dragover', function (ev) { if (dragFrom < 0) return; ev.preventDefault(); li.classList.add('is-over'); });
      li.addEventListener('dragleave', function () { li.classList.remove('is-over'); });
      li.addEventListener('drop', function (ev) {
        ev.preventDefault();
        var from = dragFrom; dragFrom = -1;
        if (from >= 0 && moveScreen(from, i)) { announce('Tela movida para a posição ' + (i + 1) + '.'); renderOverview(p.screens[i].id); }
      });
      grid.appendChild(li);
    });
    if (focusId) {
      var t = focusBtn ? grid.querySelector('[data-screen="' + focusId + '"]').parentNode.querySelector('[data-move="' + focusBtn + '"]') : null;
      if (t && t.disabled) t = grid.querySelector('[data-screen="' + focusId + '"]').parentNode.querySelector('[data-move]:not(:disabled)');
      (t || grid.querySelector('[data-screen="' + focusId + '"]')).focus();
    }
  }

  function bindOverview() {
    $('ov-grid').addEventListener('click', function (ev) {
      var mv = ev.target.closest('[data-move]');
      if (mv) {
        var i = Number(mv.dataset.index), to = mv.dataset.move === 'left' ? i - 1 : i + 1, id = state.project.screens[i].id;
        if (moveScreen(i, to)) { announce('Tela movida para a posição ' + (to + 1) + '.'); renderOverview(id, mv.dataset.move); }
        return;
      }
      var op = ev.target.closest('.ov-open');
      if (op) { $('dlg-overview').close(); switchScreen(op.dataset.screen); }
    });
  }

  function openOverview() {
    renderOverview();
    showDialog($('dlg-overview'));
    var cur = $('ov-grid').querySelector('.is-current .ov-open');
    if (cur) cur.focus();
  }

  async function addScreen() {
    var p = state.project;
    var r = await newScreenDialog();
    if (!r || !r.name) return;
    var vp = E.VIEWPORTS[p.viewport] || E.VIEWPORTS.mobile;
    var els = r.tpl.build(vp.w, vp.h).map(function (e) { e.id = E.uid(); return e; });
    var sc = { id: E.uid(), name: r.name.slice(0, 60), elements: els };
    p.screens.push(sc);
    p.activeScreenId = sc.id;
    engine.setScreen(sc, p.viewport);
    renderTabs(sc.id);
    commit('screen-add');
    if (els.length) announce('Tela criada a partir do modelo ' + r.tpl.name + ', com ' + els.length + ' elementos.');
  }

  async function renameScreen() {
    var sc = activeScreen();
    var name = await promptDialog({ title: 'Renomear tela', label: 'Nome da tela', value: sc.name, okText: 'Renomear' });
    if (!name) return;
    sc.name = name.slice(0, 60);
    renderTabs();
    commit('screen-rename');
  }

  function duplicateScreen() {
    var p = state.project, sc = activeScreen();
    var copy = JSON.parse(JSON.stringify(sc));
    copy.id = E.uid();
    copy.name = (sc.name + ' (cópia)').slice(0, 60);
    var idm = {};
    copy.elements.forEach(function (e) { var n = E.uid(); idm[e.id] = n; e.id = n; });
    copy.elements.forEach(function (e) { if (e.from) e.from = idm[e.from] || null; if (e.to) e.to = idm[e.to] || null; });
    var i = p.screens.indexOf(sc);
    p.screens.splice(i + 1, 0, copy);
    p.activeScreenId = copy.id;
    engine.setScreen(copy, p.viewport);
    renderTabs(copy.id);
    commit('screen-dup');
    toast('Tela duplicada.');
  }

  async function deleteScreen() {
    var p = state.project, sc = activeScreen();
    if (p.screens.length <= 1) { toast('O projeto precisa ter pelo menos uma tela.', 'error'); return; }
    var c = await confirmDialog({ title: 'Excluir tela', message: 'Excluir a tela "' + sc.name + '" e todos os seus elementos? Você pode desfazer logo em seguida.', ok: 'Excluir tela', danger: true });
    if (c !== 'ok') return;
    var i = p.screens.indexOf(sc);
    p.screens.splice(i, 1);
    p.screens.forEach(function (x) { x.elements.forEach(function (e) { if (e.go === sc.id) e.go = null; }); });
    var next = p.screens[Math.min(i, p.screens.length - 1)];
    p.activeScreenId = next.id;
    engine.setScreen(next, p.viewport);
    renderTabs(next.id);
    commit('screen-delete');
    toast('Tela excluída.');
  }

  function setViewport(key) {
    var p = state.project;
    if (p.viewport === key) return;
    var o = VIEWPORTS[p.viewport], n = VIEWPORTS[key];
    p.screens.forEach(function (sc) {
      sc.elements.forEach(function (el) {
        if (el.type === 'navbar' && el.x === 0 && el.w === o.w) { el.w = n.w; return; }
        el.w = Math.min(el.w, n.w);
        el.h = Math.min(el.h, n.h);
        el.x = clamp(el.x, 0, n.w - el.w);
        el.y = clamp(el.y, 0, n.h - el.h);
      });
    });
    p.viewport = key;
    engine.setViewport(key, false);
    engine.render();
    updateViewportButtons();
    fitView();
    commit('viewport');
    announce('Moldura ' + n.label + '.');
  }

  /* ================================================================== projetos */
  async function openProject(project) {
    await flushSave();
    state.project = project;
    var rec = null;
    try { rec = await S.getHistory(project.id); } catch (e) { rec = null; }
    var ok = rec && rec.sig === sigOf(project) && Array.isArray(rec.stack) && rec.stack.length &&
      typeof rec.idx === 'number' && rec.idx >= 0 && rec.idx < rec.stack.length;
    state.hist = ok ? { stack: rec.stack, idx: rec.idx } : { stack: [snap(project)], idx: 0 };
    state.lastTag = null;
    ls('alicerce.last', project.id);
    updateHeader();
    updateViewportButtons();
    renderTabs();
    updateUndoRedo();
    engine.setScreen(activeScreen(), project.viewport);
    fitView();
    syncInspector(true);
    setStatus('Pronto');
  }

  async function refreshCount() {
    try { state.projectCount = await S.countProjects(); } catch (e) { state.projectCount = state.project ? 1 : 0; }
    updateBadge();
  }

  function updateBadge() {
    if (!('setAppBadge' in navigator)) return;
    var n = state.projectCount || 0;
    var p = n > 0 ? navigator.setAppBadge(n) : navigator.clearAppBadge();
    if (p && p.catch) p.catch(function () { /* sem permissão para badge */ });
  }

  async function createNewProject() {
    var r = await newProjectDialog();
    if (!r) return;
    await flushSave();
    var p = createProject(r.name || 'Novo projeto', r.viewport);
    await S.putProject(p);
    await openProject(p);
    await refreshCount();
    toast('Projeto "' + p.name + '" criado.');
  }

  async function renameCurrentProject() {
    var name = await promptDialog({ title: 'Renomear projeto', label: 'Nome do projeto', value: state.project.name, okText: 'Renomear' });
    if (!name) return;
    state.project.name = name.slice(0, 80);
    updateHeader();
    commit('name');
  }

  async function renderProjects() {
    var list = $('projects-list');
    var all = await S.getAllProjects();
    all.sort(function (a, b) { return b.updatedAt - a.updatedAt; });
    list.textContent = '';
    if (!all.length) {
      var li = document.createElement('li');
      li.className = 'muted';
      li.textContent = 'Nenhum projeto salvo.';
      list.appendChild(li);
      return;
    }
    all.forEach(function (p) {
      var isCur = state.project && p.id === state.project.id;
      var live = isCur ? state.project : p;
      var row = document.createElement('li');
      row.className = 'proj-row' + (isCur ? ' is-current' : '');
      var info = document.createElement('div');
      info.className = 'proj-info';
      var nm = document.createElement('div');
      nm.className = 'proj-name';
      nm.textContent = (isCur ? '● ' : '') + live.name + (isCur ? ' (aberto)' : '');
      var meta = document.createElement('div');
      meta.className = 'proj-meta';
      var n = live.screens.length;
      meta.textContent = n + (n === 1 ? ' tela' : ' telas') + ' · ' + VIEWPORTS[live.viewport].label + ' · atualizado em ' +
        new Date(live.updatedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
      info.appendChild(nm);
      info.appendChild(meta);
      var act = document.createElement('div');
      act.className = 'proj-actions';
      [['open', 'Abrir', 'i-folder'], ['rename', 'Renomear', 'i-edit'], ['dup', 'Duplicar', 'i-duplicate'], ['del', 'Excluir', 'i-trash']].forEach(function (a) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn btn-secondary';
        b.dataset.pact = a[0];
        b.dataset.id = p.id;
        b.setAttribute('aria-label', a[1] + ' projeto ' + live.name);
        b.appendChild(svgIcon(a[2]));
        b.appendChild(document.createTextNode(a[1]));
        act.appendChild(b);
      });
      row.appendChild(info);
      row.appendChild(act);
      list.appendChild(row);
    });
  }

  async function openProjectsDialog() {
    await flushSave();
    await renderProjects();
    var dlg = $('dlg-projects');
    if (!dlg.open) dlg.showModal();
  }

  async function projectAction(act, id) {
    var isCur = state.project && state.project.id === id;
    var p = isCur ? state.project : await S.getProject(id);
    if (!p) { await renderProjects(); return; }
    if (act === 'open') {
      $('dlg-projects').close('cancel');
      if (!isCur) { await openProject(p); toast('Projeto "' + p.name + '" aberto.'); }
      return;
    }
    if (act === 'rename') {
      var name = await promptDialog({ title: 'Renomear projeto', label: 'Nome do projeto', value: p.name, okText: 'Renomear' });
      if (!name) return;
      p.name = name.slice(0, 80);
      p.updatedAt = Date.now();
      if (isCur) { updateHeader(); commit('name'); await flushSave(); } else { await S.putProject(p); }
      await renderProjects();
      return;
    }
    if (act === 'dup') {
      var copy = cloneProject(p, (p.name + ' (cópia)').slice(0, 80));
      await S.putProject(copy);
      await refreshCount();
      await renderProjects();
      toast('Projeto duplicado como "' + copy.name + '".');
      return;
    }
    if (act === 'del') {
      var c = await confirmDialog({ title: 'Excluir projeto', message: 'Excluir definitivamente "' + p.name + '" e todas as suas telas deste dispositivo? Esta ação não pode ser desfeita. Considere exportar um backup antes.', ok: 'Excluir projeto', danger: true });
      if (c !== 'ok') return;
      if (isCur) { clearTimeout(state.saveTimer); state.dirty = false; await state.chain; }
      await S.deleteProject(id);
      state.handles.delete(id);
      if (isCur) {
        var rest = await S.getAllProjects();
        rest.sort(function (a, b) { return b.updatedAt - a.updatedAt; });
        var next = rest[0];
        if (!next) { next = createProject('Meu primeiro projeto', 'mobile'); await S.putProject(next); }
        await openProject(next);
      }
      await refreshCount();
      await renderProjects();
      toast('Projeto excluído.');
    }
  }

  /* ================================================================== arquivos */
  async function getHandle(id) {
    if (state.handles.has(id)) return state.handles.get(id);
    try {
      var h = await S.getMeta('handle:' + id);
      if (h) state.handles.set(id, h);
      return h || null;
    } catch (e) { return null; }
  }
  async function rememberHandle(id, h) {
    state.handles.set(id, h);
    try { await S.setMeta('handle:' + id, h); } catch (e) { /* ignorado */ }
  }
  async function ensureWritePermission(h) {
    var opts = { mode: 'readwrite' };
    if ((await h.queryPermission(opts)) === 'granted') return true;
    return (await h.requestPermission(opts)) === 'granted';
  }

  async function openFile() {
    if ('showOpenFilePicker' in window) {
      try {
        var r = await window.showOpenFilePicker({ types: FILE_TYPES, multiple: false });
        var h = r[0], f = await h.getFile();
        await handleFileText(await f.text(), f.name, h);
      } catch (e) {
        if (e && e.name !== 'AbortError') toast('Não foi possível abrir o arquivo: ' + errMsg(e), 'error');
      }
      return;
    }
    $('file-input').click();
  }

  async function handleFileText(text, name, handle) {
    var data;
    try { data = JSON.parse(text); } catch (e) {
      toast('"' + (name || 'Arquivo') + '" não é um JSON válido.', 'error');
      return;
    }
    try {
      if (data && (data.kind === 'backup' || Array.isArray(data.projects))) {
        await restoreBackup(data.projects);
        var addedSn = await mergeSnippets(data.snippets);
        if (addedSn) toast(addedSn + (addedSn === 1 ? ' componente salvo restaurado.' : ' componentes salvos restaurados.'));
        return;
      }
      var project = normalizeProject(data && data.project ? data.project : data);
      await importProject(project, handle);
    } catch (e) {
      toast('Não foi possível importar: ' + errMsg(e), 'error');
    }
  }

  async function importProject(project, handle) {
    await flushSave();
    var existing = await S.getProject(project.id);
    var replaced = false;
    if (existing) {
      var c = await confirmDialog({
        title: 'Projeto já existe',
        message: 'Já existe um projeto salvo com o mesmo identificador: "' + existing.name + '". Substituir pelo conteúdo do arquivo ou importar como uma cópia?',
        ok: 'Substituir', alt: 'Importar como cópia'
      });
      if (c === 'cancel') return;
      if (c === 'alt') {
        project.id = E.uid();
        project.name = (project.name + ' (importado)').slice(0, 80);
      } else {
        replaced = true;
        await S.deleteHistory(project.id);
      }
    }
    project.updatedAt = Date.now();
    await S.putProject(project);
    if (handle && (replaced || !existing)) await rememberHandle(project.id, handle);
    await openProject(project);
    await refreshCount();
    toast('Projeto "' + project.name + '" importado com ' + project.screens.length + (project.screens.length === 1 ? ' tela.' : ' telas.'));
  }

  async function restoreBackup(rawList) {
    if (!Array.isArray(rawList) || !rawList.length) throw new Error('o backup não contém projetos.');
    var seen = new Set(), list = [], skipped = 0;
    rawList.forEach(function (r) {
      try {
        var p = normalizeProject(r);
        if (seen.has(p.id)) p.id = E.uid();
        seen.add(p.id);
        list.push(p);
      } catch (e) { skipped++; }
    });
    if (!list.length) throw new Error('nenhum projeto válido foi encontrado no backup.');
    await flushSave();
    var existing = await S.getAllProjects();
    var c = await confirmDialog({
      title: 'Restaurar backup',
      message: 'O backup contém ' + list.length + (list.length === 1 ? ' projeto' : ' projetos') + (skipped ? ' (' + skipped + ' inválido(s) ignorado(s))' : '') +
        '. Você tem ' + existing.length + ' salvo(s) neste dispositivo.\n\nSubstituir tudo apaga os projetos atuais e mantém somente o backup. Mesclar mantém os atuais e sobrescreve os que tiverem o mesmo identificador.',
      ok: 'Substituir tudo', alt: 'Mesclar', danger: true
    });
    if (c === 'cancel') return;
    var curId = state.project && state.project.id;
    if (c === 'ok') {
      state.dirty = false;
      clearTimeout(state.saveTimer);
      await state.chain;
      for (var i = 0; i < existing.length; i++) { await S.deleteProject(existing[i].id); state.handles.delete(existing[i].id); }
    } else {
      for (var j = 0; j < list.length; j++) await S.deleteHistory(list[j].id);
    }
    await S.putProjects(list);
    var target = null;
    list.forEach(function (p) { if (p.id === curId) target = p; });
    if (c === 'ok' || target) {
      await openProject(target || list.sort(function (a, b) { return b.updatedAt - a.updatedAt; })[0]);
    }
    await refreshCount();
    toast('Backup restaurado: ' + list.length + (list.length === 1 ? ' projeto.' : ' projetos.'));
  }

  async function saveToDisk(forceAs, retried) {
    var p = state.project;
    await flushSave();
    var text = projectFileText(p);
    if (!('showSaveFilePicker' in window)) {
      downloadBlob(new Blob([text], { type: 'application/json' }), slug(p.name) + '.alicerce');
      toast('Arquivo "' + slug(p.name) + '.alicerce" baixado.');
      return;
    }
    try {
      var h = forceAs ? null : await getHandle(p.id);
      if (h && !(await ensureWritePermission(h))) h = null;
      if (!h) h = await window.showSaveFilePicker({ suggestedName: slug(p.name) + '.alicerce', types: FILE_TYPES });
      var w = await h.createWritable();
      await w.write(text);
      await w.close();
      await rememberHandle(p.id, h);
      toast('Salvo em "' + h.name + '".');
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      if (e && e.name === 'NotFoundError' && !retried) {
        state.handles.delete(p.id);
        try { await S.deleteMeta('handle:' + p.id); } catch (x) { /* ignorado */ }
        return saveToDisk(true, true);
      }
      toast('Não foi possível salvar no disco: ' + errMsg(e), 'error');
    }
  }

  function exportJson() {
    var p = state.project;
    flushSave();
    downloadBlob(new Blob([projectFileText(p)], { type: 'application/json' }), slug(p.name) + '.alicerce.json');
    toast('Projeto exportado com ' + p.screens.length + (p.screens.length === 1 ? ' tela.' : ' telas.'));
  }

  async function exportPng(all) {
    var p = state.project;
    try {
      var canvas = all ? E.renderSheetCanvas(p) : E.renderScreenCanvas(activeScreen(), p.viewport, 2);
      var blob = await canvasToBlob(canvas);
      downloadBlob(blob, slug(p.name) + (all ? '-todas-as-telas' : '-' + slug(activeScreen().name)) + '.png');
      toast(all ? 'PNG com todas as telas exportado.' : 'PNG da tela exportado.');
    } catch (e) { toast(errMsg(e), 'error'); }
  }

  async function exportSvg(all) {
    var p = state.project;
    try {
      var text = all ? E.renderSheetSvg(p) : E.renderScreenSvg(activeScreen(), p.viewport);
      downloadBlob(new Blob([text], { type: 'image/svg+xml' }), slug(p.name) + (all ? '-todas-as-telas' : '-' + slug(activeScreen().name)) + '.svg');
      toast(all ? 'SVG com todas as telas exportado.' : 'SVG da tela exportado.');
    } catch (e) { toast(errMsg(e), 'error'); }
  }

  async function exportPdf(all) {
    var p = state.project;
    try {
      var blob = E.renderPdfBytes(p, all ? p.screens : [activeScreen()]);
      downloadBlob(blob, slug(p.name) + (all ? '' : '-' + slug(activeScreen().name)) + '.pdf');
      toast(all ? 'PDF com ' + p.screens.length + (p.screens.length === 1 ? ' página exportado.' : ' páginas exportado.') : 'PDF da tela exportado.');
    } catch (e) { toast(errMsg(e), 'error'); }
  }

  async function backupAll() {
    await flushSave();
    var list = await S.getAllProjects();
    if (!list.length) { toast('Não há projetos para exportar.', 'error'); return; }
    var text = JSON.stringify({ app: 'alicerce', kind: 'backup', version: 1, exportedAt: new Date().toISOString(), projects: list, snippets: state.snippets || [] }, null, 2);
    var name = 'alicerce-backup-' + dateStamp() + '.json';
    if ('showSaveFilePicker' in window) {
      try {
        var h = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'Backup Alicerce (.json)', accept: { 'application/json': ['.json'] } }] });
        var w = await h.createWritable();
        await w.write(text);
        await w.close();
        toast('Backup com ' + list.length + (list.length === 1 ? ' projeto' : ' projetos') + ' salvo em "' + h.name + '".');
      } catch (e) {
        if (e && e.name !== 'AbortError') toast('Não foi possível salvar o backup: ' + errMsg(e), 'error');
      }
      return;
    }
    downloadBlob(new Blob([text], { type: 'application/json' }), name);
    toast('Backup com ' + list.length + (list.length === 1 ? ' projeto exportado.' : ' projetos exportado.'));
  }

  /* ================================================================== compartilhar */
  async function tryShare(files, title, text) {
    if (!navigator.share || !navigator.canShare) return false;
    if (!navigator.canShare({ files: files })) return false;
    try {
      await navigator.share({ files: files, title: title, text: text });
    } catch (e) {
      if (e && e.name !== 'AbortError') throw e;
    }
    return true;
  }

  async function shareProject() {
    var p = state.project;
    await flushSave();
    var text = projectFileText(p);
    try {
      var done = await tryShare([new File([text], slug(p.name) + '.alicerce', { type: 'application/json' })], p.name + ' — Alicerce', 'Projeto de wireframe criado no Alicerce.');
      if (!done) done = await tryShare([new File([text], slug(p.name) + '.alicerce.json', { type: 'text/plain' })], p.name + ' — Alicerce', 'Projeto de wireframe criado no Alicerce.');
      if (!done) {
        downloadBlob(new Blob([text], { type: 'application/json' }), slug(p.name) + '.alicerce.json');
        toast('Este navegador não compartilha arquivos. O projeto foi baixado.');
      }
    } catch (e) { toast('Não foi possível compartilhar: ' + errMsg(e), 'error'); }
  }

  async function sharePng() {
    var p = state.project;
    try {
      var blob = await canvasToBlob(E.renderSheetCanvas(p));
      var name = slug(p.name) + '.png';
      var done = await tryShare([new File([blob], name, { type: 'image/png' })], p.name + ' — Alicerce', 'Wireframe criado no Alicerce.');
      if (!done) {
        downloadBlob(blob, name);
        toast('Este navegador não compartilha imagens. O PNG foi baixado.');
      }
    } catch (e) { toast('Não foi possível compartilhar: ' + errMsg(e), 'error'); }
  }

  /* ================================================================== impressão */
  function printAll() {
    var p = state.project;
    var vp = VIEWPORTS[p.viewport];
    var st = $('print-orient');
    if (!st) { st = document.createElement('style'); st.id = 'print-orient'; document.head.appendChild(st); }
    st.textContent = '@page { size: ' + (vp.w > vp.h ? 'landscape' : 'portrait') + '; margin: 10mm; }';
    E.buildPrintArea(p, $('print-area'));
    var cleanup = function () { $('print-area').textContent = ''; window.removeEventListener('afterprint', cleanup); };
    window.addEventListener('afterprint', cleanup);
    setTimeout(function () { window.print(); }, 60);
  }

  /* ================================================================== área de transferência */
  async function copySelection() {
    var data = engine.copyData();
    if (!data) return;
    state.clip = data;
    try { await navigator.clipboard.writeText(data); toast('Elemento copiado.'); }
    catch (e) { toast('Copiado (disponível apenas dentro do Alicerce).'); }
  }
  async function pasteClipboard() {
    var text = '';
    try { text = await navigator.clipboard.readText(); } catch (e) { text = ''; }
    if (engine.pasteData(text)) return;
    if (state.clip && engine.pasteData(state.clip)) return;
    toast('A área de transferência não contém elementos do Alicerce.', 'error');
  }
  function inWorkspace() {
    var a = document.activeElement;
    return !!(a && a.closest && a.closest('#workspace') && !a.matches('textarea, input, select'));
  }
  function bindClipboardEvents() {
    document.addEventListener('copy', function (e) {
      if (!inWorkspace()) return;
      var d = engine.copyData();
      if (!d) return;
      e.clipboardData.setData('text/plain', d);
      e.preventDefault();
      state.clip = d;
      toast('Elemento copiado.');
    });
    document.addEventListener('cut', function (e) {
      if (!inWorkspace()) return;
      var d = engine.copyData();
      if (!d) return;
      e.clipboardData.setData('text/plain', d);
      e.preventDefault();
      state.clip = d;
      engine.deleteSelected();
      toast('Elemento recortado.');
    });
    document.addEventListener('paste', function (e) {
      if (!inWorkspace()) return;
      e.preventDefault();
      var t = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
      if (!engine.pasteData(t)) toast('A área de transferência não contém elementos do Alicerce.', 'error');
    });
  }

  /* ================================================================== temas e modo */
  function applyTheme(id, silent) {
    if (!THEMES.some(function (t) { return t.id === id; })) id = 'original';
    document.documentElement.dataset.theme = id;
    ls('alicerce.theme', id);
    syncThemeUI();
    if (!silent) announce('Tema ' + THEMES.filter(function (t) { return t.id === id; })[0].name + ' ativado.');
  }
  function applyMode(mode, silent) {
    mode = mode === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.mode = mode;
    ls('alicerce.mode', mode);
    syncThemeUI();
    if (!silent) announce(mode === 'dark' ? 'Modo escuro ativado.' : 'Modo claro ativado.');
  }
  function syncThemeUI() {
    var d = document.documentElement, theme = d.dataset.theme, dark = d.dataset.mode === 'dark';
    document.querySelectorAll('.js-theme-select').forEach(function (s) { s.value = theme; });
    document.querySelectorAll('#theme-radios input').forEach(function (r) { r.checked = r.value === theme; });
    document.querySelectorAll('.js-mode-toggle').forEach(function (b) {
      var u = b.querySelector('use');
      if (u) u.setAttribute('href', dark ? '#i-sun' : '#i-moon');
      b.setAttribute('aria-label', dark ? 'Ativar modo claro' : 'Ativar modo escuro');
      var t = b.querySelector('.btn-text');
      if (t) t.textContent = dark ? 'Modo claro' : 'Modo escuro';
    });
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      var c = getComputedStyle(d).getPropertyValue('--header-bg').trim();
      if (c) meta.setAttribute('content', c);
    }
  }
  function buildThemeRadios() {
    var box = $('theme-radios');
    THEMES.forEach(function (t) {
      var label = document.createElement('label');
      label.className = 'theme-opt';
      var inp = document.createElement('input');
      inp.type = 'radio';
      inp.name = 'theme';
      inp.value = t.id;
      var sw = document.createElement('span');
      sw.className = 'swatch';
      sw.style.background = t.grad;
      sw.setAttribute('aria-hidden', 'true');
      var nm = document.createElement('span');
      nm.className = 'theme-name';
      nm.textContent = t.name;
      var sub = document.createElement('small');
      sub.className = 'theme-sub';
      sub.textContent = t.sub;
      nm.appendChild(sub);
      label.appendChild(inp);
      label.appendChild(sw);
      label.appendChild(nm);
      label.appendChild(svgIcon('i-check'));
      box.appendChild(label);
    });
    box.addEventListener('change', function (e) { if (e.target.name === 'theme') applyTheme(e.target.value); });
  }

  /* ================================================================== tela cheia, instalação */
  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(function () { /* ignorado */ });
    } else {
      document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(function (e) {
        toast('Não foi possível entrar em tela cheia: ' + errMsg(e), 'error');
      });
    }
  }
  function syncFullscreenUI() {
    var on = !!document.fullscreenElement;
    document.querySelectorAll('.js-fs').forEach(function (b) {
      var u = b.querySelector('use');
      if (u) u.setAttribute('href', on ? '#i-fullscreen-exit' : '#i-fullscreen');
      b.setAttribute('aria-label', on ? 'Sair da tela cheia' : 'Entrar em tela cheia');
      b.title = on ? 'Sair da tela cheia' : 'Tela cheia';
      var t = b.querySelector('.btn-text');
      if (t) t.textContent = on ? 'Sair da tela cheia' : 'Tela cheia';
    });
    setTimeout(function () { if (state.autoFit) fitView(); }, 150);
  }

  function isInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: window-controls-overlay)').matches ||
      window.navigator.standalone === true;
  }
  function showInstall(show) {
    document.querySelectorAll('.js-install').forEach(function (b) { b.hidden = !show; });
  }
  async function installApp() {
    var ev = state.deferredPrompt;
    if (!ev) { toast('A instalação não está disponível neste momento.', 'error'); return; }
    state.deferredPrompt = null;
    showInstall(false);
    try {
      ev.prompt();
      var r = await ev.userChoice;
      if (r && r.outcome === 'accepted') toast('Instalando o Alicerce…');
    } catch (e) { toast('Não foi possível instalar: ' + errMsg(e), 'error'); }
  }

  /* ================================================================== gaveta */
  function drawerFocusables() {
    return Array.prototype.filter.call($('drawer').querySelectorAll('a[href], button:not([disabled]), input:not([disabled])'), function (n) { return n.offsetParent !== null; });
  }
  function openDrawer() {
    if (state.drawerOpen) return;
    state.drawerOpen = true;
    var d = $('drawer');
    d.removeAttribute('inert');
    d.setAttribute('aria-hidden', 'false');
    d.classList.add('open');
    $('drawer-backdrop').hidden = false;
    $('btn-menu').setAttribute('aria-expanded', 'true');
    setTimeout(function () { $('drawer-close').focus(); }, 30);
  }
  function closeDrawer(restoreFocus) {
    if (!state.drawerOpen) return;
    state.drawerOpen = false;
    var d = $('drawer');
    d.classList.remove('open');
    d.setAttribute('aria-hidden', 'true');
    d.setAttribute('inert', '');
    $('drawer-backdrop').hidden = true;
    $('btn-menu').setAttribute('aria-expanded', 'false');
    if (restoreFocus !== false) $('btn-menu').focus();
  }

  /* ================================================================== paleta */
  function buildPalette() {
    var list = $('palette-list');
    E.GROUPS.forEach(function (g) {
      var gh = document.createElement('h3');
      gh.className = 'palette-group';
      gh.textContent = g.label;
      list.appendChild(gh);
      g.types.forEach(function (type) { addPaletteItem(list, type); });
    });
    buildPaletteEvents(list);
    buildPaletteEvents($('saved-list'));
  }

  function addPaletteItem(list, type) {
    {
      var c = COMPONENTS[type];
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'palette-item';
      b.dataset.type = type;
      b.setAttribute('aria-label', 'Inserir ' + c.label);
      b.title = 'Inserir ' + c.label + ' (clique ou arraste)';
      b.appendChild(svgIcon(c.icon));
      var sp = document.createElement('span');
      sp.textContent = c.label;
      b.appendChild(sp);
      list.appendChild(b);
    }
  }

  function snippetById(id) { return (state.snippets || []).filter(function (x) { return x.id === id; })[0]; }
  function placePaletteItem(b, pos) {
    if (b.dataset.snippet) engine.insertSnippet(snippetById(b.dataset.snippet), pos);
    else engine.addElement(b.dataset.type, pos);
  }

  function buildPaletteEvents(list) {
    list.addEventListener('click', function (e) {
      var b = e.target.closest('.palette-item');
      if (!b) return;
      if (state.suppressClick) { state.suppressClick = false; return; }
      placePaletteItem(b);
    });

    var drag = null;
    list.addEventListener('pointerdown', function (e) {
      var b = e.target.closest('.palette-item');
      if (!b || e.pointerType === 'touch' || e.button !== 0) return;
      drag = { b: b, sx: e.clientX, sy: e.clientY, ghost: null, id: e.pointerId };
      try { b.setPointerCapture(e.pointerId); } catch (x) { /* ignorado */ }
    });
    list.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.ghost) {
        if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 8) return;
        var g = document.createElement('div');
        g.className = 'drag-ghost';
        var sdrag = drag.b.dataset.snippet ? snippetById(drag.b.dataset.snippet) : null;
        if (drag.b.dataset.snippet && !sdrag) { drag = null; return; }
        g.appendChild(svgIcon(sdrag ? COMPONENTS[sdrag.elements[0].type].icon : COMPONENTS[drag.b.dataset.type].icon));
        g.appendChild(document.createTextNode(sdrag ? sdrag.name : COMPONENTS[drag.b.dataset.type].label));
        document.body.appendChild(g);
        document.body.classList.add('is-dragging');
        drag.ghost = g;
      }
      drag.ghost.style.left = e.clientX + 'px';
      drag.ghost.style.top = e.clientY + 'px';
    });
    var end = function (e, cancel) {
      if (!drag || e.pointerId !== drag.id) return;
      var d = drag;
      drag = null;
      try { d.b.releasePointerCapture(e.pointerId); } catch (x) { /* ignorado */ }
      if (!d.ghost) return;
      d.ghost.remove();
      document.body.classList.remove('is-dragging');
      state.suppressClick = true;
      setTimeout(function () { state.suppressClick = false; }, 60);
      if (cancel) return;
      var over = document.elementFromPoint(e.clientX, e.clientY);
      if (over && over.closest('#workspace')) {
        placePaletteItem(d.b, engine.clientToStage(e.clientX, e.clientY));
      }
    };
    list.addEventListener('pointerup', function (e) { end(e, false); });
    list.addEventListener('pointercancel', function (e) { end(e, true); });
  }

  /* ================================================================== componentes salvos */
  var SNIP_KEY = 'alicerce.snippets', SNIP_MAX = 60;

  function cleanSnippet(raw) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.elements)) return null;
    var els = raw.elements.slice(0, 200).filter(function (e) { return e && typeof e === 'object' && COMPONENTS[e.type]; }).map(function (e) {
      return {
        type: e.type, x: numIn(e.x, -8000, 8000, 0), y: numIn(e.y, -8000, 8000, 0),
        w: numIn(e.w, E.MIN_SIZE, 8000, COMPONENTS[e.type].w), h: numIn(e.h, 4, 8000, COMPONENTS[e.type].h),
        text: typeof e.text === 'string' ? e.text.slice(0, 2000) : '', checked: !!e.checked,
        fill: E.normHex(e.fill), stroke: E.normHex(e.stroke), color: E.normHex(e.color),
        flipH: !!e.flipH, flipV: !!e.flipV, r: COMPONENTS[e.type].radius ? E.normR(e.r) : null,
        g: (typeof e.g === 'string' && e.g) ? e.g.slice(0, 40) : null
      };
    });
    if (!els.length) return null;
    var cnt = {};
    els.forEach(function (e) { if (e.g) cnt[e.g] = (cnt[e.g] || 0) + 1; });
    els.forEach(function (e) { if (e.g && cnt[e.g] < 2) e.g = null; });
    return { id: str(raw.id, 100, '') || E.uid(), name: str(raw.name, 80, 'Componente'), w: numIn(raw.w, 1, 8000, 100), h: numIn(raw.h, 1, 8000, 40), createdAt: numIn(raw.createdAt, 0, 8.64e15, Date.now()), elements: els };
  }

  async function loadSnippets() {
    state.snippets = [];
    try {
      var raw = await S.getMeta(SNIP_KEY);
      if (Array.isArray(raw)) state.snippets = raw.slice(0, SNIP_MAX).map(cleanSnippet).filter(Boolean);
    } catch (e) { /* sem IndexedDB: a lista fica só na memória desta sessão */ }
    renderSnippets();
  }

  async function persistSnippets() {
    try { await S.setMeta(SNIP_KEY, state.snippets); }
    catch (e) { toast('Não foi possível guardar os componentes salvos neste navegador: ' + errMsg(e), 'error'); }
  }

  function renderSnippets() {
    var list = $('saved-list'), sn = state.snippets || [];
    if (!list) return;
    list.textContent = '';
    $('saved-empty').hidden = sn.length > 0;
    $('saved-count').textContent = sn.length ? '(' + sn.length + ')' : '';
    sn.forEach(function (sp) {
      var row = document.createElement('div');
      row.className = 'saved-row';
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'palette-item'; b.dataset.snippet = sp.id;
      b.setAttribute('aria-label', 'Inserir componente salvo ' + sp.name + ', ' + sp.elements.length + (sp.elements.length === 1 ? ' elemento' : ' elementos'));
      b.title = 'Inserir "' + sp.name + '" (clique ou arraste)';
      b.appendChild(svgIcon(COMPONENTS[sp.elements[0].type].icon));
      var tx = document.createElement('span'); tx.textContent = sp.name; b.appendChild(tx);
      var n = document.createElement('span'); n.className = 'saved-n'; n.textContent = sp.elements.length + (sp.elements.length === 1 ? ' elem.' : ' elems.'); n.setAttribute('aria-hidden', 'true'); b.appendChild(n);
      row.appendChild(b);
      var acts = document.createElement('div'); acts.className = 'saved-acts';
      [['snippet-rename', 'i-edit', 'Renomear'], ['snippet-delete', 'i-trash', 'Excluir']].forEach(function (a) {
        var x = document.createElement('button');
        x.type = 'button'; x.className = 'saved-act'; x.dataset.action = a[0]; x.dataset.id = sp.id;
        x.title = a[2] + ' "' + sp.name + '"'; x.setAttribute('aria-label', a[2] + ' componente salvo ' + sp.name);
        x.appendChild(svgIcon(a[1]));
        acts.appendChild(x);
      });
      row.appendChild(acts);
      list.appendChild(row);
    });
  }

  function setPaletteTab(saved) {
    $('ptab-std').setAttribute('aria-selected', saved ? 'false' : 'true');
    $('ptab-saved').setAttribute('aria-selected', saved ? 'true' : 'false');
    $('palette-list').hidden = !!saved;
    $('saved-panel').hidden = !saved;
  }

  async function saveSnippet() {
    var snip = engine.snippetFromSelection();
    if (!snip) { toast('Selecione elementos na tela para salvar como componente.', 'error'); return; }
    if (state.snippets.length >= SNIP_MAX) { toast('Limite de ' + SNIP_MAX + ' componentes salvos. Exclua algum para salvar outro.', 'error'); return; }
    var first = engine.selectedElements()[0];
    var def = snip.elements.length === 1 ? layerName(first) : 'Componente ' + (state.snippets.length + 1);
    var name = await promptDialog({ title: 'Salvar como componente', label: 'Nome do componente', value: def, okText: 'Salvar' });
    if (name === null || !name) return;
    var rec = cleanSnippet(Object.assign({ id: E.uid(), name: name, createdAt: Date.now() }, snip));
    if (!rec) return;
    state.snippets.unshift(rec);
    renderSnippets();
    await persistSnippets();
    toast('Componente "' + rec.name + '" salvo. Ele está na aba Salvos da paleta e vale para todos os projetos.');
    announce('Componente ' + rec.name + ' salvo.');
  }

  async function renameSnippet(id) {
    var sp = state.snippets.filter(function (x) { return x.id === id; })[0];
    if (!sp) return;
    var name = await promptDialog({ title: 'Renomear componente salvo', label: 'Nome do componente', value: sp.name, okText: 'Renomear' });
    if (!name) return;
    sp.name = name.slice(0, 80);
    renderSnippets();
    await persistSnippets();
  }

  async function deleteSnippet(id) {
    var sp = state.snippets.filter(function (x) { return x.id === id; })[0];
    if (!sp) return;
    var c = await confirmDialog({ title: 'Excluir componente salvo', message: 'Excluir o componente "' + sp.name + '" da sua biblioteca? Os projetos que já o usam não mudam.', ok: 'Excluir', danger: true });
    if (c !== 'ok') return;
    state.snippets = state.snippets.filter(function (x) { return x.id !== id; });
    renderSnippets();
    await persistSnippets();
    toast('Componente "' + sp.name + '" excluído.');
  }

  async function mergeSnippets(rawList) {
    if (!Array.isArray(rawList)) return 0;
    var add = 0;
    rawList.slice(0, SNIP_MAX).map(cleanSnippet).filter(Boolean).forEach(function (sp) {
      if (state.snippets.some(function (x) { return x.id === sp.id; })) return;
      if (state.snippets.length < SNIP_MAX) { state.snippets.push(sp); add++; }
    });
    if (add) { renderSnippets(); await persistSnippets(); }
    return add;
  }

  /* ================================================================== ações */
  var ACTIONS = {
    menu: openDrawer,
    'drawer-close': function () { closeDrawer(true); },
    'new': createNewProject,
    projects: openProjectsDialog,
    'rename-project': renameCurrentProject,
    undo: undo,
    redo: redo,
    'zoom-in': function () { engine.zoomBy(1.2); },
    'zoom-out': function () { engine.zoomBy(1 / 1.2); },
    'zoom-100': function () { engine.setZoom(1); },
    fit: fitView,
    hand: function () { engine.toggleHand(); },
    grid: function (btn) {
      var on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      engine.setGrid(on);
      ls('alicerce.grid', on ? '1' : '0');
      announce(on ? 'Grade visível.' : 'Grade oculta.');
    },
    snap: function (btn) {
      var on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      engine.setSnap(on);
      ls('alicerce.snap', on ? '1' : '0');
      announce(on ? 'Grade magnética ativada.' : 'Grade magnética desativada.');
    },
    guides: function (btn) {
      var on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      engine.setGuides(on);
      ls('alicerce.guides', on ? '1' : '0');
      announce(on ? 'Guias inteligentes ativadas.' : 'Guias inteligentes desativadas.');
    },
    'vp-mobile': function () { setViewport('mobile'); },
    'vp-desktop': function () { setViewport('desktop'); },
    open: openFile,
    restore: openFile,
    save: function () { return saveToDisk(false); },
    saveas: function () { return saveToDisk(true); },
    'export': function () { $('dlg-export').showModal(); },
    'export-json': exportJson,
    'export-png': function () { return exportPng(false); },
    'export-png-all': function () { return exportPng(true); },
    'export-svg': function () { return exportSvg(false); },
    'export-svg-all': function () { return exportSvg(true); },
    'export-pdf': function () { return exportPdf(false); },
    'export-pdf-all': function () { return exportPdf(true); },
    print: printAll,
    share: shareProject,
    'share-json': shareProject,
    'share-png': sharePng,
    backup: backupAll,
    mode: function () { applyMode(document.documentElement.dataset.mode === 'dark' ? 'light' : 'dark'); },
    fullscreen: toggleFullscreen,
    install: installApp,
    about: function () { $('dlg-about').showModal(); },
    'el-copy': copySelection,
    'el-paste': pasteClipboard,
    'el-dup': function () { engine.duplicateSelected(); },
    'el-front': function () { engine.bringToFront(); },
    'el-back': function () { engine.sendToBack(); },
    'el-edit': function () { if (engine.selection.length === 1) engine.startEdit(engine.selection[0]); },
    'el-layers': showLayers,
    'el-select-all': function () { engine.selectAll(); engine.ws.focus({ preventScroll: true }); },
    'el-lock': function () { engine.toggleLockSelected(); },
    'el-flip-h': function () { engine.flipSelected('h'); },
    'el-flip-v': function () { engine.flipSelected('v'); },
    'el-colors': openColors,
    'el-props': function () {
      var open = !document.body.classList.contains('inspector-open');
      if (open && $('inspector').dataset.tab !== 'props') setPanelTab('props');
      openInspector(open);
    },
    'el-delete': function () { engine.deleteSelected(); },
    'ptab-std': function () { setPaletteTab(false); },
    'ptab-saved': function () { setPaletteTab(true); },
    'snippet-save': saveSnippet,
    'snippet-rename': function (btn) { renameSnippet(btn.dataset.id); },
    'snippet-delete': function (btn) { deleteSnippet(btn.dataset.id); },
    'connect': function () { engine.connectSelected(); },
    'disconnect': function () { engine.disconnectSelected(); },
    'group': function () { engine.groupSelected(); },
    'ungroup': function () { engine.ungroupSelected(); },
    'align-left': function () { engine.alignSelected('left'); },
    'align-hcenter': function () { engine.alignSelected('hcenter'); },
    'align-right': function () { engine.alignSelected('right'); },
    'align-top': function () { engine.alignSelected('top'); },
    'align-vcenter': function () { engine.alignSelected('vcenter'); },
    'align-bottom': function () { engine.alignSelected('bottom'); },
    'dist-h': function () { engine.distributeSelected('h'); },
    'dist-v': function () { engine.distributeSelected('v'); },
    'screen-add': addScreen,
    'screen-rename': renameScreen,
    'screen-dup': duplicateScreen,
    'screens-overview': openOverview,
    'preview': function () { setPreview(!state.preview); },
    'preview-exit': function () { setPreview(false); },
    'preview-back': previewBack,
    'rulers': function () { setRulers(!document.body.classList.contains('rulers-on'), true); },
    'screen-delete': deleteScreen
  };
  var KEEP_DRAWER = { mode: 1, fullscreen: 1, menu: 1, 'drawer-close': 1 };

  function run(action, btn) {
    var fn = ACTIONS[action];
    if (!fn) return;
    var r;
    try { r = fn(btn); } catch (e) { toast('Erro: ' + errMsg(e), 'error'); return; }
    if (r && r.catch) r.catch(function (e) { toast('Erro: ' + errMsg(e), 'error'); });
  }

  function bindUI() {
    document.addEventListener('click', function (e) {
      var closer = e.target.closest('[data-close]');
      if (closer) {
        var dlg = closer.closest('dialog');
        if (dlg) dlg.close('cancel');
        return;
      }
      var btn = e.target.closest('[data-action]');
      if (!btn || btn.disabled) return;
      var action = btn.dataset.action;
      var host = btn.closest('dialog');
      if (host && host.open) host.close('cancel');
      if (btn.closest('#drawer') && !KEEP_DRAWER[action]) closeDrawer(false);
      run(action, btn);
    });

    $('drawer-backdrop').addEventListener('click', function () { closeDrawer(true); });

    $('prompt-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); $('prompt-form').requestSubmit($('prompt-ok')); }
    });

    $('theme-select').addEventListener('change', function (e) { applyTheme(e.target.value); });

    $('projects-list').addEventListener('click', function (e) {
      var b = e.target.closest('[data-pact]');
      if (b) projectAction(b.dataset.pact, b.dataset.id);
    });

    $('screen-tabs').addEventListener('click', function (e) {
      var t = e.target.closest('.tab');
      if (t) switchScreen(t.dataset.screen);
    });
    $('screen-tabs').addEventListener('keydown', function (e) {
      var t = e.target.closest('.tab');
      if (!t) return;
      var p = state.project, i = p.screens.findIndex(function (s) { return s.id === t.dataset.screen; }), n = -1;
      if (e.key === 'ArrowRight') n = (i + 1) % p.screens.length;
      else if (e.key === 'ArrowLeft') n = (i - 1 + p.screens.length) % p.screens.length;
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = p.screens.length - 1;
      if (n < 0) return;
      e.preventDefault();
      switchScreen(p.screens[n].id);
      renderTabs(p.screens[n].id);
    });

    $('file-input').addEventListener('change', async function (e) {
      var f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!f) return;
      try { await handleFileText(await f.text(), f.name, null); }
      catch (x) { toast('Não foi possível ler o arquivo: ' + errMsg(x), 'error'); }
    });

    document.addEventListener('keydown', function (e) {
      if (state.drawerOpen) {
        if (e.key === 'Escape') { e.preventDefault(); closeDrawer(true); return; }
        if (e.key === 'Tab') {
          var f = drawerFocusables();
          if (!f.length) return;
          var first = f[0], last = f[f.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
        return;
      }
      if (document.querySelector('dialog[open]')) return;
      var tg = e.target, tag = tg && tg.tagName;
      var typing = tag === 'TEXTAREA' || tag === 'SELECT' || (tag === 'INPUT' && !/^(checkbox|radio|color|button|range)$/.test(tg.type));
      if (typing) return;
      var mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
      if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
      if (mod && k === 's') { e.preventDefault(); saveToDisk(e.shiftKey); return; }
      if (mod && k === 'o') { e.preventDefault(); openFile(); return; }
      if (e.key === 'Escape' && document.body.classList.contains('inspector-open')) { openInspector(false); engine.focusSelected(); return; }
      if (tg && tg.closest && tg.closest('#workspace')) {
        if (engine.handleKey(e)) e.preventDefault();
      }
    });

    document.addEventListener('fullscreenchange', syncFullscreenUI);

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      state.deferredPrompt = e;
      if (!isInstalled()) showInstall(true);
    });
    window.addEventListener('appinstalled', function () {
      state.deferredPrompt = null;
      showInstall(false);
      toast('Alicerce instalado.');
    });
    window.matchMedia('(display-mode: standalone)').addEventListener('change', function () { if (isInstalled()) showInstall(false); });

    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flushSave(); });
    window.addEventListener('pagehide', function () { flushSave(); });

    if (typeof ResizeObserver === 'function') {
      var raf = 0;
      new ResizeObserver(function () {
        if (!state.autoFit || !state.project) return;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(fitView);
      }).observe($('workspace'));
    }
  }

  /* ================================================================== splash, SW, arranque */
  function setupSplash() {
    var splash = $('splash'), app = $('app');
    app.setAttribute('inert', '');
    return new Promise(function (resolve) {
      var gone = false;
      var finish = function () {
        if (gone) return;
        gone = true;
        splash.remove();
        app.removeAttribute('inert');
        resolve();
      };
      splash.addEventListener('animationend', function (e) { if (e.animationName === 'splash-life') finish(); });
      setTimeout(finish, 3300);
    });
  }

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    var had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('./sw.js').catch(function () { /* requer https ou localhost */ });
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (had) toast('Nova versão do Alicerce instalada. Recarregue a página para usá-la.');
      had = true;
    });
  }

  function setupLaunchQueue() {
    if (!('launchQueue' in window)) return;
    window.launchQueue.setConsumer(async function (params) {
      if (!params || !params.files || !params.files.length) return;
      for (var i = 0; i < params.files.length; i++) {
        try {
          var h = params.files[i], f = await h.getFile();
          await handleFileText(await f.text(), f.name, h);
        } catch (e) { toast('Não foi possível abrir o arquivo: ' + errMsg(e), 'error'); }
      }
    });
  }

  async function loadInitialProject() {
    var all = [];
    try { all = await S.getAllProjects(); } catch (e) {
      toast('O armazenamento local (IndexedDB) não está disponível. O projeto não será salvo automaticamente.', 'error');
    }
    var valid = [];
    all.forEach(function (p) { try { valid.push(normalizeProject(p)); } catch (e) { /* ignora registros corrompidos */ } });
    var last = ls('alicerce.last'), project = null;
    valid.forEach(function (p) { if (p.id === last) project = p; });
    if (!project && valid.length) {
      valid.sort(function (a, b) { return b.updatedAt - a.updatedAt; });
      project = valid[0];
    }
    if (!project) {
      project = createProject('Meu primeiro projeto', 'mobile');
      try { await S.putProject(project); } catch (e) { /* já avisado */ }
    }
    await openProject(project);
  }

  async function boot() {
    var splashDone = setupSplash();
    var params = new URLSearchParams(location.search);
    var action = params.get('action');

    applyTheme(ls('alicerce.theme') || 'original', true);
    applyMode(ls('alicerce.mode') === 'dark' ? 'dark' : 'light', true);
    buildThemeRadios();
    syncThemeUI();
    syncFullscreenUI();
    if (!document.fullscreenEnabled) document.querySelectorAll('.js-fs').forEach(function (b) { b.hidden = true; });

    engine = new E.CanvasEngine({
      workspace: $('workspace'),
      wrap: $('stage-wrap'),
      stage: $('stage'),
      callbacks: {
        onChange: function (tag) { commit(tag); },
        onSelection: updateSelectionUI,
        onNavigate: function (id) { previewGo(id); },
        onGeometry: function () { syncInspector(false); schedulePositionSelBar(); },
        onZoom: onZoom,
        onHand: function (on) {
          var b = $('tb-hand');
          if (b) b.setAttribute('aria-pressed', on ? 'true' : 'false');
          announce(on ? 'Mãozinha ativada: arraste para mover o palco.' : 'Mãozinha desativada.');
        },
        onLocked: function (n, verb) {
          var now = Date.now();
          if (state.lockToastAt && now - state.lockToastAt < 1500) return;
          state.lockToastAt = now;
          toast((n === 1 ? 'Elemento travado' : n + ' elementos travados') + ': destrave o cadeado para ' + verb + '.', 'info');
        },
        onAnnounce: announce
      }
    });
    var snapOn = ls('alicerce.snap') !== '0', gridOn = ls('alicerce.grid') !== '0';
    engine.setSnap(snapOn);
    var guidesOn = ls('alicerce.guides') !== '0';
    engine.setGuides(guidesOn);
    $('tb-guides').setAttribute('aria-pressed', guidesOn ? 'true' : 'false');
    engine.setGrid(gridOn);
    $('tb-snap').setAttribute('aria-pressed', snapOn ? 'true' : 'false');
    $('tb-grid').setAttribute('aria-pressed', gridOn ? 'true' : 'false');

    buildPalette();
    loadSnippets();
    buildSwatches();
    buildCorners();
    bindLayers();
    buildAlignInspector();
    setRulers(ls('alicerce.rulers') === '1', false);
    $('workspace').addEventListener('pointermove', function (ev) { state.rulerPt = { x: ev.clientX, y: ev.clientY }; if (document.body.classList.contains('rulers-on')) schedulePositionSelBar(); });
    $('workspace').addEventListener('pointerleave', function () { state.rulerPt = null; schedulePositionSelBar(); });
    $('workspace').addEventListener('scroll', schedulePositionSelBar, { passive: true });
    ['pointerup', 'pointercancel'].forEach(function (t) { $('workspace').addEventListener(t, function () { setTimeout(schedulePositionSelBar, 0); }); });
    window.addEventListener('resize', schedulePositionSelBar);
    bindInspector();
    bindOverview();
    bindClipboardEvents();
    bindUI();
    registerSW();
    if (isInstalled()) showInstall(false);
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () { /* ignorado */ });

    state.projectCount = 0;
    await loadInitialProject();
    await refreshCount();
    setupLaunchQueue();

    await splashDone;
    if (action === 'new' || action === 'projects') {
      history.replaceState(null, '', location.pathname);
      run(action === 'new' ? 'new' : 'projects', null);
    }
  }

  boot().catch(function (e) {
    console.error(e);
    toast('Erro ao iniciar o Alicerce: ' + errMsg(e), 'error');
    var s = document.getElementById('splash');
    if (s) s.remove();
    var a = document.getElementById('app');
    if (a) a.removeAttribute('inert');
  });
})();
