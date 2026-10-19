# Lenny cinematic render kit

Everything needed to rebuild the cinematic episodes on a fresh machine.

```bash
git clone https://github.com/whaleyxbt/claude-motion && cd claude-motion
git apply ../Anal/youtube/lenny/motion/claude-motion.patch     # registers Ep02..Ep08 + Trailer in Root.tsx
cp -r ../Anal/youtube/lenny/motion/{episode,trailer} src/
cp -r ../Anal/youtube/lenny/motion/episodes ../Anal/youtube/lenny/motion/trailer.json .
cp ../Anal/youtube/lenny/motion/sfx/*.py sfx/cues/
cp -r ../Anal/youtube/lenny/motion/public/* public/
npm install
./episodes/render.sh Ep05 ep05 && EP=ep05 python3 -m sfx sfx/cues/episode.py
./episodes/master.sh ep05 out/hq/lenny_ep05_cinematic.mp4      # needs Dark_Fog.mp3 path inside master.sh
./episodes/finalize.sh ep05                                     # HQ parts + GitHub copy into the Anal repo
```
Root.tsx imports public/ep02..ep08 and public/shorts/*: copy only what you render, or trim the imports.
Music: Dark Fog (Kevin MacLeod, CC BY) — copy of the file is in youtube/lenny/music/.
