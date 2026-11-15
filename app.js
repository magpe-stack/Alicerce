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
          color: E.normHex(e.color)
        };
      });
      return { id: id, name: str(sc.name, 60, 'Tela ' + (i + 1)), elements: els };
    });
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
    var b = $('el-props');
    b.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      setTimeout(function () { revealSelection(); var t = $('insp-x'); if (t && !$('insp-form').hidden) t.focus({ preventScroll: true }); }, 60);
    }
  }

  function updateSelectionUI(ids) {
    var n = ids.length, els = engine.selectedElements();
    var single = n === 1 ? els[0] : null;
    ['el-copy', 'el-dup', 'el-front', 'el-back', 'el-delete'].forEach(function (id) { setDisabled(id, n < 1); });
    setDisabled('el-edit', !(single && COMPONENTS[single.type].editable));
    setDisabled('el-props', n < 1);
    setDisabled('el-colors', n < 1);
    if (n < 1) openInspector(false);
    syncInspector(true);
    setTimeout(revealSelection, 60);
  }

  function syncInspector(force) {
    var els = engine.selectedElements();
    var empty = $('insp-empty'), form = $('insp-form');
    if (els.length !== 1) {
      form.hidden = true;
      empty.hidden = false;
      empty.textContent = els.length > 1 ? els.length + ' elementos selecionados. Use as ferramentas da barra para duplicar, copiar, ordenar ou excluir, ou aplique cores abaixo.' : 'Selecione um elemento na prancheta para editar suas propriedades e cores.';
      syncColors(els, force);
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
    set('insp-x', Math.round(el.x));
    set('insp-y', Math.round(el.y));
    set('insp-w', Math.round(el.w));
    set('insp-h', Math.round(el.h));
    $('insp-checked').checked = !!el.checked;
    syncColors(els, force);
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
      if (el.type !== 'divider') ok.fill = true;
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
    ['x', 'y', 'w', 'h'].forEach(function (k) {
      var inp = $('insp-' + k);
      inp.addEventListener('input', function () {
        var el = single(); if (!el) return;
        if (inp.value === '' || !isFinite(Number(inp.value))) return;
        var patch = {}; patch[k] = Number(inp.value);
        engine.updateElement(el.id, patch, '~insp-' + k);
      });
      inp.addEventListener('change', function () { syncInspector(true); });
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
  }

  /* ================================================================== telas */
  async function addScreen() {
    var p = state.project;
    var name = await promptDialog({ title: 'Nova tela', label: 'Nome da tela', value: 'Tela ' + (p.screens.length + 1), okText: 'Criar tela' });
    if (!name) return;
    var sc = { id: E.uid(), name: name.slice(0, 60), elements: [] };
    p.screens.push(sc);
    p.activeScreenId = sc.id;
    engine.setScreen(sc, p.viewport);
    renderTabs(sc.id);
    commit('screen-add');
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
    copy.elements.forEach(function (e) { e.id = E.uid(); });
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

  async function backupAll() {
    await flushSave();
    var list = await S.getAllProjects();
    if (!list.length) { toast('Não há projetos para exportar.', 'error'); return; }
    var text = JSON.stringify({ app: 'alicerce', kind: 'backup', version: 1, exportedAt: new Date().toISOString(), projects: list }, null, 2);
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
    E.COMPONENT_ORDER.forEach(function (type) {
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
    });

    list.addEventListener('click', function (e) {
      var b = e.target.closest('.palette-item');
      if (!b) return;
      if (state.suppressClick) { state.suppressClick = false; return; }
      engine.addElement(b.dataset.type);
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
        g.appendChild(svgIcon(COMPONENTS[drag.b.dataset.type].icon));
        g.appendChild(document.createTextNode(COMPONENTS[drag.b.dataset.type].label));
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
        engine.addElement(d.b.dataset.type, engine.clientToStage(e.clientX, e.clientY));
      }
    };
    list.addEventListener('pointerup', function (e) { end(e, false); });
    list.addEventListener('pointercancel', function (e) { end(e, true); });
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
    'el-colors': openColors,
    'el-props': function () { openInspector(!document.body.classList.contains('inspector-open')); },
    'el-delete': function () { engine.deleteSelected(); },
    'screen-add': addScreen,
    'screen-rename': renameScreen,
    'screen-dup': duplicateScreen,
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
        onGeometry: function () { syncInspector(false); },
        onZoom: onZoom,
        onAnnounce: announce
      }
    });
    var snapOn = ls('alicerce.snap') !== '0', gridOn = ls('alicerce.grid') !== '0';
    engine.setSnap(snapOn);
    engine.setGrid(gridOn);
    $('tb-snap').setAttribute('aria-pressed', snapOn ? 'true' : 'false');
    $('tb-grid').setAttribute('aria-pressed', gridOn ? 'true' : 'false');

    buildPalette();
    buildSwatches();
    bindInspector();
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
