// Palvelimen käynnistys (8.11.2026, käyttäjä: "miksi ladata joka app käynnistyksellä uusiksi -> hidastaa").
// Qwen-malli (lib/qwen.ts) on kuvassa valmiina; käynnistyksessä se vain luetaan muistiin. Ennen se
// tapahtui ensimmäisen kysymyksen kohdalla; nyt taustalla heti käynnistyksen jälkeen, joten sivu
// ei odota eikä ensimmäinen kysymys maksa latausaikaa.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PUBLIC_LIIGA_STATIC === "1") return;
  setTimeout(() => { import("./lib/qwen").then((m) => m.warm()).catch(() => {}); }, 3000);
}
