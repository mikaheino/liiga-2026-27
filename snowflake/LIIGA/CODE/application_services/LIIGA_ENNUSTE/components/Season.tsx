// Kauden tilanne isona: kuinka paljon Liigaa on jäljellä. Käyttäjän toive 16.10.:
// yläpalkin etenemispalkki "voisi olla isompi".
export default function Season({ played, total, nextDate, nextGames }: {
  played: number; total: number; nextDate: string | null; nextGames: number;
}) {
  const left = total - played;
  const pct = total ? (100 * played) / total : 0;
  const rounds = Array.from({ length: 32 }, (_, i) => i);   // 32 x 17 ottelua = 544
  const done = Math.floor((played / total) * rounds.length);
  const day = nextDate
    ? new Intl.DateTimeFormat("fi-FI", { weekday: "long", day: "numeric", month: "numeric", timeZone: "Europe/Helsinki" }).format(new Date(`${nextDate}T12:00:00Z`))
    : null;
  return (
    <section className="season-hero" aria-label="Kauden tilanne">
      <div className="sh-main">
        <div className="eyebrow">Runkosarja 2026–27</div>
        <div className="sh-big">
          <span className="sh-num">{left}</span>
          <span className="sh-unit">ottelua<br />jäljellä</span>
        </div>
        <div className="sh-sub">{played} / {total} pelattu · {(100 - pct).toFixed(0)} % kaudesta edessä</div>
      </div>
      <div className="sh-track" aria-hidden>
        <div className="sh-bar"><i style={{ width: `${pct.toFixed(1)}%` }} /><span className="sh-now" style={{ left: `${pct.toFixed(1)}%` }} /></div>
        <div className="sh-ticks">{rounds.map((i) => <span key={i} className={i < done ? "on" : ""} />)}</div>
        <div className="sh-scale"><span>Syyskuu</span><span>Joulukuu</span><span>Maaliskuu</span></div>
      </div>
      {day && (
        <div className="sh-next">
          <div className="sh-next-k">Seuraava pelipäivä</div>
          <div className="sh-next-d">{day}</div>
          <div className="sh-next-s">{nextGames} ottelua</div>
        </div>
      )}
    </section>
  );
}
