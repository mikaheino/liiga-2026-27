-- Kuratoitujen taulujen ja pelaajamallin sormenjäljet (22.11.2026, src/liiga/curated.py).
-- daily.py luo taulun itse (CREATE TABLE IF NOT EXISTS); tämä tiedosto kuvaa sen.
-- Uudelleenlataus seuraavassa ajossa: UPDATE ... SET fingerprint = 'force' WHERE name = '<taulu>'.
-- Rivi __initialized__ (23.11.2026): ennen sitä puuttuva rivi omaksutaan vain, jos taulun sisältö = tiedosto
-- (muuten poikkeama PIPELINE_CHECKSiin ja lataus); sen jälkeen puuttuva rivi tarkoittaa aina latausta.
USE ROLE LIIGA_ADMIN;

CREATE TABLE IF NOT EXISTS LIIGA.CODE.PIPELINE_STATE (
    name        VARCHAR,     -- taulu tai 'player_rates' (pelaajamalli)
    fingerprint VARCHAR,     -- sha256 syötetiedostoista
    updated_at  VARCHAR,     -- ISO 8601 UTC
    note        VARCHAR      -- adopted / loaded N / rivimäärät
);
