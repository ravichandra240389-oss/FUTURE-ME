"use strict";

const SVG_NS = "http://www.w3.org/2000/svg";
const PROGRESS_KEY = "futureme.progress.v1";
const WEIGHTS_KEY = "futureme.weights.v1";

const FACTORS = [
  { key: "demand", label: "Demand", hint: "How many companies are hiring for it" },
  { key: "compensation", label: "Compensation", hint: "Pay ceiling at your level" },
  { key: "aiProof", label: "AI-proof", hint: "How hard it is for AI to automate" },
  { key: "irreplaceable", label: "Irreplaceable", hint: "How hard you are to swap out" },
];

const state = {
  catalog: null,
  weights: { demand: 3, compensation: 3, aiProof: 3, irreplaceable: 3 },
  lineId: null,
  stationIdx: 0,
  progress: {},
};

/* ---------- storage (best effort; site works without it) ---------- */
function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

/* ---------- helpers ---------- */
const $ = (sel) => document.querySelector(sel);
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "style") node.style.cssText = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) node.append(c instanceof Node ? c : document.createTextNode(c));
  return node;
}
function svg(tag, attrs = {}, parent) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.append(node);
  return node;
}
function wrapText(text, maxChars) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    if (!line) line = w;
    else if ((line + " " + w).length <= maxChars) line += " " + w;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines;
}
const lines = () => state.catalog.roadmaps;
const currentLine = () => lines().find((r) => r.id === state.lineId);

function matchScore(r) {
  let num = 0, den = 0;
  for (const f of FACTORS) {
    num += state.weights[f.key] * r.scores[f.key];
    den += state.weights[f.key] * 10;
  }
  return den === 0 ? 0 : Math.round((num / den) * 100);
}
function ranked() {
  return [...lines()].sort((a, b) => matchScore(b) - matchScore(a));
}

/* ---------- progress ---------- */
function checked(lineId, stationId) {
  return new Set(state.progress[lineId]?.[stationId] ?? []);
}
function toggleTopic(lineId, stationId, idx, on) {
  const set = checked(lineId, stationId);
  on ? set.add(idx) : set.delete(idx);
  state.progress[lineId] ??= {};
  state.progress[lineId][stationId] = [...set];
  save(PROGRESS_KEY, state.progress);
}
function stationDone(line, st) {
  return checked(line.id, st.id).size >= st.topics.length;
}
function lineProgress(line) {
  let total = 0, done = 0;
  for (const st of line.stations) {
    total += st.topics.length;
    done += Math.min(checked(line.id, st.id).size, st.topics.length);
  }
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
}
function nextStopIdx(line) {
  const i = line.stations.findIndex((st) => !stationDone(line, st));
  return i === -1 ? line.stations.length - 1 : i;
}

/* ---------- header ---------- */
function renderProfile() {
  const p = state.catalog.profile;
  $("#profile-line").textContent =
    `${p.name} · ${p.title} · ${p.yearsOfExperience}+ years · ${p.location}. ` +
    `${lines().length} lines in demand as of ${state.catalog.asOf}, ranked by what you care about.`;
  $("#skills").replaceChildren(...p.skills.map((s) => el("li", {}, s)));
  $("#disclaimer").textContent = state.catalog.disclaimer;
}

/* ---------- footer ---------- */
function renderFooter() {
  $("#as-of").textContent = `Data as of ${state.catalog.asOf}.`;
  $("#footer-factors").replaceChildren(
    ...FACTORS.map((f) => el("li", {}, el("b", {}, f.label), `: ${f.hint.toLowerCase()}`)));
}

/* ---------- header nav: mark the section in view ---------- */
function watchSections() {
  if (!("IntersectionObserver" in window)) return;
  const links = new Map(
    [...document.querySelectorAll(".nav a")].map((a) => [a.getAttribute("href").slice(1), a]));
  const observer = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      links.forEach((a, id) => {
        if (id === e.target.id) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
    }
  }, { rootMargin: "-40% 0px -55% 0px" });
  links.forEach((_, id) => { const s = document.getElementById(id); if (s) observer.observe(s); });
}

