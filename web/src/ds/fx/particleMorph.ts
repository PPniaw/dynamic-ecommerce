// Particle morph: the one transition for every storefront change.
//
// Universal on purpose — no component knows about it. Before the update we
// read what's on screen (text, images, coloured blocks inside [data-morph]),
// turn it into particles at those positions in those colours, hide the old
// page, apply the update synchronously, read the new page the same way, and
// fly the particles to their new places while their colours blend. Then the
// new page fades in under them and they dissolve.
//
// Rules it keeps (CLAUDE.md): the update is applied within HIDE_MS (once the
// old page has faded into its particles — never later, whatever the browser
// does), the animation is only an overlay, and the page is never left hidden:
// a hard timeout restores it whatever happens.

type RGBA = [number, number, number, number];
// `s`: index of the source element, so colours can be re-read without moving the particle.
interface Pt { x: number; y: number; c: RGBA; s: number }
interface Src { el: Element; kind: "text" | "img" | "block"; rect: DOMRect; color: RGBA }

const TOTAL_MS = 1250;
const HIDE_MS = 180;          // old page fades into its particles, then the update applies
const FLY_START = 200;
const FLY_MS = 620;
const STAGGER_MS = 260;       // top of the screen moves first
const REVEAL_START = 780;     // new page fades in under the particles
const REVEAL_MS = 380;

let running: { finish: () => void } | undefined;

export const prefersReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

export function particleMorph(update: () => void) {
  running?.finish();
  const roots = [...document.querySelectorAll<HTMLElement>("[data-morph]")];
  if (!roots.length || prefersReducedMotion()) { update(); return; }

  const budget = Math.round(Math.min(4200, Math.max(1200, (innerWidth * innerHeight) / 240)));
  let from: Pt[];
  try { from = particlesFrom(sources(roots), budget); } catch { update(); return; }

  // Overlay canvas.
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100vw", height: "100vh", pointerEvents: "none", zIndex: "35" });
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  const setOpacity = (v: number, ms: number) => roots.forEach((r) => {
    r.style.transition = ms ? `opacity ${ms}ms ease` : "";
    r.style.opacity = String(v);
  });
  setOpacity(0, HIDE_MS);

  // Once the old page is gone, apply the change and read the new layout.
  let to: Pt[] | undefined;
  let toSrc: Src[] = [];
  let applied = false;
  const liveRoots = () => [...document.querySelectorAll<HTMLElement>("[data-morph]")];
  const apply = () => {
    if (applied) return;
    applied = true;
    update();
    try {
      // Roots may have been re-created by the update.
      const rs = liveRoots();
      rs.forEach((r) => { r.style.transition = ""; r.style.opacity = "0"; });
      toSrc = sources(rs);
      to = pair(from, particlesFrom(toSrc, budget));
    } catch { to = from; }
  };
  const applyTimer = setTimeout(apply, HIDE_MS);
  // Theme colours transition over 300ms (tokens.css): re-read target colours once they've settled.
  const recolour = setTimeout(() => {
    if (!to || !toSrc.length) return;
    try {
      const fresh = toSrc.map((s) => colourOf(s.el, s.kind) ?? s.color);
      for (const p of to) if (p.s >= 0) p.c = fresh[p.s];
    } catch { /* keep the first reading */ }
  }, HIDE_MS + 340);

  // Per-particle randomness: curve and timing.
  const seeds = from.map(() => ({ bend: (Math.random() - 0.5) * 220, jitter: Math.random() * 110, size: 2 + Math.random() * 2.2 }));
  const t0 = performance.now();
  // Marks the page while morphing (CSS hooks, and tests read the clock).
  document.documentElement.dataset.morphing = String(Math.round(t0));
  let revealed = false;
  let raf = 0;

  const done = () => {
    clearTimeout(applyTimer);
    apply(); // a morph cut short still applies its update
    cancelAnimationFrame(raf);
    clearTimeout(recolour);
    clearTimeout(guard);
    canvas.remove();
    delete document.documentElement.dataset.morphing;
    liveRoots().forEach((r) => { r.style.transition = ""; r.style.opacity = ""; });
    running = undefined;
  };
  // Never leave the store hidden.
  const guard = setTimeout(done, TOTAL_MS + 800);
  running = { finish: done };

  const frame = (now: number) => {
    const t = now - t0;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    if (!revealed && t >= REVEAL_START) {
      revealed = true;
      liveRoots().forEach((r) => { r.style.transition = `opacity ${REVEAL_MS}ms ease`; r.style.opacity = "1"; });
    }
    const fadeIn = Math.min(1, t / HIDE_MS);
    const fadeOut = t < REVEAL_START ? 1 : Math.max(0, 1 - (t - REVEAL_START) / REVEAL_MS);
    const target = to ?? from;
    for (let i = 0; i < from.length; i++) {
      const a = from[i], b = target[i], s = seeds[i];
      const delay = FLY_START + (Math.min(a.y, b.y) / innerHeight) * STAGGER_MS + s.jitter;
      const k = ease(clamp01((t - delay) / FLY_MS));
      // Quadratic curve through a bent midpoint: particles swirl, not slide.
      const mx = (a.x + b.x) / 2 + s.bend, my = (a.y + b.y) / 2 - Math.abs(s.bend) * 0.6;
      const x = (1 - k) * (1 - k) * a.x + 2 * (1 - k) * k * mx + k * k * b.x;
      const y = (1 - k) * (1 - k) * a.y + 2 * (1 - k) * k * my + k * k * b.y;
      const c = mix(a.c, b.c, k);
      ctx.globalAlpha = c[3] * fadeIn * fadeOut;
      ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      const r = s.size * (1 + Math.sin(k * Math.PI) * 0.8);
      ctx.fillRect(x - r / 2, y - r / 2, r, r);
    }
    if (t < TOTAL_MS) raf = requestAnimationFrame(frame);
    else done();
  };
  raf = requestAnimationFrame(frame);
}

