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
    divider: { label: 'Divisor', icon: 'c-divider', w: 280, h: 12, text: '', editable: false },
    fab: { label: 'Botão flutuante (FAB)', icon: 'c-fab', w: 56, h: 56, text: '', editable: false },
    iconbutton: { label: 'Botão de ícone', icon: 'c-iconbutton', w: 44, h: 44, text: '+', editable: true },
    select: { label: 'Seleção (dropdown)', icon: 'c-select', w: 260, h: 44, text: 'Selecione uma opção', editable: true },
    radio: { label: 'Radio button', icon: 'c-radio', w: 180, h: 32, text: 'Opção', editable: true, hasState: true, stateLabel: 'Selecionado' },
    slider: { label: 'Slider', icon: 'c-slider', w: 240, h: 32, text: '', editable: false },
    tabs: { label: 'Abas (tabs)', icon: 'c-tabs', w: 320, h: 44, text: 'Aba 1\nAba 2\nAba 3', editable: true, multiline: true },
    breadcrumb: { label: 'Breadcrumb', icon: 'c-breadcrumb', w: 300, h: 28, text: 'Início\nProjetos\nConfigurações', editable: true, multiline: true },
    bottomnav: { label: 'Navegação inferior', icon: 'c-bottomnav', w: 360, h: 64, text: 'Início\nBuscar\nPerfil', editable: true, multiline: true, full: true, dock: 'bottom' },
    sidebar: { label: 'Menu lateral (drawer)', icon: 'c-sidebar', w: 240, h: 400, text: 'Alicerce\nPainel\nProjetos\nRelatórios\nAjustes', editable: true, multiline: true },
    scrollbar: { label: 'Barra de rolagem', icon: 'c-scrollbar', w: 16, h: 200, text: '', editable: false },
    card: { label: 'Card com imagem', icon: 'c-card', w: 280, h: 240, text: 'Título do card\nDescrição curta do conteúdo.', editable: true, multiline: true },
    modal: { label: 'Modal / Diálogo', icon: 'c-modal', w: 300, h: 200, text: 'Título do diálogo\nTexto de apoio que explica a decisão.', editable: true, multiline: true },
    arrow: { label: 'Seta de fluxo', icon: 'c-arrow', w: 160, h: 24, text: '', editable: false },
    note: { label: 'Nota / Anotação', icon: 'c-note', w: 200, h: 96, text: 'Anotação: descreva o comportamento ou o destino deste elemento.', editable: true, multiline: true },
    toast: { label: 'Toast / Snackbar', icon: 'c-toast', w: 300, h: 48, text: 'Alterações salvas\nDesfazer', editable: true, multiline: true },
    badge: { label: 'Badge / Tag', icon: 'c-badge', w: 64, h: 24, text: 'Ativo', editable: true },
    chip: { label: 'Chip removível', icon: 'c-chip', w: 104, h: 32, text: 'Filtro', editable: true },
    tooltip: { label: 'Tooltip', icon: 'c-tooltip', w: 160, h: 56, text: 'Dica de uso', editable: true },
    progress: { label: 'Barra de progresso', icon: 'c-progress', w: 240, h: 16, text: '', editable: false },
    skeleton: { label: 'Skeleton (carregando)', icon: 'c-skeleton', w: 280, h: 72, text: '', editable: false }
  };
  var GROUPS = [
    { label: 'Ações', types: ['button', 'iconbutton', 'fab'] },
    { label: 'Formulários', types: ['input', 'select', 'checkbox', 'radio', 'toggle', 'slider'] },
    { label: 'Navegação', types: ['navbar', 'hamburger', 'sidebar', 'bottomnav', 'tabs', 'breadcrumb', 'scrollbar'] },
    { label: 'Conteúdo e feedback', types: ['container', 'card', 'image', 'text', 'list', 'divider', 'badge', 'chip', 'tooltip', 'progress', 'skeleton', 'modal', 'toast'] },
    { label: 'Fluxo e anotações', types: ['arrow', 'note'] }
  ];
  var COMPONENT_ORDER = GROUPS.reduce(function (a, g) { return a.concat(g.types); }, []);

  /* Cores do wireframe (iguais às variáveis CSS --wf-*) */
  var NOTE = '#FFF3B0', INK = '#1F2430', MUTED = '#5B6270', FILL = '#EEF0F4', PAPER = '#FFFFFF', LIGHT = '#C9CED8', SOFT = '#F7F8FA';
  var FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

  /* ------------------------------------------------------------------ cores */
  var HEX_RE = /^#[0-9a-fA-F]{6}$/;
  var DEFAULT_BG = { container: PAPER, button: FILL, input: PAPER, navbar: FILL, hamburger: PAPER, image: SOFT, text: PAPER, list: PAPER, toggle: PAPER, checkbox: PAPER, divider: PAPER,
    fab: FILL, iconbutton: PAPER, select: PAPER, radio: PAPER, slider: PAPER, tabs: PAPER, breadcrumb: PAPER, bottomnav: PAPER, sidebar: PAPER,
    scrollbar: PAPER, card: PAPER, modal: PAPER, toast: FILL, badge: FILL, chip: FILL, tooltip: PAPER, progress: PAPER, skeleton: LIGHT, arrow: PAPER, note: NOTE };

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
    node.classList.toggle('is-locked', !!el.locked);
    node.classList.toggle('is-hidden', !!el.hidden);
  }

  /* ------------------------------------------------------------------ cantos (raio) */
  var DEFAULT_RADIUS = { container: 8, button: 8, input: 6, navbar: 0, hamburger: 8, image: 0, text: 4, list: 8,
    iconbutton: 8, select: 6, bottomnav: 0, sidebar: 0, card: 8, modal: 8, toast: 8, note: 2, badge: 999, chip: 999, tooltip: 6 };
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
  function radiusOf(el, hAdj) {
    var d = DEFAULT_RADIUS[el.type] || 0;
    var base = (el.r && COMPONENTS[el.type] && COMPONENTS[el.type].radius) ? el.r : [d, d, d, d];
    return fitRadii(base, el.w, hAdj || el.h);
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
  /* Linhas não vazias (itens de abas, menus, breadcrumbs...). Sempre devolve ao menos um item. */
  function lines(t) {
    var a = String(t || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 12);
    return a.length ? a : [''];
  }
  function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }

  function describe(el) {
    var c = COMPONENTS[el.type];
    var out = c.label;
    var t = firstLine(el.text);
    if (t && c.editable) out += ': ' + t;
    if (c.hasState) out += el.checked ? ', ' + c.stateLabel.toLowerCase() : ', desativado';
    if (el.flipH || el.flipV) out += ', espelhado' + (el.flipH && el.flipV ? ' na horizontal e na vertical' : el.flipH ? ' na horizontal' : ' na vertical');
    if (el.locked) out += ', travado';
    if (el.hidden) out += ', oculto';
    out += '. Posição ' + Math.round(el.x) + ', ' + Math.round(el.y) + '. Tamanho ' + Math.round(el.w) + ' por ' + Math.round(el.h) + '.';
    return out;
  }

  /* ------------------------------------------------------------------ DOM dos componentes */
  function hamburgerSvg(cls) {
    var sv = s('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', 'class': cls });
    sv.appendChild(s('path', { d: 'M4 7h16M4 12h16M4 17h16' }));
    return sv;
  }

  /* Seta de fluxo: reta ao longo do lado maior; se o lado menor passar de 28 px, vira diagonal de canto a canto.
     A espelhada na horizontal/vertical inverte o sentido (a ponta muda de lado). */
  var ARROW_DIAG = 28;
  function arrowPts(el) {
    var w = el.w, hh = el.h, pad = 4, x1, y1, x2, y2;
    if (Math.min(w, hh) > ARROW_DIAG) { x1 = pad; y1 = pad; x2 = w - pad; y2 = hh - pad; if (el.flipH) { var tx = x1; x1 = x2; x2 = tx; } if (el.flipV) { var ty = y1; y1 = y2; y2 = ty; } }
    else if (w >= hh) { y1 = y2 = hh / 2; x1 = pad; x2 = w - pad; if (el.flipH) { x1 = w - pad; x2 = pad; } }
    else { x1 = x2 = w / 2; y1 = pad; y2 = hh - pad; if (el.flipV) { y1 = hh - pad; y2 = pad; } }
    var dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / len, uy = dy / len;
    var hl = Math.min(14, len * 0.6), hw = hl * 0.5;
    var bx = x2 - ux * hl, by = y2 - uy * hl;
    return { x1: x1, y1: y1, x2: x2, y2: y2, bx: bx, by: by, lx: bx - uy * hw, ly: by + ux * hw, rx: bx + uy * hw, ry: by - ux * hw };
  }
  function arrowSvg(el) {
    var a = arrowPts(el), f = function (n) { return Math.round(n * 100) / 100; };
    var sv = s('svg', { viewBox: '0 0 ' + el.w + ' ' + el.h, 'class': 'wf-arrow-svg', 'aria-hidden': 'true' });
    sv.appendChild(s('line', { x1: f(a.x1), y1: f(a.y1), x2: f(a.bx), y2: f(a.by) }));
    sv.appendChild(s('polygon', { points: [a.x2, a.y2, a.lx, a.ly, a.rx, a.ry].map(f).join(',') }));
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
      case 'note':
        body.appendChild(h('div', 'wf-text-content', t));
        break;
      case 'arrow':
        body.appendChild(arrowSvg(el));
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
      case 'fab': {
        var fs = s('svg', { viewBox: '0 0 24 24', 'class': 'wf-fill-svg', 'aria-hidden': 'true' });
        fs.appendChild(s('path', { d: 'M12 6v12M6 12h12' }));
        body.appendChild(fs);
        break;
      }
      case 'iconbutton':
        body.appendChild(h('span', 'wf-label', firstLine(t)));
        break;
      case 'select': {
        body.appendChild(h('span', 'wf-label wf-muted', firstLine(t)));
        var ch = s('svg', { viewBox: '0 0 16 16', 'class': 'wf-chev', 'aria-hidden': 'true' });
        ch.appendChild(s('path', { d: 'M4 6l4 4 4-4' }));
        body.appendChild(ch);
        break;
      }
      case 'radio': {
        var rd = s('svg', { viewBox: '0 0 20 20', 'class': 'wf-check wf-radio-ico', 'aria-hidden': 'true' });
        rd.appendChild(s('circle', { cx: 10, cy: 10, r: 9 }));
        if (el.checked) rd.appendChild(s('circle', { cx: 10, cy: 10, r: 5, 'class': 'dot' }));
        body.appendChild(rd);
        body.appendChild(h('span', 'wf-label', firstLine(t)));
        break;
      }
      case 'slider': {
        var tr = h('div', 'wf-sl-track');
        tr.appendChild(h('i', 'wf-sl-fill'));
        body.appendChild(tr);
        body.appendChild(h('b', 'wf-sl-thumb'));
        break;
      }
      case 'tabs':
        lines(t).forEach(function (ln, i) { body.appendChild(h('div', 'wf-tab' + (i === 0 ? ' on' : ''), ln)); });
        break;
      case 'breadcrumb':
        lines(t).forEach(function (ln, i, arr) {
          if (i) body.appendChild(h('span', 'wf-sep', '›'));
          body.appendChild(h('span', 'wf-crumb' + (i === arr.length - 1 ? ' last' : ''), ln));
        });
        break;
      case 'bottomnav':
        lines(t).slice(0, 6).forEach(function (ln, i) {
          var it = h('div', 'wf-bn' + (i === 0 ? ' on' : ''));
          it.appendChild(h('i', 'wf-bn-ico'));
          it.appendChild(h('span', 'wf-bn-lbl', ln));
          body.appendChild(it);
        });
        break;
      case 'sidebar': {
        var sl = lines(t);
        body.appendChild(h('div', 'wf-sb-title', sl[0]));
        sl.slice(1).forEach(function (ln, i) {
          var it = h('div', 'wf-sb-item' + (i === 0 ? ' on' : ''));
          it.appendChild(h('i'));
          it.appendChild(h('span', 'wf-label', ln));
          body.appendChild(it);
        });
        break;
      }
      case 'scrollbar':
        body.appendChild(h('i', 'wf-sbthumb'));
        break;
      case 'card': {
        var img = h('div', 'wf-card-img');
        var cs = s('svg', { viewBox: '0 0 100 100', preserveAspectRatio: 'none', 'class': 'wf-fill-svg', 'aria-hidden': 'true' });
        cs.appendChild(s('line', { x1: 0, y1: 0, x2: 100, y2: 100, 'vector-effect': 'non-scaling-stroke' }));
        cs.appendChild(s('line', { x1: 100, y1: 0, x2: 0, y2: 100, 'vector-effect': 'non-scaling-stroke' }));
        img.appendChild(cs);
        body.appendChild(img);
        var tx = h('div', 'wf-card-txt');
        tx.appendChild(h('div', 'wf-card-title', firstLine(t)));
        tx.appendChild(h('div', 'wf-card-desc wf-muted', String(t).split('\n').slice(1).join('\n')));
        body.appendChild(tx);
        break;
      }
      case 'modal': {
        var hd = h('div', 'wf-md-head');
        hd.appendChild(h('span', 'wf-md-title', firstLine(t)));
        hd.appendChild(h('span', 'wf-md-x', '×'));
        body.appendChild(hd);
        body.appendChild(h('div', 'wf-md-body wf-muted', String(t).split('\n').slice(1).join('\n')));
        var ft = h('div', 'wf-md-foot');
        ft.appendChild(h('span', 'wf-md-btn ghost', 'Cancelar'));
        ft.appendChild(h('span', 'wf-md-btn', 'Confirmar'));
        body.appendChild(ft);
        break;
      }
      case 'toast': {
        var tl = String(t).split('\n');
        body.appendChild(h('span', 'wf-label', tl[0]));
        if (tl[1] && tl[1].trim()) body.appendChild(h('span', 'wf-act', tl[1].trim()));
        break;
      }
      case 'badge':
        body.appendChild(h('span', 'wf-label', firstLine(t)));
        break;
      case 'chip': {
        body.appendChild(h('span', 'wf-label', firstLine(t)));
        var cx = s('svg', { viewBox: '0 0 12 12', 'class': 'wf-chip-x', 'aria-hidden': 'true' });
        cx.appendChild(s('path', { d: 'M3 3l6 6M9 3l-6 6' }));
        body.appendChild(cx);
        break;
      }
      case 'tooltip': {
        var bx = h('div', 'wf-tip-box');
        bx.appendChild(h('span', 'wf-label', firstLine(t)));
        body.appendChild(bx);
        var ar = s('svg', { viewBox: '0 0 16 10', 'class': 'wf-tip-arrow', 'aria-hidden': 'true' });
        ar.appendChild(s('path', { d: 'M0 0h16L8 9z', 'class': 'tip-fill' }));
        ar.appendChild(s('path', { d: 'M1 0L8 8L15 0', 'class': 'tip-line' }));
        body.appendChild(ar);
        break;
      }
      case 'progress':
        body.appendChild(h('i', 'wf-pg-fill'));
        break;
      case 'skeleton': {
        body.appendChild(h('i', 'wf-sk-av'));
        var col = h('div', 'wf-sk-col');
        [100, 85, 60].forEach(function (pc) { var b = h('i', 'wf-sk-bar'); b.style.width = pc + '%'; col.appendChild(b); });
        body.appendChild(col);
        break;
      }
    }
    node.appendChild(body);
  }

  function applyGeom(node, el) {
    node.style.left = el.x + 'px';
    node.style.top = el.y + 'px';
    node.style.width = el.w + 'px';
    node.style.height = el.h + 'px';
    if (el.type === 'scrollbar') node.classList.toggle('is-horiz', el.w > el.h);
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
      this.cb = Object.assign({ onChange: noop, onSelection: noop, onGeometry: noop, onZoom: noop, onAnnounce: noop, onLocked: noop }, opts.callbacks || {});
      this.screen = null;
      this.viewport = 'mobile';
      this.zoom = 1;
      this.snap = true;
      this.guides = true;
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
    setGuides(on) { this.guides = !!on; if (!on) this._clearGuides(); }
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
      var sel = this.selection, single = sel.length === 1, self = this;
      this.nodes.forEach(function (node, id) {
        var on = sel.indexOf(id) > -1;
        node.classList.toggle('is-selected', on);
        node.setAttribute('aria-selected', on ? 'true' : 'false');
        var hs = node.querySelectorAll('.handle');
        var locked = !!(self.find(id) || {}).locked;
        if (on && single && !locked) { if (!hs.length) addHandles(node); }
        else hs.forEach(function (x) { x.remove(); });
      });
      this._groupBoxes();
    }

    /* Moldura tracejada ao redor de cada grupo que tem algum membro selecionado. */
    _groupBoxes() {
      if (this._gbRaf) return;
      var self = this;
      this._gbRaf = requestAnimationFrame(function () {
        self._gbRaf = 0;
        Array.prototype.forEach.call(self.stage.querySelectorAll('.group-box'), function (b) { b.remove(); });
        if (!self.screen) return;
        var gs = {};
        self.selection.forEach(function (id) { var e = self.find(id); if (e && e.g) gs[e.g] = 1; });
        Object.keys(gs).forEach(function (g) {
          var L = Infinity, T = Infinity, R = -Infinity, B = -Infinity, n = 0;
          self.screen.elements.forEach(function (e) {
            if (e.g !== g || e.hidden) return;
            n++; L = Math.min(L, e.x); T = Math.min(T, e.y); R = Math.max(R, e.x + e.w); B = Math.max(B, e.y + e.h);
          });
          if (n < 2) return;
          var d = document.createElement('div');
          d.className = 'group-box'; d.setAttribute('aria-hidden', 'true');
          d.style.left = (L - 4) + 'px'; d.style.top = (T - 4) + 'px';
          d.style.width = (R - L + 8) + 'px'; d.style.height = (B - T + 8) + 'px';
          self.stage.appendChild(d);
        });
      });
    }

    groupSelected() {
      var els = this.selectedElements();
      if (els.length < 2) { this.announce('Selecione 2 ou mais elementos para agrupar.'); return false; }
      var g = uid();
      els.forEach(function (e) { e.g = g; });
      this._decorate();
      this.cb.onSelection(this.selection.slice());
      this.cb.onChange(null, 'group');
      this.announce(els.length + ' elementos agrupados.');
      return true;
    }

    ungroupSelected() {
      var els = this.selectedElements().filter(function (e) { return e.g; });
      if (!els.length) return false;
      els.forEach(function (e) { e.g = null; });
      this._decorate();
      this.cb.onSelection(this.selection.slice());
      this.cb.onChange(null, 'ungroup');
      this.announce('Grupo desfeito. Os elementos voltaram a ser independentes.');
      return true;
    }

    /* Grupos com menos de 2 membros deixam de existir. */
    _cleanGroups() {
      var cnt = {};
      this.screen.elements.forEach(function (e) { if (e.g) cnt[e.g] = (cnt[e.g] || 0) + 1; });
      this.screen.elements.forEach(function (e) { if (e.g && cnt[e.g] < 2) e.g = null; });
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
      if (el.type === 'arrow') { var old = node.querySelector('.wf-arrow-svg'); if (old) old.replaceWith(arrowSvg(el)); }
      node.setAttribute('aria-label', describe(el));
      if (el.g) this._groupBoxes();
    }

    /* Grupos: elementos com o mesmo `g` se comportam como uma peça. `exact` seleciona só os ids dados (Alt+clique, camadas). */
    _withGroups(ids) {
      var self = this, gs = {}, out = ids.slice();
      ids.forEach(function (id) { var e = self.find(id); if (e && e.g) gs[e.g] = 1; });
      if (!Object.keys(gs).length) return out;
      this.screen.elements.forEach(function (e) { if (e.g && gs[e.g] && out.indexOf(e.id) < 0) out.push(e.id); });
      return out;
    }

    select(ids, silent, exact) {
      var self = this;
      ids = (ids || []).filter(function (id) { return !!self.find(id); });
      if (!exact) ids = this._withGroups(ids);
      this.selection = ids;
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
        w = vp.w; x = 0; y = c.dock === 'bottom' ? Math.max(0, vp.h - hgt) : 0;
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
      var el = { id: uid(), type: type, x: x, y: y, w: w, h: hgt, text: c.text || '', checked: false, fill: '', stroke: '', color: '', flipH: false, flipV: false, r: null, locked: false, hidden: false };
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
      var self = this;
      var all = this.selection.slice();
      var ids = all.filter(function (id) { var e = self.find(id); return e && !e.locked; });
      var kept = all.filter(function (id) { return ids.indexOf(id) < 0; });
      if (kept.length) this.cb.onLocked(kept.length, 'excluir');
      if (!ids.length) return;
      this.screen.elements = this.screen.elements.filter(function (e) { return ids.indexOf(e.id) < 0; });
      ids.forEach(function (id) {
        var n = self.nodes.get(id);
        if (n) n.remove();
        self.nodes.delete(id);
      });
      this.selection = kept;
      this._decorate();
      this._cleanGroups();
      this.cb.onSelection(kept.slice());
      this.cb.onChange(null, 'delete');
      this.announce(ids.length === 1 ? 'Elemento excluído.' : ids.length + ' elementos excluídos.');
      this.ws.focus({ preventScroll: true });
    }

    _cloneEls(els, off) {
      var vp = this.vp, cnt = {}, gmap = {};
      els.forEach(function (e) { if (e.g) cnt[e.g] = (cnt[e.g] || 0) + 1; });
      return els.map(function (e) {
        var c = {
          id: uid(), type: e.type, text: e.text || '', checked: !!e.checked,
          fill: normHex(e.fill), stroke: normHex(e.stroke), color: normHex(e.color),
          flipH: !!e.flipH, flipV: !!e.flipV, r: normR(e.r), locked: false, hidden: false,
          w: e.w, h: e.h, x: e.x + off, y: e.y + off,
          g: (e.g && cnt[e.g] > 1) ? (gmap[e.g] || (gmap[e.g] = uid())) : null
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

    _syncOrder() {
      var self = this;
      this.screen.elements.forEach(function (e) {
        var n = self.nodes.get(e.id);
        if (n) self.stage.appendChild(n);
      });
    }

    _reorder(front) {
      if (!this.selection.length) return;
      var ids = this.selection, sel = [], rest = [];
      this.screen.elements.forEach(function (e) { (ids.indexOf(e.id) > -1 ? sel : rest).push(e); });
      this.screen.elements = front ? rest.concat(sel) : sel.concat(rest);
      this._syncOrder();
      this.cb.onChange(null, 'order');
      this.announce(front ? 'Trazido para frente.' : 'Enviado para trás.');
      this.focusSelected();
    }

    /* Camadas: o índice 0 é o fundo e o último é o primeiro plano. */
    layerIndex(id) {
      for (var i = 0; i < this.screen.elements.length; i++) if (this.screen.elements[i].id === id) return i;
      return -1;
    }

    moveLayer(id, to) {
      if (!this.screen) return false;
      var arr = this.screen.elements, from = this.layerIndex(id);
      if (from < 0) return false;
      to = clamp(Math.round(to), 0, arr.length - 1);
      if (to === from) return false;
      var el = arr.splice(from, 1)[0];
      arr.splice(to, 0, el);
      this._syncOrder();
      this.cb.onChange(null, 'order');
      var pos = arr.length - to;
      this.announce('Camada ' + pos + (pos === 1 ? ' (primeiro plano)' : '') + ' de ' + arr.length + '.');
      return true;
    }

    stepLayer(id, dir) { return this.moveLayer(id, this.layerIndex(id) + (dir > 0 ? 1 : -1)); }

    /* Alterna uma propriedade de camada ('locked' ou 'hidden') de um elemento específico. */
    setLayerProp(id, prop, val) {
      var el = this.find(id);
      if (!el || (prop !== 'locked' && prop !== 'hidden')) return false;
      var patch = {}; patch[prop] = !!val;
      this._patch(el, patch);
      this._decorate();
      this.cb.onGeometry();
      this.cb.onChange(null, 'layer');
      this.announce(prop === 'locked' ? (val ? 'Camada travada.' : 'Camada destravada.') : (val ? 'Camada oculta.' : 'Camada visível.'));
      return true;
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
        elements: els.map(function (e) { return { type: e.type, x: e.x, y: e.y, w: e.w, h: e.h, text: e.text, checked: !!e.checked, fill: e.fill || '', stroke: e.stroke || '', color: e.color || '', flipH: !!e.flipH, flipV: !!e.flipV, r: e.r || null, g: e.g || null }; })
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
          g: (typeof e.g === 'string' && e.g) ? e.g.slice(0, 40) : null,
          x: num(e.x, 0), y: num(e.y, 0), w: Math.max(MIN_SIZE, num(e.w, 100)), h: Math.max(4, num(e.h, 40)) };
      }), off);
      this._addMany(els);
      this.cb.onChange(null, 'paste');
      this.announce(els.length === 1 ? 'Elemento colado.' : els.length + ' elementos colados.');
      return true;
    }

    _patch(el, patch) {
      var vp = this.vp, c = COMPONENTS[el.type], textChanged = false, stateChanged = false, styleChanged = false;
      if ('locked' in patch) { el.locked = !!patch.locked; styleChanged = true; }
      if ('hidden' in patch) { el.hidden = !!patch.hidden; styleChanged = true; }
      if (el.locked) patch = Object.assign({}, patch, { x: undefined, y: undefined, w: undefined, h: undefined });
      ['x', 'y', 'w', 'h'].forEach(function (k) { if (patch[k] === undefined) delete patch[k]; });
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

    /* Cadeado: trava ou destrava a seleção. Se todos já estão travados, destrava; senão, trava todos. */
    toggleLockSelected(force) {
      var els = this.selectedElements();
      if (!els.length) return false;
      var on = typeof force === 'boolean' ? force : !els.every(function (e) { return e.locked; });
      var self = this;
      els.forEach(function (e) { self._patch(e, { locked: on }); });
      this._decorate();
      this.cb.onGeometry();
      this.cb.onChange(null, 'lock');
      this.announce(on ? (els.length === 1 ? 'Elemento travado.' : els.length + ' elementos travados.') : (els.length === 1 ? 'Elemento destravado.' : els.length + ' elementos destravados.'));
      return on;
    }

    /* Espelha a seleção em torno do próprio retângulo envolvente (eixo 'h' ou 'v').
     * Os elementos trocam de lado, cada um alterna seu estado espelhado e os raios
     * dos cantos são trocados, de modo que r sempre descreve o que se vê. O texto não é invertido. */
    flipSelected(axis) {
      var all = this.selectedElements();
      if (!all.length) return false;
      var els = all.filter(function (e) { return !e.locked; });
      if (all.length > els.length) this.cb.onLocked(all.length - els.length, 'espelhar');
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

    /* ---------- guias inteligentes ---------- */
    /* Linhas-alvo: bordas e centros dos outros elementos visíveis e da própria tela. Cada alvo guarda
       o trecho ocupado no outro eixo, para desenhar a guia só entre os elementos. */
    _guideTargets(excl) {
      var vp = this.vp, xs = [], ys = [];
      [0, vp.w / 2, vp.w].forEach(function (v) { xs.push({ v: v, a: 0, b: vp.h, edge: true }); });
      [0, vp.h / 2, vp.h].forEach(function (v) { ys.push({ v: v, a: 0, b: vp.w, edge: true }); });
      this.screen.elements.forEach(function (e) {
        if (e.hidden || excl.indexOf(e.id) > -1) return;
        [e.x, e.x + e.w / 2, e.x + e.w].forEach(function (v) { xs.push({ v: v, a: e.y, b: e.y + e.h }); });
        [e.y, e.y + e.h / 2, e.y + e.h].forEach(function (v) { ys.push({ v: v, a: e.x, b: e.x + e.w }); });
      });
      return { xs: xs, ys: ys };
    }

    /* Menor deslocamento que leva alguma das linhas `mine` até um alvo, dentro do limite `T`. */
    _bestSnap(mine, targets, T) {
      var best = null;
      mine.forEach(function (m) {
        targets.forEach(function (t) {
          var d = t.v - m;
          if (Math.abs(d) <= T && (best === null || Math.abs(d) < Math.abs(best))) best = d;
        });
      });
      return best;
    }

    /* Desenha as guias das linhas que coincidem (após o encaixe) com algum alvo. */
    _drawGuides(box, tg) {
      this._clearGuides();
      var self = this, made = {};
      function line(vert, v, a, b) {
        var key = (vert ? 'x' : 'y') + Math.round(v * 2);
        var d = made[key];
        if (d) { d.a = Math.min(d.a, a); d.b = Math.max(d.b, b); return; }
        made[key] = { vert: vert, v: v, a: a, b: b };
      }
      var mx = [box.x, box.x + box.w / 2, box.x + box.w], my = [box.y, box.y + box.h / 2, box.y + box.h];
      mx.forEach(function (m) { tg.xs.forEach(function (t) { if (Math.abs(t.v - m) < 0.5) line(true, t.v, Math.min(t.a, box.y), Math.max(t.b, box.y + box.h)); }); });
      my.forEach(function (m) { tg.ys.forEach(function (t) { if (Math.abs(t.v - m) < 0.5) line(false, t.v, Math.min(t.a, box.x), Math.max(t.b, box.x + box.w)); }); });
      Object.keys(made).forEach(function (k) {
        var d = made[k], n = document.createElement('div');
        n.className = 'snap-guide ' + (d.vert ? 'is-v' : 'is-h');
        n.setAttribute('aria-hidden', 'true');
        if (d.vert) { n.style.left = d.v + 'px'; n.style.top = d.a + 'px'; n.style.height = (d.b - d.a) + 'px'; }
        else { n.style.top = d.v + 'px'; n.style.left = d.a + 'px'; n.style.width = (d.b - d.a) + 'px'; }
        self.stage.appendChild(n);
      });
    }

    _clearGuides() {
      if (!this.stage) return;
      Array.prototype.forEach.call(this.stage.querySelectorAll('.snap-guide'), function (n) { n.remove(); });
    }

    /* ---------- componentes salvos ---------- */
    /* Gera um molde com os elementos selecionados, em coordenadas relativas ao canto da caixa que os envolve. */
    snippetFromSelection() {
      var els = this.selectedElements();
      if (!els.length) return null;
      var L = Infinity, T = Infinity, R = -Infinity, B = -Infinity, cnt = {};
      els.forEach(function (e) { L = Math.min(L, e.x); T = Math.min(T, e.y); R = Math.max(R, e.x + e.w); B = Math.max(B, e.y + e.h); if (e.g) cnt[e.g] = (cnt[e.g] || 0) + 1; });
      var order = this.screen.elements.filter(function (e) { return els.indexOf(e) > -1; }); // mantém a ordem das camadas
      return {
        w: Math.round(R - L), h: Math.round(B - T),
        elements: order.map(function (e) {
          return { type: e.type, x: Math.round(e.x - L), y: Math.round(e.y - T), w: e.w, h: e.h, text: e.text || '', checked: !!e.checked,
            fill: e.fill || '', stroke: e.stroke || '', color: e.color || '', flipH: !!e.flipH, flipV: !!e.flipV, r: e.r || null,
            g: (e.g && cnt[e.g] > 1) ? e.g : null };
        })
      };
    }

    /* Insere um molde com ids novos. `pos` = centro desejado (coordenadas do palco); sem `pos`, usa o centro visível. */
    insertSnippet(snip, pos) {
      if (!snip || !snip.elements || !snip.elements.length || !this.screen) return null;
      var vp = this.vp, gmap = {}, w = Math.min(snip.w, vp.w), h = Math.min(snip.h, vp.h), p = pos;
      if (!p) {
        p = this._visibleCenter();
        this._cascade = (this._cascade + 1) % 8;
        p = { x: p.x + this._cascade * 16 - 56, y: p.y + this._cascade * 16 - 56 };
      }
      var ox = clamp(this._snapV(p.x - snip.w / 2), 0, Math.max(0, vp.w - w));
      var oy = clamp(this._snapV(p.y - snip.h / 2), 0, Math.max(0, vp.h - h));
      var list = snip.elements.filter(function (e) { return COMPONENTS[e.type]; }).map(function (e) {
        var c = COMPONENTS[e.type];
        return { id: uid(), type: e.type, x: ox + num(e.x, 0), y: oy + num(e.y, 0),
          w: Math.max(MIN_SIZE, num(e.w, c.w)), h: Math.max(4, num(e.h, c.h)),
          text: String(e.text || '').slice(0, 2000), checked: !!e.checked,
          fill: normHex(e.fill), stroke: normHex(e.stroke), color: normHex(e.color),
          flipH: !!e.flipH, flipV: !!e.flipV, r: normR(e.r), locked: false, hidden: false,
          g: (typeof e.g === 'string' && e.g) ? (gmap[e.g] || (gmap[e.g] = uid())) : null };
      });
      if (!list.length) return null;
      this._addMany(list);
      this.cb.onChange(null, 'snippet');
      this.announce(list.length === 1 ? 'Componente salvo inserido.' : 'Componente salvo inserido com ' + list.length + ' elementos.');
      return list;
    }

    /* ---------- alinhar e distribuir ---------- */
    /* Unidade = um elemento solto ou um grupo inteiro (caixa que envolve os membros). Unidade com
       algum membro travado não se move, mas continua valendo como referência. */
    _units(els) {
      var map = {}, list = [];
      els.forEach(function (e) {
        var u;
        if (e.g) { u = map[e.g]; if (!u) { u = map[e.g] = { els: [] }; list.push(u); } }
        else { u = { els: [] }; list.push(u); }
        u.els.push(e);
      });
      list.forEach(function (u) {
        var L = Infinity, T = Infinity, R = -Infinity, B = -Infinity;
        u.els.forEach(function (e) { L = Math.min(L, e.x); T = Math.min(T, e.y); R = Math.max(R, e.x + e.w); B = Math.max(B, e.y + e.h); });
        u.x = L; u.y = T; u.w = R - L; u.h = B - T;
        u.locked = u.els.some(function (e) { return e.locked; });
      });
      return list;
    }

    _moveUnit(u, nx, ny) {
      var dx = nx - u.x, dy = ny - u.y, self = this;
      if (!dx && !dy) return false;
      u.els.forEach(function (e) { e.x += dx; e.y += dy; self._geom(e); });
      u.x = nx; u.y = ny;
      return true;
    }

    alignSelected(mode) {
      var units = this._units(this.selectedElements());
      if (units.length < 2) return false;
      var free = units.filter(function (u) { return !u.locked; });
      if (units.length > free.length) this.cb.onLocked(units.length - free.length, 'alinhar');
      if (!free.length) return false;
      var minX = Infinity, minY = Infinity, maxR = -Infinity, maxB = -Infinity, self = this, moved = 0;
      units.forEach(function (u) {
        minX = Math.min(minX, u.x); minY = Math.min(minY, u.y);
        maxR = Math.max(maxR, u.x + u.w); maxB = Math.max(maxB, u.y + u.h);
      });
      free.forEach(function (u) {
        var nx = u.x, ny = u.y;
        if (mode === 'left') nx = minX;
        else if (mode === 'right') nx = maxR - u.w;
        else if (mode === 'hcenter') nx = Math.round((minX + maxR) / 2 - u.w / 2);
        else if (mode === 'top') ny = minY;
        else if (mode === 'bottom') ny = maxB - u.h;
        else if (mode === 'vcenter') ny = Math.round((minY + maxB) / 2 - u.h / 2);
        if (self._moveUnit(u, nx, ny)) moved++;
      });
      this.cb.onGeometry();
      if (moved) this.cb.onChange(null, 'align');
      this.announce(moved ? moved + (moved === 1 ? ' item alinhado.' : ' itens alinhados.') : 'Os itens já estavam alinhados.');
      return true;
    }

    /* Espaçamento igual entre as unidades, mantendo as duas das pontas onde estão. Pede 3 ou mais. */
    distributeSelected(axis) {
      var units = this._units(this.selectedElements());
      if (units.length < 3) return false;
      var horiz = axis !== 'v', self = this, moved = 0;
      var P = horiz ? 'x' : 'y', S = horiz ? 'w' : 'h';
      var sorted = units.slice().sort(function (a, b) { return (a[P] + a[S] / 2) - (b[P] + b[S] / 2); });
      var first = sorted[0], last = sorted[sorted.length - 1];
      var span = last[P] + last[S] - first[P], sum = 0;
      sorted.forEach(function (u) { sum += u[S]; });
      var gap = (span - sum) / (sorted.length - 1);
      var lockedN = units.filter(function (u) { return u.locked; }).length;
      if (lockedN) this.cb.onLocked(lockedN, 'distribuir');
      if (lockedN === units.length) return false;
      var cursor = first[P];
      sorted.forEach(function (u) {
        if (u.locked) { cursor = u[P] + u[S] + gap; return; }
        var np = Math.round(cursor);
        if (self._moveUnit(u, horiz ? np : u.x, horiz ? u.y : np)) moved++;
        cursor += u[S] + gap;
      });
      this.cb.onGeometry();
      if (moved) this.cb.onChange(null, 'align');
      this.announce(moved ? 'Itens distribuídos na ' + (horiz ? 'horizontal' : 'vertical') + '.' : 'O espaçamento já estava igual.');
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
      if (!e.shiftKey && !mod && !e.altKey && lk === 'h') { this.toggleHand(); return true; }
      if (mod && !e.altKey && lk === 'g') { if (e.shiftKey) this.ungroupSelected(); else this.groupSelected(); return true; }
      if (!this.selection.length) return false;
      if (key === 'Delete' || key === 'Backspace') { this.deleteSelected(); return true; }
      if (key === 'Escape') { this.select([]); this.ws.focus({ preventScroll: true }); return true; }
      if ((key === 'Enter' || key === 'F2') && this.selection.length === 1) { this.startEdit(this.selection[0]); return true; }
      if (mod && lk === 'd') { this.duplicateSelected(); return true; }
      if (mod && key === ']') { this.bringToFront(); return true; }
      if (mod && key === '[') { this.sendToBack(); return true; }
      if (e.shiftKey && !mod && !e.altKey && (lk === 'h' || lk === 'v')) { this.flipSelected(lk); return true; }
      if (e.shiftKey && !mod && !e.altKey && lk === 'l') { this.toggleLockSelected(); return true; }
      if (key.indexOf('Arrow') === 0 && !mod) {
        var step = e.shiftKey ? 10 : (this.snap ? GRID : 1);
        var dx = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0;
        var dy = key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0;
        var vp = this.vp, self = this, els = this.selectedElements();
        var movable = els.filter(function (x) { return !x.locked; });
        if (movable.length < els.length) this.cb.onLocked(els.length - movable.length, e.altKey ? 'redimensionar' : 'mover');
        els = movable;
        if (!els.length) return true;
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
      ws.addEventListener('keydown', function (e) {
        if (e.code === 'Space' && !self.editing && !self._space) { self._space = true; ws.classList.add('is-space'); e.preventDefault(); }
      });
      var endSpace = function () { self._space = false; ws.classList.remove('is-space'); };
      ws.addEventListener('keyup', function (e) { if (e.code === 'Space') endSpace(); });
      ws.addEventListener('blur', endSpace);
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
      if (e.button === 1 || (this._space && e.pointerType === 'mouse') || this.hand) {
        this._beginPan(e);
      } else if (handle && node) {
        this._beginResize(e, node, handle.dataset.h);
      } else if (node) {
        this._beginDrag(e, node);
      } else if (e.pointerType === 'mouse') {
        this._beginMarquee(e);
      } else {
        this._beginPan(e);
      }
      this._capturing = true;
      try { this.ws.setPointerCapture(e.pointerId); } catch (err) { /* ignorado */ }
      this._capturing = false;
    }

    /* Ferramenta mãozinha: o arrasto com o botão principal (ou toque) move o palco em qualquer ponto. */
    setHand(on) {
      on = !!on;
      if (on === !!this.hand) return;
      this.endEdit(true);
      this.hand = on;
      this.ws.classList.toggle('is-hand', on);
      if (this.cb.onHand) this.cb.onHand(on);
    }
    toggleHand() { this.setHand(!this.hand); }

    _beginPan(e) {
      this.mode = 'pan';
      this.pan = { sx: e.clientX, sy: e.clientY, l: this.ws.scrollLeft, t: this.ws.scrollTop, moved: false };
      this.ws.classList.add('is-panning');
    }

    /* Retângulo de seleção (mouse): arraste em uma área vazia. Shift/Ctrl somam à seleção atual. */
    _beginMarquee(e) {
      var additive = e.shiftKey || e.ctrlKey || e.metaKey;
      var box = h('div', 'marquee');
      box.setAttribute('aria-hidden', 'true');
      this.stage.appendChild(box);
      this.mode = 'marquee';
      this.marquee = { sx: e.clientX, sy: e.clientY, base: additive ? this.selection.slice() : [], box: box, moved: false, additive: additive, last: null };
    }

    _updateMarquee(e) {
      var m = this.marquee, z = this.zoom, vp = this.vp;
      var sr = this.stage.getBoundingClientRect();
      var x1 = clamp((Math.min(m.sx, e.clientX) - sr.left) / z, 0, vp.w), x2 = clamp((Math.max(m.sx, e.clientX) - sr.left) / z, 0, vp.w);
      var y1 = clamp((Math.min(m.sy, e.clientY) - sr.top) / z, 0, vp.h), y2 = clamp((Math.max(m.sy, e.clientY) - sr.top) / z, 0, vp.h);
      var st = m.box.style;
      st.left = x1 + 'px'; st.top = y1 + 'px'; st.width = (x2 - x1) + 'px'; st.height = (y2 - y1) + 'px';
      var ids = m.base.slice();
      this.screen.elements.forEach(function (el) {
        if (!el.hidden && el.x < x2 && el.x + el.w > x1 && el.y < y2 && el.y + el.h > y1 && ids.indexOf(el.id) < 0) ids.push(el.id);
      });
      var key = ids.join(',');
      if (key !== m.last) { m.last = key; this.select(ids); }
    }

    _beginDrag(e, node) {
      var id = node.dataset.id, multi = e.shiftKey || e.ctrlKey || e.metaKey;
      var gm = this._withGroups([id]);
      if (e.altKey && !multi) {
        if (this.selection.indexOf(id) < 0 || this.selection.length !== 1) this.select([id], false, true);
      } else if (multi) {
        if (this.selection.indexOf(id) > -1) this.select(this.selection.filter(function (x) { return gm.indexOf(x) < 0; }));
        else this.select(this.selection.concat([id]));
      } else if (this.selection.indexOf(id) < 0) {
        this.select([id]);
      }
      if (this.selection.indexOf(id) < 0) { this.mode = null; return; }
      var self = this;
      this.mode = 'drag';
      var sel = this.selection.map(function (sid) { return self.find(sid); });
      this.drag = {
        sx: e.clientX, sy: e.clientY, primary: id, moved: false, multi: multi, alt: !!e.altKey, warned: false,
        lockedCount: sel.filter(function (el) { return el.locked; }).length,
        orig: sel.filter(function (el) { return !el.locked; }).map(function (el) { return { id: el.id, x: el.x, y: el.y, w: el.w, h: el.h }; })
      };
    }

    _beginResize(e, node, dir) {
      var id = node.dataset.id, el = this.find(id);
      if (!el) return;
      if (el.locked) { this.mode = null; this.cb.onLocked(1, 'redimensionar'); return; }
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
      if (this.mode === 'marquee') {
        var mq = this.marquee;
        if (!mq.moved && Math.hypot(e.clientX - mq.sx, e.clientY - mq.sy) < 4) return;
        mq.moved = true;
        this._updateMarquee(e);
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
        if (d0.lockedCount && !d0.warned) { d0.warned = true; this.cb.onLocked(d0.lockedCount, 'mover'); }
        if (!d0.orig.length) return;
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
        var gtg = null;
        if (this.guides) {
          if (!d0.tg) d0.tg = this._guideTargets(this.selection);
          gtg = d0.tg;
          var T = 6 / z, bw = maxR - minX, bh = maxB - minY;
          var sx = this._bestSnap([minX + ddx, minX + ddx + bw / 2, minX + ddx + bw], gtg.xs, T);
          var sy = this._bestSnap([minY + ddy, minY + ddy + bh / 2, minY + ddy + bh], gtg.ys, T);
          if (sx !== null) ddx += sx;
          if (sy !== null) ddy += sy;
        }
        ddx = Math.min(Math.max(ddx, -minX), Math.max(vp.w - maxR, -minX));
        ddy = Math.min(Math.max(ddy, -minY), Math.max(vp.h - maxB, -minY));
        if (gtg) this._drawGuides({ x: minX + ddx, y: minY + ddy, w: maxR - minX, h: maxB - minY }, gtg);
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
        var rtg = null, RT = 6 / z, gsn = function (v, list) { var d = rtg ? self._bestSnap([v], list, RT) : null; return d === null ? v : v + d; };
        if (this.guides) { if (!r.tg) r.tg = this._guideTargets([r.id]); rtg = r.tg; }
        if (dir.indexOf('e') > -1) { w = gsn(this._snapV(o.x + o.w + rdx), rtg && rtg.xs) - o.x; }
        if (dir.indexOf('w') > -1) { x = gsn(this._snapV(o.x + rdx), rtg && rtg.xs); w = o.x + o.w - x; }
        if (dir.indexOf('s') > -1) { hh = gsn(this._snapV(o.y + o.h + rdy), rtg && rtg.ys) - o.y; }
        if (dir.indexOf('n') > -1) { y = gsn(this._snapV(o.y + rdy), rtg && rtg.ys); hh = o.y + o.h - y; }
        if (w < MIN_SIZE) { if (dir.indexOf('w') > -1) x = o.x + o.w - MIN_SIZE; w = MIN_SIZE; }
        if (hh < MIN_SIZE) { if (dir.indexOf('n') > -1) y = o.y + o.h - MIN_SIZE; hh = MIN_SIZE; }
        if (x < 0) { w += x; x = 0; }
        if (y < 0) { hh += y; y = 0; }
        if (x + w > vp.w) w = vp.w - x;
        if (y + hh > vp.h) hh = vp.h - y;
        el2.x = x; el2.y = y; el2.w = Math.max(MIN_SIZE, w); el2.h = Math.max(MIN_SIZE, hh);
        this._geom(el2);
        if (rtg) this._drawGuides({ x: el2.x, y: el2.y, w: el2.w, h: el2.h }, rtg); else this._clearGuides();
        this.cb.onGeometry();
      }
    }

    _up(e, cancel) {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.delete(e.pointerId);
      this._clearGuides();
      try { this.ws.releasePointerCapture(e.pointerId); } catch (err) { /* ignorado */ }

      if (this.mode === 'drag') {
        var d = this.drag;
        if (d.moved) {
          this.cb.onChange(null, 'move');
          var el = this.find(d.primary);
          if (el) this.announce('Movido para ' + Math.round(el.x) + ', ' + Math.round(el.y) + '.');
        } else if (!cancel && !d.multi && this.selection.length > 1) {
          this.select([d.primary], false, this.drag.alt);
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
      } else if (this.mode === 'marquee') {
        var mq2 = this.marquee;
        mq2.box.remove();
        this.mode = null;
        if (cancel) this.select(mq2.base);
        else if (!mq2.moved) { if (!mq2.additive) this.select([]); }
        else this.announce(this.selection.length === 1 ? '1 elemento selecionado.' : this.selection.length + ' elementos selecionados.');
        this.ws.focus({ preventScroll: true });
      } else if (this.mode === 'pan') {
        var moved = this.pan.moved;
        this.ws.classList.remove('is-panning');
        this.mode = null;
        if (!moved && !cancel && !this.hand) { this.select([]); this.ws.focus({ preventScroll: true }); }
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

      case 'fab': {
        var fm = Math.min(w, hh), fcx = w / 2, fcy = hh / 2;
        ctx.beginPath(); ctx.arc(fcx, fcy, fm / 2 - 1, 0, Math.PI * 2);
        ctx.fillStyle = bg || FILL; ctx.fill();
        ctx.strokeStyle = line; ctx.lineWidth = 2; ctx.stroke();
        ctx.strokeStyle = mark; ctx.lineWidth = 2 * fm * 0.6 / 24;
        var fq = fm * 0.15;
        ctx.beginPath(); ctx.moveTo(fcx, fcy - fq); ctx.lineTo(fcx, fcy + fq); ctx.moveTo(fcx - fq, fcy); ctx.lineTo(fcx + fq, fcy); ctx.stroke();
        break;
      }
      case 'iconbutton':
        box(PAPER, R); outline(R);
        ctx.fillStyle = txt; ctx.font = '600 20px ' + FONT; ctx.textAlign = 'center';
        ctx.fillText(truncate(ctx, firstLine(t), w - 12), w / 2, hh / 2 + 0.5);
        break;
      case 'select': {
        box(PAPER, R); outline(R);
        ctx.fillStyle = customText ? txt : MUTED; ctx.font = '14px ' + FONT; ctx.textAlign = LA;
        ctx.fillText(truncate(ctx, firstLine(t), w - 28 - 24), X(14), hh / 2 + 0.5);
        var scx = fh ? 22 : w - 22, scy = hh / 2;
        ctx.strokeStyle = mark; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(scx - 4, scy - 2); ctx.lineTo(scx, scy + 2); ctx.lineTo(scx + 4, scy - 2); ctx.stroke();
        break;
      }
      case 'radio': {
        box('', 6);
        var rbx = fh ? w - 22 : 2, rby = (hh - 20) / 2;
        ctx.beginPath(); ctx.arc(rbx + 10, rby + 10, 9, 0, Math.PI * 2);
        ctx.fillStyle = bg || PAPER; ctx.fill(); ctx.strokeStyle = mark; ctx.lineWidth = 2; ctx.stroke();
        if (el.checked) { ctx.beginPath(); ctx.arc(rbx + 10, rby + 10, 5, 0, Math.PI * 2); ctx.fillStyle = mark; ctx.fill(); }
        ctx.fillStyle = txt; ctx.font = '14px ' + FONT; ctx.textAlign = LA;
        ctx.fillText(truncate(ctx, firstLine(t), w - 34), X(32), hh / 2 + 0.5);
        break;
      }
      case 'slider': {
        var tw0 = w - 24, sy0 = hh / 2, pp = fh ? 0.6 : 0.4;
        var thumbX = 12 + 2 + pp * (tw0 - 4);
        rrect(ctx, 13, sy0 - 3, tw0 - 2, 6, [3, 3, 3, 3]); ctx.fillStyle = bg || PAPER; ctx.fill();
        ctx.fillStyle = mark;
        if (fh) ctx.fillRect(thumbX, sy0 - 2, 12 + tw0 - 2 - thumbX, 4); else ctx.fillRect(14, sy0 - 2, thumbX - 14, 4);
        ctx.strokeStyle = line; ctx.lineWidth = 2; rrect(ctx, 13, sy0 - 3, tw0 - 2, 6, [3, 3, 3, 3]); ctx.stroke();
        ctx.beginPath(); ctx.arc(thumbX, sy0, 9, 0, Math.PI * 2); ctx.fillStyle = bg || PAPER; ctx.fill();
        ctx.strokeStyle = line; ctx.stroke();
        break;
      }
      case 'tabs': {
        var tt = lines(t), tn = tt.length, slot = w / tn;
        if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, hh); }
        ctx.strokeStyle = line; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, fv ? 1 : hh - 1); ctx.lineTo(w, fv ? 1 : hh - 1); ctx.stroke();
        var tcy = fv ? (6 + hh) / 2 : (hh - 6) / 2;
        tt.forEach(function (ln, i) {
          var si = fh ? tn - 1 - i : i;
          if (i === 0) { ctx.fillStyle = mark; ctx.fillRect(si * slot, fv ? 2 : hh - 6, slot, 4); }
          ctx.fillStyle = txt; ctx.font = (i === 0 ? '700 ' : '500 ') + '14px ' + FONT; ctx.textAlign = 'center';
          ctx.fillText(truncate(ctx, ln, slot - 16), si * slot + slot / 2, tcy + 0.5);
        });
        break;
      }
      case 'breadcrumb': {
        var bl = lines(t), parts = [], bi;
        for (bi = 0; bi < bl.length; bi++) {
          if (bi) parts.push({ k: 'sep', t: '›' });
          parts.push({ k: bi === bl.length - 1 ? 'last' : 'link', t: bl[bi] });
        }
        var bx0 = fh ? w - 2 : 2;
        ctx.textAlign = fh ? 'right' : 'left';
        parts.forEach(function (pt) {
          ctx.font = (pt.k === 'last' ? '700 ' : '') + '14px ' + FONT;
          var tw1 = ctx.measureText(pt.t).width;
          ctx.fillStyle = txt;
          ctx.fillText(pt.t, bx0, hh / 2 + 0.5);
          if (pt.k === 'link') {
            ctx.lineWidth = 1; ctx.strokeStyle = txt;
            var ux = fh ? bx0 - tw1 : bx0;
            ctx.beginPath(); ctx.moveTo(ux, hh / 2 + 8.5); ctx.lineTo(ux + tw1, hh / 2 + 8.5); ctx.stroke();
          }
          bx0 += (fh ? -1 : 1) * (tw1 + 8);
        });
        break;
      }
      case 'bottomnav': {
        box(PAPER, R); outline(R);
        var bn = lines(t).slice(0, 6), bs = (w - 4) / bn.length, btop = hh / 2 - 19.5;
        bn.forEach(function (ln, i) {
          var si = fh ? bn.length - 1 - i : i, bcx = 2 + si * bs + bs / 2;
          rr(ctx, bcx - 9, btop + 1, 18, 18, 5);
          ctx.lineWidth = 2; ctx.strokeStyle = mark;
          if (i === 0) { ctx.fillStyle = mark; ctx.fill(); }
          ctx.stroke();
          ctx.fillStyle = txt; ctx.font = (i === 0 ? '700 ' : '') + '12px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(truncate(ctx, ln, bs - 8), bcx, btop + 31);
        });
        break;
      }
      case 'sidebar': {
        box(PAPER, R); outline(R);
        var sl = lines(t);
        ctx.save();
        rrect(ctx, 2, 2, w - 4, hh - 4, R.map(function (v) { return Math.max(0, v - 1); })); ctx.clip();
        var ty0 = fv ? hh - 2 - 45 : 2;
        ctx.fillStyle = txt; ctx.font = '700 16px ' + FONT; ctx.textAlign = LA; ctx.textBaseline = 'middle';
        ctx.fillText(truncate(ctx, sl[0], w - 32), X(16), ty0 + (fv ? 25 : 24));
        ctx.lineWidth = 1; ctx.strokeStyle = LIGHT;
        var sepY = fv ? ty0 + 0.5 : ty0 + 44.5;
        ctx.beginPath(); ctx.moveTo(2, sepY); ctx.lineTo(w - 2, sepY); ctx.stroke();
        sl.slice(1).forEach(function (ln, i) {
          var iy = fv ? hh - 2 - 45 - (i + 1) * 40 : 2 + 45 + i * 40, icy = iy + 20;
          if (i === 0) { ctx.save(); ctx.globalAlpha = 0.12; ctx.fillStyle = txt; ctx.fillRect(2, iy, w - 4, 40); ctx.restore(); }
          ctx.lineWidth = 2; ctx.strokeStyle = mark;
          rr(ctx, fh ? w - 16 - 16 + 1 : 17, icy - 7, 14, 14, 3); ctx.stroke();
          ctx.fillStyle = txt; ctx.font = (i === 0 ? '600 ' : '') + '14px ' + FONT; ctx.textAlign = LA;
          ctx.fillText(truncate(ctx, ln, w - 32 - 28), X(44), icy + 0.5);
        });
        ctx.restore();
        break;
      }
      case 'scrollbar': {
        var sbr = Math.min(w, hh) / 2 - 1;
        rrect(ctx, 1, 1, w - 2, hh - 2, [sbr, sbr, sbr, sbr]); ctx.fillStyle = bg || PAPER; ctx.fill();
        ctx.strokeStyle = line; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = mark;
        if (w > hh) {
          var hl = 0.4 * (w - 4), hx = fh ? w - 4 - hl : 4, hr = (hh - 8) / 2;
          rrect(ctx, hx, 4, hl, hh - 8, [hr, hr, hr, hr]); ctx.fill();
        } else {
          var vl = 0.4 * (hh - 4), vy = fv ? hh - 4 - vl : 4, vr = (w - 8) / 2;
          rrect(ctx, 4, vy, w - 8, vl, [vr, vr, vr, vr]); ctx.fill();
        }
        break;
      }
      case 'card': {
        box(PAPER, R); outline(R);
        var cl = String(t).split('\n'), ih = (hh - 4) * 0.5;
        ctx.save();
        rrect(ctx, 2, 2, w - 4, hh - 4, R.map(function (v) { return Math.max(0, v - 1); })); ctx.clip();
        var iy0 = fv ? hh - 2 - ih : 2;
        ctx.strokeStyle = line; ctx.lineWidth = 2;
        ctx.save(); ctx.beginPath(); ctx.rect(2, iy0 + (fv ? 2 : 0), w - 4, ih - 2); ctx.clip();
        ctx.beginPath(); ctx.moveTo(2, iy0 + (fv ? 2 : 0)); ctx.lineTo(w - 2, iy0 + (fv ? 2 : 0) + ih - 2);
        ctx.moveTo(w - 2, iy0 + (fv ? 2 : 0)); ctx.lineTo(2, iy0 + (fv ? 2 : 0) + ih - 2); ctx.stroke();
        ctx.restore();
        var bly = fv ? iy0 + 1 : iy0 + ih - 1;
        ctx.beginPath(); ctx.moveTo(2, bly); ctx.lineTo(w - 2, bly); ctx.stroke();
        ctx.font = '13px ' + FONT;
        var dl = wrapLines(ctx, cl.slice(1).join('\n'), w - 28);
        if (!cl.slice(1).join('').trim()) dl = [];
        var blockH = 20 + (dl.length ? 4 + dl.length * 18 : 0);
        var by0 = fv ? iy0 - 12 - blockH : iy0 + ih + 12;
        if (!fv) by0 = 2 + ih + 12;
        ctx.textBaseline = 'middle'; ctx.textAlign = LA;
        ctx.fillStyle = txt; ctx.font = '700 15px ' + FONT;
        ctx.fillText(truncate(ctx, cl[0], w - 28), X(14), by0 + 10.5);
        ctx.fillStyle = customText ? txt : MUTED; ctx.font = '13px ' + FONT;
        dl.forEach(function (ln, i) { ctx.fillText(ln, X(14), by0 + 24 + i * 18 + 9.5); });
        ctx.restore();
        break;
      }
      case 'modal': {
        box(PAPER, R); outline(R);
        var ml = String(t).split('\n');
        ctx.save();
        rrect(ctx, 2, 2, w - 4, hh - 4, R.map(function (v) { return Math.max(0, v - 1); })); ctx.clip();
        var hy = fv ? hh - 2 - 46 : 2, fy = fv ? 2 : hh - 2 - 56;
        ctx.lineWidth = 1; ctx.strokeStyle = LIGHT;
        var hl2 = fv ? hy + 0.5 : hy + 45.5, fl2 = fv ? fy + 55.5 : fy + 0.5;
        ctx.beginPath(); ctx.moveTo(2, hl2); ctx.lineTo(w - 2, hl2); ctx.moveTo(2, fl2); ctx.lineTo(w - 2, fl2); ctx.stroke();
        ctx.textBaseline = 'middle'; ctx.fillStyle = txt; ctx.textAlign = LA;
        var hcy = fv ? hy + 1 + 22.5 : hy + 22.5;
        ctx.font = '700 15px ' + FONT;
        ctx.fillText(truncate(ctx, ml[0], w - 32 - 28), X(16), hcy + 0.5);
        ctx.font = '20px ' + FONT; ctx.textAlign = fh ? 'left' : 'right';
        ctx.fillText('×', fh ? 16 : w - 16, hcy + 0.5);
        // texto de apoio
        ctx.font = '14px ' + FONT; ctx.fillStyle = customText ? txt : MUTED; ctx.textAlign = LA;
        var dl2 = String(ml.slice(1).join('\n')).trim() ? wrapLines(ctx, ml.slice(1).join('\n'), w - 32) : [];
        var regTop = fv ? fy + 56 : hy + 46, regBot = fv ? hy : fy;
        var dy0 = fv ? regBot - 14 - dl2.length * 20 : regTop + 14;
        dl2.forEach(function (ln, i) { ctx.fillText(ln, X(16), dy0 + i * 20 + 10.5); });
        // botões
        var fcy = fv ? fy + 27.5 : fy + 1 + 27.5;
        ctx.font = '600 13px ' + FONT;
        var wc = ctx.measureText('Cancelar').width + 28, wo = ctx.measureText('Confirmar').width + 28;
        var xc, xo;
        if (fh) { xo = 14; xc = 14 + wo + 8; } else { xo = w - 14 - wo; xc = xo - 8 - wc; }
        ctx.fillStyle = txt; ctx.textAlign = 'center';
        ctx.fillText('Cancelar', xc + wc / 2, fcy + 0.5);
        rrect(ctx, xo + 1, fcy - 15, wo - 2, 30, [5, 5, 5, 5]); ctx.fillStyle = bg || PAPER; ctx.fill();
        ctx.strokeStyle = line; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = txt; ctx.fillText('Confirmar', xo + wo / 2, fcy + 0.5);
        ctx.restore();
        break;
      }
      case 'toast': {
        box(FILL, R); outline(R);
        var tl2 = String(t).split('\n'), act = (tl2[1] || '').trim(), aw = 0;
        ctx.textBaseline = 'middle';
        if (act) {
          ctx.font = '700 13px ' + FONT; aw = ctx.measureText(act).width;
          ctx.fillStyle = txt; ctx.textAlign = fh ? 'left' : 'right';
          var ax = fh ? 16 : w - 16;
          ctx.fillText(act, ax, hh / 2 + 0.5);
          ctx.lineWidth = 1; ctx.strokeStyle = txt;
          var ux2 = fh ? ax : ax - aw;
          ctx.beginPath(); ctx.moveTo(ux2, hh / 2 + 8.5); ctx.lineTo(ux2 + aw, hh / 2 + 8.5); ctx.stroke();
        }
        ctx.fillStyle = txt; ctx.font = '14px ' + FONT; ctx.textAlign = LA;
        ctx.fillText(truncate(ctx, tl2[0], w - 32 - (act ? aw + 12 : 0)), X(16), hh / 2 + 0.5);
        break;
      }
      case 'note': {
        box(NOTE, R); outline(R);
        ctx.fillStyle = 'rgba(31,36,48,.22)';
        ctx.beginPath(); ctx.moveTo(w - 17, 1); ctx.lineTo(w - 17, 17); ctx.lineTo(w - 1, 17); ctx.closePath(); ctx.fill();
        ctx.fillStyle = txt; ctx.font = '14px ' + FONT; ctx.textBaseline = 'top'; ctx.textAlign = LA;
        var nl = wrapLines(ctx, t, w - 24), ny = fv ? hh - 10 - nl.length * 20 : 10;
        nl.forEach(function (ln, i) { ctx.fillText(ln, X(12), ny + i * 20 + 3); });
        break;
      }
      case 'arrow': {
        var ap = arrowPts(el);
        ctx.strokeStyle = line; ctx.fillStyle = line; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(ap.x1, ap.y1); ctx.lineTo(ap.bx, ap.by); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ap.x2, ap.y2); ctx.lineTo(ap.lx, ap.ly); ctx.lineTo(ap.rx, ap.ry); ctx.closePath(); ctx.fill();
        break;
      }
      case 'badge':
        box(FILL, R); outline(R);
        ctx.fillStyle = txt; ctx.font = '700 12px ' + FONT; ctx.textAlign = 'center';
        ctx.fillText(truncate(ctx, firstLine(t), w - 16), w / 2, hh / 2 + 0.5);
        break;
      case 'chip': {
        box(FILL, R); outline(R);
        ctx.font = '14px ' + FONT;
        var ctw = Math.min(ctx.measureText(firstLine(t)).width, w - 24 - 18), ctot = ctw + 6 + 12, cs0 = (w - ctot) / 2;
        var ctx0 = fh ? cs0 + 18 : cs0, cxx = fh ? cs0 : cs0 + ctw + 6;
        ctx.fillStyle = txt; ctx.textAlign = 'left';
        ctx.fillText(truncate(ctx, firstLine(t), ctw + 0.5), ctx0, hh / 2 + 0.5);
        ctx.strokeStyle = mark; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cxx + 3, hh / 2 - 3); ctx.lineTo(cxx + 9, hh / 2 + 3); ctx.moveTo(cxx + 9, hh / 2 - 3); ctx.lineTo(cxx + 3, hh / 2 + 3); ctx.stroke();
        break;
      }
      case 'tooltip': {
        var TR = radiusOf(el, hh - 8).map(function (v) { return Math.max(0, v - 1); });
        var tbh = hh - 8;
        ctx.save();
        if (fv) { ctx.translate(0, hh); ctx.scale(1, -1); }
        rrect(ctx, 1, 1, w - 2, tbh - 2, TR); ctx.fillStyle = bg || PAPER; ctx.fill();
        ctx.strokeStyle = line; ctx.lineWidth = 2; ctx.stroke();
        var ax0 = fh ? w - 34 : 18;
        ctx.beginPath(); ctx.moveTo(ax0, tbh - 2); ctx.lineTo(ax0 + 16, tbh - 2); ctx.lineTo(ax0 + 8, hh - 1); ctx.closePath();
        ctx.fillStyle = bg || PAPER; ctx.fill();
        ctx.beginPath(); ctx.moveTo(ax0 + 1, tbh - 2); ctx.lineTo(ax0 + 8, hh - 2); ctx.lineTo(ax0 + 15, tbh - 2); ctx.stroke();
        ctx.restore();
        ctx.fillStyle = txt; ctx.font = '13px ' + FONT; ctx.textAlign = 'center';
        ctx.fillText(truncate(ctx, firstLine(t), w - 24), w / 2, (fv ? 8 + tbh / 2 : tbh / 2) + 0.5);
        break;
      }
      case 'progress': {
        var pr = Math.min(w, hh) / 2 - 1;
        rrect(ctx, 1, 1, w - 2, hh - 2, [pr, pr, pr, pr]); ctx.fillStyle = bg || PAPER; ctx.fill();
        ctx.save();
        var ipr = Math.max(0, pr - 1);
        rrect(ctx, 2, 2, w - 4, hh - 4, [ipr, ipr, ipr, ipr]); ctx.clip();
        ctx.fillStyle = mark;
        var pw = 0.6 * (w - 4);
        ctx.fillRect(fh ? w - 2 - pw : 2, 2, pw, hh - 4);
        ctx.restore();
        ctx.strokeStyle = line; ctx.lineWidth = 2; rrect(ctx, 1, 1, w - 2, hh - 2, [pr, pr, pr, pr]); ctx.stroke();
        break;
      }
      case 'skeleton': {
        var skc = bg || LIGHT, sbw = w - 52;
        ctx.fillStyle = skc;
        ctx.beginPath(); ctx.arc(fh ? w - 20 : 20, hh / 2, 20, 0, Math.PI * 2); ctx.fill();
        [1, 0.85, 0.6].forEach(function (f, i) {
          var bw2 = Math.max(0, sbw * f), by2 = hh / 2 - 23 + i * 18;
          rrect(ctx, fh ? sbw - bw2 : 52, by2, bw2, 10, [5, 5, 5, 5]); ctx.fill();
        });
        break;
      }
    }
    ctx.restore();
  }

  function drawScreen(ctx, screen, vp) {
    ctx.save();
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, vp.w, vp.h);
    ctx.beginPath(); ctx.rect(0, 0, vp.w, vp.h); ctx.clip();
    screen.elements.forEach(function (el) { if (!el.hidden) drawElement(ctx, el); });
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
    GROUPS: GROUPS,
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
