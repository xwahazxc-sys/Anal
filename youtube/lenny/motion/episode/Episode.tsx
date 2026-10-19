import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import {band, clamp01, easeIn, easeInOut, easeOut, lerp, prog, rand, sp} from '../lib';
import {Grain, Mask} from '../components/primitives';
import {useFonts} from '../components/useFonts';

export const EFPS = 30;
export const EW = 1920;
export const EH = 1080;

// Same look as the trailer: night teal, cream type, one red accent, Lenny teal.
export const P = {
  black: '#05080A',
  cream: '#F2EEE4',
  creamDim: 'rgba(242,238,228,0.62)',
  muted: 'rgba(242,238,228,0.34)',
  red: '#FF4A3D',
  redGlow: 'rgba(255,74,61,0.55)',
  teal: '#1EE3CF',
  tealGlow: 'rgba(30,227,207,0.45)',
  link: '#8FC3FF',
};
export const F = {
  serif: '"Instrument Serif", Georgia, serif',
  sans: '"Inter Variable", Inter, system-ui, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
};
const BAR = 96; // letterbox: 2.2:1, leaves room for captions
const OV = 0.6; // scene overlap (cross-dissolve length)

type Ov = Record<string, any> | null;
export type Seg = {s: number; e: number; img: string; kind: string; ov: Ov; frame: string; move: string; trans: string; dim: boolean; words: [string, number][]};
export type Cap = {a: number; b: number; w: [string, number][]};
export type EpData = {duration: number; segs: Seg[]; caps: Cap[]};

