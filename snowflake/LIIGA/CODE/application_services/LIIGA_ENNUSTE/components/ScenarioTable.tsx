"use client";
// Skenaarion ennustettu lopputaulukko (13.11.2026). Omistaja lukitsi "KooKoo häviää kaikki kotiottelunsa"
// ja sai hakutuloslistan: "Tämä tulos ei kerro minulle suoraan mitään. Haluaisin mieluummin interaktiivisen
// näkymän, jossa näen vaikutuksen sarjataulukkoon samaan aikaan ... sarjataulukko on se mikä kiinnostaa."
// Sama komponentti on tulos sekä sanallisessa haussa että tarkassa näkymässä (ScenarioBoard luo sen kerran):
// kaikki 17 joukkuetta skenaarion sijan mukaan, vyöhykeviivat 6/10/14, sijan muutos muotona (▲2 ▼1 –),
// odotetut pisteet muutoksineen ja todennäköisyydet. Puhelimessa yksi todennäköisyyssarake kerrallaan
// (valitsin taulukon yllä), leveällä kaikki neljä. Ilman skenaariota näytetään nykyinen ennuste
// (pohja) ilman muutosmerkkejä, jotta ruutu ei ole koskaan tyhjä. Laskennan ajan edellinen taulukko
// pysyy näkyvissä himmennettynä. Logiikka: lib/scenarioTable.ts (testit tests/scenarioTable.test.ts).
import { Fragment, useLayoutEffect, useRef, useState } from "react";
import { logo } from "@/lib/table";
import { MEASURES, ZONES, defaultMeasure, moved, pctText, pointsText, ppText, rankMove, type Measure, type TRow } from "@/lib/scenarioTable";

const href = (team: string) => `/joukkue/${encodeURIComponent(team)}`;

