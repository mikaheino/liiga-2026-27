// Mouhon salaisuus -- Moottori: verbit, kohteet, lause, tavarat ja hiiri.
"use strict";
// ---------------------------------------------------------------- verbit ja kohteet
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
    return script(() => say(GAME.text.cannot));
  }
  await walkTo(target.at, target.aty ?? (room().scale?.[0] ?? 126) + 3);
  st.dir = (target.x + target.w / 2) > st.x ? 1 : -1;
  const it = first; first = null; renderInv();
  const f = it ? (target[`${v}:${it}`] || (v === "Anna" && target.Anna && (() => target.Anna(it)))) : target[v];
  if (target.exit && !it && (v === "Kävele" || v === "Käytä")) return f && f();
  if (f) return script(f);
  if (it) return script(() => say("Se ei toimi."));
  if (v !== "Kävele") return script(() => say(GAME.text.generic[v] || GAME.text.unknown));
}

// ---------------------------------------------------------------- käyttöliittymä
function stagePos(e) { const b = cv.getBoundingClientRect(); return [((e.clientX - b.left) / b.width) * W - camOff(), ((e.clientY - b.top) / b.height) * H]; }   // ruudun koordinaatit (kamera huomioitu)
cv.addEventListener("mousemove", (e) => { if (busy || !room()) return; const [x, y] = stagePos(e); setSentence(spotsAt(x, y)); });
function click(e, right) {
  if (skip) { skip(); pendingClick = null; return; }
  if (busy && !overlay) { pendingClick = { e: { clientX: e.clientX, clientY: e.clientY }, right, t: performance.now() }; return; }
  if (busy || !room() || overlay) return;
  if (OUT.on) return comeBack(e, right);
  const [x, y] = stagePos(e), strip = stripOf(st.scene);
  if (strip && (x < 0 || x >= W)) { const n = strip[strip.indexOf(st.scene) + (x < 0 ? -1 : 1)]; if (n) return crossTo(n, x < 0 ? x + W : x - W, y); }   // naapuriruudun puolelle
  let o = spotsAt(x, y);
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
function renderVerbs() { $verbs.replaceChildren(...VERBS.map((v) => { const b = document.createElement("button"); b.textContent = v; if (v === verb) b.className = "on"; b.onclick = () => { if (busy && !room()) return; verb = v; first = null; renderVerbs(); renderInv(); setSentence(); }; return b; })); }
// Tavarat kuvakkeina (MI2-tyyli): jokainen esine piirtää oman 24 x 16 kuvakkeensa.
const iconCache = {};
// Kuvakkeen koko ja sarjakuvamainen ääriviiva tulevat pelin asetuksista (GAME.iconSize, GAME.iconOutline).
function icon(k) { if (iconCache[k]) return iconCache[k]; const [w, h] = GAME.iconSize ?? [24, 16], c = document.createElement("canvas"); c.width = w; c.height = h;
  const prev = g; g = c.getContext("2d"); ITEMS[k].icon?.(); g = prev; if (GAME.iconOutline) outline(c, GAME.iconOutline); return (iconCache[k] = c); }
// Läpinäkyvä pikseli, jonka vieressä on kuvaa, saa ääriviivan värin.
function outline(c, col) {
  const x2 = c.getContext("2d"), d = x2.getImageData(0, 0, c.width, c.height), a = (x, y) => x >= 0 && y >= 0 && x < c.width && y < c.height && d.data[(y * c.width + x) * 4 + 3] > 127;
  const n = parseInt(col.slice(1), 16), out = [];
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (!a(x, y) && (a(x - 1, y) || a(x + 1, y) || a(x, y - 1) || a(x, y + 1))) out.push((y * c.width + x) * 4);
  for (const i of out) { d.data[i] = n >> 16; d.data[i + 1] = (n >> 8) & 255; d.data[i + 2] = n & 255; d.data[i + 3] = 255; }
  x2.putImageData(d, 0, 0);
}
function renderInv() { $inv.replaceChildren(...st.inv.map((k) => { const b = document.createElement("button"); b.title = ITEMS[k].name; b.setAttribute("aria-label", ITEMS[k].name);
  const img = document.createElement("img"); img.src = icon(k).toDataURL(); img.alt = ""; b.append(img);
  if (first === k) b.className = "sel"; else if (newItem === k) b.className = "new"; else if (ITEMS[k].nudge?.()) b.className = "nudge";
  b.onclick = () => { if (busy) return; if (first && first !== k) return script(() => say("Ne eivät sovi yhteen.")); act(verb === "Kävele" ? "Katso" : verb, k); if (verb !== "Käytä" && verb !== "Anna") { verb = "Kävele"; renderVerbs(); } };
  b.oncontextmenu = (e) => { e.preventDefault(); if (!busy) act("Katso", k); };
  b.onmouseenter = () => setSentence(k); return b; })); }
