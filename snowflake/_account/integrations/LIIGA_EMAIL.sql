-- Aamutiedotteen sähköposti (SEND_MORNING_BRIEF_<sha>). Vain sallitut
-- vastaanottajat; SYSTEM$SEND_EMAIL lähettää vain tilin käyttäjien VAHVISTETTUIHIN
-- osoitteisiin (DESC USER näyttää osoitteen).
--
-- Aja ACCOUNTADMINina: snow sql -c CONTAINER_SERVICES --role ACCOUNTADMIN -f snowflake/_account/integrations/LIIGA_EMAIL.sql
-- Idempotentti. Koko tilin järjestys: snowflake/_account/README.md.

USE ROLE ACCOUNTADMIN;

CREATE NOTIFICATION INTEGRATION IF NOT EXISTS LIIGA_EMAIL
  TYPE = EMAIL
  ENABLED = TRUE
  ALLOWED_RECIPIENTS = ('mika.heino@recordlydata.com')
  COMMENT = 'Liiga Ennustaja: aamutiedote. Vain sallitut vastaanottajat.';

-- SYSTEM$SEND_EMAIL lähettää vain tilin käyttäjien VAHVISTETTUIHIN osoitteisiin.
DESC USER MHEINO;