export default function ScenarioTable({ rows, base, pending, focus = [], note }: {
  rows: TRow[]; base: boolean; pending: boolean; focus?: string[]; note?: string;
}) {
  // Puhelimen sarake: käyttäjän valinta pysyy, muuten eniten liikkuva (lib/scenarioTable.ts defaultMeasure).
  const [pick, setPick] = useState<Measure | null>(null);
  const m = pick ?? (base ? "top10" : defaultMeasure(rows, focus));
  const anyMoved = !base && rows.some(moved);

  // FLIP (13.11.2026): sijan vaihtuessa rivi liukuu vanhalta paikaltaan uudelle. 17 riviä, vain transform,
  // ei uudelleenasettelua animaation aikana. Ei piilossa (puhelimen Ottelut-välilehti) eikä vähennetyllä liikkeellä.
  const list = useRef<HTMLDivElement>(null);
  const prev = useRef<Map<string, number>>(new Map());
  const lastSig = useRef("");
  const sig = rows.map((r) => r.team).join("|");
  // Joka renderöinnillä (ei riippuvuuksia): paikat mitataan aina, jotta välilehdeltä palatessa vertailukohta on tuore;
  // liike animoidaan vain, kun järjestys vaihtui.
  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    const rowsEl = [...el.querySelectorAll<HTMLElement>("[data-team]")];
    const visible = el.offsetParent !== null;
    const calm = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const next = new Map(rowsEl.map((r) => [r.dataset.team!, r.offsetTop] as const));
    if (visible && !calm && prev.current.size && lastSig.current !== sig) {
      for (const r of rowsEl) {
        const was = prev.current.get(r.dataset.team!), now = next.get(r.dataset.team!)!;
        if (was == null || was === now) continue;
        r.style.transition = "none";
        r.style.transform = `translateY(${was - now}px)`;
        void r.offsetHeight; // pakotettu asettelu: lähtöpaikka voimaan ennen siirtymää
        r.style.transition = "transform .42s cubic-bezier(.2,.7,.2,1)";
        r.style.transform = "";
      }
    }
    prev.current = visible ? next : new Map();
    lastSig.current = sig;
  });

  return (
    <section className={`st m-${m} ${pending ? "upd" : ""}`} aria-label={base ? "Ennustettu lopputaulukko" : "Ennustettu lopputaulukko skenaariossa"}>
      <div className="st-head">
        <h2 className="st-h">{base ? "Ennustettu lopputaulukko" : "Ennustettu lopputaulukko skenaariossa"}</h2>
        <p className="st-note">{base
          ? "Nykyinen ennuste, ei vielä skenaariota. Lukitse ottelu, niin muutokset näkyvät tässä."
          : "Runkosarjan lopputilanne 10 000 simuloidulla kaudella. Muutokset verrattuna nykyiseen ennusteeseen."}</p>
        <p className="st-live" aria-live="polite">{pending ? "Lasketaan…" : ""}</p>
      </div>
      <div className="st-pick" role="radiogroup" aria-label="Näytettävä todennäköisyys">
        {MEASURES.map(([k, l]) => (
          <button key={k} type="button" role="radio" aria-checked={m === k} className={m === k ? "on" : ""} onClick={() => setPick(k)}>{l}</button>
        ))}
      </div>
      {note && <p className="st-note warn">{note}</p>}
      {!base && !anyMoved && rows.length > 0 && (
        <p className="st-note">Skenaario liikuttaa taulukkoa vain vähän: yksikään sija ei vaihdu, eikä mikään luku muutu yli 2 pistettä tai 3 prosenttiyksikköä.</p>
      )}
      <div className="st-t" role="table" aria-label="Sijoitus, joukkue, odotetut pisteet ja todennäköisyydet prosentteina">
        <div className="st-r st-th" role="row">
          <span role="columnheader" className="st-rk">Sija</span>
          <span role="columnheader" className="st-tm">Joukkue</span>
          <span role="columnheader" className="st-pts">Pisteet</span>
          {MEASURES.map(([k, l]) => <span key={k} role="columnheader" className={`st-p ${k}`}>{l} %</span>)}
        </div>
        <div ref={list} role="rowgroup" className="st-body">
          {rows.map((r, i) => {
            const z = ZONES.find((x) => x.from === i + 1);
            const mv = rankMove(r), pts = pointsText(r);
            const own = focus.includes(r.team), hot = !base && moved(r);
            return (
              <Fragment key={r.team}>
                {z && (
                  <div role="row" className={`st-z ${z.k}`} key={`z${z.k}`}>
                    <span role="cell">{z.from}.–{z.to}. {z.text}</span>
                  </div>
                )}
                <div role="row" data-team={r.team} className={`st-r ${hot ? "hot" : ""} ${own ? "own" : ""}`}>
                  <span role="cell" className="st-rk">
                    <b>{r.rank}.</b>
                    {mv.text && <i className={`st-mv ${mv.dir}`} aria-hidden>{mv.text}</i>}
                    {mv.say && <span className="st-sr">, {mv.say}</span>}
                  </span>
                  <span role="cell" className="st-tm">
                    <a href={href(r.team)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={logo(r.team)} alt="" width={20} height={20} />
                      <span>{r.team}</span>
                      {own && <span className="st-own" title="Skenaarion joukkue">◆<span className="st-sr"> skenaarion joukkue</span></span>}
                    </a>
                  </span>
                  <span role="cell" className="st-pts">
                    <b>{pts.value}</b>
                    {pts.delta && <small>{pts.delta}<span className="st-sr"> pistettä nykyennusteeseen</span></small>}
                  </span>
                  {MEASURES.map(([k, l]) => {
                    const d = ppText(r.pNow?.[k], r.p[k]);
                    return (
                      <span key={k} role="cell" className={`st-p ${k}`}>
                        <span className="st-sr">{l} </span><b>{pctText(r.p[k])}</b>
                        {d && <small>{d}</small>}
                      </span>
                    );
                  })}
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>
    </section>
  );
}
