#!/usr/bin/env python3
"""clean_scan.py - stricter filter over scan/results.json for the rights-management lead list.

A copy counts only if its title names the film AND looks like a full-film upload (full-movie marker,
quality tag or the year), it is not a trailer/episode/concert/documentary/'from the makers of' video, and
the channel is not an obvious official/distributor channel. Writes scan/leads.csv and scan/leads.json.
"""
import csv, json, os, re, sys, unicodedata
HERE = os.path.dirname(os.path.abspath(__file__))
S = os.path.join(HERE, sys.argv[1] if len(sys.argv) > 1 else "scan")
FULL = re.compile(r"full movie|full film|pel[ií]cula completa|filme completo|completo|completa|dublad|legendad|espa[nñ]ol latino|"
                  r"sub indo|t[uü]rk[cç]e dublaj|hela filmen|film complet|ganzer film|720p|1080p|\bhd\b|4k|full hd", re.I)
NOISE = re.compile(r"producers of|creators of|makers of|from the director|trailer|tr[aá]iler|episod|epis[oó]dio|temporada|season|"
                   r"concert|festival|documentary|documental|doku|livestream|weltpremiere|10 aniversario|behind|making|"
                   r"masha|peppa|clifford|bebefinn|barney|explained|review", re.I)
OFFICIAL = re.compile(r"air bud tv|eugenio derbez|constantin film|mundo gloob|viva films|frontline|exit festival|"
                      r"lionsgate|sony pictures|universal pictures|paramount|warner|disney|netflix|amazon|"
                      r"vision video|flix for free|movie central|filmisnow|midnight pulp|garage filmes|encouragetv|deep c digital|"
                      r"meteorite entertainment|janson tv|christian movies|maple indie", re.I)

def norm(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    return " " + re.sub(r"[^a-z0-9]+", " ", s).strip() + " "

films = {f"{f['title']} ({f['year']})": f for f in json.load(open(os.path.join(S, "films.json")))}
res = json.load(open(os.path.join(S, "results.json")))
leads = []
for key, v in res.items():
    f = films[key]; names = [norm(n) for n in [f["title"]] + f["alts"]]
    keep = []
    for c in v["copies"]:
        t = c["title"]
        if NOISE.search(t) or OFFICIAL.search(c["channel"] or ""): continue
        if not (FULL.search(t) or str(f["year"]) in t): continue
        if not any(n in norm(t) for n in names): continue
        keep.append(c)
    if not keep: continue
    leads.append({"film": key, "country": v["country"], "copies": len(keep),
                  "channels": len({c["channel_id"] for c in keep}), "total_views": sum(c["views"] for c in keep),
                  "max_views": max(c["views"] for c in keep), "uploads": keep})
leads.sort(key=lambda x: -x["total_views"])
json.dump(leads, open(os.path.join(S, "leads.json"), "w"), ensure_ascii=False, indent=1)
with open(os.path.join(S, "leads.csv"), "w", newline="") as fh:
    w = csv.writer(fh); w.writerow(["film", "country", "copies", "channels", "total_views", "max_views", "top_uploaders"])
    for l in leads:
        w.writerow([l["film"], l["country"], l["copies"], l["channels"], l["total_views"], l["max_views"],
                    "; ".join(f"{c['channel']} ({c['views']:,})" for c in l["uploads"][:5])])
print(len(leads))
for l in leads[:60]:
    print(f"{l['film'][:40]:40} {l['country']} n={l['copies']:2} ch={l['channels']:2} tot={l['total_views']:>11,} | " +
          " ; ".join(f"{(c['channel'] or '')[:14]}:{c['views']//1000}k:{c['title'][:38]}" for c in l["uploads"][:2]))
