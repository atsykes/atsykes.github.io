// Interactive waveform viewer for the project pages.
// Draws per-cycle data (js/waves-data.js for the SIMD page, js/waves-mesh.js
// for the NoC page; both extracted from Icarus Verilog VCDs) as SVG, with a cursor, numbered events, zoom, collapsible
// signal groups, and a switch between design versions.
(() => {
  const root = document.querySelector('[data-wave]');
  const waves = root && window[root.dataset.wave || 'WAVES'];
  if (!waves) return;

  const NS = 'http://www.w3.org/2000/svg';
  const ROW = 28, GROUP = 26, HEAD = 46, CHAR = 6.7;
  const ZOOMS = [32, 44, 60, 80, 108, 140];

  const el = (tag, attrs = {}, text) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text != null) n.textContent = text;
    return n;
  };
  const sv = (tag, attrs = {}, text) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text != null) n.textContent = text;
    return n;
  };

  // ---------- static chrome ----------
  root.replaceChildren();
  const bar = el('div', { class: 'wave-bar' });
  const tabs = el('div', { class: 'wave-tabs', role: 'group', 'aria-label': root.dataset.waveTabs || 'Design version' });
  const tabBtns = waves.map((w, i) => {
    const b = el('button', { type: 'button', class: 'wave-btn', 'aria-pressed': i === 0 ? 'true' : 'false' }, w.tab);
    b.addEventListener('click', () => load(i));
    tabs.append(b);
    return b;
  });
  const zoom = el('div', { class: 'wave-zoom', role: 'group', 'aria-label': 'Zoom' });
  const zOut = el('button', { type: 'button', class: 'wave-btn wave-btn-sq', 'aria-label': 'Zoom out' }, '−');
  const zIn = el('button', { type: 'button', class: 'wave-btn wave-btn-sq', 'aria-label': 'Zoom in' }, '+');
  zoom.append(zOut, zIn);
  bar.append(tabs, zoom);

  const title = el('p', { class: 'wave-title' });
  const sub = el('p', { class: 'wave-sub' });
  const markRow = el('div', { class: 'wave-marks', role: 'group', 'aria-label': 'Events to look for' });
  const note = el('p', { class: 'wave-note', 'aria-live': 'polite' });

  const body = el('div', { class: 'wave-body' });
  const labels = el('div', { class: 'wave-labels' });
  const scroll = el('div', {
    class: 'wave-scroll', tabindex: '0', role: 'group',
    'aria-label': 'Waveform. Use the left and right arrow keys to move the cursor one cycle.',
  });
  const svg = sv('svg', { class: 'wave-svg', 'aria-hidden': 'true', focusable: 'false' });
  scroll.append(svg);
  body.append(labels, scroll);

  const readout = el('div', { class: 'wave-readout' });
  const live = el('p', { class: 'wave-sr', 'aria-live': 'polite' });
  const hint = el('p', { class: 'wave-hint' }, 'Hover or tap a cycle to read every value. Arrow keys step the cursor once the waveform has focus.');
  root.append(bar, title, sub, markRow, note, body, readout, hint, live);

  // ---------- state ----------
  let w, cw, pinned, hover = null, sel = null, collapsed;
  // Cycle number as the testbench logs it (a dataset can start mid-run).
  const lab = (c) => (w.c0 || 1) + c - 1;
  const span = (m) => (m.f === m.t ? ` ${lab(m.f)}` : `s ${lab(m.f)}–${lab(m.t)}`);

  function load(i) {
    w = waves[i];
    tabBtns.forEach((b, j) => b.setAttribute('aria-pressed', j === i ? 'true' : 'false'));
    collapsed = new Set();
    sel = null;
    pinned = 1;
    // Wide enough to read instruction names; the strip scrolls sideways.
    cw = Math.min(w.zoom || 80, scroll.clientWidth < 500 ? 60 : 80);
    title.textContent = w.title;
    sub.textContent = w.sub;
    markRow.replaceChildren(...w.markers.map((m) => {
      const b = el('button', { type: 'button', class: 'wave-mark', 'aria-pressed': 'false' }, String(m.n));
      b.setAttribute('aria-label', `Event ${m.n}, cycle${span(m).replace('–', ' to ')}`);
      b.addEventListener('click', () => select(m.n === sel ? null : m.n, true));
      return b;
    }));
    note.textContent = 'Pick a numbered event to see what to look for.';
    scroll.scrollLeft = 0;
    draw();
  }

  function rows() {
    const out = [];
    w.groups.forEach((g, gi) => {
      out.push({ group: g, gi });
      if (!collapsed.has(gi)) g.signals.forEach((s) => out.push({ sig: s }));
    });
    return out;
  }

  const fit = (text, px) => {
    const n = Math.floor((px - 12) / CHAR);
    if (n <= 0) return '';
    return text.length <= n ? text : (n <= 1 ? '…' : text.slice(0, n - 1) + '…');
  };

  function draw() {
    const R = rows();
    const width = w.cycles * cw;
    let height = HEAD;
    R.forEach((r) => { r.y = height; height += r.group ? GROUP : ROW; });
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.replaceChildren();

    const hiSet = new Set(sel ? w.markers[sel - 1].s : []);

    // marker bands and badges
    const bands = sv('g');
    w.markers.forEach((m) => {
      const x = (m.f - 1) * cw, wd = (m.t - m.f + 1) * cw;
      const band = sv('rect', { x, y: 18, width: wd, height: height - 18, class: 'wv-band' + (sel === m.n ? ' is-sel' : '') });
      const cx = x + wd / 2;
      const badge = sv('g', { class: 'wv-badge' + (sel === m.n ? ' is-sel' : ''), transform: `translate(${cx},10)` });
      badge.append(sv('circle', { r: 8.5 }), sv('text', { y: 3.5, 'text-anchor': 'middle' }, String(m.n)));
      badge.addEventListener('click', (e) => { e.stopPropagation(); select(m.n === sel ? null : m.n, false); });
      bands.append(band, badge);
    });
    svg.append(bands);

    // highlighted rows
    R.forEach((r) => {
      if (r.sig && hiSet.has(r.sig.label)) svg.append(sv('rect', { x: 0, y: r.y, width, height: ROW, class: 'wv-rowhi' }));
    });

    // grid and cycle numbers
    const grid = sv('g', { class: 'wv-grid' });
    for (let c = 0; c <= w.cycles; c++) grid.append(sv('line', { x1: c * cw, x2: c * cw, y1: 22, y2: height }));
    svg.append(grid);
    const nums = sv('g', { class: 'wv-num' });
    const every = cw < 40 ? 2 : 1;
    for (let c = 1; c <= w.cycles; c++) {
      if ((c - 1) % every === 0) nums.append(sv('text', { x: (c - 0.5) * cw, y: 38, 'text-anchor': 'middle' }, String(lab(c))));
    }
    svg.append(nums);

    // signals
    R.forEach((r) => {
      if (r.group) {
        svg.append(sv('line', { x1: 0, x2: width, y1: r.y + GROUP - 1, y2: r.y + GROUP - 1, class: 'wv-sep' }));
        return;
      }
      const s = r.sig, top = r.y + 5, bot = r.y + ROW - 5, mid = r.y + ROW / 2;
      const g = sv('g');
      if (s.type === 'bit') {
        let d = '', fill = '';
        s.values.forEach((v, i) => {
          const x0 = i * cw, x1 = (i + 1) * cw, y = v === 1 ? top : v === 0 ? bot : mid;
          d += (i === 0 ? `M${x0},${y}` : `L${x0},${y}`) + `L${x1},${y}`;
          if (v === 1) fill += `M${x0},${top}H${x1}V${bot}H${x0}Z`;
        });
        if (fill) g.append(sv('path', { d: fill, class: 'wv-bitfill' }));
        g.append(sv('path', { d, class: 'wv-bit' }));
      } else {
        let i = 0;
        while (i < s.values.length) {
          let j = i;
          while (j + 1 < s.values.length && s.values[j + 1] === s.values[i]) j++;
          const v = s.values[i], x0 = i * cw, x1 = (j + 1) * cw;
          if (v == null) {
            g.append(sv('line', { x1: x0, x2: x1, y1: mid, y2: mid, class: 'wv-empty' }));
          } else {
            const k = Math.min(5, (x1 - x0) / 4);
            const a = x0 + 2, b = x1 - 2;
            g.append(sv('path', { d: `M${a},${mid}L${a + k},${top}H${b - k}L${b},${mid}L${b - k},${bot}H${a + k}Z`, class: s.type === 'inst' ? 'wv-inst' : 'wv-bus' }));
            const t = fit(v, x1 - x0);
            if (t) g.append(sv('text', { x: (x0 + x1) / 2, y: mid + 3.8, 'text-anchor': 'middle', class: 'wv-val' }, t));
          }
          i = j + 1;
        }
      }
      svg.append(g);
    });

    // cursor
    const cur = hover || pinned;
    svg.append(sv('rect', { x: (cur - 1) * cw + 0.5, y: 22, width: cw - 1, height: height - 22, class: 'wv-cursor' }));

    // labels column
    labels.replaceChildren();
    labels.style.paddingTop = HEAD + 'px';
    R.forEach((r) => {
      if (r.group) {
        const open = !collapsed.has(r.gi);
        const b = el('button', { type: 'button', class: 'wave-group', 'aria-expanded': String(open) });
        b.append(el('span', { class: 'wave-caret', 'aria-hidden': 'true' }, open ? '▾' : '▸'), document.createTextNode(r.group.name));
        b.addEventListener('click', () => { open ? collapsed.add(r.gi) : collapsed.delete(r.gi); draw(); });
        labels.append(b);
      } else {
        labels.append(el('div', { class: 'wave-label' + (hiSet.has(r.sig.label) ? ' is-hi' : '') }, r.sig.label));
      }
    });

    zOut.disabled = cw <= ZOOMS[0];
    zIn.disabled = cw >= ZOOMS[ZOOMS.length - 1];
    [...markRow.children].forEach((b, i) => b.setAttribute('aria-pressed', String(sel === i + 1)));
    renderReadout(cur, hiSet);
  }

  function valueText(s, c) {
    const v = s.values[c - 1];
    if (v == null) return '—';
    return String(v);
  }

  function renderReadout(c, hiSet) {
    readout.replaceChildren(el('p', { class: 'wave-readout-head' }, `Cycle ${lab(c)}`));
    const dl = el('dl');
    w.groups.forEach((g) => g.signals.forEach((s) => {
      const dt = el('dt', hiSet.has(s.label) ? { class: 'is-hi' } : {}, s.label);
      const dd = el('dd', hiSet.has(s.label) ? { class: 'is-hi' } : {}, valueText(s, c));
      dl.append(dt, dd);
    }));
    readout.append(dl);
  }

  function announce(c) {
    const pipe = w.groups[0].signals.map((s) => `${s.label} ${valueText(s, c) === '—' ? 'empty' : valueText(s, c)}`).join(', ');
    live.textContent = `Cycle ${lab(c)}. ${pipe}.`;
  }

  function ensureVisible(c) {
    const x0 = (c - 1) * cw, x1 = c * cw;
    if (x0 < scroll.scrollLeft) scroll.scrollLeft = x0 - cw;
    else if (x1 > scroll.scrollLeft + scroll.clientWidth) scroll.scrollLeft = x1 - scroll.clientWidth + cw;
  }

  function select(n, fromButton) {
    sel = n;
    if (n) {
      const m = w.markers[n - 1];
      pinned = m.f;
      note.replaceChildren(el('b', {}, `${n}. Cycle${span(m)}. `), document.createTextNode(m.text));
      const x = (m.f - 1) * cw, wd = (m.t - m.f + 1) * cw;
      scroll.scrollLeft = Math.max(0, x + wd / 2 - scroll.clientWidth / 2);
    } else {
      note.textContent = 'Pick a numbered event to see what to look for.';
    }
    hover = null;
    draw();
    if (fromButton) announce(pinned);
  }

  const cycleAt = (e) => {
    const r = svg.getBoundingClientRect();
    const c = Math.floor((e.clientX - r.left) / cw) + 1;
    return Math.min(Math.max(c, 1), w.cycles);
  };
  svg.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const c = cycleAt(e);
    if (c !== hover) { hover = c; draw(); }
  });
  svg.addEventListener('pointerleave', () => { if (hover) { hover = null; draw(); } });
  svg.addEventListener('click', (e) => { pinned = cycleAt(e); hover = null; draw(); });

  scroll.addEventListener('keydown', (e) => {
    let c = pinned;
    if (e.key === 'ArrowRight') c++;
    else if (e.key === 'ArrowLeft') c--;
    else if (e.key === 'Home') c = 1;
    else if (e.key === 'End') c = w.cycles;
    else return;
    e.preventDefault();
    pinned = Math.min(Math.max(c, 1), w.cycles);
    hover = null;
    draw();
    ensureVisible(pinned);
    announce(pinned);
  });

  const rezoom = (dir) => {
    const i = ZOOMS.indexOf(cw);
    const next = ZOOMS[Math.min(Math.max(i + dir, 0), ZOOMS.length - 1)];
    if (next === cw) return;
    const centre = (scroll.scrollLeft + scroll.clientWidth / 2) / cw;
    cw = next;
    draw();
    scroll.scrollLeft = centre * cw - scroll.clientWidth / 2;
  };
  zOut.addEventListener('click', () => rezoom(-1));
  zIn.addEventListener('click', () => rezoom(1));

  load(0);
})();
