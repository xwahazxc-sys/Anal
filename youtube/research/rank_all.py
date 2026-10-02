#!/usr/bin/env python3
"""rank_all.py - one ranking of every no-upload twin film by expected revenue per film.

Expected $ = median views of hour-plus films in that genre and channel language (search top-40, measured)
x RPM for that language and genre (ESTIMATE). It is what a film earns IF it reaches the search top,
not a forecast for a new channel. Writes full/ranking_all.md and full/ranking_all.csv.
"""
import csv, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
F = os.path.join(HERE, "full")
med = {}
for s in json.load(open(os.path.join(F, "summary.json")))["summary"]:
    med[(s["lang"], s["genre"])] = s["median_views_long"]
for g, v in json.load(open(os.path.join(F, "de_hits.json"))).items():
    med[("de", g)] = v["median_views"]
for l, gs in json.load(open(os.path.join(F, "lang_hits.json"))).items():
    for g, v in gs.items():
        med[(l, g)] = v["median_views"]
BASE = {"en": 3.83, "es": 1.34, "pt": 0.95, "ja": 3.10, "de": 3.9, "fr": 2.5, "nl": 3.8, "sv": 4.0, "da": 4.5}
MULT = {"family": 1.15, "faith": 1.1, "horror": .85, "crime": .85, "thriller": .9, "action": .9}

FILMS = [  # country, film, channel language, genre key in the measured data
 ("DE","Ich seh, ich seh (2014)","de","horror"),("DE","Hagazussa (2017)","de","horror"),("DE","Der Nachtmahr (2015)","de","horror"),
 ("DE","Abgeschnitten (2018)","de","thriller"),("DE","Nur Gott kann mich richten (2017)","de","crime"),("DE","SMS für Dich (2016)","de","romance"),
 ("DE","Der Vorname (2018)","de","comedy"),("DE","Wochenendrebellen (2023)","de","true_story"),("DE","Die Päpstin (2009)","de","history"),
 ("DE","Ostwind (2013)","de","family"),
 ("US","The Decoy Bride (2011)","en","romance"),("US","Let's Go to Prison (2006)","en","comedy"),("US","The Blackcoat's Daughter (2015)","en","horror"),
 ("US","Lake Mungo (2008)","en","horror"),("US","Indivisible (2018)","en","faith"),("US","Woodlawn (2015)","en","faith"),
 ("US","The Least of These (2019)","en","faith"),("US","Brian Banks (2018)","en","lifetime"),
 ("MX","Miss Bala (2011)","es","action"),("MX","Heli (2013)","es","crime"),("MX","Desierto (2015)","es","thriller"),
 ("MX","Vuelven (2017)","es","horror"),("MX","Cristiada (2012)","es","faith"),
 ("AR","Cuando acecha la maldad (2023)","es","horror"),("AR","El Ángel (2018)","es","crime"),("AR","Mi obra maestra (2018)","es","comedy"),
 ("AR","Un cuento chino (2011)","es","comedy"),
 ("ES","Ahora o nunca (2015)","es","romance"),("ES","Señor, dame paciencia (2017)","es","comedy"),("ES","Frágiles (2005)","es","horror"),
 ("ES","El Bar (2017)","es","thriller"),("ES","El desconocido (2015)","es","thriller"),("ES","Cuando los ángeles duermen (2018)","es","thriller"),
 ("BR","Aparecida: O Milagre (2010)","pt","faith"),("BR","Divaldo: O Mensageiro da Paz (2019)","pt","faith"),("BR","Carcereiros: O Filme (2019)","pt","action"),
 ("JP","残穢 Zan'e (2015)","ja","mystery"),("JP","事故物件 恐い間取り (2020)","ja","lifetime"),("JP","クロユリ団地 (2013)","ja","horror"),
 ("JP","樹海村 (2021)","ja","horror"),("JP","劇場霊 (2015)","ja","horror"),("JP","コワすぎ! (2012)","ja","horror"),
 ("UK","Severance (2006)","en","horror"),("UK","Their Finest (2016)","en","romance"),("UK","The Selfish Giant (2013)","en","drama"),
 ("AU","The Loved Ones (2009)","en","horror"),("AU","Red Dog (2011)","en","family"),("AU","Top End Wedding (2019)","en","romance"),
 ("FR","Ils (2006)","fr","horror"),("FR","Patients (2016)","fr","drama"),("FR","Mon Roi (2015)","fr","romance"),
 ("FR","Un homme à la hauteur (2016)","fr","comedy"),
 ("NL","Bankier van het Verzet (2018)","nl","drama"),("NL","Sint (2010)","nl","horror"),("NL","Huisvrouwen bestaan niet (2017)","nl","comedy"),
 ("SE","Monica Z (2013)","sv","drama"),("SE","Sameblod (2016)","sv","drama"),("SE","Snabba Cash (2010)","sv","thriller"),("SE","Ondskan (2003)","sv","drama"),
 ("NO","Bølgen (2015)","en","action"),("NO","Den 12. mann (2017)","en","lifetime"),("NO","Kongens nei (2016)","en","lifetime"),
 ("DK","Under sandet (2015)","en","lifetime"),("DK","Flammen & Citronen (2008)","en","lifetime"),("DK","Klovn: The Movie (2010)","en","comedy"),
 ("DK","De grønne slagtere (2003)","en","comedy"),("DK","Kollektivet (2016)","da","drama"),
]
rows = []
for c, f, l, g in FILMS:
    v = med[(l, g)]; r = round(BASE[l] * MULT.get(g, 1.0), 2)
    rows.append({"country": c, "film": f, "channel_lang": l, "genre": g, "median_views": v, "rpm_est": r, "usd_per_film": round(v / 1000 * r)})
rows.sort(key=lambda x: -x["usd_per_film"])
with open(os.path.join(F, "ranking_all.csv"), "w", newline="") as fh:
    w = csv.DictWriter(fh, fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)
for i, x in enumerate(rows, 1):
    print(f"{i:2} | {x['country']} | {x['film']} | {x['channel_lang']} | {x['genre']} | {x['median_views']:,} | {x['rpm_est']} | {x['usd_per_film']:,}")
