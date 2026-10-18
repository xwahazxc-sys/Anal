#!/bin/bash
EPS=/tmp/claude-0/-home-user-Anal/29395d32-6348-5014-9351-365c62c4f7d2/scratchpad/eps
log(){ echo "$(date -u +%H:%M) $*" >> $EPS/render.log; }
for ep in ep02 ep03 ep04 ep05 ep06 ep07 ep08; do
  ls $EPS/$ep/*_send.mp4 >/dev/null 2>&1 && continue
  until [ "$(cat $EPS/state/lenny-$ep-a 2>/dev/null)" = done ] && [ "$(cat $EPS/state/lenny-$ep-b 2>/dev/null)" = done ]; do sleep 60; done
  until [ -d /tmp/claude-0/-home-user-Anal/29395d32-6348-5014-9351-365c62c4f7d2/scratchpad/kaggle/qwen/outEB ]; do sleep 60; done
  log "$ep render start"
  rm -f $EPS/$ep/ch_*.mp4
  if python3 $EPS/engine/ep.py $EPS/$ep all >> $EPS/$ep/render.out 2>&1; then log "$ep DONE $(grep -o "missing.*" $EPS/$ep/render.out | tail -1)"; else log "$ep FAILED"; fi
done
log "all episodes rendered"
