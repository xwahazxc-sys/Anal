#!/bin/bash
# voice + quiet sfx + Dark Fog (ducked under speech) → two-pass loudnorm -14 LUFS → mux
cd /home/user/claude-motion; SLUG=$1; OUTF=$2
MUSIC=/tmp/claude-0/-home-user-Anal/29395d32-6348-5014-9351-365c62c4f7d2/scratchpad/music/Dark_Fog.mp3
D=out/$SLUG
ffmpeg -y -loglevel error -i public/$SLUG/voice.wav -i public/$SLUG/sfx.wav -stream_loop -1 -i $MUSIC -filter_complex \
"[0]aresample=48000,apad=pad_dur=1,asplit=2[v][vk];[1]aresample=48000,volume=0.75[s];[2]aresample=48000,volume=0.20[m0];\
[m0][vk]sidechaincompress=threshold=0.015:ratio=8:attack=40:release=700:makeup=1[m1];[m1]afade=t=in:d=1.5[m];\
[v][s][m]amix=inputs=3:normalize=0:duration=shortest,alimiter=limit=0.8[a]" -map "[a]" -ac 2 -c:a pcm_s16le $D/mix.wav
J=$(ffmpeg -hide_banner -i $D/mix.wav -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/{/,/}/p')
g(){ echo "$J" | python3 -c "import json,sys;print(json.load(sys.stdin)['$1'])"; }
LN="loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true"
ffmpeg -y -loglevel error -i $D/silent.mp4 -i $D/mix.wav -af "$LN" -map 0:v -map 1:a -shortest -c:v copy -c:a aac -b:a 192k -ar 48000 -movflags +faststart $OUTF && echo MASTER_OK
