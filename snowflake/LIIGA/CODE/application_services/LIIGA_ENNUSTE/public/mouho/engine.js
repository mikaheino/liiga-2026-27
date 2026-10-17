// =============================================================================
// MOUHO-MOOTTORI -- pieni SCUMM-henkinen point-and-click-moottori selaimeen.
//
// Oma toteutus (SCUMM ja sen työkalut ovat LucasArtsin/Disneyn omaisuutta);
// periaatteet Video Game History Foundationin julkisesta Monkey Island -aineistosta:
//   * kävelyalueet (walk boxes) monikulmioina + A*-reitinhaku ruudukossa
//   * syvyystasot (z-planes): hahmot ja esineet piirretään jalkojen y:n mukaan
//   * hahmot (actors) puku- eli costume-funktiolla, kävely 4 suuntaan, puheanimaatio
//   * verbit, tavarakuvakkeet, oletustoiminto oikealla painikkeella
//   * skriptit async-funktioina: say / walkTo / choose / cutscene
//
// Sisältö (ruudut, esineet, tarina) on game.js:ssä, grafiikka art.js:ssä.
// =============================================================================
"use strict";
const W = 320, H = 136;
const cv = document.getElementById("c"), main = cv.getContext("2d");
// Tuplatarkkuus (17.10.): maailma on yhä 320 x 136 (kentät, pulmat, kävelyalueet), mutta kangas
// on 640 x 272. Taustat skaalautuvat terävinä 2x, hahmojen päät piirretään puoleen kokoon
// omalla tarkkuudellaan (faces.js) -- tarkat hahmot vanhan maailman päällä.
const PXS = cv.width / 320; main.setTransform(PXS, 0, 0, PXS, 0, 0); main.imageSmoothingEnabled = false;
let g = main;                         // piirtokohde: pääcanvas tai taustan välimuisti
const $say = document.getElementById("say"), $sent = document.getElementById("sentence");
const $verbs = document.getElementById("verbs"), $inv = document.getElementById("inv"), $dlg = document.getElementById("dialog");
const $game = document.getElementById("game");

