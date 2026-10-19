#!/bin/bash
# render an episode in 1-minute chunks (restart-safe), then concat
cd /home/user/claude-motion
ID=$1; SLUG=$2; N=$(python3 -c "import json;print(round(json.load(open('public/$SLUG/ep.json'))['duration']*30))")
mkdir -p out/$SLUG
i=0
for ((a=0; a<N; a+=1800)); do
  b=$((a+1799)); [ $b -ge $N ] && b=$((N-1))
  f=out/$SLUG/c$(printf %02d $i).mp4
  if [ ! -f $f.done ]; then
    npx remotion render $ID $f --frames=$a-$b --muted --crf=17 --concurrency=4 --log=error && touch $f.done
  fi
  echo "chunk $i done ($a-$b)"
  i=$((i+1))
done
ls out/$SLUG/c*.mp4 | sed "s#out/$SLUG/#file '#;s#\$#'#" > out/$SLUG/list.txt
ffmpeg -loglevel error -y -f concat -safe 0 -i out/$SLUG/list.txt -c copy out/$SLUG/silent.mp4 && echo CONCAT_OK
