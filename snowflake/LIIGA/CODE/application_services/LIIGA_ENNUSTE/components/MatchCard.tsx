"use client";
// Ottelukortti (27.10., korttiteema): kierroksen ottelun napautus avaa ottelun koko
// tiedon omana korttinaan; pyyhkäisy oikealle tai Takaisin sulkee. Sisältö: virallinen
// ennuste ja haastaja, huomiot (maalivahdit, poissaolot), vire, keskinäiset ja uutiset.
import Link from "next/link";
import { useEffect, useState } from "react";
import SwipeBack from "@/components/SwipeBack";
import { fi, logo } from "@/lib/table";

export type MatchDetail = {
  when: string; home: string; away: string; pHome: number | null; pOt: number | null;
  ch: { pHome: number; notes: string } | null;
  form: Record<string, string[]>;                       // joukkue -> viimeiset tulokset (V/JV/JH/H)
  h2h: { date: string; text: string }[];
  news: { team: string; title: string; url: string; date: string }[];
};

const pct = (p: number) => `${fi(100 * p, 0)} %`;

// Haastajan huomio ihmisen kielelle (käyttäjä 29.10.: "miksi haastaja eroaa").
// challenger.py kirjoittaa maalivahdin muodossa "MV Sukunimi +0.05" = torjutut maalit
// ottelua kohden verrattuna joukkueen kauden aiempiin aloittajiin.
function why(note: string): string {
  const m = note.match(/^MV (.+) ([+-]\d+(?:\.\d+)?)$/);
  if (!m) return note;
  const d = Number(m[2]);
  if (Math.abs(d) < 0.005) return `Aloittava maalivahti ${m[1]}: sama taso kuin joukkueen aiemmat aloittajat`;
  return `Aloittava maalivahti ${m[1]}: ${d > 0 ? "parempi" : "heikompi"} kuin joukkueen aiemmat aloittajat (${d > 0 ? "−" : "+"}${fi(Math.abs(d), 2)} päästettyä maalia / ottelu)`;
}

function Sheet({ d, onClose }: { d: MatchDetail; onClose: () => void }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", esc); };
  }, [onClose]);
  const h = d.pHome;
  return (
    <div className="mc-wrap" role="dialog" aria-modal="true" aria-label={`${d.home} – ${d.away}`}>
      <SwipeBack onBack={onClose} className="mc">
        <button className="crumb mc-back" onClick={onClose}>◀ Takaisin</button>
        <div className="mc-when">{d.when}</div>
        <div className="mc-teams">
          {[d.home, d.away].map((t, i) => (
            <Link key={t} href={`/joukkue/${encodeURIComponent(t)}`} className="mc-team">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo(t)} alt="" width={56} height={56} />
              <b>{t}</b>
              {h != null && <span className="mc-p">{pct(i === 0 ? h : 1 - h)}</span>}
            </Link>
          ))}
        </div>
        {h != null && (
          <div className="nr-bar mc-bar"><i className={h >= 0.5 ? "fav" : ""} style={{ width: `${100 * h}%` }} /><i className={h < 0.5 ? "fav" : ""} style={{ width: `${100 * (1 - h)}%` }} /></div>
        )}
        {d.pOt != null && <div className="mc-ot">Jatkoaika {pct(d.pOt)}</div>}
        {d.ch && (
          <div className="mc-box">
            <div className="label">Haastaja</div>
            <b>{d.home} {pct(d.ch.pHome)} – {pct(1 - d.ch.pHome)} {d.away}</b>
            {h != null && <div className="mc-ot">Virallinen {pct(h)} → haastaja {pct(d.ch.pHome)} ({d.home})</div>}
            {d.ch.notes ? (<>
              <div className="label sub">Miksi eroaa</div>
              <ul className="mc-why">{d.ch.notes.split("; ").map((n) => <li key={n}>{why(n)}</li>)}</ul>
            </>) : <p className="dim">Haastaja ei kirjannut syytä tälle ottelulle.</p>}
          </div>
        )}
        <div className="mc-box">
          <div className="label">Vire (viimeiset 5)</div>
          {[d.home, d.away].map((t) => (
            <div key={t} className="mc-form"><span>{t}</span>
              <span className="form">{(d.form[t] ?? []).map((r, i) => (
                <i key={i} className={`res ${r === "V" ? "res-w" : r === "JV" ? "res-otw" : r === "JH" ? "res-otl" : "res-l"}`}>{r === "JV" ? "J" : r === "JH" ? "H" : r}</i>
              ))}</span>
            </div>
          ))}
        </div>
        {d.h2h.length > 0 && (
          <div className="mc-box">
            <div className="label">Keskinäiset tällä kaudella</div>
            {d.h2h.map((g) => <div key={g.date} className="mc-h2h"><span>{g.date}</span><b>{g.text}</b></div>)}
          </div>
        )}
        {d.news.length > 0 && (
          <div className="mc-box">
            <div className="label">Uutiset</div>
            {d.news.map((n) => (
              <a key={n.url} className="mc-news" href={n.url} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logo(n.team)} alt="" width={14} height={14} /> {n.date} {n.title} ↗
              </a>
            ))}
          </div>
        )}
        <div className="mc-hint">Pyyhkäise oikealle palataksesi</div>
      </SwipeBack>
    </div>
  );
}

export default function MatchTap({ d, children }: { d: MatchDetail; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="mc-tap" onClick={() => setOpen(true)} aria-label={`${d.home} – ${d.away}: lisätiedot`}>{children}</button>
      {open && <Sheet d={d} onClose={() => setOpen(false)} />}
    </>
  );
}
