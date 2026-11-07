-- Päävalmentajien vaihdot (käsin ylläpidetty data/coaching_changes.csv, synkka vie RAW-skeemaan).
-- MODEL-näkymänä 7.11.2026: sovelluksen rooli LIIGA_APP näkee vain MODELin, ja etusivun haku
-- (lib/scenarioDescribe.ts coachingEvidence) antaa agentille tämän kauden vaihdot näytöksi, kun
-- käyttäjä kysyy valmentajanvaihdosta ("KAIKKI PITÄÄ TOIMIA SNOWFLAKE").
CREATE OR REPLACE VIEW LIIGA.MODEL.V_COACHING_CHANGES
  COMMENT = 'Päävalmentajien vaihdot kausittain (season, team, change_date, coach_out, coach_in).'
AS
SELECT season, team, change_date, coach_out, coach_in
FROM LIIGA.RAW.COACHING_CHANGES;
