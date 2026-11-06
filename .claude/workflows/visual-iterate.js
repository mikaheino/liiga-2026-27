export const meta = {
  name: 'visual-iterate',
  description: 'Paranna visuaalista tuotosta (GIF, kuva, dia, sivu): ideoijat -> tuomari -> rakentaja työpuussa -> kriitikko <-> korjaaja',
  whenToUse: 'Kun käyttäjä sanoo animaatiota, kuvaa tai visualisointia tylsäksi ja haluaa agenttien iteroivan. Pohjana Liiga-heatmap-GIF (7.11.2026).',
  phases: [
    { title: 'Ideointi', detail: 'suunnat rinnakkain' },
    { title: 'Valinta', detail: 'tuomari yhdistää' },
    { title: 'Rakennus', detail: 'toteutus työpuussa' },
    { title: 'Kritiikki', detail: 'ruudut katsotaan' },
    { title: 'Korjaus', detail: 'kriitikon korjaukset' },
  ],
}

/*
TEMPLATE. Args (vain goal, current ja out ovat pakollisia):
{
  goal:        'Mitä tehdään ja käyttäjän palaute sanatarkasti',
  current:     '/polku/nykyiseen/tuotokseen.gif',   // katsotaan ruutuina
  out:         '/scratchpad/polku',                 // tulokset: <out>/wf/v1.gif, v2.gif ...
  files:       ['scripts/local/heatmap_gif.py'],    // repo-suhteelliset lähteet, jotka kaikkien pitää lukea
  constraints: 'lisärajat (koko, ruutumäärä, formaatti)',
  directions:  [{ key: 'tv', angle: '...' }, ...],  // oletus: TV-grafiikka / peli / elokuvamainen tarina
  brief:       '...' tai 'file:/polku/judge.json',  // jos annettu: ideointi+valinta ohitetaan
  rounds:      1,                                   // kriitikko+korjaaja -kierrokset (1-3)
  name:        'v',                                 // tuotosten nimen etuliite
}
*/

const A = args || {}
const REPO = A.repo || '/Users/mika.heino/prod/liiga_2026-27'
const PY = A.py || `${REPO}/.venv/bin/python`
const OUT = `${A.out}/wf`
const NAME = A.name || 'v'
const ROUNDS = Math.max(1, Math.min(3, A.rounds || 1))
const FILES = (A.files || []).map(f => (f.startsWith('/') ? f : `${REPO}/${f}`))

const CONTEXT = `
TAVOITE: ${A.goal}

Lue lähteet: ${FILES.join(', ') || '(ei annettu, etsi itse tuotoksen tekevä skripti)'}
Nykyinen tuotos: ${A.current}. GIFin ruudun saa purettua näin: ${PY} -c "from PIL import Image; im=Image.open('GIF'); im.seek(N); im.convert('RGB').save('PNG')", minkä jälkeen PNG katsotaan Read-työkalulla.

RAJAT:
${A.constraints || 'Säilytä nykyisen tuotoksen koko ja formaatti.'}
- Käytä Pythonia ${PY}. Älä asenna uusia paketteja, älä käytä ulkoisia binäärejä äläkä verkkoa tai selainta.
- Kaikkien lukujen on tultava datasta. Kuvissa vain olemassa olevaa materiaalia, ja tekijätiedot näkyvät.
- Tyylikeinot ja genre ovat sallittuja, mutta mitään olemassa olevaa peliä, brändiä tai teosta ei kopioida.
- Älä commitoi, älä pushaa äläkä muokkaa pääkopiota (${REPO}). Rakentaja muokkaa vain omaa työpuutaan.
- Kirjoita tekstit suomeksi. Väliaikaiset tiedostot: ${OUT}.`

