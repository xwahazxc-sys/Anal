#!/bin/bash
# make a <=95 MB copy for GitHub (2-pass x264); keep the HQ master in out/hq
IN=$1; OUT=$2; T=$(mktemp -d)
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$IN")
VB=$(python3 -c "print(int((93*8*1024*1024/$DUR - 192000)/1000))")
ffmpeg -y -loglevel error -i "$IN" -c:v libx264 -preset slow -b:v ${VB}k -pass 1 -passlogfile $T/p -an -f null /dev/null && \
ffmpeg -y -loglevel error -i "$IN" -c:v libx264 -preset slow -b:v ${VB}k -pass 2 -passlogfile $T/p -c:a copy -movflags +faststart "$OUT" && echo "FIT_OK $(du -m "$OUT" | cut -f1)MB ${VB}k"
rm -rf $T
