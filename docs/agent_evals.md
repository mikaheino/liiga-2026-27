# Agentin evaluoinnit

*Kirjoittaa `scripts/agent_eval.py`. Append-only.*

Mittarit: oikeellisuus (answer_correctness v3), oikea työkalu = osuus
kysymyksistä joissa valittiin oikea työkalu (laatuportti), työkalu (raaka) =
tool_selection_accuracy, joka laskee mallin latauksen ja kyselyn kahdeksi
kutsuksi (tehokkuus, ei porttia), suomi = oma mittari, johdonmukaisuus
(logical_consistency v3). Laatuportti: `agent_eval.GATE`.

Ajot 16.10. ennen uutta porttia: 1229 = tuotannon perustaso (VERSION$2),
1238 = ohjeluonnos joka kieltäytyi pudotuspelikysymyksestä (vanha portti
hylkäsi), 1245/1323 = korjatut ohjeet, 1031 = ensimmäinen GitHub-ajo (vanha
portti hylkäsi raa'an työkalumittarin 0,94 takia).

| ajo | agentti | versio | n | oikeellisuus | oikea työkalu | työkalu (raaka) | suomi | johdonmukaisuus | virheet | heikot (< 0,67) |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| 20261016_1229 | LIIGA_ENNUSTAJA | PRODUCTION | 25 | 0.97 | 1.00 | 1.00 | 0.98 | 0.87 | 0 | Kuka voittaa Liigan mestaruuden pudotuspeleissä?; Miten tämän päivän pelit päättyvät? |
| 20261016_1238 | LIIGA_ENNUSTAJA_DEV | LIVE | 25 | 0.93 | 0.92 | 0.90 | 1.00 | 0.88 | 0 | Kuka voittaa Liigan mestaruuden pudotuspeleissä?; Millä todennäköisyydellä JYP pääsee kuuden joukkoon?; Tee illan peleistä HTML-sivu |
| 20261016_1245 | LIIGA_ENNUSTAJA_DEV | LIVE | 25 | 0.96 | 1.00 | 0.98 | 1.00 | 0.89 | 0 | Kuka voittaa Liigan mestaruuden pudotuspeleissä? |
| 20261016_1323 | LIIGA_ENNUSTAJA_DEV | LIVE | 25 | 0.95 | 1.00 | 0.98 | 1.00 | 0.87 | 0 | Kuka voittaa Liigan mestaruuden pudotuspeleissä?; Onko KooKoon huono alku ollut huonoa tuuria? |
| 20261016_1031 (GitHub) | LIIGA_ENNUSTAJA_DEV | LIVE | 25 | 0.95 | 1.00 | 0.94 | 1.00 | 0.87 | 0 | Kuka voittaa Liigan mestaruuden pudotuspeleissä?; Mikä on liigan ylivoimaprosentti tällä kaudella?; Onko KooKoon huono alku ollut huonoa tuuria? |
| 20261016_1523 | LIIGA_ENNUSTAJA | DEV | 30 | 0.97 | 1.00 | 1.00 | 0.97 | 0.89 | 0 | Mikä joukkue on kerännyt eniten pisteitä kotiotteluista? |
