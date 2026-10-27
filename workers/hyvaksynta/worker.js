// Liiga Ennuste: GitHub-kirjautuminen ja OK-napin välitys (27.10.2026;
// docs/uutismalli_suunnitelma.md). Cloudflare Worker, ilmainen taso.
//
// Miksi välipalvelin: GitHub Pages on julkinen ja staattinen, eikä GitHub-
// kirjautumisen viimeistä vaihetta (client secret) voi tehdä selaimessa.
// Käyttäjä 27.10.: sivu toimii normaalisti, kirjautuminen vain uutisen kohdalla.
//
//   GET  /login?return=<sivu>  -> GitHubin kirjautuminen (ei oikeuksia, vain tunnistus)
//   GET  /callback             -> tunnus tarkistetaan (ALLOWED_LOGINS), selaimeen
//                                 30 päivän istunto (HMAC), takaisin sivulle #istunto=...
//   POST /absence              -> istunto tarkistetaan, absence.yml käynnistetään
//                                 palvelimen GitHub-avaimella (GITHUB_PAT, ei selaimessa)
//   GET  /me                   -> kuka on kirjautunut
//
// Salaisuudet (wrangler secret put): GITHUB_CLIENT_SECRET, GITHUB_PAT, SESSION_SECRET.

const enc = new TextEncoder();
const DAY = 86400;
const DURATION = /^(\d{1,2})(ott|vko|kk)$|^kausi$/;

function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));
}
async function hmac(secret, data) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data))));
}
async function sign(env, payload) {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  return `${body}.${await hmac(env.SESSION_SECRET, body)}`;
}
async function verify(env, token) {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig || (await hmac(env.SESSION_SECRET, body)) !== sig) return null;
  const p = JSON.parse(fromB64url(body));
  return p.exp > Date.now() / 1000 ? p : null;
}

const cors = (env) => ({
  "Access-Control-Allow-Origin": env.SITE_ORIGIN,
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Vary": "Origin",
});
const json = (env, status, data) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...cors(env) } });
const back = (url, hash) => Response.redirect(`${url.split("#")[0]}#${hash}`, 302);

async function login(req, env) {
  const ret = new URL(req.url).searchParams.get("return") || env.SITE_URL;
  if (!ret.startsWith(env.SITE_URL)) return new Response("tuntematon paluuosoite", { status: 400 });   // ei avointa uudelleenohjausta
  const state = await sign(env, { r: ret, exp: Date.now() / 1000 + 600 });
  const q = new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, redirect_uri: `${new URL(req.url).origin}/callback`,
    state, allow_signup: "false" });
  return Response.redirect(`https://github.com/login/oauth/authorize?${q}`, 302);
}

async function callback(req, env) {
  const p = new URL(req.url).searchParams;
  const st = await verify(env, p.get("state"));
  if (!st) return new Response("vanhentunut tai väärä kirjautuminen", { status: 400 });
  const tok = await (await fetch("https://github.com/login/oauth/access_token", {
    method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code: p.get("code") }),
  })).json();
  if (!tok.access_token) return back(st.r, "kirjautuminen=virhe");
  const user = await (await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${tok.access_token}`, "User-Agent": "liiga-hyvaksynta", Accept: "application/vnd.github+json" },
  })).json();
  const allowed = String(env.ALLOWED_LOGINS).toLowerCase().split(",").map((s) => s.trim());
  if (!user.login || !allowed.includes(user.login.toLowerCase())) return back(st.r, "kirjautuminen=ei-oikeutta");
  return back(st.r, `istunto=${await sign(env, { u: user.login, exp: Date.now() / 1000 + 30 * DAY })}`);
}

async function absence(req, env) {
  const s = await verify(env, (req.headers.get("Authorization") || "").replace(/^Bearer /, ""));
  if (!s) return json(env, 401, { error: "kirjaudu uudelleen" });
  let b;
  try { b = await req.json(); } catch { return json(env, 400, { error: "virheellinen pyyntö" }); }
  const str = (v, n = 300) => typeof v === "string" && v.length <= n;
  if (!str(b.url ?? "") || !str(b.player ?? "", 80) || !str(b.team ?? "", 40) || !["out", "back", "dismiss"].includes(b.kind)
      || (b.kind === "out" && !DURATION.test(String(b.duration)))) return json(env, 400, { error: "virheelliset tiedot" });
  // Lopullinen tarkistus (uutinen, rosteri, rajat) tehdään absence.yml:ssä (approve.py).
  const r = await fetch(`https://api.github.com/repos/${env.REPO}/actions/workflows/absence.yml/dispatches`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.GITHUB_PAT}`, Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "liiga-hyvaksynta" },
    body: JSON.stringify({ ref: "main", inputs: { url: b.url ?? "", player: b.player ?? "", team: b.team ?? "", kind: b.kind,
      duration: b.kind === "out" ? String(b.duration) : "1ott" } }),
  });
  return r.status === 204 ? new Response(null, { status: 204, headers: cors(env) }) : json(env, 502, { error: `GitHub ${r.status}` });
}

export default {
  async fetch(req, env) {
    const path = new URL(req.url).pathname;
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(env) });
    if (path === "/login") return login(req, env);
    if (path === "/callback") return callback(req, env);
    if (path === "/absence" && req.method === "POST") return absence(req, env);
    if (path === "/me") {
      const s = await verify(env, (req.headers.get("Authorization") || "").replace(/^Bearer /, ""));
      return s ? json(env, 200, { login: s.u }) : json(env, 401, { error: "ei kirjautunut" });
    }
    return new Response("Liiga Ennuste: hyväksyntä", { status: 404 });
  },
};
