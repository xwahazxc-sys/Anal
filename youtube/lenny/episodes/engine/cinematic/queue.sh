#!/bin/bash
# render all cinematic episodes in order; restart-safe via .done markers
cd /home/user/claude-motion
while pgrep -f "render.sh Ep02" >/dev/null && [ "$1" != "--now" ]; do sleep 20; done
DEST=/home/user/Anal/youtube/lenny/videos/cinematic; mkdir -p $DEST
for e in 02 03 04 05 06 07 08; do
  OUTF=$DEST/lenny_ep${e}_cinematic.mp4
  [ -f $OUTF ] && { echo "ep$e already done"; continue; }
  echo "ep$e start $(date +%H:%M)"
  ./episodes/render.sh Ep$e ep$e || { echo "ep$e RENDER_FAIL"; continue; }
  EP=ep$e python3 -m sfx sfx/cues/episode.py
  ./episodes/master.sh ep$e $OUTF.tmp.mp4 && mv $OUTF.tmp.mp4 $OUTF && echo "EP_DONE ep$e $(date +%H:%M)"
  rm -f out/ep$e/c*.mp4   # free disk; markers stay only while needed
  rm -f out/ep$e/c*.mp4.done
done
echo QUEUE_FINISHED
