#!/usr/bin/env node
// Mouho-pelin sokkotestaus komentoriviltä (17.10.: "testikierrokset merkittävästi nopeammaksi").
// Jokainen testaaja saa oman päätteettömän Chromen; komento = yksi pelaajan toiminto, ja vastaus
// on vain se, minkä pelaaja näkisi (pelin ?testi-tilan window.mouho-rajapinta, engine.js).
//
//   node scripts/tools/mouho_cli.mjs <nimi> aloita [alku]     käynnistää (alku: istanbul|kappadokia)
//   node scripts/tools/mouho_cli.mjs <nimi> katso
//   node scripts/tools/mouho_cli.mjs <nimi> tee <verbi> "<kohde>" ["<esine>"]
//   node scripts/tools/mouho_cli.mjs <nimi> valitse <n>
//   node scripts/tools/mouho_cli.mjs <nimi> vihje
//   node scripts/tools/mouho_cli.mjs <nimi> kuva <tiedosto.png>
//   node scripts/tools/mouho_cli.mjs <nimi> lopeta
import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const BASE = process.env.MOUHO_URL ?? "http://localhost:3010/mouho/index.html";
const [name, cmd, ...args] = process.argv.slice(2);
if (!name || !cmd) { console.log(readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(1, 12).join("\n")); process.exit(1); }
const stateFile = `/tmp/mouho-cli-${name}.json`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect(port) {
  for (let i = 0; i < 60; i++) {
    try { const t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const p = t.find((x) => x.type === "page");
      if (p) { const ws = new WebSocket(p.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; }); return ws; } } catch { /* ei vielä pystyssä */ }
    await sleep(200);
  }
  throw new Error("Chrome ei vastaa");
}
function rpc(ws) {
  let id = 0; const pend = {};
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } };
  return (method, params = {}) => new Promise((r) => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
}
function show(v) {
  if (!v || typeof v !== "object") return console.log(String(v));
  if (v.virhe) console.log(`! ${v.virhe}`);
  for (const l of v.uudet_repliikit ?? []) console.log(l);
  console.log(`-- ${v.ruutu} | ${v.mouho_iq ?? ""}`);
  if (v.kohteet?.length) console.log(`kohteet: ${v.kohteet.join(" | ")}`);
  console.log(`tavarat: ${(v.tavarat ?? []).join(" | ")}`);
  if (v.vaihtoehdot) console.log(`VALITSE: ${v.vaihtoehdot.map((o, i) => `[${i + 1}] ${o}`).join("  ")}`);
  if (v.lomake) console.log(`LOMAKE NÄKYVISSÄ: ${v.lomake.replace(/\s+/g, " ")}`);
}

if (cmd === "aloita") {
  if (existsSync(stateFile)) { try { process.kill(JSON.parse(readFileSync(stateFile, "utf8")).pid); } catch { /* jo poissa */ } }
  const port = 9400 + Math.floor(Math.random() * 400), alku = args[0] ? `&alku=${args[0]}` : "";
  const ch = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=/tmp/mouho-cli-profile-${name}`, "--window-size=960,700", `${BASE}?testi${alku}`],
    { stdio: "ignore", detached: true });
  ch.unref(); writeFileSync(stateFile, JSON.stringify({ port, pid: ch.pid }));
  await sleep(2500);
}
if (!existsSync(stateFile)) { console.log("Aloita ensin: aloita"); process.exit(1); }
const { port, pid } = JSON.parse(readFileSync(stateFile, "utf8"));
if (cmd === "lopeta") { try { process.kill(pid); } catch { /* jo poissa */ } rmSync(stateFile); await sleep(800);
  rmSync(`/tmp/mouho-cli-profile-${name}`, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); console.log("lopetettu"); process.exit(0); }

const ws = await connect(port), send = rpc(ws);
if (cmd === "kuva") {
  const r = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 960, height: 560, scale: 1 } });
  writeFileSync(args[0] ?? `/tmp/mouho-${name}.png`, Buffer.from(r.result.data, "base64")); console.log(`kuva: ${args[0] ?? `/tmp/mouho-${name}.png`}`);
} else {
  const call = { aloita: "mouho.aloita()", katso: "mouho.katso()", vihje: "mouho.vihje()",
    valitse: `mouho.valitse(${Number(args[0])})`, tee: `mouho.tee(${args.map((a) => JSON.stringify(a)).join(", ")})` }[cmd];
  if (!call) { console.log(`Tuntematon komento: ${cmd}`); process.exit(1); }
  const alku = cmd === "aloita" && process.argv[4];
  const r = await send("Runtime.evaluate", { expression: alku ? "mouho.katso()" : call, awaitPromise: true, returnByValue: true, timeout: 90000 });
  if (r.result?.exceptionDetails) console.log("! virhe:", r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text);
  else show(r.result?.result?.value);
}
ws.close(); process.exit(0);