/* ---------- network map ---------- */
function renderNetwork() {
  const box = $("#network");
  const W = Math.max(300, box.parentElement.clientWidth);
  box.replaceChildren();
  if (W >= 760) renderRadialNetwork(box, W);
  else renderStackedNetwork(box, W);
}

function networkTerminus(g, line) {
  g.setAttribute("class", "terminus-hit");
  g.setAttribute("tabindex", "0");
  g.setAttribute("role", "link");
  g.setAttribute("aria-label", `Open route: ${line.title}`);
  const go = () => { selectLine(line.id, 0); $("#route-section").scrollIntoView({ behavior: "smooth" }); };
  g.addEventListener("click", go);
  g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
}

function renderRadialNetwork(box, W) {
  const H = Math.round(Math.min(620, Math.max(480, W * 0.52)));
  box.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const cx = W / 2, cy = H / 2;
  const rx = W / 2 - 210, ry = H / 2 - 70;
  const list = lines();
  list.forEach((line, i) => {
    const angle = (-Math.PI / 2) + (Math.PI * 2 * (i + 0.5)) / list.length;
    const tx = cx + Math.cos(angle) * rx, ty = cy + Math.sin(angle) * ry;
    // track: elbow like a metro map (out from hub, then diagonal to terminus)
    const mx = cx + Math.cos(angle) * rx * 0.45, my = cy + Math.sin(angle) * ry * 0.45;
    const d = `M${cx},${cy} L${mx},${my} L${tx},${ty}`;
    svg("path", { d, fill: "none", stroke: line.color, "stroke-width": 7, "stroke-linecap": "round", "stroke-linejoin": "round", opacity: 0.9 }, box);
    // intermediate stations along the second leg
    const mids = line.stations.length - 2;
    for (let k = 1; k <= mids; k++) {
      const t = k / (mids + 1);
      // position along the elbow path: first leg hub→elbow, second leg elbow→terminus
      const sx = t < 0.45 ? cx + (mx - cx) * (t / 0.45) : mx + (tx - mx) * ((t - 0.45) / 0.55);
      const sy = t < 0.45 ? cy + (my - cy) * (t / 0.45) : my + (ty - my) * ((t - 0.45) / 0.55);
      const junction = line.stations[k].type === "junction";
      svg("circle", { cx: sx, cy: sy, r: junction ? 6 : 4, fill: "var(--surface)", stroke: line.color, "stroke-width": junction ? 3 : 2.5 }, box);
    }
    const g = svg("g", {}, box);
    networkTerminus(g, line);
    svg("circle", { cx: tx, cy: ty, r: 11, fill: line.color, stroke: "var(--surface)", "stroke-width": 3 }, g);
    const right = Math.cos(angle) > 0.25, left = Math.cos(angle) < -0.25;
    const anchor = right ? "start" : left ? "end" : "middle";
    const lx = tx + (right ? 18 : left ? -18 : 0);
    const below = Math.sin(angle) > 0;
    const wrapped = wrapText(line.title, 24);
    const baseY = (right || left) ? ty - (wrapped.length - 1) * 8 + 5 : below ? ty + 30 : ty - 20 - (wrapped.length - 1) * 16;
    const text = svg("text", { x: lx, y: baseY, "text-anchor": anchor, "font-size": 14, "font-weight": 650, style: "fill: var(--text)" }, g);
    wrapped.forEach((ln, j) => { const ts = svg("tspan", { x: lx, dy: j === 0 ? 0 : 16 }, text); ts.textContent = ln; });
    const score = svg("text", { x: lx, y: baseY + wrapped.length * 16, "text-anchor": anchor, "font-size": 12, style: "fill: var(--muted)" }, g);
    score.textContent = `${matchScore(line)}% match`;
  });
  drawHub(box, cx, cy);
}

