// Mouhon salaisuus -- Moottori: kävelyalueet, syvyys ja A*-reitinhaku.
"use strict";
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
function walkTo(x, y = st.y) { return new Promise((res) => { st.path = findPath(st.x, st.y, x, y);
  if (TEST && st.path.length) { [st.x, st.y] = st.path.at(-1); st.path = []; }      // testitila: perille heti, ei odotusta kävelyyn
  onArrive = res; if (!st.path.length) { onArrive = null; res(); } }); }
function depth(y) { const sc = room()?.scale; if (!sc) return 1; const [y0, y1, s0 = 0.7, s1 = 1.02] = sc; return s0 + (s1 - s0) * Math.max(0, Math.min(1, (y - y0) / (y1 - y0))); }
function place(x, y) { st.x = x; st.y = y; st.path = []; onArrive = null; }
