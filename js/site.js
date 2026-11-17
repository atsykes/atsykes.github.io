// AS-2027 site script. Two small jobs, and the site works without it.
document.documentElement.classList.add('js');

// 1. Give the sticky header a translucent background once the page scrolls.
const header = document.querySelector('.site-header');
if (header) {
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

// 2. "Copy email" buttons copy the address and say so.
document.querySelectorAll('[data-copy]').forEach((btn) => {
  const status = document.getElementById(btn.getAttribute('aria-describedby'));
  btn.addEventListener('click', async () => {
    const text = btn.getAttribute('data-copy');
    try {
      await navigator.clipboard.writeText(text);
      if (status) status.textContent = 'Copied ' + text;
    } catch {
      if (status) status.textContent = 'Copy failed. The address is ' + text;
    }
  });
});

// 3. Figure 2 on the home page: packets route between random routers with XY routing.
//    Runs only while the figure is on screen, has a pause button, and stays
//    static (one fixed route) when the visitor prefers reduced motion.
const mesh = document.querySelector('svg[data-mesh]');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
if (mesh && !reduceMotion.matches && mesh.animate) {
  const XS = [70, 157, 243, 330];
  const YS = [50, 117, 183, 250];
  const HOP_MS = 260;     // time per hop
  const HOLD_MS = 900;    // pause at the destination
  const route = mesh.querySelector('[data-route]');
  const src = mesh.querySelector('[data-src]');
  const dst = mesh.querySelector('[data-dst]');
  const packet = mesh.querySelector('[data-packet]');
  const label = mesh.querySelector('[data-label]');
  const toggle = document.querySelector('[data-mesh-toggle]');

  let running = false;      // the loop is active
  let paused = false;       // the visitor pressed Pause
  let visible = false;      // the figure is on screen
  let timer = 0;
  let anims = [];
  let from = [0, 0];

  const pick = (not) => {
    let p;
    do { p = [Math.floor(Math.random() * 4), Math.floor(Math.random() * 4)]; }
    while (not && p[0] === not[0] && p[1] === not[1]);
    return p;
  };
  const place = (rect, [c, r], size) => {
    rect.setAttribute('x', XS[c] - size / 2);
    rect.setAttribute('y', YS[r] - size / 2);
  };

  function step() {
    if (!running) return;
    const to = pick(from);
    const [sc, sr] = from;
    const [dc, dr] = to;
    const hops = Math.abs(dc - sc) + Math.abs(dr - sr);
    const d = `M${XS[sc]} ${YS[sr]} H${XS[dc]} V${YS[dr]}`;
    route.setAttribute('d', d);
    place(src, from, 28);
    place(dst, to, 28);
    label.textContent = `src (${sc},${sr}) to dst (${dc},${dr}): ${hops} hop${hops === 1 ? '' : 's'}`;

    const len = route.getTotalLength();
    const dur = hops * HOP_MS;
    route.style.strokeDasharray = len;
    packet.removeAttribute('hidden');

    // Corner points of the XY path, for the packet's keyframes
    const pts = [[XS[sc], YS[sr]], [XS[dc], YS[sr]], [XS[dc], YS[dr]]];
    const xHops = Math.abs(dc - sc);
    const corner = hops ? xHops / hops : 0;
    anims = [
      route.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: dur, easing: 'linear', fill: 'forwards' }),
      packet.animate([
        { transform: `translate(${pts[0][0] - 70}px, ${pts[0][1] - 50}px)`, offset: 0 },
        { transform: `translate(${pts[1][0] - 70}px, ${pts[1][1] - 50}px)`, offset: corner },
        { transform: `translate(${pts[2][0] - 70}px, ${pts[2][1] - 50}px)`, offset: 1 },
      ], { duration: dur, easing: 'linear', fill: 'forwards' }),
    ];
    from = to;
    timer = setTimeout(step, dur + HOLD_MS);
  }

  function update() {
    const shouldRun = visible && !paused && !document.hidden;
    if (shouldRun && !running) { running = true; step(); }
    if (!shouldRun && running) {
      running = false;
      clearTimeout(timer);
      anims.forEach((a) => a.finish());
    }
  }

  if (toggle) {
    toggle.hidden = false;
    toggle.addEventListener('click', () => {
      paused = !paused;
      toggle.textContent = paused ? 'Play animation' : 'Pause animation';
      update();
    });
  }
  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    update();
  }, { threshold: 0.3 }).observe(mesh);
  document.addEventListener('visibilitychange', update);
}