function renderStackedNetwork(box, W) {
  const rowH = 58, top = 92;
  const list = ranked();
  const H = top + list.length * rowH + 10;
  box.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const hubX = 40, hubY = 46;
  list.forEach((line, i) => {
    const y = top + i * rowH;
    const endX = W - 24;
    svg("path", { d: `M${hubX},${hubY} L${hubX},${y - 14} Q${hubX},${y} ${hubX + 14},${y} L${endX},${y}`, fill: "none", stroke: line.color, "stroke-width": 5, "stroke-linecap": "round", opacity: 0.9 }, box);
    const mids = line.stations.length - 2;
    for (let k = 1; k <= mids; k++) {
      const x = hubX + 30 + ((endX - hubX - 60) * k) / (mids + 1);
      svg("circle", { cx: x, cy: y, r: line.stations[k].type === "junction" ? 5 : 3.5, fill: "var(--surface)", stroke: line.color, "stroke-width": 2.5 }, box);
    }
    const g = svg("g", {}, box);
    networkTerminus(g, line);
    svg("rect", { x: hubX + 10, y: y - 30, width: endX - hubX - 10, height: 50, fill: "transparent" }, g);
    svg("circle", { cx: endX, cy: y, r: 8, fill: line.color, stroke: "var(--surface)", "stroke-width": 2 }, g);
    const t = svg("text", { x: hubX + 22, y: y - 10, "font-size": 13, "font-weight": 650, style: "fill: var(--text)" }, g);
    t.textContent = `${line.title} · ${matchScore(line)}%`;
  });
  drawHub(box, hubX, hubY, true);
}

function drawHub(box, x, y, compact = false) {
  const g = svg("g", {}, box);
  svg("circle", { cx: x, cy: y, r: compact ? 22 : 46, fill: "var(--surface)", stroke: "var(--text)", "stroke-width": compact ? 4 : 6 }, g);
  const p = state.catalog.profile;
  if (compact) {
    const t = svg("text", { x: x + 34, y: y + 5, "font-size": 14, "font-weight": 700, style: "fill: var(--text)" }, g);
    t.textContent = `You · ${p.yearsOfExperience}+ yrs Java`;
    const e = svg("text", { x, y: y + 6, "text-anchor": "middle", "font-size": 16 }, g);
    e.textContent = "🚉";
    return;
  }
  const a = svg("text", { x, y: y - 6, "text-anchor": "middle", "font-size": 22 }, g);
  a.textContent = "🚉";
  const b = svg("text", { x, y: y + 16, "text-anchor": "middle", "font-size": 12, "font-weight": 700, style: "fill: var(--text)" }, g);
  b.textContent = "YOU";
  const c = svg("text", { x, y: y + 30, "text-anchor": "middle", "font-size": 10, style: "fill: var(--muted)" }, g);
  c.textContent = `${p.yearsOfExperience}+ yrs Java`;
}

/* ---------- weights & cards ---------- */
function renderWeights() {
  const box = $("#weights");
  box.replaceChildren(...FACTORS.map((f) => {
    const out = el("output", {}, String(state.weights[f.key]));
    const input = el("input", {
      type: "range", min: 0, max: 5, step: 1, value: state.weights[f.key], id: `w-${f.key}`,
      oninput: (e) => {
        state.weights[f.key] = Number(e.target.value);
        out.textContent = e.target.value;
        save(WEIGHTS_KEY, state.weights);
        renderCards(); renderCompare(); renderNetwork();
      },
    });
    return el("div", { class: "weight" },
      el("label", { for: `w-${f.key}` }, el("span", {}, f.label), out),
      input,
      el("small", {}, f.hint));
  }));
}

function renderCards() {
  const list = ranked();
  $("#cards").replaceChildren(...list.map((r, i) => {
    const bars = FACTORS.flatMap((f) => [
      el("span", {}, f.label),
      el("div", { class: "bar", role: "img", "aria-label": `${f.label} ${r.scores[f.key]} of 10` },
        el("span", { style: `width:${r.scores[f.key] * 10}%` })),
      el("b", {}, String(r.scores[f.key])),
    ]);
    return el("article", { class: "card", style: `--line:${r.color}` },
      el("span", { class: "rank" }, `#${i + 1}`),
      el("h3", {}, r.title),
      el("div", { class: "match" }, `${matchScore(r)}% match`, i === 0 ? el("span", { class: "best" }, "Best fit") : ""),
      el("p", {}, r.tagline),
      el("div", { class: "bars" }, bars),
      el("div", { class: "pay" }, el("b", {}, "India: "), r.compensation.india, " · ", el("b", {}, "US: "), r.compensation.global),
      el("button", { type: "button", onclick: () => { selectLine(r.id, 0); $("#route-section").scrollIntoView({ behavior: "smooth" }); } }, "View route →"));
  }));
}