const DIRS = A.directions || [
  { key: 'tv', angle: 'TV-urheilugrafiikka: lähetyksen grafiikkapaketti, liukuvat alapalkit, studion rytmi, liike ohjaa katsetta.' },
  { key: 'game', angle: 'Pelimäisyys: toimintaa ja liikettä ruudulla, efektejä ja omaa sprite-tyylistä grafiikkaa, ei minkään olemassa olevan pelin kopiota.' },
  { key: 'story', angle: 'Elokuvamainen datatarina: muutama draama, lähikuvat, kontrasti, iso typografia ja loppuhuipennus. Data on näyttämö, ei pääosa.' },
]

const CONCEPT = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    diagnosis: { type: 'string', description: 'Mikä nykyisessä ei toimi: konkreettiset havainnot ruuduista' },
    concept: { type: 'string' },
    storyboard: { type: 'array', items: { type: 'string' } },
    techniques: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
  },
  required: ['name', 'diagnosis', 'concept', 'storyboard', 'techniques', 'risks'],
}
const JUDGE = {
  type: 'object',
  properties: {
    winner: { type: 'string' },
    scores: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, score: { type: 'number' }, why: { type: 'string' } }, required: ['name', 'score', 'why'] } },
    brief: { type: 'string', description: 'Rakentajalle täsmällinen kuvakäsikirjoitus ja tekniikka' },
  },
  required: ['winner', 'scores', 'brief'],
}
const BUILD = {
  type: 'object',
  properties: {
    output: { type: 'string' }, sheet: { type: 'string', description: 'koostekuva 6-9 ruudusta' },
    size_mb: { type: 'number' }, frames: { type: 'number' }, seconds: { type: 'number' },
    worktree: { type: 'string' }, files: { type: 'array', items: { type: 'string' } },
    data_log: { type: 'string', description: 'datasta lasketut keskeiset luvut ja valinnat' },
    summary: { type: 'string' },
  },
  required: ['output', 'sheet', 'size_mb', 'frames', 'seconds', 'worktree', 'files', 'data_log', 'summary'],
}
const REVIEW = {
  type: 'object',
  properties: {
    boring_still: { type: 'boolean' },
    score: { type: 'number', description: '1-10 kiinnostavuus' },
    issues: { type: 'array', items: { type: 'string' } },
    must_fix: { type: 'array', items: { type: 'string' }, description: 'enintään 5, tärkein ensin' },
  },
  required: ['boring_still', 'score', 'issues', 'must_fix'],
}

// --- Ideointi + valinta (ohitetaan, jos brief annettu) ---
let judged = null
let concepts = []
let BRIEF
if (A.brief) {
  BRIEF = A.brief.startsWith('file:')
    ? `LUE KOKO BRIEF ENSIN tiedostosta ${A.brief.slice(5)} (kenttä "brief"). Noudata sitä tarkasti.`
    : A.brief
  log('brief annettu: ideointi ja valinta ohitetaan')
} else {
  phase('Ideointi')
  concepts = (await parallel(DIRS.map(d => () => agent(
    `${CONTEXT}\n\nSINUN SUUNTASI: ${d.angle}\n\nKatso ensin vähintään 8 ruutua nykyisestä tuotoksesta ja kirjaa konkreettisesti, mikä siinä ei toimi. Ehdota sitten oma suuntasi täsmällisenä kuvakäsikirjoituksena (kohtaukset ja kestot) ja tekniikkana, joka pysyy rajoissa. Ole rohkea, mutta pidä ehdotus toteutettavana yhdellä rakennuskierroksella. Älä kirjoita koodia repoon.`,
    { label: `idea:${d.key}`, phase: 'Ideointi', schema: CONCEPT },
  )))).filter(Boolean)
  log(`ideoita ${concepts.length}/${DIRS.length}`)

  phase('Valinta')
  judged = await agent(
    `${CONTEXT}\n\nEhdotukset:\n${JSON.stringify(concepts, null, 1)}\n\nPisteytä jokainen ehdotus asteikolla 1-10 näillä perusteilla: (1) kiinnostavuus syötteessä ensimmäisten 3 sekunnin aikana ja koko matkan, (2) datan rehellisyys ja luettavuus, (3) toteutettavuus rajoissa ja (4) sopivuus tekijän toiveisiin. Valitse voittaja. Kirjoita rakentajalle yksi täsmällinen brief, johon yhdistät muilta ehdotuksilta enintään kaksi parasta siirtoa. Jos siirrot ovat ristiriidassa, valitse yksinkertaisempi.`,
    { label: 'tuomari', phase: 'Valinta', schema: JUDGE },
  )
  BRIEF = judged.brief
}

