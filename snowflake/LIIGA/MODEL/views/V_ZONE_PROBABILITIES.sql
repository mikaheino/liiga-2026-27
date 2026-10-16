-- Ennusteen sijavyöhykkeet (ENNUSTAJA_SV). 1.-6. suoraan puolivälieriin,
-- 7.-10. karsintaan, 15.-17. putoaa B-sarjaan (uutta 2026-27).
CREATE OR REPLACE VIEW LIIGA.MODEL.V_ZONE_PROBABILITIES
  COMMENT = 'Ennusteen todennäköisyys kullekin sarjavyöhykkeelle 10 000 simulaatiosta.'
AS
SELECT team,
       rank_1 AS p_regular_season_win,
       rank_1 + rank_2 + rank_3 + rank_4 + rank_5 + rank_6 AS p_top6_quarterfinal,
       rank_7 + rank_8 + rank_9 + rank_10 AS p_7_10_playoff_qualifier,
       rank_1 + rank_2 + rank_3 + rank_4 + rank_5 + rank_6
         + rank_7 + rank_8 + rank_9 + rank_10 AS p_playoffs_any,
       rank_11 + rank_12 + rank_13 + rank_14 AS p_11_14_out,
       rank_15 + rank_16 + rank_17 AS p_relegation_15_17
FROM LIIGA.MODEL.POSITION_DISTRIBUTION_2026_27;


