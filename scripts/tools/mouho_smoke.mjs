#!/usr/bin/env node
// Mouho-pelin savutesti: pelaa koko pelin läpi tunnetulla ratkaisulla päätteettömässä Chromessa
// (?testi-tilan window.mouho-rajapinta) ja tarkistaa, että Mouho 2027 -lomake aukeaa lopussa.
// Grafiikkaputki (docs/mouho_pixel_art.md) ajaa tämän jokaisen muutoksen jälkeen: jos grafiikka
// rikkoo pelin kulun, muutos perutaan. Tulostaa yhden rivin: OK <aika> tai FAIL <vaihe>: <syy>.
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";

const URL = (process.env.MOUHO_URL ?? "http://localhost:3010/mouho/index.html") + "?testi";
const port = 9800 + Math.floor(Math.random() * 150), prof = `/tmp/mouho-smoke-${port}`, t0 = Date.now();
const ch = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ["--headless=new", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows",
   `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, "--window-size=960,700", URL], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const done = (msg, code) => { console.log(msg); try { ch.kill(); } catch { /* */ } setTimeout(() => { rmSync(prof, { recursive: true, force: true }); process.exit(code); }, 600); };
setTimeout(() => done("FAIL aikakatkaisu 300 s", 1), 300000);

let ws;
for (let i = 0; i < 60 && !ws; i++) { try { const t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const p = t.find((x) => x.type === "page" && x.url.includes("mouho"));
  if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r)); } } catch { /* odota */ } if (!ws) await sleep(250); }
if (!ws) done("FAIL Chrome ei käynnistynyt", 1);
let id = 0; const pend = {}; ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
await sleep(2000);

// Ratkaisu pelaajan toimintoina. ["tee", verbi, kohde, esine?] tai ["valitse", "vaihtoehdon alku"].
const OK = ["Ja tuollaisilla hinnoilla", "Ilmeisesti, koska", "Siksi tingin", "Mutta erotan", "Sitten sulttaani"];
const STEPS = [
  ["aloita"], ["tee", "Poimi", "50 euron seteli"], ["tee", "Poimi", "50 euron seteli"], ["tee", "Käytä", "SaiPan toimiston ovi", "50 euron seteli"],
  ["tee", "Katso", "ilmoitustaulu"], ["tee", "Käytä", "kännykkä"], ["tee", "Anna", "salkkumies", "pyramidikaavio"],
  ["tee", "Puhu", "salkkumies"], ["valitse", "Mitä sijoittajat"],
  ["tee", "Kävele", "numero 1"], ["tee", "Kävele", "numero 9"], ["tee", "Kävele", "numero 8"], ["tee", "Kävele", "numero 5"],
  ["tee", "Avaa", "postilaatikko"], ["tee", "Poimi", "kirje"], ["tee", "Katso", "kirje"], ["tee", "Käytä", "taksi lentokentälle", "lentolippu"],
  ["tee", "Puhu", "kauppias"], ["valitse", "Mouho Global"], ["valitse", "Esittelen"], ["valitse", "Missä se"], ["valitse", "Ei mitään"],
  ["tee", "Katso", "matto"], ["tee", "Kävele", "itäinen kuja"],
  ["tee", "Puhu", "erotuomarin haamu"], ["valitse", "Kuka"], ["valitse", "Liity"],
  ["tee", "Poimi", "kultainen idoli"], ["tee", "Kävele", "käytävä basaariin"],
  ["tee", "Puhu", "kauppias"], ["valitse", "Tarvitsen pussin"], ...OK.map((o) => ["valitse", o]),
  ["tee", "Kävele", "itäinen kuja"], ["tee", "Käytä", "hiekka", "isoisän nahkapussi"], ["tee", "Käytä", "kultainen idoli", "hiekkasäkki"],
  ["tee", "Puhu", "kauppias"], ["valitse", "Löysin"],
];
const ev = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true, timeout: 120000 });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? "poikkeus"); return r.result?.result?.value; };
let v;
for (const [k, s] of STEPS.entries()) {
  try {
    if (s[0] === "aloita") v = await ev("mouho.aloita()");
    else if (s[0] === "tee") v = await ev(`mouho.tee(${s.slice(1).map((a) => JSON.stringify(a)).join(",")})`);
    else { const i = (v?.vaihtoehdot ?? []).findIndex((o) => o.startsWith(s[1])); if (i < 0) throw new Error(`ei vaihtoehtoa "${s[1]}" (${(v?.vaihtoehdot ?? []).join(" | ")})`); v = await ev(`mouho.valitse(${i + 1})`); }
    if (v?.virhe) throw new Error(v.virhe);
  } catch (e) { done(`FAIL vaihe ${k + 1} ${JSON.stringify(s)}: ${e.message}`, 1); await sleep(5000); }
}
for (let i = 0; i < 40 && !v?.lomake; i++) { await sleep(500); v = await ev("mouho.katso()"); }
v?.lomake ? done(`OK ${Math.round((Date.now() - t0) / 1000)} s, ${v.mouho_iq}`, 0) : done("FAIL lomake ei auennut lopussa", 1);
