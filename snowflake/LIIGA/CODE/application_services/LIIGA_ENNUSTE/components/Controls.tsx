"use client";
// Ohjaimet: ikkuna, korostetut joukkueet ja kytkimet. Jokainen valinta päivittää
// URL:n heti (router.replace), joten näkymä on aina jaettava linkki -- sama
// muoto jonka agentti antaa: ?joukkue=KooKoo,Jokerit&ikkuna=10&xg=1&kayra=0
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { logo } from "@/lib/table";

export default function Controls({ teams }: { teams: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();

  const window = sp.get("ikkuna") ?? "10";
  const picked = new Set((sp.get("joukkue") ?? "").split(",").filter(Boolean));
  const spark = sp.get("kayra") !== "0";
  const xg = sp.get("xg") === "1";

  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(sp.toString());
    if (value == null || value === "") next.delete(key);
    else next.set(key, value);
    start(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  };
  const toggleTeam = (t: string) => {
    const s = new Set(picked);
    s.has(t) ? s.delete(t) : s.add(t);
    set("joukkue", [...s].join(","));
  };

  return (
    <div className={`ctl ${pending ? "is-pending" : ""}`}>
      <div className="ctl-group">
        <div className="ctl-label">Muotoikkuna</div>
        <div className="seg" role="radiogroup" aria-label="Muotoikkuna">
          {["5", "10", "20"].map((n) => (
            <button key={n} role="radio" aria-checked={window === n} className={window === n ? "on" : ""}
              onClick={() => set("ikkuna", n === "10" ? null : n)}>{n}</button>
          ))}
        </div>
        <div className="ctl-hint">otteluita vireessä ja sijamuutoksessa</div>
      </div>

      <div className="ctl-group">
        <div className="ctl-label">
          Korosta joukkueet
          {picked.size > 0 && <button className="ctl-clear" onClick={() => set("joukkue", null)}>Tyhjennä</button>}
        </div>
        <div className="chips">
          {teams.map((t) => (
            <button key={t} className={`chip ${picked.has(t) ? "on" : ""}`} onClick={() => toggleTeam(t)} aria-pressed={picked.has(t)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo(t)} alt="" width={16} height={16} />
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="ctl-group">
        <label className="sw"><input type="checkbox" checked={spark} onChange={(e) => set("kayra", e.target.checked ? null : "0")} /><span />Muotokäyrä</label>
        <label className="sw"><input type="checkbox" checked={xg} onChange={(e) => set("xg", e.target.checked ? "1" : null)} /><span />xG-osuus</label>
      </div>
    </div>
  );
}
