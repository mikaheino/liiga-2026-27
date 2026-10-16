"use client";
// Jaettavat PDF:t. Diat renderöidään kerran per ennuste (export_linkedin.py),
// ja ne ladataan PDF:nä, koska LinkedIn-karuselli on PDF.
import { useCallback, useEffect, useState } from "react";
import { stamp as fmt } from "@/components/Top";

type Asset = { key: string; title: string; description: string; pages: string[]; pdf: string | null; error: string };
type State = { unavailable?: string; stamp?: string; dir?: string; manifest?: { assets: Asset[] } | null; running?: boolean; log?: string; error?: string };

export default function LinkedinPanel() {
  const [s, setS] = useState<State | null>(null);
  const refresh = useCallback(async () => setS(await (await fetch("/api/linkedin", { cache: "no-store" })).json()), []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!s?.running) return;
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [s?.running, refresh]);
  const start = async () => { await fetch("/api/linkedin", { method: "POST" }); refresh(); };

  if (!s) return <div className="li-empty">…</div>;
  if (s.unavailable) return <div className="li-empty">{s.unavailable}</div>;
  const file = (n: string) => `/api/linkedin/file/${n}?v=${s.dir}`;
  const assets = s.manifest?.assets ?? [];
  const done = (s.log ?? "").split("\n").filter((l) => /diaa/.test(l)).length;

  return (
    <>
      <div className="li-head">
        <div>
          <div className="label">Jaettavat</div>
          <div className="li-stamp">{s.stamp ? `Ennuste ${fmt(s.stamp)}` : ""}</div>
        </div>
        {(!s.manifest || s.running) && (
          <button className="btn" onClick={start} disabled={s.running}>
            {s.running ? `Renderöidään… ${done}/7` : "Renderöi diat"}
          </button>
        )}
      </div>
      {s.running && <div className="li-progress"><i style={{ width: `${(100 * done) / 7}%` }} /></div>}
      {s.error && <div className="li-empty">{s.error}</div>}
      {!s.manifest && !s.running && <div className="li-empty">Tämän ennusteen diat on vielä renderöimättä. Kestää noin puoli minuuttia.</div>}
      <div className="assets">
        {assets.map((a, i) => (
          <article key={a.key} className="asset" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="asset-top">
              <div>
                <h3>{a.title}</h3>
                <p>{a.description}</p>
              </div>
              {a.pdf
                ? <a className="btn" href={file(a.pdf)} download>PDF · {a.pages.length}</a>
                : <span className="dim">{a.error}</span>}
            </div>
            <div className="strip">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {a.pages.map((p) => <img key={p} src={file(p)} alt="" loading="lazy" width={216} height={270} />)}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
