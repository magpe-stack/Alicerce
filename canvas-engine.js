/* Alicerce — canvas-engine.js
 * Motor da prancheta: renderização dos componentes, seleção, arrastar, redimensionar,
 * zoom/pan (mouse, toque e pinça via PointerEvents), teclado, edição de texto,
 * exportação PNG (canvas 2D nativo) e montagem da área de impressão.
 */
(function (global) {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';
  var GRID = 10;
  var MIN_SIZE = 16;
  var MIN_ZOOM = 0.1;
  var MAX_ZOOM = 4;
  var CLIP_PREFIX = 'ALICERCE-ELEMENTOS:';

  var VIEWPORTS = {
    mobile: { w: 360, h: 800, label: 'Mobile 360×800' },
    desktop: { w: 1280, h: 800, label: 'Desktop 1280×800' }
  };

  var COMPONENTS = {
    container: { label: 'Container / Card', icon: 'c-container', w: 300, h: 180, text: '', editable: true },
    button: { label: 'Botão', icon: 'c-button', w: 140, h: 44, text: 'Botão', editable: true },
    input: { label: 'Campo de input', icon: 'c-input', w: 260, h: 44, text: 'Digite aqui', editable: true },
    navbar: { label: 'Cabeçalho / Navbar', icon: 'c-navbar', w: 360, h: 56, text: 'Título', editable: true, full: true },
    hamburger: { label: 'Menu hambúrguer', icon: 'c-hamburger', w: 44, h: 44, text: '', editable: false },
    image: { label: 'Imagem placeholder', icon: 'c-image', w: 200, h: 140, text: '', editable: false },
    text: { label: 'Bloco de texto', icon: 'c-text', w: 260, h: 72, text: 'Escreva o texto aqui', editable: true, multiline: true },
    list: { label: 'Lista', icon: 'c-list', w: 280, h: 112, text: 'Item 1\nItem 2\nItem 3', editable: true, multiline: true },
    toggle: { label: 'Toggle', icon: 'c-toggle', w: 180, h: 32, text: 'Opção', editable: true, hasState: true, stateLabel: 'Ativado' },
    checkbox: { label: 'Checkbox', icon: 'c-checkbox', w: 180, h: 32, text: 'Opção', editable: true, hasState: true, stateLabel: 'Marcado' },
    divider: { label: 'Divisor', icon: 'c-divider', w: 280, h: 12, text: '', editable: false }
  };
  var COMPONENT_ORDER = ['container', 'button', 'input', 'navbar', 'hamburger', 'image', 'text', 'list', 'toggle', 'checkbox', 'divider'];

  /* Cores do wireframe (iguais às variáveis CSS --wf-*) */
  var INK = '#1F2430', MUTED = '#5B6270', FILL = '#EEF0F4', PAPER = '#FFFFFF', LIGHT = '#C9CED8', SOFT = '#F7F8FA';
  var FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

  /* ------------------------------------------------------------------ cores */
  var HEX_RE = /^#[0-9a-fA-F]{6}$/;
  var DEFAULT_BG = { container: PAPER, button: FILL, input: PAPER, navbar: FILL, hamburger: PAPER, image: SOFT, text: PAPER, list: PAPER, toggle: PAPER, checkbox: PAPER, divider: PAPER };

  function normHex(v) { return typeof v === 'string' && HEX_RE.test(v) ? v.toUpperCase() : ''; }
  function relLum(hex) {
    var c = [1, 3, 5].map(function (i) {
      var v = parseInt(hex.substr(i, 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contrast(a, b) {
    var la = relLum(a), lb = relLum(b);
    if (la < lb) { var t = la; la = lb; lb = t; }
    return (la + 0.05) / (lb + 0.05);
  }
  /* Texto automático: preto sobre fundos claros, branco sobre fundos escuros (maior contraste). */
  function autoText(bg) { return contrast('#000000', bg) >= contrast('#FFFFFF', bg) ? '#000000' : '#FFFFFF'; }
  function textColorOf(el) { return el.color || (el.fill ? autoText(el.fill) : INK); }
  function bgOf(el) { return el.fill || DEFAULT_BG[el.type] || PAPER; }
  function colorInfo(el) {
    var t = textColorOf(el), b = bgOf(el);
    return { text: t, bg: b, ratio: contrast(t, b) };
  }
  function applyStyle(node, el) {
    var st = node.style;
    if (el.fill) st.setProperty('--c-bg', el.fill); else st.removeProperty('--c-bg');
    if (el.stroke) st.setProperty('--c-line', el.stroke); else st.removeProperty('--c-line');
    if (el.fill || el.color) st.setProperty('--c-text', textColorOf(el)); else st.removeProperty('--c-text');
    node.classList.toggle('is-flip-h', !!el.flipH);
    node.classList.toggle('is-flip-v', !!el.flipV);
  }

  /* ------------------------------------------------------------------ cantos (raio) */
  var DEFAULT_RADIUS = { container: 8, button: 8, input: 6, navbar: 0, hamburger: 8, image: 0, text: 4, list: 8 };
  Object.keys(DEFAULT_RADIUS).forEach(function (k) { COMPONENTS[k].radius = true; });

  /* r = null (padrão do tipo) ou [sup.esq., sup.dir., inf.dir., inf.esq.] em inteiros 0..999 */
  function normR(r) {
    if (typeof r === 'number' && isFinite(r)) r = [r, r, r, r];
    if (!Array.isArray(r) || r.length !== 4) return null;
    var out = r.map(function (v) { v = Math.round(Number(v)); return isFinite(v) ? Math.min(999, Math.max(0, v)) : 0; });
    return out;
  }
  /* Escala proporcional, como no CSS, para que raios vizinhos nunca ultrapassem o lado. */
  function fitRadii(r, w, hh) {
    var f = 1;
    function lim(a, b, side) { var sum = a + b; if (sum > 0 && side / sum < f) f = side / sum; }
    lim(r[0], r[1], w); lim(r[3], r[2], w); lim(r[0], r[3], hh); lim(r[1], r[2], hh);
    return r.map(function (v) { return Math.round(v * f * 100) / 100; });
  }
  function radiusOf(el) {
    var d = DEFAULT_RADIUS[el.type] || 0;
    var base = (el.r && COMPONENTS[el.type] && COMPONENTS[el.type].radius) ? el.r : [d, d, d, d];
    return fitRadii(base, el.w, el.h);
  }
  function maxRadius(el) { return Math.max(1, Math.floor(Math.min(el.w, el.h) / 2)); }

  /* ------------------------------------------------------------------ utilidades */
  function noop() {}
  function uid() {
    if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  function clamp(v, a, b) { return Math.min(Math.max(v, a), b); }
  function h(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function s(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }
  function firstLine(t) { return String(t || '').split('\n')[0]; }
  function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }

  function describe(el) {
    var c = COMPONENTS[el.type];
    var out = c.label;
    var t = firstLine(el.text);
    if (t && c.editable) out += ': ' + t;
    if (c.hasState) out += el.checked ? ', ' + c.stateLabel.toLowerCase() : ', desativado';
    if (el.flipH || el.flipV) out += ', espelhado' + (el.flipH && el.flipV ? ' na horizontal e na vertical' : el.flipH ? ' na horizontal' : ' na vertical');
    out += '. Posição ' + Math.round(el.x) + ', ' + Math.round(el.y) + '. Tamanho ' + Math.round(el.w) + ' por ' + Math.round(el.h) + '.';
    return out;
  }

  /* ------------------------------------------------------------------ DOM dos componentes */
  function hamburgerSvg(cls) {
    var sv = s('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', 'class': cls });
    sv.appendChild(s('path', { d: 'M4 7h16M4 12h16M4 17h16' }));
    return sv;
  }

  function fillNode(node, el) {
    node.textContent = '';
    var body = h('div', 'wf-body');
    var t = el.text || '';
    switch (el.type) {
      case 'container':
        if (t) body.appendChild(h('span', 'wf-label', firstLine(t)));
        break;
      case 'button':
        body.appendChild(h('span', 'wf-label', firstLine(t)));
        break;
      case 'input':
        body.appendChild(h('span', 'wf-label wf-muted', firstLine(t)));
        break;
      case 'navbar':
        body.appendChild(hamburgerSvg('wf-ico'));
        body.appendChild(h('span', 'wf-label', firstLine(t)));
        break;
      case 'hamburger':
        body.appendChild(hamburgerSvg('wf-fill-svg'));
        break;
      case 'image': {
        var sv = s('svg', { viewBox: '0 0 100 100', preserveAspectRatio: 'none', 'class': 'wf-fill-svg', 'aria-hidden': 'true' });
        sv.appendChild(s('line', { x1: 0, y1: 0, x2: 100, y2: 100, 'vector-effect': 'non-scaling-stroke' }));
        sv.appendChild(s('line', { x1: 100, y1: 0, x2: 0, y2: 100, 'vector-effect': 'non-scaling-stroke' }));
        body.appendChild(sv);
        break;
      }
      case 'text':
        body.appendChild(h('div', 'wf-text-content', t));
        break;
      case 'list':
        String(t).split('\n').forEach(function (line) {
          var row = h('div', 'wf-li');
          row.appendChild(h('i'));
          row.appendChild(h('span', 'wf-label', line));
          body.appendChild(row);
        });
        break;
      case 'toggle': {
        body.appendChild(h('span', 'wf-label', firstLine(t)));
        var sw = s('svg', { viewBox: '0 0 44 24', 'class': 'wf-switch', 'aria-hidden': 'true' });
        sw.appendChild(s('rect', { x: 1, y: 1, width: 42, height: 22, rx: 11, 'class': 'wf-track' + (el.checked ? ' on' : '') }));
        sw.appendChild(s('circle', { cx: el.checked ? 32 : 12, cy: 12, r: 7, 'class': 'wf-knob' + (el.checked ? ' on' : '') }));
        body.appendChild(sw);
        break;
      }
      case 'checkbox': {
        var cb = s('svg', { viewBox: '0 0 20 20', 'class': 'wf-check', 'aria-hidden': 'true' });
        cb.appendChild(s('rect', { x: 1, y: 1, width: 18, height: 18, rx: 4 }));
        if (el.checked) cb.appendChild(s('path', { d: 'M5 10.5l3.5 3.5L15 6.5' }));
        body.appendChild(cb);
        body.appendChild(h('span', 'wf-label', firstLine(t)));
        break;
      }
      case 'divider':
        body.appendChild(h('i', 'wf-line'));
        break;
    }
    node.appendChild(body);
  }

  function applyGeom(node, el) {
    node.style.left = el.x + 'px';
    node.style.top = el.y + 'px';
    node.style.width = el.w + 'px';
    node.style.height = el.h + 'px';
    if (el.r && COMPONENTS[el.type] && COMPONENTS[el.type].radius) {
      node.style.setProperty('--c-radius', fitRadii(el.r, el.w, el.h).map(function (v) { return v + 'px'; }).join(' '));
    } else node.style.removeProperty('--c-radius');
  }

  function buildNode(el, plain) {
    var node = h('div', 'wf wf-' + el.type);
    node.dataset.id = el.id;
    applyGeom(node, el);
    fillNode(node, el);
    applyStyle(node, el);
    if (!plain) {
      node.tabIndex = 0;
      node.setAttribute('role', 'option');
      node.setAttribute('aria-selected', 'false');
      node.setAttribute('aria-label', describe(el));
    }
    return node;
  }

  function addHandles(node) {
    ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(function (d) {
      var hd = h('span', 'handle');
      hd.dataset.h = d;
      hd.setAttribute('aria-hidden', 'true');
      node.appendChild(hd);
    });
  }

  /* ------------------------------------------------------------------ Motor */
  class CanvasEngine {
    constructor(opts) {
      this.ws = opts.workspace;
      this.wrap = opts.wrap;
      this.stage = opts.stage;
      this.cb = Object.assign({ onChange: noop, onSelection: noop, onGeometry: noop, onZoom: noop, onAnnounce: noop }, opts.callbacks || {});
      this.screen = null;
      this.viewport = 'mobile';
      this.zoom = 1;
      this.snap = true;
      this.showGrid = true;
      this.selection = [];
      this.nodes = new Map();
      this.pointers = new Map();
      this.mode = null;
      this.editing = null;
      this._pointerActive = false;
      this._lastTap = null;
      this._cascade = 0;
      this._pasteCount = 0;
      this._bind();
    }

    /* ---------- estado ---------- */
    get vp() { return VIEWPORTS[this.viewport] || VIEWPORTS.mobile; }
    find(id) {
      if (!this.screen) return null;
      for (var i = 0; i < this.screen.elements.length; i++) if (this.screen.elements[i].id === id) return this.screen.elements[i];
      return null;
    }
    selectedElements() {
      var self = this;
      return this.selection.map(function (id) { return self.find(id); }).filter(Boolean);
    }

    setScreen(screen, viewport, opts) {
      this.endEdit(false);
      this.screen = screen;
      if (viewport) this.viewport = viewport;
      this.selection = [];
      this._sizeStage();
      this.render();
      if (opts && opts.fit) this.fit();
      this.cb.onSelection([]);
    }

    setViewport(key, fit) {
      this.viewport = VIEWPORTS[key] ? key : 'mobile';
      this._sizeStage();
      if (fit !== false) this.fit();
    }

    setSnap(on) { this.snap = !!on; }
    setGrid(on) {
      this.showGrid = !!on;
      this.stage.classList.toggle('grid-on', this.showGrid);
    }

    _sizeStage() {
      var vp = this.vp, z = this.zoom;
      this.wrap.style.width = vp.w * z + 'px';
      this.wrap.style.height = vp.h * z + 'px';
      this.stage.style.width = vp.w + 'px';
      this.stage.style.height = vp.h + 'px';
      this.stage.style.transform = 'scale(' + z + ')';
      this.stage.style.setProperty('--inv', (1 / z).toFixed(4));
    }

    render() {
      this.stage.textContent = '';
      this.nodes.clear();
      if (!this.screen) return;
      var self = this;
      this.screen.elements.forEach(function (el) {
        var n = buildNode(el);
        self.nodes.set(el.id, n);
        self.stage.appendChild(n);
      });
      this._decorate();
    }

    _decorate() {
      var sel = this.selection, single = sel.length === 1;
      this.nodes.forEach(function (node, id) {
        var on = sel.indexOf(id) > -1;
        node.classList.toggle('is-selected', on);
        node.setAttribute('aria-selected', on ? 'true' : 'false');
        var hs = node.querySelectorAll('.handle');
        if (on && single) { if (!hs.length) addHandles(node); }
        else hs.forEach(function (x) { x.remove(); });
      });
    }

    _refreshNode(el) {
      var node = this.nodes.get(el.id);
      if (!node) return;
      var wasSel = node.classList.contains('is-selected');
      var hadHandles = node.querySelector('.handle');
      fillNode(node, el);
      node.setAttribute('aria-label', describe(el));
      if (wasSel && hadHandles) addHandles(node);
    }

    _geom(el) {
      var node = this.nodes.get(el.id);
      if (!node) return;
      applyGeom(node, el);
      node.setAttribute('aria-label', describe(el));
    }

    select(ids, silent) {
      var self = this;
      this.selection = (ids || []).filter(function (id) { return !!self.find(id); });
      this._decorate();
      if (!silent) this.cb.onSelection(this.selection.slice());
    }

    focusSelected() {
      var n = this.selection.length ? this.nodes.get(this.selection[0]) : null;
      (n || this.ws).focus({ preventScroll: true });
    }

    announce(msg) { this.cb.onAnnounce(msg); }

    /* ---------- coordenadas e zoom ---------- */
    clientToStage(cx, cy) {
      var r = this.stage.getBoundingClientRect();
      return { x: (cx - r.left) / this.zoom, y: (cy - r.top) / this.zoom };
    }

    setZoom(z, fx, fy, anchor) {
      z = Math.round(clamp(z, MIN_ZOOM, MAX_ZOOM) * 1000) / 1000;
      var sr = this.stage.getBoundingClientRect();
      var wr = this.ws.getBoundingClientRect();
      if (fx == null) { fx = wr.left + wr.width / 2; fy = wr.top + wr.height / 2; }
      var a = anchor || { x: (fx - sr.left) / this.zoom, y: (fy - sr.top) / this.zoom };
      this.zoom = z;
      this._sizeStage();
      var nr = this.stage.getBoundingClientRect();
      this.ws.scrollLeft += nr.left + a.x * z - fx;
      this.ws.scrollTop += nr.top + a.y * z - fy;
      this.cb.onZoom(z);
    }
    zoomBy(f) { this.setZoom(this.zoom * f); }
    fit() {
      var vp = this.vp, pad = 48;
      var z = Math.min((this.ws.clientWidth - pad) / vp.w, (this.ws.clientHeight - pad) / vp.h, 1);
      if (!isFinite(z) || z <= 0) z = 1;
      this.setZoom(z);
      this.ws.scrollLeft = 0;
      this.ws.scrollTop = 0;
    }

    _visibleCenter() {
      var wr = this.ws.getBoundingClientRect(), sr = this.stage.getBoundingClientRect();
      var l = Math.max(wr.left, sr.left), r = Math.min(wr.right, sr.right);
      var t = Math.max(wr.top, sr.top), b = Math.min(wr.bottom, sr.bottom);
      if (r <= l || b <= t) return { x: this.vp.w / 2, y: this.vp.h / 2 };
      return { x: ((l + r) / 2 - sr.left) / this.zoom, y: ((t + b) / 2 - sr.top) / this.zoom };
    }

    _snapV(v) { return this.snap ? Math.round(v / GRID) * GRID : v; }

    /* ---------- operações sobre elementos ---------- */
    addElement(type, pos) {
      var c = COMPONENTS[type];
      if (!c || !this.screen) return null;
      var vp = this.vp, w = Math.min(c.w, vp.w), hgt = c.h, x, y;
      if (c.full) {
        w = vp.w; x = 0; y = 0;
      } else {
        var p = pos;
        if (!p) {
          p = this._visibleCenter();
          this._cascade = (this._cascade + 1) % 8;
          p = { x: p.x + this._cascade * 16 - 56, y: p.y + this._cascade * 16 - 56 };
        }
        x = this._snapV(p.x - w / 2);
        y = this._snapV(p.y - hgt / 2);
        x = clamp(x, 0, Math.max(0, vp.w - w));
        y = clamp(y, 0, Math.max(0, vp.h - hgt));
      }
      var el = { id: uid(), type: type, x: x, y: y, w: w, h: hgt, text: c.text || '', checked: false, fill: '', stroke: '', color: '', flipH: false, flipV: false, r: null };
      this.screen.elements.push(el);
      var node = buildNode(el);
      this.nodes.set(el.id, node);
      this.stage.appendChild(node);
      this.select([el.id]);
      node.focus({ preventScroll: true });
      this.cb.onChange(null, 'add');
      this.announce(c.label + ' adicionado.');
      return el;
    }

    deleteSelected() {
      if (!this.selection.length) return;
      var ids = this.selection.slice(), self = this;
      this.screen.elements = this.screen.elements.filter(function (e) { return ids.indexOf(e.id) < 0; });
      ids.forEach(function (id) {
        var n = self.nodes.get(id);
        if (n) n.remove();
        self.nodes.delete(id);
      });
      this.selection = [];
      this.cb.onSelection([]);
      this.cb.onChange(null, 'delete');
      this.announce(ids.length === 1 ? 'Elemento excluído.' : ids.length + ' elementos excluídos.');
      this.ws.focus({ preventScroll: true });
    }

    _cloneEls(els, off) {
      var vp = this.vp;
      return els.map(function (e) {
        var c = {
          id: uid(), type: e.type, text: e.text || '', checked: !!e.checked,
          fill: normHex(e.fill), stroke: normHex(e.stroke), color: normHex(e.color),
          flipH: !!e.flipH, flipV: !!e.flipV, r: normR(e.r),
          w: e.w, h: e.h, x: e.x + off, y: e.y + off
        };
        c.x = clamp(c.x, 0, Math.max(0, vp.w - c.w));
        c.y = clamp(c.y, 0, Math.max(0, vp.h - c.h));
        return c;
      });
    }

    _addMany(list) {
      var self = this;
      list.forEach(function (el) {
        self.screen.elements.push(el);
        var n = buildNode(el);
        self.nodes.set(el.id, n);
        self.stage.appendChild(n);
      });
      this.select(list.map(function (e) { return e.id; }));
      this.focusSelected();
    }

    duplicateSelected() {
      var els = this.selectedElements();
      if (!els.length) return;
      this._addMany(this._cloneEls(els, 20));
      this.cb.onChange(null, 'duplicate');
      this.announce(els.length === 1 ? 'Elemento duplicado.' : els.length + ' elementos duplicados.');
    }

    _reorder(front) {
      if (!this.selection.length) return;
      var ids = this.selection, sel = [], rest = [];
      this.screen.elements.forEach(function (e) { (ids.indexOf(e.id) > -1 ? sel : rest).push(e); });
      this.screen.elements = front ? rest.concat(sel) : sel.concat(rest);
      var self = this;
      this.screen.elements.forEach(function (e) {
        var n = self.nodes.get(e.id);
        if (n) self.stage.appendChild(n);
      });
      this.cb.onChange(null, 'order');
      this.announce(front ? 'Trazido para frente.' : 'Enviado para trás.');
      this.focusSelected();
    }
    bringToFront() { this._reorder(true); }
    sendToBack() { this._reorder(false); }

    selectAll() {
      if (!this.screen) return;
      this.select(this.screen.elements.map(function (e) { return e.id; }));
      this.announce(this.selection.length + ' elementos selecionados.');
    }

    copyData() {
      var els = this.selectedElements();
      if (!els.length) return '';
      this._pasteCount = 0;
      return CLIP_PREFIX + JSON.stringify({
        elements: els.map(function (e) { return { type: e.type, x: e.x, y: e.y, w: e.w, h: e.h, text: e.text, checked: !!e.checked, fill: e.fill || '', stroke: e.stroke || '', color: e.color || '', flipH: !!e.flipH, flipV: !!e.flipV, r: e.r || null }; })
      });
    }

    pasteData(text) {
      if (!text || typeof text !== 'string' || text.indexOf(CLIP_PREFIX) !== 0 || !this.screen) return false;
      var data;
      try { data = JSON.parse(text.slice(CLIP_PREFIX.length)); } catch (e) { return false; }
      var items = (data && data.elements || []).filter(function (e) { return e && COMPONENTS[e.type]; });
      if (!items.length) return false;
      this._pasteCount++;
      var off = 20 * this._pasteCount;
      var els = this._cloneEls(items.map(function (e) {
        return { type: e.type, text: String(e.text || '').slice(0, 2000), checked: !!e.checked,
          fill: normHex(e.fill), stroke: normHex(e.stroke), color: normHex(e.color),
          flipH: !!e.flipH, flipV: !!e.flipV, r: normR(e.r),
          x: num(e.x, 0), y: num(e.y, 0), w: Math.max(MIN_SIZE, num(e.w, 100)), h: Math.max(4, num(e.h, 40)) };
      }), off);
      this._addMany(els);
      this.cb.onChange(null, 'paste');
      this.announce(els.length === 1 ? 'Elemento colado.' : els.length + ' elementos colados.');
      return true;
    }

    _patch(el, patch) {
      var vp = this.vp, c = COMPONENTS[el.type], textChanged = false, stateChanged = false, styleChanged = false;
      if ('w' in patch) el.w = Math.max(MIN_SIZE, Math.round(num(patch.w, el.w)));
      if ('h' in patch) el.h = Math.max(4, Math.round(num(patch.h, el.h)));
      if ('x' in patch) el.x = Math.round(clamp(num(patch.x, el.x), -el.w + 20, Math.max(20, vp.w - 20)));
      if ('y' in patch) el.y = Math.round(clamp(num(patch.y, el.y), -el.h + 20, Math.max(20, vp.h - 20)));
      if ('text' in patch && c.editable) {
        var t = String(patch.text).replace(/\r/g, '').slice(0, 2000);
        el.text = c.multiline ? t : t.replace(/\n/g, ' ');
        textChanged = true;
      }
      if ('checked' in patch && c.hasState) { el.checked = !!patch.checked; stateChanged = true; }
      ['fill', 'stroke', 'color'].forEach(function (k) {
        if (k in patch) { el[k] = normHex(patch[k]); styleChanged = true; }
      });
      if ('r' in patch && c.radius) el.r = normR(patch.r);
      ['flipH', 'flipV'].forEach(function (k) {
        if (k in patch) { el[k] = !!patch[k]; styleChanged = true; }
      });
      this._geom(el);
      if (textChanged || stateChanged) this._refreshNode(el);
      if (styleChanged) {
        var node = this.nodes.get(el.id);
        if (node) applyStyle(node, el);
      }
    }

    updateElement(id, patch, tag) {
      var el = this.find(id);
      if (!el) return;
      this._patch(el, patch);
      this.cb.onChange(tag || null, 'update');
    }

    /* Aplica o mesmo patch a vários elementos em um único passo de histórico. */
    updateMany(ids, patch, tag) {
      var self = this, any = false;
      ids.forEach(function (id) {
        var el = self.find(id);
        if (el) { self._patch(el, patch); any = true; }
      });
      if (any) this.cb.onChange(tag || null, 'update');
    }

    /* Espelha a seleção em torno do próprio retângulo envolvente (eixo 'h' ou 'v').
     * Os elementos trocam de lado, cada um alterna seu estado espelhado e os raios
     * dos cantos são trocados, de modo que r sempre descreve o que se vê. O texto não é invertido. */
    flipSelected(axis) {
      var els = this.selectedElements();
      if (!els.length) return false;
      var horiz = axis !== 'v', self = this;
      var minX = Infinity, minY = Infinity, maxR = -Infinity, maxB = -Infinity;
      els.forEach(function (e) {
        minX = Math.min(minX, e.x); minY = Math.min(minY, e.y);
        maxR = Math.max(maxR, e.x + e.w); maxB = Math.max(maxB, e.y + e.h);
      });
      els.forEach(function (e) {
        if (horiz) { e.x = minX + maxR - (e.x + e.w); e.flipH = !e.flipH; }
        else { e.y = minY + maxB - (e.y + e.h); e.flipV = !e.flipV; }
        if (e.r) e.r = horiz ? [e.r[1], e.r[0], e.r[3], e.r[2]] : [e.r[3], e.r[2], e.r[1], e.r[0]];
        var node = self.nodes.get(e.id);
        self._geom(e);
        if (node) applyStyle(node, e);
      });
      this.cb.onGeometry();
      this.cb.onChange(null, 'flip');
      this.announce(els.length === 1 ? 'Elemento espelhado na ' + (horiz ? 'horizontal' : 'vertical') + '.' : els.length + ' elementos espelhados na ' + (horiz ? 'horizontal' : 'vertical') + '.');
      return true;
    }

    /* ---------- edição de texto ---------- */
    startEdit(id) {
      var el = this.find(id), c = el && COMPONENTS[el.type];
      if (!c || !c.editable) return false;
      this.endEdit(true);
      var node = this.nodes.get(id);
      if (!node) return false;
      var ta = h('textarea', 'wf-editor');
      ta.value = el.text || '';
      ta.setAttribute('aria-label', 'Editar texto: ' + c.label + (c.multiline ? '. Ctrl+Enter confirma.' : '. Enter confirma.') + ' Escape cancela.');
      node.appendChild(ta);
      this.editing = { id: id, ta: ta };
      var self = this;
      ta.addEventListener('keydown', function (ev) {
        ev.stopPropagation();
        if (ev.key === 'Escape') { ev.preventDefault(); self.endEdit(false); }
        else if (ev.key === 'Enter' && (!c.multiline || ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); self.endEdit(true); }
      });
      ta.addEventListener('blur', function () { self.endEdit(true, true); });
      ta.focus();
      ta.select();
      return true;
    }

    endEdit(commit, fromBlur) {
      var e = this.editing;
      if (!e) return;
      this.editing = null;
      var el = this.find(e.id), c = el && COMPONENTS[el.type];
      var val = e.ta.value.replace(/\r/g, '');
      var node = this.nodes.get(e.id);
      e.ta.remove();
      if (commit && el && val !== el.text) {
        el.text = c.multiline ? val.slice(0, 2000) : val.replace(/\n/g, ' ').slice(0, 2000);
        this._refreshNode(el);
        this.cb.onChange(null, 'text');
        this.announce('Texto atualizado.');
      }
      if (node && !fromBlur) node.focus({ preventScroll: true });
    }

    /* ---------- teclado ---------- */
    handleKey(e) {
      if (this.editing) return false;
      var key = e.key, mod = e.ctrlKey || e.metaKey, lk = key.toLowerCase();
      if (mod && lk === 'a') { this.selectAll(); return true; }
      if (!this.selection.length) return false;
      if (key === 'Delete' || key === 'Backspace') { this.deleteSelected(); return true; }
      if (key === 'Escape') { this.select([]); this.ws.focus({ preventScroll: true }); return true; }
      if ((key === 'Enter' || key === 'F2') && this.selection.length === 1) { this.startEdit(this.selection[0]); return true; }
      if (mod && lk === 'd') { this.duplicateSelected(); return true; }
      if (mod && key === ']') { this.bringToFront(); return true; }
      if (mod && key === '[') { this.sendToBack(); return true; }
      if (e.shiftKey && !mod && !e.altKey && (lk === 'h' || lk === 'v')) { this.flipSelected(lk); return true; }
      if (key.indexOf('Arrow') === 0 && !mod) {
        var step = e.shiftKey ? 10 : (this.snap ? GRID : 1);
        var dx = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0;
        var dy = key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0;
        var vp = this.vp, self = this, els = this.selectedElements();
        if (e.altKey) {
          if (els.length !== 1) return true;
          var el = els[0];
          el.w = clamp(el.w + dx, MIN_SIZE, Math.max(MIN_SIZE, vp.w - el.x));
          el.h = clamp(el.h + dy, MIN_SIZE, Math.max(MIN_SIZE, vp.h - el.y));
          this._geom(el);
          this.cb.onGeometry();
          this.cb.onChange('~resize', 'resize');
          this.announce('Tamanho ' + Math.round(el.w) + ' por ' + Math.round(el.h) + '.');
        } else {
          els.forEach(function (el) {
            el.x = clamp(el.x + dx, 0, Math.max(0, vp.w - el.w));
            el.y = clamp(el.y + dy, 0, Math.max(0, vp.h - el.h));
            self._geom(el);
          });
          this.cb.onGeometry();
          this.cb.onChange('~nudge', 'move');
          if (els.length === 1) this.announce('Posição ' + Math.round(els[0].x) + ', ' + Math.round(els[0].y) + '.');
        }
        return true;
      }
      return false;
    }

    /* ---------- ponteiro: mouse, toque e pinça ---------- */
    _bind() {
      var ws = this.ws, self = this;
      ws.addEventListener('pointerdown', function (e) { self._down(e); });
      ws.addEventListener('pointermove', function (e) { self._move(e); });
      ws.addEventListener('pointerup', function (e) { self._up(e, false); });
      ws.addEventListener('pointercancel', function (e) { self._up(e, true); });
      ws.addEventListener('lostpointercapture', function (e) { if (self.pointers.has(e.pointerId) && !self._capturing) self._up(e, true); });
      ws.addEventListener('wheel', function (e) {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          self.setZoom(self.zoom * Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
        }
      }, { passive: false });
      ws.addEventListener('contextmenu', function (e) {
        if (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) e.preventDefault();
      });
      this.stage.addEventListener('focusin', function (e) {
        if (self._pointerActive || self.editing) return;
        var n = e.target.closest && e.target.closest('.wf');
        if (!n) return;
        var id = n.dataset.id;
        if (self.selection.indexOf(id) < 0) self.select([id]);
      });
    }

    _down(e) {
      if (e.target.closest && e.target.closest('.wf-editor')) return;
      if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1) return;
      this.endEdit(true);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this._pointerActive = true;
      if (this.pointers.size === 2) { this._beginPinch(); return; }
      if (this.pointers.size > 2) return;

      var handle = e.target.closest('.handle');
      var node = e.target.closest('.wf');
      if (e.button === 1) {
        this._beginPan(e);
      } else if (handle && node) {
        this._beginResize(e, node, handle.dataset.h);
      } else if (node) {
        this._beginDrag(e, node);
      } else {
        this._beginPan(e);
      }
      this._capturing = true;
      try { this.ws.setPointerCapture(e.pointerId); } catch (err) { /* ignorado */ }
      this._capturing = false;
    }

    _beginPan(e) {
      this.mode = 'pan';
      this.pan = { sx: e.clientX, sy: e.clientY, l: this.ws.scrollLeft, t: this.ws.scrollTop, moved: false };
      this.ws.classList.add('is-panning');
    }

    _beginDrag(e, node) {
      var id = node.dataset.id, multi = e.shiftKey || e.ctrlKey || e.metaKey;
      if (multi) {
        if (this.selection.indexOf(id) > -1) this.select(this.selection.filter(function (x) { return x !== id; }));
        else this.select(this.selection.concat([id]));
      } else if (this.selection.indexOf(id) < 0) {
        this.select([id]);
      }
      if (this.selection.indexOf(id) < 0) { this.mode = null; return; }
      var self = this;
      this.mode = 'drag';
      this.drag = {
        sx: e.clientX, sy: e.clientY, primary: id, moved: false, multi: multi,
        orig: this.selection.map(function (sid) { var el = self.find(sid); return { id: sid, x: el.x, y: el.y, w: el.w, h: el.h }; })
      };
    }

    _beginResize(e, node, dir) {
      var id = node.dataset.id, el = this.find(id);
      if (!el) return;
      this.mode = 'resize';
      this.resize = { id: id, dir: dir, sx: e.clientX, sy: e.clientY, o: { x: el.x, y: el.y, w: el.w, h: el.h }, moved: false };
    }

    _beginPinch() {
      this._finishDragIfMoved();
      this.ws.classList.remove('is-panning');
      var pts = Array.from(this.pointers.values());
      var cx = (pts[0].x + pts[1].x) / 2, cy = (pts[0].y + pts[1].y) / 2;
      var sr = this.stage.getBoundingClientRect();
      this.mode = 'pinch';
      this.pinch = {
        dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1, z: this.zoom,
        anchor: { x: (cx - sr.left) / this.zoom, y: (cy - sr.top) / this.zoom }
      };
    }

    _finishDragIfMoved() {
      if (this.mode === 'drag' && this.drag && this.drag.moved) this.cb.onChange(null, 'move');
      if (this.mode === 'resize' && this.resize && this.resize.moved) this.cb.onChange(null, 'resize');
      this.mode = null;
    }

    _move(e) {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      var z = this.zoom, vp = this.vp, self = this;

      if (this.mode === 'pinch' && this.pointers.size >= 2) {
        var pts = Array.from(this.pointers.values());
        var d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
        var cx = (pts[0].x + pts[1].x) / 2, cy = (pts[0].y + pts[1].y) / 2;
        this.setZoom(this.pinch.z * d / this.pinch.dist, cx, cy, this.pinch.anchor);
        return;
      }
      if (this.mode === 'pan') {
        var p = this.pan, dx = e.clientX - p.sx, dy = e.clientY - p.sy;
        if (!p.moved && Math.hypot(dx, dy) < 4) return;
        p.moved = true;
        this.ws.scrollLeft = p.l - dx;
        this.ws.scrollTop = p.t - dy;
        return;
      }
      if (this.mode === 'drag') {
        var d0 = this.drag, ddx = (e.clientX - d0.sx) / z, ddy = (e.clientY - d0.sy) / z;
        if (!d0.moved && Math.hypot(ddx, ddy) * z < 4) return;
        d0.moved = true;
        var prim = d0.orig.filter(function (o) { return o.id === d0.primary; })[0] || d0.orig[0];
        if (this.snap) {
          ddx = Math.round((prim.x + ddx) / GRID) * GRID - prim.x;
          ddy = Math.round((prim.y + ddy) / GRID) * GRID - prim.y;
        }
        var minX = Infinity, minY = Infinity, maxR = -Infinity, maxB = -Infinity;
        d0.orig.forEach(function (o) {
          minX = Math.min(minX, o.x); minY = Math.min(minY, o.y);
          maxR = Math.max(maxR, o.x + o.w); maxB = Math.max(maxB, o.y + o.h);
        });
        ddx = Math.min(Math.max(ddx, -minX), Math.max(vp.w - maxR, -minX));
        ddy = Math.min(Math.max(ddy, -minY), Math.max(vp.h - maxB, -minY));
        d0.orig.forEach(function (o) {
          var el = self.find(o.id);
          if (!el) return;
          el.x = o.x + ddx;
          el.y = o.y + ddy;
          self._geom(el);
        });
        this.cb.onGeometry();
        return;
      }
      if (this.mode === 'resize') {
        var r = this.resize, el2 = this.find(r.id);
        if (!el2) return;
        var rdx = (e.clientX - r.sx) / z, rdy = (e.clientY - r.sy) / z;
        if (!r.moved && Math.hypot(rdx, rdy) * z < 3) return;
        r.moved = true;
        var o = r.o, x = o.x, y = o.y, w = o.w, hh = o.h, dir = r.dir;
        if (dir.indexOf('e') > -1) { w = this._snapV(o.x + o.w + rdx) - o.x; }
        if (dir.indexOf('w') > -1) { x = this._snapV(o.x + rdx); w = o.x + o.w - x; }
        if (dir.indexOf('s') > -1) { hh = this._snapV(o.y + o.h + rdy) - o.y; }
        if (dir.indexOf('n') > -1) { y = this._snapV(o.y + rdy); hh = o.y + o.h - y; }
        if (w < MIN_SIZE) { if (dir.indexOf('w') > -1) x = o.x + o.w - MIN_SIZE; w = MIN_SIZE; }
        if (hh < MIN_SIZE) { if (dir.indexOf('n') > -1) y = o.y + o.h - MIN_SIZE; hh = MIN_SIZE; }
        if (x < 0) { w += x; x = 0; }
        if (y < 0) { hh += y; y = 0; }
        if (x + w > vp.w) w = vp.w - x;
        if (y + hh > vp.h) hh = vp.h - y;
        el2.x = x; el2.y = y; el2.w = Math.max(MIN_SIZE, w); el2.h = Math.max(MIN_SIZE, hh);
        this._geom(el2);
        this.cb.onGeometry();
      }
    }

    _up(e, cancel) {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.delete(e.pointerId);
      try { this.ws.releasePointerCapture(e.pointerId); } catch (err) { /* ignorado */ }

      if (this.mode === 'drag') {
        var d = this.drag;
        if (d.moved) {
          this.cb.onChange(null, 'move');
          var el = this.find(d.primary);
          if (el) this.announce('Movido para ' + Math.round(el.x) + ', ' + Math.round(el.y) + '.');
        } else if (!cancel && !d.multi && this.selection.length > 1) {
          this.select([d.primary]);
        } else if (!cancel && !d.multi && this.selection.length === 1) {
          var now = performance.now();
          if (this._lastTap && this._lastTap.id === d.primary && now - this._lastTap.t < 400) {
            this._lastTap = null;
            this.startEdit(d.primary);
          } else {
            this._lastTap = { id: d.primary, t: now };
          }
        }
        this.mode = null;
      } else if (this.mode === 'resize') {
        if (this.resize.moved) this.cb.onChange(null, 'resize');
        this.mode = null;
      } else if (this.mode === 'pan') {
        var moved = this.pan.moved;
        this.ws.classList.remove('is-panning');
        this.mode = null;
        if (!moved && !cancel) { this.select([]); this.ws.focus({ preventScroll: true }); }
      } else if (this.mode === 'pinch') {
        if (this.pointers.size === 1) {
          var rest = Array.from(this.pointers.values())[0];
          this.mode = 'pan';
          this.pan = { sx: rest.x, sy: rest.y, l: this.ws.scrollLeft, t: this.ws.scrollTop, moved: true };
          this.ws.classList.add('is-panning');
        } else {
          this.mode = null;
        }
      }
      if (this.pointers.size === 0) { this._pointerActive = false; this.ws.classList.remove('is-panning'); }
    }
  }

  /* ------------------------------------------------------------------ Exportação PNG (canvas 2D) */
  function rr(ctx, x, y, w, hh, r) {
    r = Math.max(0, Math.min(r, w / 2, hh / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + hh, r);
    ctx.arcTo(x + w, y + hh, x, y + hh, r);
    ctx.arcTo(x, y + hh, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* Retângulo com raios individuais [sup.esq., sup.dir., inf.dir., inf.esq.] */
  function rrect(ctx, x, y, w, hh, r) {
    var tl = r[0], tr = r[1], br = r[2], bl = r[3];
    ctx.beginPath();
    ctx.moveTo(x + tl, y);
    ctx.arcTo(x + w, y, x + w, y + hh, tr);
    ctx.arcTo(x + w, y + hh, x, y + hh, br);
    ctx.arcTo(x, y + hh, x, y, bl);
    ctx.arcTo(x, y, x + w, y, tl);
    ctx.closePath();
  }

  function truncate(ctx, text, maxW) {
    text = String(text || '');
    if (maxW <= 0) return '';
    if (ctx.measureText(text).width <= maxW) return text;
    var t = text;
    while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return t + '…';
  }

  function wrapLines(ctx, text, maxW) {
    var out = [];
    String(text || '').split('\n').forEach(function (p) {
      var words = p.split(/\s+/), line = '';
      words.forEach(function (w) {
        var t = line ? line + ' ' + w : w;
        if (!line || ctx.measureText(t).width <= maxW) line = t;
        else { out.push(line); line = w; }
      });
      out.push(line);
    });
    return out;
  }

  function drawHamburger(ctx, x, y, size, lineW, color) {
    var k = size / 24;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    ctx.lineWidth = lineW;
    ctx.strokeStyle = color || INK;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(4, 7); ctx.lineTo(20, 7);
    ctx.moveTo(4, 12); ctx.lineTo(20, 12);
    ctx.moveTo(4, 17); ctx.lineTo(20, 17);
    ctx.stroke();
    ctx.restore();
  }

  function drawElement(ctx, el) {
    var w = el.w, hh = el.h, c = COMPONENTS[el.type];
    if (!c) return;
    var line = el.stroke || INK;          // bordas e linhas
    var txt = textColorOf(el);            // texto
    var mark = el.stroke || txt;          // ícones e marcas internas
    var bg = el.fill || '';
    var customText = !!(el.fill || el.color);
    var fh = !!el.flipH, fv = !!el.flipV;
    /* raios do caminho (2px de borda: o traço fica centrado a 1px da borda externa) */
    var R = radiusOf(el).map(function (v) { return Math.max(0, v - 1); });
    var LA = fh ? 'right' : 'left';       // alinhamento do texto à "esquerda" lógica
    function X(off) { return fh ? w - off : off; }
    ctx.save();
    ctx.translate(el.x, el.y);
    ctx.beginPath(); ctx.rect(0, 0, w, hh); ctx.clip();
    ctx.lineWidth = 2; ctx.strokeStyle = line; ctx.fillStyle = txt; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    var t = el.text || '';

    function path(r) { rrect(ctx, 1, 1, w - 2, hh - 2, typeof r === 'number' ? [r, r, r, r] : r); }
    function box(def, r) {
      var col = bg || def;
      if (!col) return;
      path(r);
      ctx.fillStyle = col; ctx.fill();
      ctx.fillStyle = txt;
    }
    function outline(r) { ctx.strokeStyle = line; path(r); ctx.stroke(); }

    switch (el.type) {
      case 'container':
        box('', R); outline(R);
        if (t) {
          ctx.font = '600 13px ' + FONT; ctx.textBaseline = fv ? 'bottom' : 'top'; ctx.textAlign = LA;
          ctx.fillText(truncate(ctx, firstLine(t), w - 28), X(14), fv ? hh - 9 : 9);
        }
        break;
      case 'button':
        box(FILL, R); outline(R);
        ctx.fillStyle = txt; ctx.font = '600 14px ' + FONT; ctx.textAlign = 'center';
        ctx.fillText(truncate(ctx, firstLine(t), w - 28), w / 2, hh / 2 + 0.5);
        break;
      case 'input':
        box(PAPER, R); outline(R);
        ctx.fillStyle = customText ? txt : MUTED; ctx.font = '14px ' + FONT; ctx.textAlign = LA;
        ctx.fillText(truncate(ctx, firstLine(t), w - 28), X(14), hh / 2 + 0.5);
        break;
      case 'navbar':
        box(FILL, R); outline(R);
        drawHamburger(ctx, fh ? w - 14 - 24 : 14, hh / 2 - 12, 24, 2, mark);
        ctx.fillStyle = txt; ctx.font = '600 16px ' + FONT; ctx.textAlign = LA;
        ctx.fillText(truncate(ctx, firstLine(t), w - 14 - 24 - 16 - 14), X(54), hh / 2 + 0.5);
        break;
      case 'hamburger': {
        box('', R); outline(R);
        var inner = Math.min(w, hh) - 4 - 12;
        if (inner > 0) drawHamburger(ctx, w / 2 - inner / 2, hh / 2 - inner / 2, inner, 2, mark);
        break;
      }
      case 'image':
        box(SOFT, R);
        ctx.save();
        path(R); ctx.clip();
        ctx.strokeStyle = line;
        ctx.beginPath(); ctx.moveTo(1, 1); ctx.lineTo(w - 1, hh - 1); ctx.moveTo(w - 1, 1); ctx.lineTo(1, hh - 1); ctx.stroke();
        ctx.restore();
        outline(R);
        break;
      case 'text': {
        box('', R);
        ctx.fillStyle = txt; ctx.font = '14px ' + FONT; ctx.textBaseline = 'top'; ctx.textAlign = LA;
        var tl = wrapLines(ctx, t, w - 8), y00 = fv ? hh - 4 - tl.length * 20 : 4;
        tl.forEach(function (ln, i) { ctx.fillText(ln, X(4), y00 + i * 20 + 3); });
        break;
      }
      case 'list': {
        box(PAPER, R); outline(R);
        var rows = String(t).split('\n');
        ctx.save();
        rrect(ctx, 2, 2, w - 4, hh - 4, R.map(function (v) { return Math.max(0, v - 1); })); ctx.clip();
        rows.forEach(function (ln, i) {
          var y0 = fv ? hh - 2 - (i + 1) * 32 : 2 + i * 32;
          if (fv ? y0 + 32 < 0 : y0 > hh) return;
          ctx.lineWidth = 2; ctx.strokeStyle = mark;
          rr(ctx, fh ? w - 21 : 13, y0 + 11, 8, 8, 2); ctx.stroke();
          ctx.fillStyle = txt; ctx.font = '14px ' + FONT; ctx.textBaseline = 'middle'; ctx.textAlign = LA;
          ctx.fillText(truncate(ctx, ln, w - 12 - 22 - 24 - 12), X(34), y0 + 16.5);
          if (i < rows.length - 1) {
            var ly = fv ? y0 + 0.5 : y0 + 31.5;
            ctx.lineWidth = 1; ctx.strokeStyle = LIGHT;
            ctx.beginPath(); ctx.moveTo(2, ly); ctx.lineTo(w - 2, ly); ctx.stroke();
          }
        });
        ctx.restore();
        break;
      }
      case 'toggle': {
        box('', 6);
        var sx = fh ? 2 : w - 46, sy = (hh - 24) / 2;
        ctx.fillStyle = txt; ctx.font = '14px ' + FONT; ctx.textAlign = LA;
        ctx.fillText(truncate(ctx, firstLine(t), w - 58), X(2), hh / 2 + 0.5);
        ctx.textAlign = 'left';
        ctx.strokeStyle = mark; ctx.lineWidth = 2;
        rr(ctx, sx + 1, sy + 1, 42, 22, 11);
        if (el.checked) { ctx.fillStyle = mark; ctx.fill(); }
        ctx.stroke();
        ctx.beginPath(); ctx.arc(sx + (el.checked ? 32 : 12), sy + 12, 7, 0, Math.PI * 2);
        ctx.fillStyle = el.checked ? (bg || PAPER) : mark; ctx.fill();
        break;
      }
      case 'checkbox': {
        box('', 6);
        var by = (hh - 20) / 2, bx = fh ? w - 22 : 2;
        rr(ctx, bx + 1, by + 1, 18, 18, 4); ctx.fillStyle = bg || PAPER; ctx.fill();
        ctx.strokeStyle = mark; ctx.lineWidth = 2; ctx.stroke();
        if (el.checked) {
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(bx + 5, by + 10.5); ctx.lineTo(bx + 8.5, by + 14); ctx.lineTo(bx + 15, by + 6.5); ctx.stroke();
        }
        ctx.fillStyle = txt; ctx.font = '14px ' + FONT; ctx.textAlign = LA;
        ctx.fillText(truncate(ctx, firstLine(t), w - 34), X(32), hh / 2 + 0.5);
        break;
      }
      case 'divider':
        ctx.strokeStyle = line;
        ctx.beginPath(); ctx.moveTo(0, hh / 2); ctx.lineTo(w, hh / 2); ctx.stroke();
        break;
    }
    ctx.restore();
  }

  function drawScreen(ctx, screen, vp) {
    ctx.save();
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, vp.w, vp.h);
    ctx.beginPath(); ctx.rect(0, 0, vp.w, vp.h); ctx.clip();
    screen.elements.forEach(function (el) { drawElement(ctx, el); });
    ctx.restore();
  }

  function renderScreenCanvas(screen, vpKey, scale) {
    var vp = VIEWPORTS[vpKey] || VIEWPORTS.mobile;
    scale = scale || 2;
    var c = document.createElement('canvas');
    c.width = Math.round(vp.w * scale);
    c.height = Math.round(vp.h * scale);
    var ctx = c.getContext('2d');
    ctx.scale(scale, scale);
    drawScreen(ctx, screen, vp);
    return c;
  }

  /* Folha única com TODAS as telas do projeto */
  function renderSheetCanvas(project) {
    var vp = VIEWPORTS[project.viewport] || VIEWPORTS.mobile;
    var n = project.screens.length, pad = 48, gap = 48, titleH = 44, headH = 72, maxRow = 4800;
    var cols = Math.max(1, Math.min(n, Math.floor((maxRow - pad * 2 + gap) / (vp.w + gap))));
    var rows = Math.ceil(n / cols);
    var W = pad * 2 + cols * vp.w + (cols - 1) * gap;
    var H = pad * 2 + headH + rows * (vp.h + titleH) + (rows - 1) * gap;
    var scale = Math.min(2, 16000 / W, 16000 / H, Math.sqrt(120e6 / (W * H)));
    var c = document.createElement('canvas');
    c.width = Math.floor(W * scale);
    c.height = Math.floor(H * scale);
    var ctx = c.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#F3F4F7';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = INK; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    ctx.font = '700 28px ' + FONT;
    ctx.fillText(project.name + ' — Alicerce', pad, pad + 28);
    ctx.font = '14px ' + FONT; ctx.fillStyle = MUTED;
    ctx.fillText(n + (n === 1 ? ' tela' : ' telas') + ' · ' + vp.label, pad, pad + 54);
    project.screens.forEach(function (screen, i) {
      var col = i % cols, row = Math.floor(i / cols);
      var x = pad + col * (vp.w + gap);
      var y = pad + headH + row * (vp.h + titleH + gap);
      ctx.fillStyle = INK; ctx.font = '600 18px ' + FONT; ctx.textBaseline = 'middle';
      ctx.fillText(truncate(ctx, (i + 1) + '. ' + screen.name, vp.w), x, y + titleH / 2);
      ctx.save();
      ctx.translate(x, y + titleH);
      drawScreen(ctx, screen, vp);
      ctx.restore();
      ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.strokeRect(x - 1, y + titleH - 1, vp.w + 2, vp.h + 2);
    });
    return c;
  }

  /* ------------------------------------------------------------------ Impressão */
  function buildPrintArea(project, container) {
    container.textContent = '';
    var vp = VIEWPORTS[project.viewport] || VIEWPORTS.mobile;
    var landscape = vp.w > vp.h;
    var zoom = landscape ? Math.min(980 / vp.w, 620 / vp.h) : Math.min(700 / vp.w, 900 / vp.h);
    project.screens.forEach(function (screen, i) {
      var page = h('section', 'print-page');
      page.appendChild(h('h2', 'print-title', project.name + ' — Tela ' + (i + 1) + ' de ' + project.screens.length + ': ' + screen.name + ' (' + vp.label + ')'));
      var box = h('div', 'print-stage-box');
      box.style.width = vp.w * zoom + 'px';
      box.style.height = vp.h * zoom + 'px';
      var st = h('div', 'print-stage');
      st.style.width = vp.w + 'px';
      st.style.height = vp.h + 'px';
      st.style.transform = 'scale(' + zoom + ')';
      screen.elements.forEach(function (el) { st.appendChild(buildNode(el, true)); });
      box.appendChild(st);
      page.appendChild(box);
      container.appendChild(page);
    });
  }

  global.AlicerceEngine = {
    CanvasEngine: CanvasEngine,
    COMPONENTS: COMPONENTS,
    COMPONENT_ORDER: COMPONENT_ORDER,
    VIEWPORTS: VIEWPORTS,
    GRID: GRID,
    MIN_SIZE: MIN_SIZE,
    uid: uid,
    normHex: normHex,
    normR: normR,
    radiusOf: radiusOf,
    maxRadius: maxRadius,
    DEFAULT_RADIUS: DEFAULT_RADIUS,
    contrast: contrast,
    autoText: autoText,
    colorInfo: colorInfo,
    renderScreenCanvas: renderScreenCanvas,
    renderSheetCanvas: renderSheetCanvas,
    buildPrintArea: buildPrintArea
  };
})(window);