// 4. Version C pipeline figure: a tiny cycle-by-cycle model of the pipeline
//    runs a looping program forever. Instructions move through IF, ID, EX/MEM
//    and WB, divides run in the multi-cycle SFU, the scoreboard stalls only
//    dependent instructions, loads cause a one-cycle load-use stall, and the
//    forwarding paths light up when used. On-screen only, pausable, and a
//    single still frame when the visitor prefers reduced motion.
document.querySelectorAll('svg[data-pipe]').forEach((svg) => {
  const NS = 'http://www.w3.org/2000/svg';
  const figure = svg.closest('figure');
  const note = figure.querySelector('[data-pipe-note]');
  const toggle = figure.querySelector('[data-pipe-toggle]');
  const layer = svg.querySelector('[data-tokens]');
  const sb = svg.querySelector('[data-sb]');
  const bar = svg.querySelector('[data-sfu-bar]');
  const sfuOut = svg.querySelector('[data-sfu-out]');
  const stageEl = (n) => svg.querySelector(`[data-stage="${n}"]`);
  const fwEl = (n) => svg.querySelector(`[data-fw="${n}"]`);

  const POS = { in: [-60, 122], if: [70, 122], id: [180, 122], ex: [290, 122], wb: [400, 122], sfu: [290, 207], out: [520, 122] };
  const SFU_CYCLES = 5;   // the real unit takes 64 cycles; compressed for the figure
  const STEP_MS = 1400;

  // The loop body. Registers are chosen so each pass shows a load-use stall,
  // EX-to-ID and WB-to-ID forwarding, a divide overlapping independent work,
  // and a scoreboard stall on the divide's result.
  const PROGRAM = [
    { d: 'r1',  s: ['r9'],         label: 'LD r1,0(r9)', ld: true },
    { d: 'r2',  s: ['r1', 'r1'],   label: 'ADD r2,r1,r1' },
    { d: 'r3',  s: ['r2', 'r8'],   label: 'DIV r3,r2,r8', sfu: true },
    { d: 'r4',  s: ['r2', 'r9'],   label: 'SUB r4,r2,r9' },
    { d: 'r5',  s: ['r4', 'r4'],   label: 'XOR r5,r4,r4' },
    { d: 'r6',  s: ['r5', 'r9'],   label: 'AND r6,r5,r9' },
    { d: 'r7',  s: ['r3', 'r6'],   label: 'ADD r7,r3,r6' },
    { d: 'r10', s: ['r7'],         label: 'SQRT r10,r7', sfu: true },
    { d: 'r11', s: ['r9'],         label: 'LD r11,8(r9)', ld: true },
    { d: 'r12', s: ['r11', 'r6'],  label: 'OR r12,r11,r6' },
    { d: 'r13', s: ['r12', 'r2'],  label: 'MOD r13,r12,r2', sfu: true },
    { d: 'r14', s: ['r12', 'r1'],  label: 'SUB r14,r12,r1' },
    { d: null,  s: ['r10', 'r9'],  label: 'ST r10,16(r9)' },
    { d: 'r8',  s: ['r13', 'r14'], label: 'ADD r8,r13,r14' },
  ];

  let st, seq, cycle;
  function reset() {
    st = { if: null, id: null, ex: null, wb: null, sfu: null, sfuLeft: 0, busy: new Set() };
    seq = 0; cycle = 0;
    layer.replaceChildren();
    st.if = fetch();
  }
  function fetch() {
    if (seq >= PROGRAM.length) return null;   // program done: let the pipeline drain
    const t = PROGRAM[seq];
    const ins = { ...t, s: [...t.s], n: seq++ };
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'tok' + (ins.sfu ? ' is-div' : ''));
    g.setAttribute('aria-hidden', 'true');
    const r = document.createElementNS(NS, 'rect');
    r.setAttribute('x', -47); r.setAttribute('y', -11); r.setAttribute('width', 94); r.setAttribute('height', 22);
    const tx = document.createElementNS(NS, 'text');
    tx.setAttribute('text-anchor', 'middle'); tx.setAttribute('y', 4); tx.textContent = ins.label;
    g.append(r, tx);
    g.style.transition = 'none';
    g.style.transform = `translate(${POS.in[0]}px, ${POS.in[1]}px)`;
    g.style.opacity = 0;
    layer.append(g);
    g.getBoundingClientRect();
    g.style.transition = '';
    ins.el = g;
    return ins;
  }
  const short = (ins) => ins.label.split(',')[0];
  const opName = (ins) => ins.label.split(' ')[0];

  // Decide what happens during this cycle, from the current state only.
  function decide() {
    const ev = { fw: [], notes: [] };
    if (!st.if && !st.id && !st.ex && !st.wb && !st.sfu) {
      ev.drained = true;
      ev.notes.push(`All ${PROGRAM.length} instructions have retired and the pipeline is empty. Starting over.`);
      return ev;
    }
    const sfuDone = !!st.sfu && st.sfuLeft === 0;
    ev.sfuDone = sfuDone;
    ev.exHold = sfuDone && !!st.ex;
    const ins = st.id;
    if (ins) {
      const raw = ins.s.find((r) => st.busy.has(r));
      if (raw) {
        ev.stall = `${short(ins)} needs ${raw}, which the ${opName(st.sfu)} in the SFU is still computing. The scoreboard stalls only this instruction.`;
      } else if (ins.d && st.busy.has(ins.d)) {
        ev.stall = `${short(ins)} would overwrite ${ins.d} before the ${opName(st.sfu)} writes it (WAW), so the scoreboard stalls it.`;
      } else if (st.ex && st.ex.ld && st.ex.d && ins.s.includes(st.ex.d)) {
        ev.stall = `${short(ins)} needs ${st.ex.d} from the load in EX/MEM: a one-cycle load-use stall.`;
      } else if (ins.sfu && st.sfu) {
        ev.stall = `${short(ins)} waits because the SFU is still busy with ${short(st.sfu)}.`;
      } else if (!ins.sfu && ev.exHold) {
        ev.stall = `${short(ins)} waits a cycle while EX/MEM holds for the writeback port.`;
      } else {
        ev.issue = true;
        if (st.ex && st.ex.d && !st.ex.ld && ins.s.includes(st.ex.d)) {
          ev.fw.push('ex'); ev.notes.push(`${short(ins)} gets ${st.ex.d} forwarded from EX/MEM to ID.`);
        }
        if (st.wb && st.wb.d && ins.s.includes(st.wb.d) && !(st.ex && st.ex.d === st.wb.d)) {
          ev.fw.push('wb'); ev.notes.push(`${short(ins)} gets ${st.wb.d} forwarded from WB to ID.`);
        }
        if (ins.sfu) ev.notes.push(`${short(ins)} issues to the multi-cycle SFU. The scoreboard marks ${ins.d} busy.`);
      }
    }
    if (sfuDone) {
      ev.notes.unshift(`${short(st.sfu)} finishes in the SFU and takes the shared writeback port.${ev.exHold ? ' EX/MEM holds for one cycle.' : ''}`);
    } else if (st.ex && st.sfu && st.ex.n > st.sfu.n) {
      ev.notes.push(`${short(st.ex)} finishes ahead of the older ${short(st.sfu)}: out-of-order completion.`);
    }
    return ev;
  }

  function show(ev) {
    for (const [slot, ins] of [['if', st.if], ['id', st.id], ['ex', st.ex], ['wb', st.wb], ['sfu', st.sfu]]) {
      if (!ins) continue;
      ins.el.style.transform = `translate(${POS[slot][0]}px, ${POS[slot][1]}px)`;
      ins.el.style.opacity = 1;
    }
    fwEl('ex').classList.toggle('is-on', ev.fw.includes('ex'));
    fwEl('wb').classList.toggle('is-on', ev.fw.includes('wb'));
    stageEl('id').classList.toggle('is-stalled', !!ev.stall);
    sfuOut.classList.toggle('is-on', !!ev.sfuDone);
    bar.setAttribute('width', st.sfu ? 80 * (1 - st.sfuLeft / SFU_CYCLES) : 0);
    sb.textContent = st.busy.size ? `scoreboard: ${[...st.busy].join(', ')} busy` : 'scoreboard: no busy regs';
    const text = [ev.stall, ...ev.notes].filter(Boolean).slice(0, 2).join(' ') || (seq >= PROGRAM.length && !st.if ? 'The program is done, so nothing new is fetched. The last instructions drain out.' : 'Instructions advance one stage.');
    if (note) note.innerHTML = `<b>Cycle ${cycle + 1}.</b> ${text}`;
  }

  // Apply the decisions: everything moves at the clock edge.
  function advance(ev) {
    const n = { if: st.if, id: st.id, ex: null, wb: null, sfu: st.sfu, sfuLeft: st.sfuLeft, busy: st.busy };
    if (st.wb) {   // retire
      const el = st.wb.el;
      el.style.transform = `translate(${POS.out[0]}px, ${POS.out[1]}px)`;
      el.style.opacity = 0;
      setTimeout(() => el.remove(), 600);
    }
    if (ev.sfuDone) {
      n.wb = st.sfu; n.sfu = null; n.busy.delete(st.sfu.d);
      n.ex = st.ex;                      // EX/MEM holds if occupied
    } else {
      n.wb = st.ex;
      if (n.sfu) n.sfuLeft = st.sfuLeft - 1;
    }
    if (ev.issue) {
      const ins = st.id;
      if (ins.sfu) { n.sfu = ins; n.sfuLeft = SFU_CYCLES; n.busy.add(ins.d); }
      else n.ex = ins;
      n.id = st.if;
      n.if = fetch();
    } else if (!st.id) {
      n.id = st.if;
      n.if = fetch();
    }
    st = n;
    cycle++;
  }

  reset();

  if (reduceMotion.matches) {
    // Run ahead to the first scoreboard stall and show that one frame.
    for (let i = 0; i < 40; i++) {
      const ev = decide();
      if (ev.stall && ev.stall.includes('scoreboard')) {
        layer.querySelectorAll('.tok').forEach((g) => { g.style.transition = 'none'; });
        show(ev);
        return;
      }
      advance(ev);
    }
    return;
  }

  let running = false, paused = false, visible = false, timer = 0, pending = null;
  function tick() {
    if (!running) return;
    if (pending && pending.drained) reset();
    else if (pending) advance(pending);
    pending = decide();
    show(pending);
    timer = setTimeout(tick, STEP_MS);
  }
  function update() {
    const should = visible && !paused && !document.hidden;
    if (should && !running) { running = true; tick(); }
    if (!should && running) { running = false; clearTimeout(timer); }
  }
  if (toggle) {
    toggle.hidden = false;
    toggle.addEventListener('click', () => {
      paused = !paused;
      toggle.textContent = paused ? 'Play animation' : 'Pause animation';
      update();
    });
  }
  new IntersectionObserver((e) => { visible = e[0].isIntersecting; update(); }, { threshold: 0.3 }).observe(svg);
  document.addEventListener('visibilitychange', update);
});
