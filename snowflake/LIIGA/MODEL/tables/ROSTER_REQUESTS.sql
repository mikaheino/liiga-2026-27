-- Rosterijono (7.11.2026): etusivun haku kirjaa pelaajan, jota mallissa (PLAYER_RATES) ei ole.
-- Paikallisesti sama jono on data/roster_requests.csv; Snowflakessa sovellus ei kirjoita repoon, joten
-- se kirjoittaa tänne. scripts/local/roster_queue.py lukee molemmat ja ohjaa standardipolulle
-- (docs/claude/roster.md vaiheet 1-9). Sovellus ei koskaan muuta mallin rosteria.
-- Luodaan deploy-app.yml:ssä julkaisuroolilla (omistaa myös sovelluspalvelun). Idempotentti.
CREATE TABLE IF NOT EXISTS LIIGA.MODEL.ROSTER_REQUESTS (
  requested_at TIMESTAMP_TZ NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  player       STRING       NOT NULL COMMENT 'Nimi haussa (Etunimi Sukunimi)',
  team         STRING                COMMENT 'Joukkue uutissignaalista tai hausta',
  source       STRING                COMMENT 'Haku, josta tunnistettiin (enintään 120 merkkiä)',
  status       STRING       NOT NULL DEFAULT 'pending' COMMENT 'pending | done | dismissed'
)
COMMENT = 'Liiga Ennuste: sovelluksen tunnistamat uudet pelaajat standardipolkua varten (roster_queue.py).';
