-- LIIGA_DAILY_RUNin kohde: turnaus ja skeemat (code_bundles/LIIGA_DAILY/daily.py configure()).
-- Puuttui FUTURICEPARTNER-siirrosta 21.11.2026 (luotu aikanaan käsin), mikä kaatoi päivän ajon.
-- Julkaisu: LIIGA_ADMIN käsin, ajettavissa uudelleen.
USE ROLE LIIGA_ADMIN;

CREATE TABLE IF NOT EXISTS LIIGA.CODE.PIPELINE_SETTINGS (
    tournament   STRING,
    raw_schema   STRING,
    model_schema STRING
) COMMENT = 'Daily-putken kohde: turnaus ja skeemat (daily.py configure())';

INSERT INTO LIIGA.CODE.PIPELINE_SETTINGS
SELECT 'runkosarja', 'RAW', 'MODEL'
WHERE NOT EXISTS (SELECT 1 FROM LIIGA.CODE.PIPELINE_SETTINGS);