// ---------------------------------------------------------------- piirtäminen
// VGA-henki: 320 x 136, liukuvärit Bayer-ditheröintinä eikä sileinä. Staattiset
// taustat piirretään kerran välimuistiin (bgCache), joka ruudussa vain liike.
const r = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, h | 0); };
const px = (x, y, c) => r(x, y, 1, 1, c);
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bay = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
function dither(x, y, w, h, a, b, t = 0.5) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, bay(x + i, y + j) < t ? b : a); }
// Pystysuora liukuväri väripaletin läpi, ditheröity siirtymä jokaisen värin välissä.
function vgrad(x, y, w, h, cols) {
  for (let j = 0; j < h; j++) {
    const f = (j / Math.max(h - 1, 1)) * (cols.length - 1), k = Math.min(Math.floor(f), cols.length - 2), t = f - k;
    for (let i = 0; i < w; i++) px(x + i, y + j, bay(x + i, y + j) < t ? cols[k + 1] : cols[k]);
  }
}
let seed = 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
function noise(x, y, w, h, base, cols, p) { r(x, y, w, h, base); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (rnd() < p) px(x + i, y + j, cols[(rnd() * cols.length) | 0]); }
function disc(cx, cy, rad, c, edge) { for (let j = -rad; j <= rad; j++) for (let i = -rad; i <= rad; i++) { const d = i * i + j * j; if (d <= rad * rad) px(cx + i, cy + j, edge && d > (rad - 1) * (rad - 1) ? edge : c); } }
function tri(x, y, w, h, c) { for (let j = 0; j < h; j++) { const ww = Math.round(w * (j + 1) / h); r(x + (w - ww) / 2, y + j, ww, 1, c); } }
function shadow(x, y, w) { g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.ellipse(x, y, w, 2, 0, 0, 7); g.fill(); }
function glow(x, y, rad, rgb, a) { const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`); g.globalCompositeOperation = "lighter"; g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); g.globalCompositeOperation = "source-over"; }
const bgCache = {};
function paintBg(name, fn) { if (bgCache[name]) return bgCache[name]; const c = document.createElement("canvas"); c.width = W; c.height = H; const prev = g; g = c.getContext("2d"); seed = 7; fn(); g = prev; return (bgCache[name] = c); }
function starfield(n, maxY, s0) { seed = s0; const out = []; for (let i = 0; i < n; i++) out.push([(rnd() * W) | 0, (rnd() * maxY) | 0, rnd()]); return out; }

// ---------------------------------------------------------------- tila
// st = pelaajahahmo (Jussi) + pelin muisti. Tallennetaan sellaisenaan.
const st = { scene: "koti", x: 60, y: 126, dir: 1, frame: 0, path: [], hat: false, whip: false, inv: [], flags: {} };
const ROOMS = {}, ITEMS = {};
const VERBS = ["Anna", "Poimi", "Käytä", "Avaa", "Katso", "Työnnä", "Sulje", "Puhu", "Vedä"];
let verb = "Kävele", first = null, busy = false, onArrive = null, overlay = null, speaking = null, skip = null;
let callSpk = null;   // puhelun aikana: puhujien kuplien kohdat paneeleissa (call.js)
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const has = (k) => st.inv.includes(k);
// Uusi esine välähtää tavaroissa ja soi (17.10.: "siirtyy inventaariin ilman että tajusin").
let newItem = null;
function give(k) { if (!has(k)) { st.inv.push(k); newItem = k; [659, 880].forEach((f, n) => setTimeout(() => beep(f, 120, "triangle", .05), n * 110)); setTimeout(() => { newItem = null; renderInv(); }, 2600); } renderInv(); }
function take(k) { st.inv = st.inv.filter((x) => x !== k); if (first === k) first = null; renderInv(); }
const room = () => ROOMS[st.scene];

// ---------------------------------------------------------------- kävelyalueet ja reitinhaku
// Ruudukko 2 px:n soluina. Solu on kävelykelpoinen, jos sen keskipiste on
// jonkin ruudun kävelymonikulmion sisällä. Monikulmiot voivat riippua tilasta
// (temppelin kuilun takaosa aukeaa vasta ruoskalla), siksi ruudukko lasketaan
// joka reitinhaulla -- 160 x 68 solua on halpa.
const CELL = 2, GW = W / CELL, GH = Math.ceil(H / CELL);
function inPoly(x, y, poly) { let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j];
  if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside; } return inside; }
function polys() { const w = room()?.walk; return typeof w === "function" ? w() : w ?? []; }
function grid() { const ps = polys(), m = new Uint8Array(GW * GH); for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) { const x = i * CELL + 1, y = j * CELL + 1; if (ps.some((p) => inPoly(x, y, p))) m[j * GW + i] = 1; } return m; }
function nearest(m, ci, cj) {                          // lähin kävelykelpoinen solu (BFS)
  const seen = new Uint8Array(GW * GH), q = [[ci, cj]]; seen[cj * GW + ci] = 1;
  while (q.length) { const [i, j] = q.shift(); if (m[j * GW + i]) return [i, j];
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a >= 0 && b >= 0 && a < GW && b < GH && !seen[b * GW + a]) { seen[b * GW + a] = 1; q.push([a, b]); } } }
  return null;
}
function lineFree(m, x0, y0, x1, y1) { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)); for (let k = 0; k <= n; k++) { const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n; if (!m[Math.floor(y / CELL) * GW + Math.floor(x / CELL)]) return false; } return true; }
function findPath(x0, y0, x1, y1) {
  const m = grid(), clampC = (v, n) => Math.max(0, Math.min(n - 1, Math.floor(v / CELL)));
  const s = nearest(m, clampC(x0, GW), clampC(y0, GH)), e = nearest(m, clampC(x1, GW), clampC(y1, GH)); if (!s || !e) return [];
  const goal = [e[0] * CELL + 1, e[1] * CELL + 1];
  const ex = goal[0] === Math.floor(x1 / CELL) * CELL + 1 && goal[1] === Math.floor(y1 / CELL) * CELL + 1 ? [x1, y1] : goal;
  // A* 8 suuntaan
  const N = GW * GH, gS = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), open = [], closed = new Uint8Array(N);
  const id = (i, j) => j * GW + i, hh = (i, j) => Math.hypot(i - e[0], j - e[1]);
  gS[id(...s)] = 0; open.push([hh(...s), s[0], s[1]]);
  while (open.length) {
    let bi = 0; for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k;
    const [, i, j] = open.splice(bi, 1)[0], cur = id(i, j); if (closed[cur]) continue; closed[cur] = 1;
    if (i === e[0] && j === e[1]) break;
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { if (!di && !dj) continue; const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= GW || b >= GH || !m[id(a, b)]) continue;
      const ng = gS[cur] + (di && dj ? 1.414 : 1); if (ng < gS[id(a, b)]) { gS[id(a, b)] = ng; from[id(a, b)] = cur; open.push([ng + hh(a, b), a, b]); } }
  }
  if (from[id(...e)] < 0 && id(...e) !== id(...s)) return [];
  const raw = []; for (let c = id(...e); c >= 0 && c !== id(...s); c = from[c]) raw.unshift([(c % GW) * CELL + 1, Math.floor(c / GW) * CELL + 1]);
  raw.push(ex);
  // Suoristus: hypätään kauimpaan näkyvään pisteeseen, jottei reitti ole porrastettu.
  const out = []; let px0 = x0, py0 = y0, k = 0;
  while (k < raw.length) { let far = k; for (let q = raw.length - 1; q > k; q--) if (lineFree(m, px0, py0, raw[q][0], raw[q][1])) { far = q; break; } out.push(raw[far]); [px0, py0] = raw[far]; k = far + 1; }
  return out;
}
function walkTo(x, y = st.y) { return new Promise((res) => { st.path = findPath(st.x, st.y, x, y); onArrive = res; if (!st.path.length) { onArrive = null; res(); } }); }
function depth(y) { const sc = room()?.scale; if (!sc) return 1; const [y0, y1, s0 = 0.7, s1 = 1.02] = sc; return s0 + (s1 - s0) * Math.max(0, Math.min(1, (y - y0) / (y1 - y0))); }
function place(x, y) { st.x = x; st.y = y; st.path = []; onArrive = null; }

// ---------------------------------------------------------------- ääni
let actx = null;
function beep(freq, ms = 220, type = "square", vol = 0.06) { try { actx ??= new AudioContext(); const o = actx.createOscillator(), v = actx.createGain();
  o.type = type; o.frequency.value = freq; v.gain.value = vol; v.gain.setTargetAtTime(0, actx.currentTime + ms / 1000 * .6, .05); o.connect(v).connect(actx.destination); o.start(); o.stop(actx.currentTime + ms / 1000); } catch { /* ei ääntä */ } }

// ---------------------------------------------------------------- puhe ja skriptit
// Puhuja: "jussi", ruudun hahmon id (esim. "kauppias") tai "muu" (kertoja).
// Puhekuplat (16.10.): hahmojen repliikit sarjakuvakuplina, häntä puhujan päähän;
// kertoja ("muu") tekstilaatikkona ruudun yläreunassa.
function say(text, who = "jussi") {
  return new Promise((res) => {
    const npc = room()?.actors?.find((a) => a.id === who);
    const spk = callSpk?.[who] ?? (who === "jussi" ? { x: st.x, y: st.y - 50 * depth(st.y), c: "#c8a460" } : npc ? { x: npc.x, y: npc.y - (npc.h ?? 44) * depth(npc.y), c: npc.color } : null);
    const el = document.createElement("div");
    if (!spk) el.className = "caption";
    else {
      // Kupla mitataan ja pidetään kokonaan ruudussa; häntä osoittaa silti puhujaan.
      el.className = "bubble"; el.style.left = (100 * spk.x / W) + "%"; el.style.bottom = (100 - 100 * (spk.y - 4) / H) + "%"; el.style.setProperty("--c", spk.c);
      requestAnimationFrame(() => { const stageW = $say.getBoundingClientRect().width, half = el.offsetWidth / 2 / stageW * W;
        const cx = Math.min(Math.max(spk.x, half + 2), W - half - 2), maxTail = Math.max(0, el.offsetWidth / 2 - 16);
        el.style.left = (100 * cx / W) + "%"; el.style.setProperty("--tail", Math.max(-maxTail, Math.min(maxTail, (spk.x - cx) / W * stageW)) + "px"); });
    }
    el.textContent = text; $say.replaceChildren(el); speaking = who;
    const done = () => { clearTimeout(tm); skip = null; speaking = null; el.remove(); res(); };
    // Kesto pituuden mukaan (17.10. sokkotesti: ~3 s riitti vain lyhyille, tärkeitä rivejä jäi lukematta).
    const tm = setTimeout(done, 2200 + text.length * 70); skip = done;
  });
}
async function script(fn) { busy = true; $game.classList.add("cut"); try { await fn(); } finally { busy = false; $game.classList.remove("cut"); setSentence(); } }
// Keskustelu Fate of Atlantiksen tapaan: vaihtoehdot verbien paikalla, jo kysytyt
// himmeinä, valittu repliikki Jussin suuhun.
const asked = new Set();
function choose(options) {
  return new Promise((res) => {
    $game.classList.add("talking"); $dlg.replaceChildren(...options.map((o, i) => { const b = document.createElement("button"); b.textContent = o; if (asked.has(o)) b.className = "asked";
      // stopPropagation: muuten sama klikkaus kuplii dokumenttiin ja ohittaa heti Jussin repliikin.
      b.onclick = (e) => { e.stopPropagation(); asked.add(o); $game.classList.remove("talking"); res(i); }; return b; }));
  });
}

// Mouho-IQ (Fate of Atlantiksen "Indy Quotient"): pisteet oivalluksista, kukin kerran.
const IQ_MAX = 100;   // kaikkien iq()-pisteiden summa (game.js), tarkistettu 17.10.
function iq(key, n) { st.iq ??= {}; if (st.iq[key]) return; st.iq[key] = n; renderIq(); }
const iqTotal = () => Object.values(st.iq ?? {}).reduce((a, b) => a + b, 0);
function renderIq() { const el = document.getElementById("iq"); if (el) el.textContent = `Mouho-IQ ${iqTotal()} / ${IQ_MAX}`; }
function go(scene, x, keep, y) { st.scene = scene; const r0 = ROOMS[scene]; place(x, y ?? r0?.start ?? 126); if (r0?.enter) r0.enter(); if (!keep) setSentence(); }

// ---------------------------------------------------------------- verbit ja kohteet
const GENERIC = { Poimi: "En voi ottaa sitä.", Avaa: "Se ei aukea.", Sulje: "Se ei sulkeudu.", Työnnä: "Se ei liiku.", Vedä: "Se ei liiku.", Puhu: "Se ei vastaa. Hyvä niin.", Käytä: "En keksi, miten.", Anna: "Ei kiitos.", Katso: "Ei mitään erikoista." };
function spotsAt(x, y) { const s = room(); if (!s) return null; return s.spots.find((p) => !(p.hidden && p.hidden()) && x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h) || null; }
const nameOf = (o) => (typeof o === "string" ? ITEMS[o].name : o.name);
// Oletustoiminto (oikea painike ja korostettu verbi): hahmo -> Puhu, uloskäynti -> Kävele, muuten Katso.
const defVerb = (o) => (typeof o === "string" ? "Katso" : o.def ?? (o.actor ? "Puhu" : o.exit ? "Kävele" : "Katso"));
function setSentence(target) {
  if (busy) return;
  // "Kävele" näytetään vain uloskäynneille ja lattialle; muuten oletustoiminto (sokkotesti:
  // "Kävele 50 euron seteli"). Kahden kohteen lause nuolella, koska taivutus ei onnistu.
  const shown = verb === "Kävele" && target && !(typeof target !== "string" && (target.exit || target.floor)) ? defVerb(target) : verb;
  $sent.textContent = first ? `${verb}: ${nameOf(first)} \u2192 ${target ? nameOf(target) : "..."}` : `${shown}${target ? " " + nameOf(target) : ""}`;
  const dv = target ? defVerb(target) : null; for (const b of $verbs.children) b.classList.toggle("def", b.textContent === dv);
}
async function act(v, target) {
  if (typeof target === "string") {
    if (v === "Katso") return script(ITEMS[target].look);
    if (ITEMS[target][v] && !first) return script(ITEMS[target][v]);     // esineen oma verbi (esim. Käytä kännykkä)
    if ((v === "Käytä" || v === "Anna") && !first) { first = target; renderInv(); setSentence(); return; }
    return script(() => say("Ei, se ei toimi noin."));
  }
  await walkTo(target.at, target.aty ?? (room().scale?.[0] ?? 126) + 3);
  st.dir = (target.x + target.w / 2) > st.x ? 1 : -1;
  const it = first; first = null; renderInv();
  const f = it ? (target[`${v}:${it}`] || (v === "Anna" && target.Anna && (() => target.Anna(it)))) : target[v];
  if (target.exit && !it && (v === "Kävele" || v === "Käytä")) return f && f();
  if (f) return script(f);
  if (it) return script(() => say("Se ei toimi."));
  if (v !== "Kävele") return script(() => say(GENERIC[v] || "Hmm."));
}

// ---------------------------------------------------------------- käyttöliittymä
function stagePos(e) { const b = cv.getBoundingClientRect(); return [((e.clientX - b.left) / b.width) * W, ((e.clientY - b.top) / b.height) * H]; }
cv.addEventListener("mousemove", (e) => { if (busy || !room()) return; const [x, y] = stagePos(e); setSentence(spotsAt(x, y)); });
function click(e, right) {
  if (skip) { skip(); return; } if (busy || !room() || overlay) return;
  const [x, y] = stagePos(e); let o = spotsAt(x, y);
  if (o?.floor && verb === "Kävele" && !first && !right) o = null;   // lattiakohteelle (piano) kävellään klikattuun kohtaan
  if (o) { act(right && !first ? defVerb(o) : verb, o); verb = "Kävele"; renderVerbs(); }
  else { first = null; renderInv(); onArrive = null;
    // Klikkaus omien jalkojen kohdalle: hyppy paikallaan, jotta samaa lattiakosketinta voi
    // painaa kahdesti (koodissa 2006 on kaksi nollaa).
    if (Math.hypot(x - st.x, y - st.y) < 7 && room().onStop) { st.hop = performance.now(); room().onStop(st.x, st.y); }
    else st.path = findPath(st.x, st.y, x, y); }
}
cv.addEventListener("click", (e) => click(e, false));
cv.addEventListener("contextmenu", (e) => { e.preventDefault(); click(e, true); });
document.addEventListener("click", (e) => { if (skip && e.target !== cv && !e.target.closest("#dialog")) skip(); });
document.addEventListener("keydown", (e) => { if ((e.key === "Escape" || e.key === ".") && skip) skip(); });
function renderVerbs() { $verbs.replaceChildren(...VERBS.map((v) => { const b = document.createElement("button"); b.textContent = v; if (v === verb) b.className = "on"; b.onclick = () => { if (busy) return; verb = v; first = null; renderVerbs(); renderInv(); setSentence(); }; return b; })); }
// Tavarat kuvakkeina (MI2-tyyli): jokainen esine piirtää oman 24 x 16 kuvakkeensa.
const iconCache = {};
function icon(k) { if (iconCache[k]) return iconCache[k]; const c = document.createElement("canvas"); c.width = 24; c.height = 16; const prev = g; g = c.getContext("2d"); ITEMS[k].icon?.(); g = prev; return (iconCache[k] = c); }
function renderInv() { $inv.replaceChildren(...st.inv.map((k) => { const b = document.createElement("button"); b.title = ITEMS[k].name; b.setAttribute("aria-label", ITEMS[k].name);
  const img = document.createElement("img"); img.src = icon(k).toDataURL(); img.alt = ""; b.append(img);
  if (first === k) b.className = "sel"; else if (newItem === k) b.className = "new"; else if (ITEMS[k].nudge?.()) b.className = "nudge";
  b.onclick = () => { if (busy) return; if (first && first !== k) return script(() => say("Ne eivät sovi yhteen.")); act(verb === "Kävele" ? "Katso" : verb, k); if (verb !== "Käytä" && verb !== "Anna") { verb = "Kävele"; renderVerbs(); } };
  b.oncontextmenu = (e) => { e.preventDefault(); if (!busy) act("Katso", k); };
  b.onmouseenter = () => setSentence(k); return b; })); }

// ---------------------------------------------------------------- tallennus
const SAVE = "mouho-2026-save-v3";   // v3 (17.10.): uusi juoni, vanhat tallennukset eivät sovi
function saveGame() { if (busy || overlay || !room()) return say("Ei nyt, kesken kaiken.", "muu"); try { localStorage.setItem(SAVE, JSON.stringify({ ...st, path: [] })); } catch { /* yksityinen ikkuna */ } return script(() => say("Peli tallennettu.", "muu")); }
function loadGame() { let d = null; try { d = JSON.parse(localStorage.getItem(SAVE) ?? "null"); } catch { /* ei tallennusta */ } if (!d) return say("Tallennusta ei löydy.", "muu");
  Object.assign(st, d, { path: [] }); title = false; overlay = null; renderVerbs(); renderInv(); renderIq(); setSentence(); }

// ---------------------------------------------------------------- silmukka
let last = performance.now(), title = true, drawTitleFn = null;
function frame(t) {
  const dt = Math.min(t - last, 50) / 1000; last = t;
  if (title) { drawTitleFn?.(t); return requestAnimationFrame(frame); }
  if (overlay) { overlay(t); return requestAnimationFrame(frame); }
  const s = room(); s.draw(t);
  // liike reittiä pitkin
  let moving = false, dx = 0, dy = 0;
  if (st.path.length) { const [tx, ty] = st.path[0]; dx = tx - st.x; dy = ty - st.y; const d = Math.hypot(dx, dy * 1.5), sp = (st.flags.boulder != null ? 110 : 62) * depth(st.y) * dt;
    if (d <= sp) { st.x = tx; st.y = ty; st.path.shift(); } else { st.x += dx * sp / d; st.y += dy * sp / d; }
    moving = true; if (Math.abs(dx) > 0.5) st.dir = Math.sign(dx); st.frame = Math.floor(t / 120); }
  else { if (st.frame !== 0 && !busy) s.onStop?.(st.x, st.y);     // pysähtyi juuri (lattiapiano)
    st.frame = 0; if (onArrive) { const f = onArrive; onArrive = null; f(); } }
  const away = moving && dy < 0 && Math.abs(dy) * 1.5 > Math.abs(dx);
  // Syvyysjärjestys: esineet, ruudun hahmot ja Jussi jalkojen y:n mukaan.
  const items = [...(s.props ?? []).map((p) => ({ y: p.y, draw: () => p.draw(t) })), ...(s.actors ?? []).filter((a) => !a.hidden?.()).map((a) => ({ y: a.y, draw: () => { const sc = depth(a.y); g.save(); g.translate(a.x, a.y); g.scale(sc, sc); g.translate(-a.x, -a.y); a.draw(t, speaking === a.id); g.restore(); } })),
    { y: st.y, draw: () => { const sc = depth(st.y); const hop = st.hop && t - st.hop < 260 ? Math.sin((t - st.hop) / 260 * Math.PI) * 4 * sc : 0; shadow(st.x, st.y, 7 * sc); jussi(st.x, st.y - hop, st.dir, st.frame, st, sc, away); } }];
  items.sort((a, b) => a.y - b.y).forEach((i) => i.draw());
  if (s.post) s.post(t);
  g.fillStyle = "rgba(0,0,0,.55)"; g.fillRect(0, 0, g.measureText(s.title).width + 8, 11); g.fillStyle = "#a8a8a8"; g.font = "10px VT323, monospace"; g.fillText(s.title, 4, 8);
  requestAnimationFrame(frame);
}
function startEngine({ titleScreen, intro, startRoom, startX, hint }) {
  drawTitleFn = titleScreen;
  cv.addEventListener("click", async function start(e) {
    if (!title) return; title = false; cv.removeEventListener("click", start, { capture: true });
    e.stopImmediatePropagation();          // muuten sama klikkaus ohittaa ensimmäisen repliikin
    go(startRoom, startX, true); renderVerbs(); renderInv(); renderIq(); setSentence();
    await script(intro);
  }, { capture: true });
  // stopPropagation: muuten sama klikkaus ohittaa heti "Peli tallennettu" -ilmoituksen (sokkotesti).
  document.getElementById("save")?.addEventListener("click", (e) => { e.stopPropagation(); saveGame(); });
  document.getElementById("hint")?.addEventListener("click", (e) => { e.stopPropagation(); idleAt = performance.now(); hint?.(); });   // ei kupli: muuten sama klikkaus ohittaisi vihjeen
  // Toimettomuus: minuutin hiljaisuuden jälkeen Jussi miettii ääneen seuraavaa askelta.
  let idleAt = performance.now();
  for (const ev of ["click", "contextmenu", "keydown"]) document.addEventListener(ev, () => { idleAt = performance.now(); }, true);
  setInterval(() => { if (!title && !busy && !overlay && room() && performance.now() - idleAt > 60000) { idleAt = performance.now(); hint?.(); } }, 5000);
  document.getElementById("load")?.addEventListener("click", (e) => { e.stopPropagation(); loadGame(); });
  requestAnimationFrame(frame);
}
