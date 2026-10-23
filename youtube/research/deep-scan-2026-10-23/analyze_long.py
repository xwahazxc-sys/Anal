"""Score every niche x language cell from the long-form scan."""
import json, math, os, statistics as st, datetime as dt
from lingua import LanguageDetectorBuilder as B, Language as L

D = os.path.dirname(os.path.abspath(__file__))
search = json.load(open(os.path.join(D, "long_search.json")))
info = json.load(open(os.path.join(D, "long_info.json")))
chans = json.load(open(os.path.join(D, "long_channels.json"))) if os.path.exists(os.path.join(D, "long_channels.json")) else {}

LMAP = {"en": L.ENGLISH, "de": L.GERMAN, "fr": L.FRENCH, "nl": L.DUTCH, "no": L.BOKMAL, "da": L.DANISH, "sv": L.SWEDISH,
        "fi": L.FINNISH, "it": L.ITALIAN, "es": L.SPANISH, "ja": L.JAPANESE, "ko": L.KOREAN}
det = B.from_languages(*LMAP.values(), L.HINDI, L.TURKISH, L.ARABIC, L.RUSSIAN, L.PORTUGUESE, L.INDONESIAN, L.POLISH,
                       L.VIETNAMESE, L.CHINESE, L.THAI).build()
# long-form RPM mid-points (USD), from the 2026 third-party ranges (Fluxnote, YouSEO, MilX, CreatiCalc); rough
RPM = {"no": 7.0, "de": 6.0, "da": 6.0, "sv": 5.5, "nl": 5.5, "fi": 5.0, "en": 7.0, "fr": 4.0, "ja": 4.0, "ko": 3.5,
       "it": 3.0, "es": 2.5}
NICHE_W = {"sleep_history": 0.7, "space_sleep": 0.7, "fairy_tales_adults": 0.6, "audiobooks": 0.6, "horror_stories": 0.6,
           "true_crime": 0.8, "cults": 0.7, "mafia_crime_history": 0.8, "ww2": 0.9, "brand_history": 1.3, "nostalgia_60s": 1.1,
           "old_hollywood": 1.0, "psychology_long": 1.0, "stoicism": 1.0, "food_history": 1.1, "art_history": 1.0}
TODAY = dt.date.today()


def lang_of(e, target):
    i = info.get(e["id"])
    if i and i.get("language"):
        return i["language"].split("-")[0].lower()
    t = (i or {}).get("title") or e.get("title") or ""
    g = det.detect_language_of(t)
    for k, v in LMAP.items():
        if v == g:
            return k
    return "xx"


def subs_of(e):
    i = info.get(e["id"])
    if i and i.get("channel_follower_count") is not None:
        return i["channel_follower_count"]
    c = chans.get(e.get("channel_url") or "")
    return (c or {}).get("subs")


JOINED = json.load(open(os.path.join(D, "joined.json"))) if os.path.exists(os.path.join(D, "joined.json")) else {}


def age_days(url):
    j = JOINED.get(url or "")
    if not j or j == "unknown":
        return None
    return (TODAY - dt.datetime.strptime(j, "%Y%m%d").date()).days


def chan_median(url):
    c = chans.get(url or "")
    if not c or len(c["vids"]) < 4:
        return None
    return st.median([v["views"] for v in c["vids"][:30]])


rows = []
for key, v in search.items():
    niche, lang = key.split("|")
    ents = [e for e in v["entries"] if e.get("id")]
    if not ents:
        continue
    top = ents[:10]
    views = [e["views"] for e in top]
    demand = st.median(views)
    langs = [lang_of(e, lang) for e in ents[:20]]
    native = [e for e, l in zip(ents[:20], langs) if l == lang]
    native_share = len(native) / max(1, len(ents[:20]))
    native_med = st.median([e["views"] for e in native]) if native else 0
    native_chans = len({e["channel_url"] for e in native})
    big = sum(1 for e in top if (subs_of(e) or 0) >= 500_000) / max(1, len(top))
    long25 = sum(1 for e in ents[:20] if (e.get("dur") or 0) >= 1500) / max(1, len(ents[:20]))
    thr = max(20_000, 0.3 * demand)
    small = [e for e in ents[:20] if (subs_of(e) or 10**9) < 50_000 and e["views"] >= thr]
    young = [e for e in ents[:20] if (age_days(e.get("channel_url")) or 9999) <= 365 and e["views"] >= max(20_000, 0.2 * demand)]
    small_native = [e for e in small if lang_of(e, lang) == lang]
    mult = []
    for e in ents[:20]:
        m = chan_median(e.get("channel_url"))
        if m:
            mult.append(e["views"] / max(m, 1))
    best_mult = max(mult) if mult else 0
    score = (math.log10(max(native_med, demand * native_share, 1) + 1) * (1 - 0.7 * big)
             * (1 + len(small) + 2 * len(young) + len(small_native)) * RPM.get(lang, 3) * NICHE_W.get(niche, 0.95)
             * (0.5 + 0.5 * long25))
    rows.append(dict(niche=niche, lang=lang, q=v["q"], demand=int(demand), native_share=round(native_share, 2),
                     native_med=int(native_med), native_chans=native_chans, big=round(big, 2), long25=round(long25, 2),
                     small=len(small), small_native=len(small_native), young=len(young), best_mult=round(best_mult, 1),
                     score=round(score, 1),
                     examples=[(e["channel"], subs_of(e), e["views"], (e.get("dur") or 0) // 60, age_days(e.get("channel_url")),
                                (info.get(e["id"]) or {}).get("title") or e["title"]) for e in (small + young)[:6]]))
rows.sort(key=lambda r: -r["score"])
json.dump(rows, open(os.path.join(D, "long_scores.json"), "w"), ensure_ascii=False, indent=1)
print(f"{'niche':20} {'lg':3} {'score':>6} {'demand':>9} {'nat%':>5} {'natMed':>8} {'natCh':>5} {'big':>4} {'25m':>4} {'sm':>3} {'smN':>3} {'yg':>3} {'xMed':>6}")
for r in rows[:70]:
    print(f"{r['niche'][:20]:20} {r['lang']:3} {r['score']:6.1f} {r['demand']:9,} {r['native_share']:5.2f} {r['native_med']:8,} "
          f"{r['native_chans']:5} {r['big']:4.1f} {r['long25']:4.1f} {r['small']:3} {r['small_native']:3} {r['young']:3} {r['best_mult']:6.1f}")
