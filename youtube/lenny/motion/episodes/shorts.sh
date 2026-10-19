#!/bin/bash
cd /home/user/claude-motion
DEST=/home/user/Anal/youtube/lenny/shorts/cinematic; mkdir -p $DEST
for spec in "S5 s5_grandma" "S6 s6_5sec" "S7 s7_store" "S8 s8_isthisyou"; do
  set -- $spec; OUTF=$DEST/$2.mp4; [ -f $OUTF ] && continue
  mkdir -p out/shorts/$2
  npx remotion render $1 out/shorts/$2/silent.mp4 --muted --crf=17 --concurrency=2 --log=error || { echo "$2 FAIL"; continue; }
  EP=shorts/$2 python3 -m sfx sfx/cues/episode.py
  ./episodes/master.sh shorts/$2 $OUTF && echo "SHORT_DONE $2"
done
echo SHORTS_FINISHED
