-- Juuritaski. Aja Python-konnektorilla yhtenä lauseena (ks. README.md):
-- Scripting-lohko ei kestä snow sql -f:n puolipistekatkontaa.

CREATE OR REPLACE TASK LIIGA.CODE.LIIGA_CHECK
  SCHEDULE = 'USING CRON 0 5 * * * Europe/Helsinki'
  -- 05:00, ei aiemmin: myohaisin ottelu alkaa 17:30 UTC (20:30 Suomen aikaa)
  -- ja 8 h:n grace tekee siita haettavan vasta 04:30, joten tassa on 30 min
  -- pelivaraa. Aiempi kellonaika vaatii grace_hours-arvon laskemisen
  -- (src/liiga/results.py JA taman tiedoston DATEADD), ei pelkkaa cronia.
  USER_TASK_TIMEOUT_MS = 60000
  COMMENT = 'Montako ottelua pelattu mutta hakematta; luku menee lapsitaskille.'
AS
DECLARE
  due INTEGER;
BEGIN
  -- Ehto ei ole "oliko eilen kierros" vaan "onko jokin ottelu alkanut yli
  -- 8 h sitten ja yhä hakematta". Sama asia normaalina päivänä, mutta
  -- itsekorjaava: väliin jäänyt tai epäonnistunut ajo napataan kiinni
  -- seuraavana aamuna sen sijaan että ottelu jäisi pysyvästi puuttumaan.
  SELECT COUNT(*) INTO :due
    FROM LIIGA.RAW.RAW_GAMES
   WHERE SEASON = (SELECT MAX(SEASON) FROM LIIGA.RAW.RAW_GAMES)
     AND NOT ENDED
     AND START_TIME <= TO_VARCHAR(
           CONVERT_TIMEZONE('UTC', DATEADD(hour, -8, CURRENT_TIMESTAMP())),
           'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  -- SYSTEM$SET_RETURN_VALUE vaatii vakion eikä hyväksy :due-muuttujaa, eikä
  -- sitä saa kutsua proseduurin sisältä ("function with side effects").
  -- Dynaaminen lause upottaa luvun literaalina ja kiertää molemmat.
  EXECUTE IMMEDIATE 'CALL SYSTEM$SET_RETURN_VALUE(''' || :due::STRING || ''')';
  RETURN :due;
END;
