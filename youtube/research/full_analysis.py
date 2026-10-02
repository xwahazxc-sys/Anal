#!/usr/bin/env python3
"""full_analysis.py - turn full/summary.json into revenue and opportunity estimates.

RPM figures are ESTIMATES (creator-reported ranges for long-form entertainment, 2024-2026),
not measured: YouTube does not publish RPM. Change the tables below to rerun with your own numbers.
"""
import csv, json, math, os

# audience mix per language (share of views) and RPM per country, USD per 1000 monetized-channel views
MIX = {
    "en": {"US": (.45, 6.0), "UK": (.08, 4.5), "CA": (.05, 4.5), "AU": (.04, 5.5), "IN/PH/NG/PK": (.25, .5), "other": (.13, 1.5)},
    "es": {"MX": (.30, .9), "US hispanic": (.15, 4.0), "CO": (.10, .6), "AR": (.10, .45), "ES": (.08, 2.2), "PE": (.07, .6), "CL": (.05, 1.1), "other": (.15, .6)},
    "pt": {"BR": (.88, .8), "PT": (.05, 1.8), "US": (.03, 4.0), "other": (.04, 1.0)},
    "ja": {"JP": (.92, 3.2), "other": (.08, 2.0)},
}
GENRE_MULT = {"family": 1.15, "faith": 1.1, "romance": 1.0, "drama": 1.0, "comedy": 1.0, "mystery": 1.0, "scifi": 1.0,
              "lifetime": 1.0, "action": .9, "thriller": .9, "crime": .85, "horror": .85}

def rpm(lang, genre): return sum(s * r for s, r in MIX[lang].values()) * GENRE_MULT[genre]

HERE = os.path.dirname(os.path.abspath(__file__))
rows = []
for s in json.load(open(os.path.join(HERE, "full", "summary.json")))["summary"]:
    r = rpm(s["lang"], s["genre"])
    comp = math.log10(max(s["median_subs_ranking"], 1000))          # 3 = tiny channels rank, 6 = million-sub channels
    rows.append({**s, "rpm_est": round(r, 2),
                 "usd_typical_film": round(s["channel_long_median"] / 1000 * r),
                 "usd_ranked_film": round(s["median_views_long"] / 1000 * r),
                 "usd_hit_film": round(s["p75_views_long"] / 1000 * r),
                 "opportunity": round(s["median_views_long"] / 1000 * r / (comp - 2), 1)})
rows.sort(key=lambda x: -x["opportunity"])
with open(os.path.join(HERE, "full", "opportunity.csv"), "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
for i, x in enumerate(rows, 1):
    print(f"{i:2} {x['genre']:9}{x['lang']} rpm={x['rpm_est']:.2f} medV={x['median_views_long']:>10,} subs={x['median_subs_ranking']:>8,} "
          f">1M={x['results_over_1M']:2} typ=${x['usd_typical_film']:>6,} ranked=${x['usd_ranked_film']:>6,} hit=${x['usd_hit_film']:>6,} opp={x['opportunity']}")
print({l: round(rpm(l, 'drama'), 2) for l in MIX})