const buildRules = (n) => `Tee työ omassa git-työpuussasi. Jos sen lähdetiedostot ovat vanhempia kuin pääkopion (${REPO}), kopioi ensin pääkopion versiot sinne. Kirjoita tuotos tiedostoon ${OUT}/${NAME}${n}.<pääte> ja tee koostekuva 6-9 ruudusta tiedostoon ${OUT}/${NAME}${n}_sheet.png. Katso kooste ja yksittäisiä ruutuja Read-työkalulla ja korjaa ilmeiset viat ennen kuin palautat työn. Tarkista rajat (koko ja ruutumäärä). Aja ${REPO}/.venv/bin/ruff check muokatuille .py-tiedostoille. Älä commitoi.`

// --- Rakennus ---
phase('Rakennus')
let built = await agent(
  `${CONTEXT}\n\nBRIEF:\n${BRIEF}\n\n${buildRules(1)}`,
  { label: 'rakentaja', phase: 'Rakennus', schema: BUILD, isolation: 'worktree' },
)
if (!built) return { error: 'rakentaja ei palauttanut tulosta', judged, concepts }

// --- Kritiikki <-> korjaus ---
const reviews = []
for (let r = 1; r <= ROUNDS; r++) {
  phase('Kritiikki')
  const review = await agent(
    `${CONTEXT}\n\nBrief: ${BRIEF}\n\nTuotos: ${built.output} (${built.size_mb} Mt, ${built.frames} ruutua, ${built.seconds} s). Koostekuva: ${built.sheet}. Datan luvut: ${built.data_log}\n\nArvioi ankarasti, kuin selaisit LinkedIniä puhelimella. Pura ja katso itse vähintään 12 ruutua eri kohdista ja erityisesti alku (0-5 s). Vastaa näihin: Onko tuotos yhä tylsä? Onko teksti luettavissa 390 px leveydellä? Onko dataa vääristetty? Tarkista itse muutama luku datasta. Pysyykö tuotos rajoissa? Anna enintään 5 must_fix-kohtaa tärkeysjärjestyksessä. Älä muokkaa tiedostoja.`,
    { label: `kriitikko ${r}`, phase: 'Kritiikki', schema: REVIEW },
  )
  if (!review) break
  reviews.push(review)
  log(`kierros ${r}: pisteet ${review.score}/10, tylsä=${review.boring_still}`)
  if (!review.must_fix.length || (review.score >= 9 && !review.boring_still)) break

  phase('Korjaus')
  const fixed = await agent(
    `${CONTEXT}\n\nJatkat toisen rakentajan työtä työpuussa ${built.worktree}. Siirry sinne, äläkä tee uutta työpuuta. Edellinen tulos: ${JSON.stringify(built)}\n\nBrief: ${BRIEF}\n\nKriitikon korjattavat kohdat. Tee kaikki, tärkein ensin:\n${review.must_fix.map((x, i) => `${i + 1}. ${x}`).join('\n')}\n\nMuut havainnot: ${review.issues.join(' | ')}\n\n${buildRules(r + 1)}`,
    { label: `korjaaja ${r}`, phase: 'Korjaus', schema: BUILD },
  )
  if (!fixed) break
  built = fixed
}

return {
  concepts: concepts.map(c => ({ name: c.name, diagnosis: c.diagnosis, concept: c.concept })),
  judged,
  final: built,
  reviews,
}
