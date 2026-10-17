#!/bin/bash
# Kaggle queue: push batches in order (max 2 running), download finished ones into <ep>/img.
# Queue file: one line per batch "epdir part". Log: queue.log
export KAGGLE_API_TOKEN=$(cat ~/.kaggle/access_token)
EPS=/tmp/claude-0/-home-user-Anal/29395d32-6348-5014-9351-365c62c4f7d2/scratchpad/eps
Q=$EPS/queue.txt; ST=$EPS/state; mkdir -p $ST
log(){ echo "$(date -u +%H:%M) $*" >> $EPS/queue.log; }
while true; do
  running=0; pending=0
  while read ep part; do
    [ -z "$ep" ] && continue
    slug="lenny-$ep-$part"; f=$ST/$slug
    s=$(cat $f 2>/dev/null)
    if [ "$s" = "pushed" ]; then
      st=$(kaggle kernels status iiiiafsdfs/$slug 2>&1 | tail -1)
      if echo "$st" | grep -qE "COMPLETE|ERROR|CANCEL"; then
        mkdir -p $EPS/$ep/dl_$part; kaggle kernels output iiiiafsdfs/$slug -p $EPS/$ep/dl_$part >/dev/null 2>&1
        mkdir -p $EPS/$ep/img; cp $EPS/$ep/dl_$part/*.png $EPS/$ep/img/ 2>/dev/null
        echo done > $f; log "$slug finished: $(echo $st | grep -oE 'COMPLETE|ERROR|CANCEL[A-Z_]*') $(ls $EPS/$ep/dl_$part/*.png 2>/dev/null | wc -l) png"
      else running=$((running+1)); fi
    elif [ -z "$s" ]; then pending=$((pending+1)); fi
  done < $Q
  while read ep part; do
    [ -z "$ep" ] && continue; [ $running -ge 2 ] && break
    slug="lenny-$ep-$part"; f=$ST/$slug; [ -n "$(cat $f 2>/dev/null)" ] && continue
    out=$(kaggle kernels push -p $EPS/$ep/push$part --accelerator NvidiaTeslaT4 2>&1 | tail -1)
    if echo "$out" | grep -q successfully; then echo pushed > $f; running=$((running+1)); log "$slug pushed"
    else log "$slug push failed: $out"; break; fi
  done < $Q
  [ $pending -eq 0 ] && [ $running -eq 0 ] && [ -f $EPS/queue.closed ] && { log "queue empty, exit"; exit 0; }
  sleep 120
done