/* ---------- route select ---------- */
function renderLineSelect() {
  const sel = $("#line-select");
  sel.replaceChildren(...lines().map((r) => el("option", { value: r.id }, r.title)));
  sel.value = state.lineId;
  sel.onchange = () => selectLine(sel.value, 0);
}

function selectLine(id, stationIdx) {
  state.lineId = id;
  const line = currentLine();
  state.stationIdx = stationIdx ?? nextStopIdx(line);
  $("#line-select").value = id;
  $("#route-section").style.setProperty("--line", line.color);
  $("#route-tagline").textContent = line.tagline;
  try { history.replaceState(null, "", `#line=${id}`); } catch { /* ignore */ }
  renderRoute();
}

function renderRoute() {
  renderRailway();
  renderStationPanel();
  renderLineFacts();
  renderProgress();
}

function renderProgress() {
  const p = lineProgress(currentLine());
  $("#progress-fill").style.width = `${p.pct}%`;
  $("#progress-text").textContent = `${p.done} / ${p.total} topics · ${p.pct}%`;
}

/* ---------- the railway ---------- */
function layoutRailway(W, n) {
  if (W < 640) {
    // vertical line, boards to the right
    const x = 44, top = 56, step = 104;
    return {
      vertical: true, H: top + (n - 1) * step + 70,
      pts: Array.from({ length: n }, (_, i) => ({ x, y: top + i * step, row: i, edge: null })),
    };
  }
  const perRow = W >= 1000 ? 4 : 3;
  const margin = 96, top = 64, rowH = 178;
  const spacing = (W - 2 * margin) / (perRow - 1);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / perRow), c = i % perRow;
    const vc = row % 2 === 0 ? c : perRow - 1 - c;
    const rowStart = c === 0, rowEnd = c === perRow - 1 || i === n - 1;
    let edge = null; // side of the station where a turn connects
    if ((rowEnd && i < n - 1) || (rowStart && row > 0)) edge = vc === 0 ? "left" : "right";
    pts.push({ x: margin + vc * spacing, y: top + row * rowH, row, edge });
  }
  const rows = Math.ceil(n / perRow);
  return { vertical: false, H: top + (rows - 1) * rowH + 120, pts, spacing };
}

function trackPath(pts) {
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if (a.row === b.row || a.x !== b.x || !a.edge) d += ` L${b.x},${b.y}`;
    else {
      const bulge = 72 * (a.edge === "left" ? -1 : 1);
      d += ` C${a.x + bulge},${a.y} ${b.x + bulge},${b.y} ${b.x},${b.y}`;
    }
  }
  return d;
}

