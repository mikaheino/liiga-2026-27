// Näkyy heti linkin klikkauksen jälkeen, kunnes sivu on valmis: ilman tätä
// klikkaus näytti siltä ettei mitään tapahdu (16.10.).
export default function Loading() {
  return (
    <div className="loading" role="status" aria-live="polite">
      <div className="loading-rink"><b className="puck" /></div>
      <div className="loading-t">Ladataan<span className="blink">_</span></div>
    </div>
  );
}
