# LIIGA.CODE-taskit

**Ajastus on control planessa (21.11.2026).** Snowflaken oma ketju `LIIGA_CHECK -> LIIGA_DAILY_RUN` korvattiin:

| ennen | nyt |
|---|---|
| `LIIGA_CHECK` (CRON 05:00, laskee hakematta olevat ottelut) | control planen workflow `liiga-daily`: `schedule = "05:00"`, `sensor` = sama kysely (0 -> ei ajoa, ei varastoa) |
| `LIIGA_DAILY_RUN` (`AFTER ... WHEN ... > 0`) | `LIIGA_DAILY_RUN` ilman ajastusta; control plane ajaa `EXECUTE TASK LIIGA.CODE.LIIGA_DAILY_RUN` |
| virhe näkyi vain TASK_HISTORYssa | `liiga-taskivirhe` (tunnin välein) diagnosoi Cortex Codella |

Politiikka: `/Users/mika.heino/prod/control_plane/policies/snowflake/liiga.toml`. Tila: `select * from CONTROL_PLANE.CORE.V_RUNS`.

Ehto on yhä "onko jokin ottelu alkanut yli 8 h sitten ja yhä hakematta" (itsekorjaava). Ajan muuttaminen =
`schedule` politiikassa; `grace_hours` pitää edelleen muuttaa sekä `src/liiga/results.py`:ssä että sensorin `DATEADD`:ssa.

Testiajo: `call CONTROL_PLANE.CORE.SUBMIT('manual', {}, 'liiga-daily')`.