function renderRailway() {
  const line = currentLine();
  const box = $("#railway");
  const W = Math.max(300, box.parentElement.clientWidth);
  const n = line.stations.length;
  const L = layoutRailway(W, n);
  box.setAttribute("viewBox", `0 0 ${W} ${L.H}`);
  box.setAttribute("aria-label", `Railway route for ${line.title} with ${n} stations`);
  box.replaceChildren();

  const pts = L.pts;
  const d = trackPath(pts);
  const nextIdx = nextStopIdx(line);

  // sleepers, then rails (thick line colour, hollowed by a thinner background stroke)
  svg("path", { d, fill: "none", stroke: "var(--sleeper)", "stroke-width": 24, "stroke-dasharray": "4 9" }, box);
  svg("path", { d, fill: "none", stroke: line.color, "stroke-width": 13, "stroke-linecap": "round" }, box);
  svg("path", { d, fill: "none", stroke: "var(--surface)", "stroke-width": 6, "stroke-linecap": "round" }, box);
  // travelled part of the line drawn solid
  if (nextIdx > 0) {
    svg("path", { d: trackPath(pts.slice(0, nextIdx + 1)), fill: "none", stroke: line.color, "stroke-width": 6, "stroke-linecap": "round", opacity: 0.55 }, box);
  }

  line.stations.forEach((st, i) => {
    const p = pts[i];
    const done = stationDone(line, st);
    const big = st.type !== "station";
    const g = svg("g", { class: `stn${i === state.stationIdx ? " selected" : ""}`, tabindex: 0, role: "button", "aria-label": `${st.name}, ${st.duration}${done ? ", completed" : ""}` }, box);
    const open = () => { state.stationIdx = i; renderRoute(); $("#station-panel").scrollIntoView({ behavior: "smooth", block: "nearest" }); };
    g.addEventListener("click", open);
    g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });

    const r = big ? 17 : 12;
    if (st.type === "junction") svg("circle", { cx: p.x, cy: p.y, r: r + 6, fill: "var(--surface)", stroke: line.color, "stroke-width": 3 }, g);
    svg("circle", { class: "stn-ring", cx: p.x, cy: p.y, r, fill: done ? line.color : "var(--surface)", stroke: line.color, "stroke-width": 5 }, g);
    const glyph = st.type === "start" ? "🏠" : st.type === "terminus" ? "🎯" : done ? "✓" : String(i);
    const t = svg("text", { x: p.x, y: p.y + (glyph.length > 1 || st.type === "station" || done ? 5 : 6), "text-anchor": "middle", "font-size": big && (st.type === "start" || st.type === "terminus") ? 17 : 13, "font-weight": 800, style: `fill: ${done ? "#fff" : "var(--text)"}` }, g);
    t.textContent = glyph;

    drawBoard(g, st, p, L, W);

    if (i === nextIdx) {
      const allDone = lineProgress(line).pct === 100;
      const tx = p.x, ty = L.vertical ? p.y - 34 : p.y - 30;
      const train = svg("text", { class: "train", x: tx, y: ty, "text-anchor": "middle", "font-size": 26 }, box);
      train.textContent = allDone ? "🎉" : "🚆";
    }
  });
}

function drawBoard(g, st, p, L, W) {
  const vertical = L.vertical;
  const bw = vertical ? Math.min(320, W - p.x - 40) : Math.min(168, L.spacing - 24);
  const maxChars = Math.max(10, Math.floor((bw - 16) / 7.4));
  const nameLines = wrapText(st.name, maxChars);
  const bh = 12 + nameLines.length * 16 + 16;
  let bx, by;
  if (vertical) {
    bx = p.x + 30; by = p.y - bh / 2;
  } else {
    by = p.y + 30;
    bx = p.x - bw / 2;
    if (p.edge === "left") bx = p.x - 24;
    if (p.edge === "right") bx = p.x - bw + 24;
  }
  // signboard posts
  if (!vertical) {
    svg("line", { x1: bx + 14, y1: by + bh, x2: bx + 14, y2: by + bh + 8, stroke: "#57534e", "stroke-width": 3 }, g);
    svg("line", { x1: bx + bw - 14, y1: by + bh, x2: bx + bw - 14, y2: by + bh + 8, stroke: "#57534e", "stroke-width": 3 }, g);
  }
  svg("rect", { x: bx, y: by, width: bw, height: bh, rx: 4, fill: "var(--board)", stroke: "#1c1b19", "stroke-width": 2 }, g);
  const cx = bx + bw / 2;
  const text = svg("text", { x: cx, y: by + 20, "text-anchor": "middle", "font-size": 13, "font-weight": 800, fill: "#1c1b19" }, g);
  nameLines.forEach((ln, j) => { const ts = svg("tspan", { x: cx, dy: j === 0 ? 0 : 16 }, text); ts.textContent = ln; });
  const dur = svg("text", { x: cx, y: by + bh - 9, "text-anchor": "middle", "font-size": 11, fill: "#44403c" }, g);
  dur.textContent = st.type === "junction" ? `⬥ Junction · ${st.duration}` : st.duration;
}