// ---- reading the page -------------------------------------------------------

function sources(roots: Element[]): Src[] {
  const out: Src[] = [];
  const vw = innerWidth, vh = innerHeight;
  for (const root of roots) {
    for (const el of root.querySelectorAll("*")) {
      const rect = el.getBoundingClientRect();
      if (rect.width < 3 || rect.height < 3 || rect.bottom < 0 || rect.top > vh || rect.right < 0 || rect.left > vw) continue;
      const kind: Src["kind"] | undefined = el.tagName === "IMG" ? "img"
        : hasOwnText(el) ? "text"
        : "block";
      const color = colourOf(el, kind);
      if (!color) continue;
      out.push({ el, kind, rect, color });
      if (out.length > 1500) return out;
    }
  }
  return out;
}

function hasOwnText(el: Element) {
  for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent!.trim()) return true;
  return false;
}

function colourOf(el: Element, kind: Src["kind"]): RGBA | null {
  const cs = getComputedStyle(el);
  if (cs.visibility === "hidden" || cs.display === "none") return null;
  if (kind === "text") return parse(cs.color);
  if (kind === "img") return parse(getComputedStyle(document.documentElement).getPropertyValue("--fg-muted")) ?? [128, 128, 128, 1];
  const bg = parse(cs.backgroundColor);
  // Blocks only count when they paint something.
  return bg && bg[3] > 0.05 ? bg : null;
}

function particlesFrom(src: Src[], n: number): Pt[] {
  const weight = (s: Src) => {
    const area = Math.min(s.rect.width, innerWidth) * Math.min(s.rect.height, innerHeight);
    return s.kind === "text" ? area * 1.2 : s.kind === "img" ? area * 0.5 : area * 0.12;
  };
  const total = src.reduce((a, s) => a + weight(s), 0);
  const pts: Pt[] = [];
  if (!total) {
    // Empty screen: a thin line in the middle.
    for (let i = 0; i < n; i++) pts.push({ x: (i / n) * innerWidth, y: innerHeight / 2, c: [128, 128, 128, 0.6], s: -1 });
    return pts;
  }
  src.forEach((s, si) => {
    const k = Math.max(s.kind === "text" ? 1 : 0, Math.round((weight(s) / total) * n));
    const x0 = Math.max(0, s.rect.left), x1 = Math.min(innerWidth, s.rect.right);
    const y0 = Math.max(0, s.rect.top), y1 = Math.min(innerHeight, s.rect.bottom);
    for (let i = 0; i < k; i++) pts.push({ x: x0 + Math.random() * (x1 - x0), y: y0 + Math.random() * (y1 - y0), c: s.color, s: si });
  });
  // Exactly n: trim at random or repeat.
  shuffle(pts);
  while (pts.length < n) pts.push({ ...pts[pts.length % Math.max(1, pts.length)] });
  return pts.slice(0, n);
}

// Pair old and new particles so neighbours stay neighbours (both sorted in
// horizontal bands, matched by rank); the per-particle bend and jitter keep it organic.
function pair(from: Pt[], to: Pt[]): Pt[] {
  const band = 24;
  const key = (p: Pt) => Math.floor(p.y / band) * 1e5 + p.x;
  const fi = from.map((p, i) => [key(p), i] as const).sort((a, b) => a[0] - b[0]).map(([, i]) => i);
  const ts = [...to].sort((a, b) => key(a) - key(b));
  const out = new Array<Pt>(from.length);
  fi.forEach((i, rank) => { out[i] = ts[Math.min(ts.length - 1, rank)]; });
  return out;
}

// ---- small helpers ------------------------------------------------------------

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const mix = (a: RGBA, b: RGBA, k: number): RGBA => [
  Math.round(a[0] + (b[0] - a[0]) * k), Math.round(a[1] + (b[1] - a[1]) * k), Math.round(a[2] + (b[2] - a[2]) * k), a[3] + (b[3] - a[3]) * k,
];
function shuffle<T>(xs: T[]) { for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [xs[i], xs[j]] = [xs[j], xs[i]]; } }

// Colours from getComputedStyle: rgb()/rgba(), or a hex custom property.
let probe: CanvasRenderingContext2D | null = null;
function parse(v: string): RGBA | null {
  v = v.trim();
  if (!v) return null;
  let m = v.match(/^rgba?\(([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+%?))?\)$/);
  if (!m) {
    // oklab()/color-mix() etc.: let the canvas normalise it.
    probe ??= document.createElement("canvas").getContext("2d");
    if (!probe) return null;
    probe.fillStyle = "#000";
    probe.fillStyle = v;
    const n = String(probe.fillStyle);
    m = n.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
      ? (["", String(parseInt(n.slice(1, 3), 16)), String(parseInt(n.slice(3, 5), 16)), String(parseInt(n.slice(5, 7), 16)), "1"] as unknown as RegExpMatchArray)
      : n.match(/^rgba?\(([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+%?))?\)$/);
    if (!m) return null;
  }
  const a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  return [+m[1], +m[2], +m[3], a];
}
