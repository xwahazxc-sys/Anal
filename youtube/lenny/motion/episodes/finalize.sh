#!/bin/bash
# move a finished episode out of the repo into out/hq, then put back: HQ parts (<95 MB) + a <=95 MB copy
set -e
E=$1; R=/home/user/Anal/youtube/lenny/videos/cinematic; HQ=/home/user/claude-motion/out/hq
N=lenny_${E}_cinematic.mp4
[ -f $R/$N ] && [ $(stat -c %s $R/$N) -gt 99000000 ] && mv $R/$N $HQ/$N
mkdir -p $R/hq; rm -f $R/hq/$N.part-*
( cd $R/hq && split -b 90M -d -a 2 $HQ/$N $N.part- )
cat $R/hq/$N.part-* | cmp - $HQ/$N
/home/user/claude-motion/episodes/fit.sh $HQ/$N $R/$N
echo FINAL_OK $E