/* ---------- station panel ---------- */
function renderStationPanel() {
  const line = currentLine();
  const i = state.stationIdx;
  const st = line.stations[i];
  const set = checked(line.id, st.id);
  const typeLabel = { start: "Starting platform", station: "Station", junction: "Junction · major milestone", terminus: "Terminus" }[st.type];

  const topics = el("ul", { class: "topics" }, st.topics.map((topic, k) =>
    el("li", {}, el("label", {},
      (() => {
        const cb = el("input", { type: "checkbox", onchange: (e) => { toggleTopic(line.id, st.id, k, e.target.checked); renderRailway(); renderProgress(); renderCompare(); } });
        cb.checked = set.has(k);
        return cb;
      })(),
      el("span", {}, topic)))));

  const prev = el("button", { class: "btn ghost", type: "button", onclick: () => { state.stationIdx--; renderRoute(); } }, "← Previous station");
  const next = el("button", { class: "btn", type: "button", onclick: () => { state.stationIdx++; renderRoute(); } }, "Next station →");
  prev.disabled = i === 0;
  next.disabled = i === line.stations.length - 1;

  $("#station-panel").replaceChildren(
    el("div", { class: "board" }, st.name),
    el("div", { class: "meta" }, `Stop ${i + 1} of ${line.stations.length} · ${typeLabel} · ${st.duration}`),
    el("p", {}, st.summary),
    el("h3", {}, "Topics to cover"),
    topics,
    el("div", { class: "milestone" }, el("b", {}, "🏗️ Milestone project: "), st.milestone),
    el("div", { class: "nav-row" }, prev, next));
}

function renderLineFacts() {
  const r = currentLine();
  const list = (items) => el("ul", {}, items.map((x) => el("li", {}, x)));
  $("#line-facts").replaceChildren(
    el("h3", {}, "Why this line, now"), el("p", {}, r.whyNow),
    el("h3", {}, "Skills you carry on board"), list(r.leverage),
    el("h3", {}, "Gaps to close"), list(r.gaps),
    el("h3", {}, "Roles at the terminus"), list(r.targetRoles),
    el("h3", {}, "Estimated pay"), el("p", {}, `India: ${r.compensation.india}`), el("p", {}, `US: ${r.compensation.global}`));
}

/* ---------- compare table ---------- */
function renderCompare() {
  const head = el("tr", {},
    el("th", {}, "Line"),
    FACTORS.map((f) => el("th", { class: "num" }, f.label)),
    el("th", { class: "num" }, "Match"),
    el("th", {}, "India pay"),
    el("th", {}, "US pay"),
    el("th", { class: "num" }, "Progress"));
  const rows = ranked().map((r) => el("tr", {},
    el("td", {}, el("span", { class: "dot", style: `background:${r.color}` }), r.title),
    FACTORS.map((f) => el("td", { class: "num" }, String(r.scores[f.key]))),
    el("td", { class: "num" }, el("b", {}, `${matchScore(r)}%`)),
    el("td", {}, r.compensation.india),
    el("td", {}, r.compensation.global),
    el("td", { class: "num" }, `${lineProgress(r).pct}%`)));
  $("#compare").replaceChildren(el("thead", {}, head), el("tbody", {}, rows));
}

/* ---------- boot ---------- */
async function boot() {
  watchSections();
  try {
    const res = await fetch("/api/catalog");
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    state.catalog = await res.json();
  } catch (err) {
    document.querySelector("main").prepend(el("div", { class: "error" },
      `Could not load roadmaps (${err.message}). Start the app with ./mvnw spring-boot:run and open http://localhost:8080.`));
    return;
  }
  state.weights = { ...state.weights, ...load(WEIGHTS_KEY, {}) };
  state.progress = load(PROGRESS_KEY, {});

  renderProfile();
  renderFooter();
  renderWeights();
  renderCards();
  const fromHash = /line=([\w-]+)/.exec(location.hash)?.[1];
  const initial = lines().some((r) => r.id === fromHash) ? fromHash : ranked()[0].id;
  state.lineId = initial;
  renderLineSelect();
  selectLine(initial);
  renderCompare();
  renderNetwork();

  let t;
  window.addEventListener("resize", () => {
    clearTimeout(t);
    t = setTimeout(() => { renderNetwork(); renderRailway(); }, 120);
  });
}

boot();
