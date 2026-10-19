"""Turn an old-engine episode (timeline.json + slides + voice.wav) into data for the Remotion Episode."""
import json, shutil, sys, os, re
src, slug = sys.argv[1], sys.argv[2]
pub = f'/home/user/claude-motion/public/{slug}'
os.makedirs(pub, exist_ok=True)
t = json.load(open(f'{src}/timeline.json'))
segs = []
for s in t['segs']:
    name = os.path.basename(s['img']).rsplit('.', 1)[0]
    if not os.path.exists(f'{pub}/{name}.jpg'):
        shutil.copy(f"{src}/{s['img']}", f'{pub}/{name}.jpg')
    words = []
    if s.get('words') and s['text']:
        toks = s['text'].split()
        ws = s['words']
        n = min(len(toks), len(ws))
        for i in range(n):
            words.append([toks[i], round(s['voice'] + ws[i], 3)])
    segs.append(dict(s=round(s['start'], 3), e=round(s['end'], 3), img=name, kind=s['kind'], ov=s.get('ov'),
                     frame=s['frame'], move=s['move'], trans=s['trans'], dim=s['dim'], words=words))
# caption chunks: <= 6 words, break after punctuation
caps = []
for g in segs:
    cur = []
    for i, (w, at) in enumerate(g['words']):
        cur.append([w, at])
        end = re.search(r'[.?!,:;]$', w) and len(cur) >= 2
        if len(cur) >= 6 or end or i == len(g['words']) - 1:
            caps.append(cur); cur = []
for i, c in enumerate(caps):
    nxt = caps[i + 1][0][1] if i + 1 < len(caps) else c[-1][1] + 1.2
    c_end = min(nxt, c[-1][1] + 0.35 + 0.06 * len(c[-1][0]))
    caps[i] = {'a': c[0][1], 'b': round(max(c_end, c[-1][1] + 0.3), 3), 'w': c}
json.dump({'duration': round(t['total'] + 0.6, 2), 'segs': segs, 'caps': caps}, open(f'{pub}/ep.json', 'w'))
shutil.copy(f'{src}/voice.wav', f'{pub}/voice.wav')
print(len(segs), 'segs', len(caps), 'caps', t['total'])
