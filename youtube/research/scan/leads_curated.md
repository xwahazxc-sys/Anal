# Лиды для управления правами: проверка 285 фильмов (ручная чистка топа)

Источник: scan/results.json → clean_scan.py → ручная проверка каждой копии в топе. Убраны трейлеры, обзоры, сиквелы
(считаются отдельно), чужие фильмы с похожим названием и каналы, похожие на официальных дистрибьюторов
(Air Bud en Español, Cineverse, Film&Clips, CiNENET, The Midnight Screening и т. п.).
«Каналов» — сколько разных каналов выложили полную копию: главный признак того, что фильм постоянно перезаливают.
Дат загрузки нет, поэтому «долго держится» оценено по накопленным просмотрам. Авторизована ли копия, подтверждает
только правообладатель; где канал может оказаться лицензиатом, стоит «?».

| # | Страна | Фильм | Каналов с копией | ≈ Просмотры копий | Крупнейшая копия |
|---|---|---|---|---|---|
| 1 | 🇧🇷 | Até que a Sorte nos Separe 1–2 (2012, 2014) | 6 | 24,5M | 21,7M |
| 2 | 🇲🇽 | Una Película de Huevos (2006) | 6 | 17,8M | 16,8M |
| 3 | 🇬🇧 | Green Street Hooligans (2005) | 20 | 15,4M | 5,0M |
| 4 | 🇲🇽 | Otra Película de Huevos y un Pollo (2009) | 7 | 14,8M | 14,8M |
| 5 | 🇺🇸 | Hachi: A Dog's Tale (2009), ES-дубляж | 6 | 11,1M | 10,8M |
| 6 | 🇧🇷 | Minha Mãe é uma Peça 1–2 (2013, 2016) | 16 | 8,9M | 3,8M |
| 7 | 🇺🇸 | A Walk to Remember (2002), PT/ES/EN | 22 | 8,0M | 2,9M |
| 8 | 🇨🇴 | La Vendedora de Rosas (1998) | 5 | 7,7M | 3,5M |
| 9 | 🇧🇷 | O Auto da Compadecida (2000) | 22 | 7,6M | 3,9M |
| 10 | 🇺🇸 | Heaven Is for Real (2014), ES/EN/PT | 7 | 7,6M | 3,8M |
| 11 | 🇲🇽 | Hasta el viento tiene miedo (1968) | 7 | 7,2M | 6,8M (?) |
| 12 | 🇺🇸 | Big Stan (2007), дубляжи | 5 | 7,0M | 5,6M (?) |
| 13 | 🇧🇷 | Tropa de Elite 2 (2010) | 7 | 6,5M | 6,0M |
| 14 | 🇺🇸 | War Room (2015), ES/PT | 4 | 6,0M | 5,4M |
| 15 | 🇧🇷 | Se Eu Fosse Você 1–2 (2006, 2009) | 8 | 5,7M | 3,8M |
| 16 | 🇧🇷 | Assalto ao Banco Central (2011) | 4 | 5,6M | 5,5M |
| 17 | 🇺🇸 | Eight Below (2006), ES/PT | 7 | 4,4M | 3,4M |
| 18 | 🇧🇷 | 2 Filhos de Francisco (2005) | 7 | 4,0M | 3,7M |
| 19 | 🇲🇽 | Qué culpa tiene el niño (2016) | 9 | 3,9M | 1,4M |
| 20 | 🇩🇪 | Der Untergang / Downfall (2004) | 22 | 3,3M | 0,9M |
| 21 | 🇧🇷 | Lisbela e o Prisioneiro (2003) | 6 | 3,0M | 2,8M |
| 22 | 🇲🇽 | La Leyenda de la Nahuala (2007) | 4 | 2,8M | 2,7M |
| 23 | 🇺🇸 | I Can Only Imagine (2018), ES/EN | 5 | 2,8M | 2,3M |
| 24 | 🇧🇷 | Meu Nome Não é Johnny (2008) | 4 | 2,7M | 2,0M |
| 25 | 🇧🇷 | Cidade de Deus (2002) | 5 | 2,7M | 1,6M |
| 26 | 🇺🇸 | Fireproof (2008), PT | 2 | 2,6M | 2,5M |
| 27 | 🇲🇽 | La jaula de oro (2013) | 1 | 2,2M | 2,2M |
| 28 | 🇦🇺 | Wyrmwood (2014) | 4 | 2,1M | 1,7M |
| 29 | 🇺🇸 | 12 Rounds (2009), EN/FR/ES/PT | 4 | 2,0M | 1,0M |
| 30 | 🇧🇷 | Carandiru (2003) | 1 | 2,0M | 2,0M |
| 31 | 🇺🇸 | Kickboxer: Vengeance (2016) | 4 | 1,8M | 0,9M |
| 32 | 🇺🇸 | The Ultimate Gift (2006), PT | 1 | 1,7M | 1,7M |
| 33 | 🇵🇪 | Asu Mare (2013) | 3 | 1,7M | 1,3M |
| 34 | 🇩🇪 | Die Welle (2008), PT/ES | 6 | 1,6M | 1,0M |
| 35 | 🇧🇷 | Turma da Mônica: Laços (2019) | 5 | 1,5M | 1,5M |
| 36 | 🇪🇸 | Contratiempo (2016), PT-дубляж | 6 | 1,5M | 1,2M |
| 37 | 🇧🇷 | Nosso Lar (2010) | 4 | 1,4M | 0,8M |
| 38 | 🇦🇷 | Aterrados (2017) | 12 | 1,2M | 0,7M |

Полный машинный список (229 фильмов, с каналами-перезаливщиками): leads.csv / leads.json.