/* ---------- rich text: "9 TEXTS. <em>I WROTE THEM.</em><br>…" ---------- */
type Tok = {w: string; em: boolean; br?: boolean};
export const rich = (s: string): Tok[] => {
  const out: Tok[] = [];
  let em = false;
  s.replace(/<br\s*\/?>/g, ' \n ')
    .split(/(<\/?(?:em|i|b)>)/)
    .forEach((part) => {
      if (/^<(em|i|b)>$/.test(part)) return void (em = true);
      if (/^<\/(em|i|b)>$/.test(part)) return void (em = false);
      part.split(/\s+/).filter(Boolean).forEach((w) => out.push(w === '\n' ? {w: '', em, br: true} : {w, em}));
    });
  return out;
};
export const sentence = (s: string) => {
  // ALL CAPS → Sentence case for the serif display face (looks expensive, reads faster)
  const plain = s.replace(/<[^>]+>/g, '');
  if (plain !== plain.toUpperCase()) return s;
  const low = s.replace(/<[^>]+>/g, (m) => m.toLowerCase()).toLowerCase();
  return low.replace(/(^|[.!?]\s+)((?:<[^>]+>\s*)*)([a-z])/g, (_m, a, tag, b) => a + tag + b.toUpperCase()).replace(/(^|[^<\/a-z])i(?=[\s.,!?']|$)/g, '$1I');
};

export const RichWords: React.FC<{s: string; t: number; t0: number; out?: number; style?: React.CSSProperties; stagger?: number}> = ({s, t, t0, out = 0, style, stagger = 0.09}) => {
  let i = 0;
  return (
    <div style={{fontFamily: F.serif, color: P.cream, lineHeight: 1.02, letterSpacing: '-0.02em', ...style}}>
      {rich(sentence(s)).map((tk, j) => {
        if (tk.br) return <br key={j} />;
        const k = prog(t, t0 + i * stagger, t0 + i * stagger + 0.8, easeOut);
        i++;
        return (
          <React.Fragment key={j}>
            <Mask k={k} out={out}>
              <span style={tk.em ? {fontStyle: 'italic', color: P.red, textShadow: `0 0 40px ${P.redGlow}`, paddingRight: '0.08em'} : {}}>{tk.w}</span>
            </Mask>{' '}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export const Label: React.FC<{children: React.ReactNode; k?: number; style?: React.CSSProperties}> = ({children, k = 1, style}) => (
  <div style={{fontFamily: F.mono, fontSize: 22, letterSpacing: '0.24em', textTransform: 'uppercase', color: P.creamDim, opacity: k, ...style}}>{children}</div>
);

/* ---------- the photographic plate ---------- */
export const MOVES: Record<string, {z0: number; z1: number; x0: number; x1: number; y0: number; y1: number}> = {
  in: {z0: 1.06, z1: 1.16, x0: 0, x1: 0, y0: 0, y1: 0},
  out: {z0: 1.17, z1: 1.06, x0: 0, x1: 0, y0: 0, y1: 0},
  pan_lr: {z0: 1.14, z1: 1.14, x0: -55, x1: 55, y0: 0, y1: 0},
  pan_rl: {z0: 1.14, z1: 1.14, x0: 55, x1: -55, y0: 0, y1: 0},
  tilt: {z0: 1.14, z1: 1.12, x0: 0, x1: 0, y0: 35, y1: -35},
  hold: {z0: 1.08, z1: 1.12, x0: 0, x1: 0, y0: 0, y1: 0},
};
const Plate: React.FC<{src: string; t: number; t0: number; t1: number; move: string; blur?: number; dim?: number; seed?: number}> = ({src, t, t0, t1, move, blur = 0, dim = 0, seed = 0}) => {
  const m = MOVES[move] ?? MOVES.in;
  // linear-ish drift over the whole shot (a constant slow camera never "jerks"), eased only at the ends
  const k = prog(t, t0 - OV, t1 + OV, (x) => x * 0.84 + 0.16 * easeInOut(x));
  const z = lerp(m.z0, m.z1, k);
  const x = lerp(m.x0, m.x1, k);
  const y = lerp(m.y0, m.y1, k);
  const ox = 50 + (rand(seed) - 0.5) * 16;
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <Img src={src} style={{width: '100%', height: '100%', objectFit: 'cover', transform: `translate(${x}px, ${y}px) scale(${z})`, transformOrigin: `${ox}% 45%`,
        filter: `${blur > 0.05 ? `blur(${blur}px) ` : ''}contrast(1.1) saturate(0.85) brightness(${0.88 - dim * 0.55})`}} />
      <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(10,60,70,0.32), rgba(0,0,0,0) 45%, rgba(120,50,20,0.16))', mixBlendMode: 'soft-light'}} />
      <AbsoluteFill style={{background: 'radial-gradient(ellipse 72% 72% at 50% 50%, rgba(0,0,0,0) 48%, rgba(0,0,0,0.7) 100%)'}} />
    </AbsoluteFill>
  );
};

/** The image floating as a card over a blurred copy of itself, with a slow 3D yaw. */
const CardPlate: React.FC<{src: string; t: number; t0: number; t1: number; seed: number}> = ({src, t, t0, t1, seed}) => {
  const k = prog(t, t0 - OV, t1 + OV, (x) => x);
  const dir = rand(seed) > 0.5 ? 1 : -1;
  return (
    <AbsoluteFill>
      <Plate src={src} t={t} t0={t0} t1={t1} move="hold" blur={28} dim={0.45} />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', perspective: 1800}}>
        <div style={{width: 1300, height: 731, borderRadius: 26, overflow: 'hidden', boxShadow: '0 50px 120px rgba(0,0,0,0.65), 0 0 0 1px rgba(242,238,228,0.14)',
          transform: `rotateY(${dir * lerp(5, -3, k)}deg) rotateX(${lerp(2, -1, k)}deg) scale(${lerp(0.97, 1.02, k)})`}}>
          <Plate src={src} t={t} t0={t0} t1={t1} move="in" />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Shot: React.FC<{g: Seg; t: number; base: string; idx: number}> = ({g, t, base, idx}) => {
  const src = staticFile(`${base}/${g.img}.jpg`);
  const focus = g.trans === 'blur' ? (1 - prog(t, g.s - 0.2, g.s + 0.9, easeOut)) * 14 : 0;
  const dim = g.dim || g.kind === 'title' || g.kind === 'big' || g.kind === 'quote' || g.kind === 'cards' || g.kind === 'end' || g.kind === 'list' ? 0.55 : 0;
  if (g.frame === 'card' && g.kind !== 'title') return <CardPlate src={src} t={t} t0={g.s} t1={g.e} seed={idx} />;
  return <Plate src={src} t={t} t0={g.s} t1={g.e} move={g.move} blur={focus} dim={dim} seed={idx} />;
};

/** How the incoming shot is revealed over the outgoing one. */
const Transition: React.FC<{g: Seg; t: number; children: React.ReactNode}> = ({g, t, children}) => {
  const k = prog(t, g.s - OV * 0.5, g.s + OV * 0.5, easeInOut);
  if (k >= 1) return <>{children}</>;
  if (g.trans === 'dip') {
    const kk = prog(t, g.s, g.s + 0.55, easeOut);
    return <AbsoluteFill style={{opacity: kk}}>{children}</AbsoluteFill>;
  }
  if (g.trans === 'push') {
    // a soft wipe: a feathered edge travels across, the image glides 40 px the same way
    return (
      <AbsoluteFill style={{WebkitMaskImage: `linear-gradient(90deg, #000 ${k * 130 - 30}%, transparent ${k * 130}%)`, transform: `translateX(${(1 - k) * 40}px)`}}>{children}</AbsoluteFill>
    );
  }
  if (g.trans === 'blur') return <AbsoluteFill style={{opacity: k}}>{children}</AbsoluteFill>;
  // fade: an iris that opens from the centre, feathered
  return (
    <AbsoluteFill style={{opacity: Math.min(1, k * 1.6), WebkitMaskImage: `radial-gradient(ellipse ${k * 120 + 10}% ${k * 120 + 10}% at 50% 50%, #000 60%, transparent 100%)`}}>{children}</AbsoluteFill>
  );
};

/* ---------- overlays ---------- */
export const Glass: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <div style={{padding: '26px 32px', borderRadius: 30, background: 'rgba(16,24,27,0.72)', border: '1px solid rgba(242,238,228,0.2)',
    boxShadow: '0 30px 90px rgba(0,0,0,0.55)', fontFamily: F.sans, color: P.cream, ...style}}>{children}</div>
);

const numParts = (s: string) => {
  const m = s.match(/^([^0-9]*)([0-9][0-9.,]*)(.*)$/);
  return m ? {pre: m[1], n: parseFloat(m[2].replace(/,/g, '')), dec: (m[2].split('.')[1] || '').length, post: m[3]} : null;
};

const Overlay: React.FC<{g: Seg; t: number; num: number; unit: string}> = ({g, t, num, unit}) => {
  const o = g.ov;
  if (!o) return null;
  const s0 = g.s + (o.at ?? 0.25);
  const out = prog(t, g.e - 0.45, g.e - 0.05, easeIn);
  const life = 1 - out;
  const fr = t * EFPS;

  switch (o.t) {
    case 'head':
      return (
        <AbsoluteFill style={{justifyContent: 'center', paddingLeft: 140, paddingBottom: 120}}>
          <AbsoluteFill style={{background: 'linear-gradient(90deg, rgba(5,8,10,0.75), rgba(5,8,10,0.25) 60%, rgba(0,0,0,0))', opacity: prog(t, s0 - 0.3, s0 + 0.5, easeOut) * life}} />
          <RichWords s={o.s} t={t} t0={s0} out={out} style={{fontSize: 140, maxWidth: 1500, position: 'relative'}} />
        </AbsoluteFill>
      );
    case 'lower': {
      const k = prog(t, s0, s0 + 0.8, easeOut);
      return (
        <div style={{position: 'absolute', left: 140, bottom: BAR + 150, opacity: k * life, transform: `translateX(${(1 - k) * -40}px)`}}>
          <Label style={{color: P.teal}}>{o.b}</Label>
          <div style={{fontFamily: F.serif, fontSize: 130, color: P.cream, lineHeight: 1, marginTop: 6}}>Lenny</div>
          <div style={{width: 300 * k, height: 3, background: P.teal, marginTop: 14, boxShadow: `0 0 18px ${P.tealGlow}`}} />
        </div>
      );
    }
    case 'big': {
      const p = numParts(o.s);
      const c = prog(t, s0, s0 + 2.2, easeOut);
      const k = prog(t, s0, s0 + 0.7, easeOut);
      const txt = p ? `${p.pre}${(p.n * c).toLocaleString('en-US', {minimumFractionDigits: p.dec, maximumFractionDigits: p.dec})}${p.post}` : o.s;
      return (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', opacity: life, paddingBottom: 80}}>
          <AbsoluteFill style={{background: `radial-gradient(ellipse 38% 30% at 50% 46%, ${P.redGlow} 0%, rgba(0,0,0,0) 70%)`, opacity: 0.5 * k}} />
          <div style={{fontFamily: F.serif, fontSize: o.size ?? 250, color: P.cream, lineHeight: 1, opacity: k, transform: `scale(${lerp(1.08, 1, k)})`,
            textShadow: `0 0 60px ${P.redGlow}`, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em'}}>{sentenceKeepCaps(txt)}</div>
          <Label k={prog(t, s0 + 0.6, s0 + 1.3, easeOut)} style={{marginTop: 26}}>{o.sub}</Label>
        </AbsoluteFill>
      );
    }
    case 'title': {
      const k = prog(t, g.s + 0.15, g.s + 0.9, easeOut);
      if (!o.n) {
        return (
          <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', textAlign: 'center'}}>
            <RichWords s={o.s} t={t} t0={g.s + 0.2} out={out} stagger={0.07} style={{fontSize: o.size ?? 130, display: 'inline-block', maxWidth: 1500}} />
          </AbsoluteFill>
        );
      }
      const m = String(o.n).match(/^(.*?)#?\s*(\d+)$/);
      const pre = m ? m[1].replace('#', '').trim() : '';
      const n = m ? m[2].padStart(2, '0') : sentence(String(o.n));
      const label = !m ? 'Extra' : pre ? `${pre} ${n}` : `${unit} ${n} / ${String(num).padStart(2, '0')}`;
      return (
        <AbsoluteFill style={{justifyContent: 'center', paddingLeft: 160, opacity: life}}>
          <Label k={k} style={{color: P.red, marginBottom: 18}}>{label}</Label>
          <div style={{fontFamily: F.serif, fontSize: m ? 300 : 220, fontStyle: m ? 'normal' : 'italic', lineHeight: 0.8, color: 'transparent', WebkitTextStroke: `2px ${P.cream}`, paddingRight: '0.1em'}}>
            <Mask k={k}>{n}</Mask>
          </div>
          <RichWords s={o.s} t={t} t0={g.s + 0.3} style={{fontSize: 130, marginTop: 24}} />
        </AbsoluteFill>
      );
    }
    case 'notif': {
      const k = sp(fr, g.s + 0.25, {damping: 16, stiffness: 150, mass: 0.9}, EFPS);
      const float = Math.sin(t * 0.9) * 4;
      return (
        <div style={{position: 'absolute', right: 130, top: BAR + 80 + (1 - k) * -70 + float, width: 820, opacity: k * life}}>
          <Glass>
            <div style={{fontFamily: F.mono, fontSize: 19, letterSpacing: '0.16em', color: P.creamDim, textTransform: 'uppercase'}}>{o.from}</div>
            <div style={{fontSize: 40, lineHeight: 1.3, marginTop: 12}}>
              {o.msg}{' '}{o.link ? <span style={{color: P.link, textDecoration: 'underline'}}>{o.link}</span> : null}
            </div>
          </Glass>
        </div>
      );
    }
    case 'stamp': {
      const k = sp(fr, s0, {damping: 11, stiffness: 210, mass: 0.7}, EFPS);
      return (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', opacity: Math.min(1, k * 2) * life, paddingBottom: 60}}>
          <div style={{transform: `rotate(-4deg) scale(${lerp(1.5, 1, k)})`, border: `5px solid ${P.red}`, borderRadius: 18, padding: '22px 46px',
            boxShadow: `0 0 50px ${P.redGlow}, inset 0 0 30px ${P.redGlow}`, background: 'rgba(5,8,10,0.55)'}}>
            <div style={{fontFamily: F.sans, fontWeight: 800, fontSize: o.size ?? 96, color: P.red, letterSpacing: '0.02em', textAlign: 'center', lineHeight: 1.08}}
              dangerouslySetInnerHTML={{__html: o.s}} />
          </div>
        </AbsoluteFill>
      );
    }
    case 'chips':
    case 'list': {
      const items: string[] = o.items;
      return (
        <AbsoluteFill style={{justifyContent: 'center', paddingLeft: 160, opacity: life, paddingBottom: 60}}>
          {o.h ? <Label k={prog(t, g.s + 0.2, g.s + 0.7, easeOut)} style={{color: P.teal, marginBottom: 26}}>{o.h}</Label> : null}
          {items.map((it, i) => {
            const k = prog(t, g.s + 0.45 + i * 0.32, g.s + 1.2 + i * 0.32, easeOut);
            const bad = it.startsWith('✗');
            const good = it.startsWith('✓');
            const text = it.replace(/^[✗✓]\s*/, '');
            return (
              <div key={i} style={{display: 'flex', alignItems: 'center', gap: 26, marginBottom: 22, opacity: k, transform: `translateX(${(1 - k) * -36}px)`}}>
                <div style={{width: 58, height: 58, borderRadius: 29, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.sans, fontSize: 30, fontWeight: 700,
                  color: bad ? P.red : good ? P.teal : P.cream, border: `2px solid ${bad ? P.red : good ? P.teal : P.creamDim}`,
                  boxShadow: `0 0 22px ${bad ? P.redGlow : good ? P.tealGlow : 'transparent'}`}}>{bad ? '✕' : good ? '✓' : i + 1}</div>
                <div style={{fontFamily: F.serif, fontSize: 76, color: bad ? P.creamDim : P.cream, textDecoration: bad ? `line-through ${P.red} 3px` : 'none'}}>
                  {sentence(text.replace(/^\d\.\s*/, ''))}
                </div>
              </div>
            );
          })}
        </AbsoluteFill>
      );
    }
    case 'quote':
      return (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 200px 60px'}}>
          <Label k={prog(t, g.s + 0.2, g.s + 0.8, easeOut) * life} style={{color: P.teal, marginBottom: 30}}>{o.label}</Label>
          <RichWords s={o.s} t={t} t0={g.s + 0.4} out={out} style={{fontSize: 104, maxWidth: 1450}} />
        </AbsoluteFill>
      );
    case 'sub': {
      const k = sp(fr, g.s + 0.6, {damping: 14, stiffness: 140, mass: 0.8}, EFPS);
      const ring = band(t, g.s + 1.8, g.s + 2.4);
      return (
        <div style={{position: 'absolute', left: 140, top: BAR + 90, opacity: k * life, transform: `translateY(${(1 - k) * 30}px)`, display: 'flex', alignItems: 'center', gap: 26}}>
          <div style={{width: 92, height: 92, borderRadius: 46, overflow: 'hidden', border: `2px solid ${P.teal}`, boxShadow: `0 0 30px ${P.tealGlow}`}}>
            <Img src={staticFile('lenny/L09.jpg')} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: '62% 35%'}} />
          </div>
          <div>
            <div style={{fontFamily: F.serif, fontSize: 60, color: P.cream, lineHeight: 1}}>Lenny's Scam Lab</div>
            <Label style={{marginTop: 8}}>One scam, taken apart, every week</Label>
          </div>
          <div style={{marginLeft: 20, padding: '16px 34px', borderRadius: 40, fontFamily: F.sans, fontWeight: 700, fontSize: 30,
            background: ring > 0.5 ? P.cream : P.red, color: ring > 0.5 ? P.black : P.cream, boxShadow: `0 0 30px ${P.redGlow}`}}>
            {ring > 0.5 ? '✓ Subscribed' : 'Subscribe'}
          </div>
        </div>
      );
    }
    case 'tag': {
      const k = prog(t, g.s + 0.4, g.s + 1.1, easeOut);
      return (
        <div style={{position: 'absolute', right: 130, top: BAR + 70, opacity: k * life, transform: `translateX(${(1 - k) * 40}px)`}}>
          <Glass style={{padding: '20px 30px', border: `1px solid ${o.c === 'red' ? P.red : P.teal}`, boxShadow: `0 0 40px ${o.c === 'red' ? P.redGlow : P.tealGlow}`}}>
            <Label style={{color: o.c === 'red' ? P.red : P.teal, fontSize: 24}}>{o.s}</Label>
          </Glass>
        </div>
      );
    }
    case 'call': {
      const k = sp(fr, g.s + 0.3, {damping: 15, stiffness: 150, mass: 0.9}, EFPS);
      return (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', opacity: k * life, left: 760, right: 0}}>
          {[0, 1, 2].map((i) => {
            const ph = ((t * 0.7 + i / 3) % 1);
            return <div key={i} style={{position: 'absolute', width: 220 + ph * 380, height: 220 + ph * 380, borderRadius: '50%', border: `2px solid ${P.red}`, opacity: (1 - ph) * 0.6}} />;
          })}
          <div style={{width: 220, height: 220, borderRadius: 110, background: 'rgba(16,24,27,0.85)', border: `2px solid ${P.red}`, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 120, fontFamily: F.serif, color: P.cream, boxShadow: `0 0 60px ${P.redGlow}`}}>
            {/unknown/i.test(o.from) ? '?' : (String(o.from).replace(/[^A-Za-z]/g, '')[0] || '?')}</div>
          <div style={{position: 'absolute', top: 690, textAlign: 'center'}}>
            <div style={{fontFamily: F.serif, fontSize: 84, color: P.cream}}>{String(o.from).replace(/"/g, '')}</div>
            <Label style={{marginTop: 4}}>{o.sub}</Label>
          </div>
        </AbsoluteFill>
      );
    }
    case 'cards': {
      const items: any[] = o.items;
      return (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', opacity: life, paddingBottom: 40}}>
          {o.h ? <RichWords s={o.h} t={t} t0={g.s + 0.2} style={{fontSize: 96, marginBottom: 40}} /> : null}
          <div style={{display: 'grid', gridTemplateColumns: `repeat(${items.length === 4 ? 2 : 3}, 440px)`, gap: 22}}>
            {items.map(([em, name, hot], i) => {
              const k = prog(t, g.s + 0.6 + i * 0.22, g.s + 1.3 + i * 0.22, easeOut);
              return (
                <div key={i} style={{opacity: k, transform: `translateY(${(1 - k) * 24}px)`, display: 'flex', alignItems: 'center', gap: 18, padding: '18px 24px', borderRadius: 18,
                  background: hot ? 'rgba(255,74,61,0.14)' : 'rgba(16,24,27,0.7)', border: `1px solid ${hot ? P.red : 'rgba(242,238,228,0.16)'}`,
                  boxShadow: hot ? `0 0 40px ${P.redGlow}` : 'none'}}>
                  <div style={{fontFamily: F.mono, fontSize: 20, color: hot ? P.red : P.muted}}>{String(i + 1).padStart(2, '0')}</div>
                  <div style={{fontSize: 34}}>{em}</div>
                  <div style={{fontFamily: F.sans, fontWeight: 600, fontSize: 30, color: P.cream}}>{name}</div>
                </div>
              );
            })}
          </div>
        </AbsoluteFill>
      );
    }
    case 'end':
      return (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', textAlign: 'center'}}>
          <RichWords s={o.s} t={t} t0={g.s + 0.2} style={{fontSize: 150, display: 'inline-block'}} />
          <Label k={prog(t, g.s + 1.2, g.s + 1.9, easeOut)} style={{marginTop: 34, color: P.cream}}>
            Lenny's Scam Lab <span style={{color: P.teal}}>·</span> Subscribe for the next one
          </Label>
        </AbsoluteFill>
      );
    default:
      return null;
  }
};
const sentenceKeepCaps = (s: string) => (/[a-z]/.test(s) ? s : s.length <= 14 ? s : sentence(s));

/* ---------- captions: the spoken line, word by word ---------- */
const Captions: React.FC<{caps: Cap[]; t: number; hide: boolean}> = ({caps, t, hide}) => {
  // binary search the active chunk
  let lo = 0, hi = caps.length - 1, idx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (caps[mid].a <= t + 0.05) { idx = mid; lo = mid + 1; } else hi = mid - 1;
  }
  if (idx < 0) return null;
  const c = caps[idx];
  if (t > c.b + 0.15) return null;
  const inn = prog(t, c.a - 0.05, c.a + 0.18, easeOut);
  const out = prog(t, c.b, c.b + 0.15, easeIn);
  const k = inn * (1 - out) * (hide ? 0 : 1);
  if (k <= 0.001) return null;
  return (
    <div style={{position: 'absolute', left: 0, right: 0, bottom: BAR + 44, textAlign: 'center', opacity: k, transform: `translateY(${(1 - inn) * 10}px)`}}>
      <div style={{display: 'inline-block', padding: '10px 26px', borderRadius: 14, background: 'rgba(5,8,10,0.42)', maxWidth: 1500}}>
        {c.w.map(([w, at], i) => {
          const said = t >= at - 0.02;
          const next = c.w[i + 1]?.[1] ?? c.b;
          const active = said && t < next;
          const pop = prog(t, at - 0.02, at + 0.16, easeOut);
          return (
            <span key={i} style={{fontFamily: F.sans, fontWeight: 650, fontSize: 52, letterSpacing: '-0.01em',
              color: active ? P.teal : P.cream, opacity: said ? 1 : 0.38, textShadow: active ? `0 0 24px ${P.tealGlow}, 0 2px 12px rgba(0,0,0,0.6)` : '0 2px 12px rgba(0,0,0,0.6)',
              display: 'inline-block', transform: `translateY(${(1 - pop) * 6}px)`, marginRight: '0.28em'}}>{w}</span>
          );
        })}
      </div>
    </div>
  );
};

export const LightLeak: React.FC<{k: number; x: number}> = ({k, x}) =>
  k <= 0.002 ? null : (
    <AbsoluteFill style={{mixBlendMode: 'screen', opacity: k, background: `radial-gradient(ellipse 45% 80% at ${x}% 45%, rgba(255,150,90,0.8) 0%, rgba(255,150,90,0.22) 35%, rgba(0,0,0,0) 70%)`}} />
  );
const Flare: React.FC<{k: number; y: number; color: string}> = ({k, y, color}) =>
  k <= 0.002 ? null : (
    <AbsoluteFill style={{mixBlendMode: 'screen', opacity: k}}>
      <div style={{position: 'absolute', left: -200, right: -200, top: y - 2, height: 4, background: color, filter: 'blur(3px)'}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: y - 30, height: 60, background: `linear-gradient(90deg, transparent, ${color}55, transparent)`, filter: 'blur(18px)'}} />
    </AbsoluteFill>
  );

const findSeg = (segs: Seg[], t: number) => {
  let lo = 0, hi = segs.length - 1, idx = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (segs[mid].s <= t) { idx = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return idx;
};

export const makeEpisode = (data: EpData, base: string, chapterCount = 9, unit = 'No.'): React.FC => () => {
  useFonts();
  const frame = useCurrentFrame();
  const t = frame / EFPS;
  const {segs} = data;
  const i = findSeg(segs, t);
  const g = segs[i];
  const nx = segs[i + 1];
  // the next shot starts drawing OV/2 before its cut
  const showNext = nx && t >= nx.s - OV * 0.5;
  const cur = showNext ? nx : g;
  const prev = showNext ? g : i > 0 && t < g.s + OV * 0.5 ? segs[i - 1] : null;
  const ci = showNext ? i + 1 : i;
  const big = (x: Seg) => x.kind === 'title' || x.trans === 'dip';
  // light leaks on soft cuts, a flare on chapter cards
  const cutT = cur.s;
  const near = 1 - clamp01(Math.abs(t - cutT) / 0.45);
  const leak = cur.trans === 'fade' || cur.trans === 'blur' ? 0.45 * Math.sin((Math.PI / 2) * near) : 0;
  const flare = big(cur) && cur.kind === 'title' ? Math.max(0, 1 - band(t, cur.s + 0.1, cur.s + 1.4)) * (t >= cur.s + 0.1 ? 0.85 : 0) : 0;
  const hideCaps = cur.kind === 'title' || cur.kind === 'notif' || (t < cur.s + 0.05 && prev?.kind === 'title');
  // letterbox breathes a little wider on chapter cards
  const bar = BAR + (cur.kind === 'title' ? 34 * prog(t, cur.s, cur.s + 0.8, easeInOut) * (1 - prog(t, cur.e - 0.5, cur.e, easeInOut)) : 0);
  const intro = prog(t, 0, 0.8, easeOut);
  const outro = prog(t, data.duration - 1.2, data.duration, easeIn);
  return (
    <AbsoluteFill style={{background: P.black}}>
      <AbsoluteFill style={{opacity: lerp(0.5, 1, intro) * (1 - outro)}}>
        {prev ? <Shot g={prev} t={t} base={base} idx={ci - 1} /> : null}
        {prev && cur.trans === 'dip' ? <AbsoluteFill style={{background: P.black, opacity: prog(t, cur.s - OV * 0.5, cur.s, easeIn)}} /> : null}
        <Transition g={cur} t={t}>
          <Shot g={cur} t={t} base={base} idx={ci} />
        </Transition>
        {prev && prev.e > t - 0.05 ? <Overlay g={prev} t={t} num={chapterCount} unit={unit} /> : null}
        {t >= cur.s - 0.02 ? <Overlay g={cur} t={t} num={chapterCount} unit={unit} /> : null}
        <LightLeak k={leak} x={25 + 50 * rand(ci)} />
        <Flare k={flare} y={560} color={P.red} />
        <Captions caps={data.caps} t={t} hide={hideCaps} />
      </AbsoluteFill>
      <Grain frame={frame} opacity={0.07} />
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: bar, background: '#000'}} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: bar, background: '#000'}} />
      {/* a quiet bug in the bar: channel mark */}
      <div style={{position: 'absolute', right: 60, top: (bar - 22) / 2, fontFamily: F.mono, fontSize: 18, letterSpacing: '0.24em', color: P.muted}}>
        LENNY'S SCAM LAB
      </div>
    </AbsoluteFill>
  );
};
