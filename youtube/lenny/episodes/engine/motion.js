// Dynamic camera + caption pop shared by slides.html (ep01) and ep.html (ep02+).
// Expects segments with .shots [{t,z,fx,fy}] and .hits [t] from motion.py, and .words for captions.
window.MOTION = (function () {
  const KEY = /(\d|\$|never|scam|free|money|code|password|bank|fake|crypto|gone|stop|always|every|nobody|trust|secret|steal|stole|lose|lost|card|urgent|now|today|real|warning|police|arrest|voice|clone)/i;
  function shotAt(s, lt) { const S = s.shots || [{ t: 0, z: 1.06, fx: .5, fy: .5 }]; let k = 0; for (let i = 0; i < S.length; i++) if (lt >= S[i].t) k = i; return [S[k], k, S[k + 1] ? S[k + 1].t : (s.end - s.start)]; }
  function cam(s, lt, gt) {
    const [sh, k, nextT] = shotAt(s, lt), tt = lt - sh.t, dur = Math.max(.5, nextT - sh.t);
    let z = sh.z * (1 + .03 * Math.min(1, tt / dur));             // slow push inside the shot
    z *= 1 + .045 * Math.exp(-tt * 13);                            // snap-in on the cut
    for (const h of (s.hits || [])) if (lt >= h) z *= 1 + .05 * Math.exp(-(lt - h) * 8);   // keyword punch
    const hx = Math.sin(gt * 1.3) * 5 + Math.sin(gt * 2.9) * 3, hy = Math.cos(gt * 1.7) * 4 + Math.sin(gt * 3.3) * 2;
    const r = Math.sin(gt * .9) * .25;
    return { origin: `${sh.fx * 100}% ${sh.fy * 100}%`, transform: `translate(${hx}px,${hy}px) rotate(${r}deg) scale(${z})`, cutAge: tt, shot: k };
  }
  function caption(s, sp) {
    const w = s.text.split(/\s+/), T = s.words && s.words.length == w.length ? s.words : null;
    const k = T ? Math.max(0, T.filter(x => x <= sp + .04).length - 1) : Math.min(w.length - 1, Math.floor(sp / s.dur * w.length));
    const c0 = Math.floor(k / 4) * 4, since = T ? sp - T[k] : 0;
    return w.slice(c0, c0 + 4).map((x, n) => {
      const on = c0 + n === k, key = KEY.test(x);
      const sc = on ? 1 + .22 * Math.exp(-since * 11) : 1;
      return `<span class="${on ? 'on' : ''}" style="display:inline-block;margin:0 .13em;transform:scale(${sc});${key && !on ? 'color:#ff5a5a' : ''}">${x}</span>`;
    }).join(' ');
  }
  return { cam, caption };
})();
