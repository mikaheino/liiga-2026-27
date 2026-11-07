"use client";
// Avustajahahmo (7.11.2026, käyttäjä: "muuta kysy agentilta 1-1 clippyksi eli ei yläruutu vaan
// hoverointi" ja "AI:n pitäisi olla vielä ennustavampi"). Toimii kuten vanhat toimisto-ohjelmien
// avustajat: leijuu nurkassa ja ehdottaa itse, mutta hahmo on oma (kiekko silmineen), ei kopio.
//   - Jokaisella sivulla hahmo hakee ennakoivan vihjeen (/api/vihje): havainto datasta + kysymys,
//     jota käyttäjä todennäköisimmin kysyisi seuraavaksi. Kupla aukeaa hetken päästä.
//   - "Kysy tätä" avaa keskustelukuplan ja lähettää kysymyksen agentille (lib/chatBus.ts ask).
//   - Kuplassa pääkysymys ja kaksi muuta; mikään ei pakota: kupla väistyy itse tai napautuksesta
//     muualle. Hahmon napautus tuo kuplan takaisin, toinen napautus avaa keskustelun.
// Korvaa yläpalkin ja alavalikon "Kysy"-kohdat. Pelissä (/mouho) ei näy.
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { onChatState, openChat } from "@/lib/chatBus";

type Tip = { text: string | null; q?: string; more?: string[] };

export default function Kiekko() {
  const path = usePathname();
  const [tip, setTip] = useState<Tip | null>(null);
  const [show, setShow] = useState(false);
  const [chat, setChat] = useState(false);
  useEffect(() => onChatState(setChat), []);
  useEffect(() => {
    setShow(false); setTip(null);
    let live = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    fetch(`/api/vihje?path=${encodeURIComponent(path)}`, { cache: "no-store" }).then((r) => r.json())
      .then((t: Tip) => {
        if (!live || !t.text) return;
        setTip(t);
        // Ei pakkoa vastata (7.11.: "ei ole pakko hyväksyä tätä"): kupla tulee hetkeksi ja väistyy itse.
        timers.push(setTimeout(() => live && setShow(true), 1400), setTimeout(() => live && setShow(false), 16000));
      }).catch(() => {});
    return () => { live = false; timers.forEach(clearTimeout); };
  }, [path]);
  // Napautus muualle sulkee kuplan.
  useEffect(() => {
    if (!show) return;
    const h = (e: MouseEvent) => { if (!(e.target as HTMLElement)?.closest?.(".kk")) setShow(false); };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, [show]);
  if (path.startsWith("/mouho")) return null;
  return (
    <div className={`kk ${chat ? "chat" : ""}`}>
      {show && tip?.text && !chat && (
        <div className="kk-bubble" role="status">
          <p>{tip.text}</p>
          {[tip.q, ...(tip.more ?? [])].filter(Boolean).map((q) => (
            <button key={q} type="button" className="kk-q" onClick={() => { setShow(false); openChat({ ask: q! }); }}>{q}</button>
          ))}
        </div>
      )}
      <button type="button" className="kk-me" aria-label={chat ? "Sulje keskustelu" : "Kysy avustajalta"} aria-controls="chat" aria-expanded={chat}
        onClick={() => { if (tip?.text && !show && !chat) setShow(true); else { setShow(false); openChat({ toggle: true }); } }}>
        <svg viewBox="0 0 64 64" aria-hidden>
          <ellipse cx="32" cy="46" rx="22" ry="7" className="kk-shadow" />
          <ellipse cx="32" cy="38" rx="24" ry="10" className="kk-side" />
          <ellipse cx="32" cy="30" rx="24" ry="10" className="kk-top" />
          <path d="M14 22c3-6 9-8 12-6M50 22c-3-6-9-8-12-6" className="kk-brow" />
          <circle cx="23" cy="28" r="5" className="kk-eye" /><circle cx="41" cy="28" r="5" className="kk-eye" />
          <circle cx="25" cy="28" r="2.2" className="kk-pupil" /><circle cx="43" cy="28" r="2.2" className="kk-pupil" />
        </svg>
      </button>
    </div>
  );
}
