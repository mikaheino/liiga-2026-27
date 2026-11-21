-- Suoritin ilman omaa ajastusta (21.11.2026): control plane päättää, milloin ajetaan.
-- Politiikka: /Users/mika.heino/prod/control_plane/policies/snowflake/liiga.toml, workflow liiga-daily
-- (klo 05:00 Helsinki, sensori = pelattu mutta hakematta oleva ottelu, toiminto EXECUTE TASK tähän).
-- Entinen juuritaski LIIGA_CHECK on nyt control planen sensori; epäonnistuminen -> liiga-taskivirhe.
-- Omistaja LIIGA_ADMIN. Luonti Python-konnektorilla: control_plane/scripts/migrate/liiga.py tasks
CREATE OR REPLACE TASK LIIGA.CODE.LIIGA_DAILY_RUN
  WAREHOUSE = LIIGA_WH
  COMMENT = 'Koko putki (koodibundle). Käynnistää control plane (workflow liiga-daily).'
AS
  EXECUTE CODE BUNDLE LIIGA.CODE.LIIGA_DAILY_BUNDLE ENTRYPOINT = 'daily.py';
