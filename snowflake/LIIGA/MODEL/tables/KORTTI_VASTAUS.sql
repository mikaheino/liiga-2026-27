-- Kohteeseen sidotut kysymykset (5.11.2026). Sovellus (LIIGA.CODE.LIIGA_ENNUSTE,
-- components/CardAgent.tsx, lib/kortti.ts) kirjoittaa tänne jokaisen ottelukortista
-- , joukkuesivulta, pelaajakortista tai pelaajasivulta (koko liiga) esitetyn kysymyksen ja agentin vastauksen. Vastaus on datarivi,
-- ei keskustelun vuoro: kohde (subject_type, subject_key), perusta forecast_ts
-- (PREDICTION_META.UPDATED_AT kysymyshetkellä) ja jälki (tools, sql_text, ms).
-- Uusi kohdetyyppi (esim. pelaaja) ei vaadi skeemamuutosta.
--
-- Luodaan deploy-app.yml:ssä julkaisuroolilla LIIGA_DEPLOYER, joka omistaa myös
-- sovelluspalvelun: palvelun sessiotoken saa siksi kirjoittaa tauluun ilman
-- erillisiä oikeuksia. Idempotentti -- ei koskaan CREATE OR REPLACE (rivit ovat
-- käyttäjän kysymyksiä eikä niitä voi luoda uudelleen).
CREATE TABLE IF NOT EXISTS LIIGA.MODEL.KORTTI_VASTAUS (
  id           STRING        NOT NULL COMMENT 'Rivin UUID',
  subject_type STRING        NOT NULL COMMENT 'game | team | player | season',
  subject_key  STRING        NOT NULL COMMENT 'game: <kausi>:<GAME_ID>, team: <kausi>:<joukkue>, player: <kausi>:<PLAYER_ID>, season: <kausi>:liiga',
  season       NUMBER        NOT NULL COMMENT 'Kausi (myös avaimessa; suodatusta varten)',
  question     STRING        NOT NULL COMMENT 'Kysymys sellaisenaan',
  answer       STRING                 COMMENT 'Agentin vastaus (markdown) tai virheilmoitus',
  suggestions  ARRAY                  COMMENT 'Agentin ehdottamat jatkokysymykset',
  tools        ARRAY                  COMMENT 'Agentin käyttämät työkalut (jälki)',
  sql_text     ARRAY                  COMMENT 'Cortex Analystin generoima SQL (jälki)',
  forecast_ts  STRING                 COMMENT 'Ennusteen aikaleima kysymyshetkellä; eroaa nykyisestä = VANHA PERUSTA',
  asked_at     TIMESTAMP_TZ  NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  answered_at  TIMESTAMP_TZ,
  ms           NUMBER                 COMMENT 'Vastausaika millisekunteina',
  status       STRING        NOT NULL COMMENT 'pending | done | error',
  source       STRING                 COMMENT 'snowflake = LIIGA_ENNUSTAJA, local = kehityskoneen Claude'
)
COMMENT = 'Liiga Ennuste: ottelukortista ja joukkuesivulta agentille esitetyt kysymykset ja vastaukset (CardAgent.tsx).';
