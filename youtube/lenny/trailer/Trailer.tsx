import React from 'react';
import {AbsoluteFill, Audio, Img, Sequence, staticFile, useCurrentFrame} from 'remotion';
import tl from '../../trailer.json';
import {band, clamp01, easeIn, easeInOut, easeOut, lerp, prog, rand, sp} from '../lib';
import {Grain, Mask} from '../components/primitives';
import {useFonts} from '../components/useFonts';

export const T = tl;
export const TFPS = T.fps;
export const TW = 1920;
export const TH = 1080;

// Palette and type for Lenny's Scam Lab: night teal, cream type, scam red, Lenny teal.
const P = {
  black: '#05080A',
  night: '#0B1417',
  cream: '#F2EEE4',
  creamDim: 'rgba(242,238,228,0.62)',
  muted: 'rgba(242,238,228,0.36)',
  red: '#FF4A3D',
  redGlow: 'rgba(255,74,61,0.55)',
  teal: '#1EE3CF',
  tealGlow: 'rgba(30,227,207,0.45)',
  gold: '#F5C542',
};
const F = {
  serif: '"Instrument Serif", Georgia, serif',
  sans: '"Inter Variable", Inter, system-ui, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
};
const BAR = 138; // 2.39:1 letterbox on a 16:9 frame

const img = (n: string) => staticFile(`lenny/${n}.jpg`);

/** A graded photographic plate: slow push, drift, focus pull, teal/orange grade, vignette. */
const Plate: React.FC<{
  src: string;
  t: number;
  t0: number;
  t1: number;
  z0?: number;
  z1?: number;
  x0?: number;
  x1?: number;
  focus?: number;
  dim?: number;
  ox?: number;
  oy?: number;
  ty?: number;
}> = ({src, t, t0, t1, z0 = 1.06, z1 = 1.16, x0 = 0, x1 = 0, focus = 1, dim = 0, ox = 50, oy = 46, ty = 0}) => {
  const k = prog(t, t0, t1, easeInOut);
  const z = lerp(z0, z1, k);
  const x = lerp(x0, x1, k);
  const blur = (1 - focus) * 18;
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <Img
        src={src}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `translate(${x}px, ${ty}px) scale(${z})`,
          transformOrigin: `${ox}% ${oy}%`,
          filter: `blur(${blur}px) contrast(1.12) saturate(0.82) brightness(${0.86 - dim * 0.6})`,
        }}
      />
      {/* split-tone grade: teal shadows, warm highlights */}
      <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(10,60,70,0.35), rgba(0,0,0,0) 45%, rgba(120,50,20,0.18))', mixBlendMode: 'soft-light'}} />
      <AbsoluteFill style={{background: 'radial-gradient(ellipse 70% 70% at 50% 50%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.72) 100%)'}} />
    </AbsoluteFill>
  );
};

/** Warm light leak that blooms across a cut. `k` 0..1..0 over its life. */
const LightLeak: React.FC<{k: number; x?: number; color?: string}> = ({k, x = 30, color = '255,150,90'}) =>
  k <= 0.001 ? null : (
    <AbsoluteFill
      style={{
        mixBlendMode: 'screen',
        opacity: k,
        background: `radial-gradient(ellipse 45% 80% at ${x}% 45%, rgba(${color},0.85) 0%, rgba(${color},0.25) 35%, rgba(0,0,0,0) 70%)`,
      }}
    />
  );

/** Anamorphic flare: a thin horizontal streak with a hot core. */
const Flare: React.FC<{k: number; y?: number; color?: string}> = ({k, y = 540, color = P.teal}) =>
  k <= 0.001 ? null : (
    <AbsoluteFill style={{mixBlendMode: 'screen', opacity: k}}>
      <div style={{position: 'absolute', left: -200, right: -200, top: y - 2, height: 4, background: color, filter: 'blur(3px)'}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: y - 30, height: 60, background: `linear-gradient(90deg, transparent, ${color}55, transparent)`, filter: 'blur(18px)'}} />
    </AbsoluteFill>
  );

const Label: React.FC<{children: React.ReactNode; k: number; style?: React.CSSProperties}> = ({children, k, style}) => (
  <div style={{fontFamily: F.mono, fontSize: 22, letterSpacing: '0.24em', textTransform: 'uppercase', color: P.creamDim, opacity: k, ...style}}>{children}</div>
);

/** Words revealed one by one through masks (0.09 s stagger). */
const Words: React.FC<{text: string; t: number; t0: number; out?: number; italic?: string[]; style?: React.CSSProperties}> = ({
  text, t, t0, out = 0, italic = [], style,
}) => (
  <div style={{fontFamily: F.serif, color: P.cream, lineHeight: 1, letterSpacing: '-0.02em', ...style}}>
    {text.split(' ').map((w, i) => {
      const it = italic.includes(w.replace(/[.,?!]/g, ''));
      return (
        <React.Fragment key={i}>
          <Mask k={prog(t, t0 + i * 0.09, t0 + i * 0.09 + 0.8, easeOut)} out={out}>
            <span style={it ? {fontStyle: 'italic', color: P.red, textShadow: `0 0 40px ${P.redGlow}`, paddingRight: '0.08em'} : {}}>{w}</span>
          </Mask>
          {' '}
        </React.Fragment>
      );
    })}
  </div>
);

const CARDS: [string, string][] = [
  ['W_WINDOW', 'The delivery text'],
  ['L13', 'The bank call'],
  ['L19', '“Hi Mum”'],
  ['L25', 'The easy job'],
  ['L30', 'The keen buyer'],
  ['L35', 'The frozen screen'],
];

const ColdOpen: React.FC<{t: number}> = ({t}) => {
  const o = T.open;
  const fadeIn = lerp(0.55, 1, prog(t, o.in, o.in + 1.2, easeOut));
  const out = prog(t, o.exit - 0.15, o.exit + 0.35, easeIn);
  const notif = sp(t * TFPS, o.notif, {damping: 16, stiffness: 150, mass: 0.9}, TFPS);
  const typed = 'Incoming · 02:14 AM';
  const chars = Math.floor(clamp01((t - o.label) / 0.7) * typed.length);
  return (
    <AbsoluteFill style={{opacity: 1 - out}}>
      <AbsoluteFill style={{opacity: fadeIn}}>
        <Plate src={img('PHONE')} t={t} t0={0} t1={5.6} z0={1.22} z1={1.1} focus={lerp(0.45, 1, band(t, 0, 1.4))} ox={52} oy={55} />
      </AbsoluteFill>
      <Label k={1} style={{position: 'absolute', left: 120, top: BAR + 46}}>
        {typed.slice(0, chars)}
        <span style={{opacity: Math.floor(t * 2.4) % 2 ? 0 : 1, color: P.teal}}>▍</span>
      </Label>
      {/* glass notification */}
      <div
        style={{
          position: 'absolute', left: 1040, top: BAR + 60 + (1 - notif) * -60, width: 760, opacity: notif,
          padding: '26px 30px', borderRadius: 30, background: 'rgba(242,238,228,0.14)', backdropFilter: 'blur(26px)',
          border: '1px solid rgba(242,238,228,0.22)', boxShadow: '0 30px 80px rgba(0,0,0,0.5)', fontFamily: F.sans, color: P.cream,
        }}
      >
        <div style={{fontFamily: F.mono, fontSize: 18, letterSpacing: '0.18em', color: P.creamDim}}>📦 PARCEL SERVICE · NOW</div>
        <div style={{fontSize: 36, lineHeight: 1.3, marginTop: 10}}>
          Your parcel could not be delivered. Update your address:{' '}
          <span style={{color: '#8FC3FF', textDecoration: 'underline'}}>parcel-redelivery-update.info</span>
        </div>
      </div>
      <Words text="It looks real." italic={['real']} t={t} t0={o.line1} out={prog(t, o.exit - 0.1, o.exit + 0.3, easeIn)}
        style={{position: 'absolute', left: 120, bottom: BAR + 90, fontSize: 150}} />
    </AbsoluteFill>
  );
};

const Montage: React.FC<{t: number}> = ({t}) => {
  const m = T.montage;
  const i = Math.max(0, m.cards.reduce((acc: number, c: number, j: number) => (t >= c ? j : acc), 0));
  const c0 = m.cards[i];
  const wipe = prog(t, c0, c0 + 0.32, easeInOut);
  const prev = i > 0 ? CARDS[i - 1] : null;
  const [name, title] = CARDS[i];
  const out = prog(t, m.exit - 0.1, m.exit + 0.3, easeIn);
  const tt = t - c0;
  return (
    <AbsoluteFill style={{opacity: 1 - out}}>
      {prev && wipe < 1 ? <Plate src={img(prev[0])} t={t} t0={m.cards[i - 1]} t1={c0 + 0.4} z0={1.04} z1={1.13} /> : null}
      <AbsoluteFill style={{clipPath: `inset(0 ${(1 - wipe) * 100}% 0 0)`}}>
        <Plate src={img(name)} t={t} t0={c0} t1={c0 + 1.3} z0={1.16} z1={1.05} x0={i % 2 ? 30 : -30} x1={0} />
      </AbsoluteFill>
      {/* wipe edge glow */}
      {wipe > 0 && wipe < 1 ? (
        <div style={{position: 'absolute', top: 0, bottom: 0, left: `${wipe * 100}%`, width: 6, background: P.cream, boxShadow: `0 0 40px 12px ${P.tealGlow}`, opacity: 0.8}} />
      ) : null}
      <div style={{position: 'absolute', left: 120, bottom: BAR + 70}}>
        <div style={{fontFamily: F.serif, fontSize: 210, lineHeight: 0.8, color: 'transparent', WebkitTextStroke: `2px ${P.cream}`, opacity: 0.9}}>
          <Mask k={prog(t, c0 + 0.05, c0 + 0.6, easeOut)}>{`0${i + 1}`}</Mask>
        </div>
        <div style={{fontFamily: F.serif, fontSize: 84, color: P.cream, marginTop: 14, letterSpacing: '-0.01em'}}>
          <Mask k={prog(t, c0 + 0.12, c0 + 0.7, easeOut)}>{title}</Mask>
        </div>
      </div>
      <Label k={band(tt, 0.1, 0.4)} style={{position: 'absolute', right: 120, top: BAR + 46}}>Scam {`0${i + 1}`} / 07</Label>
    </AbsoluteFill>
  );
};

const Seven: React.FC<{t: number}> = ({t}) => {
  const s = T.seven;
  const hit = prog(t, s.hit, s.hit + 0.9, easeOut);
  const through = prog(t, s.through, s.through + 1.0, Easing2);
  const z = lerp(1.25, 1, hit) * lerp(1, 14, through);
  const glow = (1 - band(t, s.hit + 0.2, s.hit + 2.5)) * 0.6 + 0.4;
  const out = prog(t, s.exit - 0.1, s.exit + 0.3, easeIn);
  const anna = band(t, s.through + 0.35, s.through + 0.95);
  const notif = sp(t * TFPS, s.anna, {damping: 15, stiffness: 160, mass: 0.8}, TFPS);
  return (
    <AbsoluteFill style={{background: P.black, opacity: 1 - out}}>
      <AbsoluteFill style={{opacity: anna}}>
        <Plate src={img('L39')} t={t} t0={s.through} t1={s.exit + 0.5} z0={1.18} z1={1.06} oy={40} />
        <div style={{
          position: 'absolute', left: 1080, top: BAR + 90 + (1 - notif) * -50, opacity: notif, width: 600, padding: '24px 30px', borderRadius: 30,
          background: 'rgba(242,238,228,0.95)', color: '#111', fontFamily: F.sans, boxShadow: '0 30px 80px rgba(0,0,0,0.55)',
        }}>
          <div style={{fontFamily: F.mono, fontSize: 18, letterSpacing: '0.16em', color: '#777'}}>+1 (415) 555-0142 · 9:41 PM</div>
          <div style={{fontSize: 40, marginTop: 8}}>Hi, is this Anna? 🙂</div>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{opacity: 1 - anna, alignItems: 'center', justifyContent: 'center'}}>
        <AbsoluteFill style={{background: `radial-gradient(ellipse 30% 45% at 50% 50%, ${P.redGlow} 0%, rgba(0,0,0,0) 70%)`, opacity: glow * hit}} />
        <div style={{fontFamily: F.serif, fontStyle: 'italic', fontSize: 620, lineHeight: 1, color: P.cream, transform: `scale(${z})`,
          textShadow: `0 0 60px ${P.redGlow}`, opacity: hit, marginTop: -60}}>7</div>
        <div style={{position: 'absolute', bottom: BAR + 80, left: 0, right: 0, textAlign: 'center', opacity: 1 - through}}>
          <Words text="Almost nobody spots it." italic={['nobody']} t={t} t0={s.line} style={{fontSize: 96, display: 'inline-block'}} />
        </div>
        <Label k={band(t, s.hit + 0.5, s.hit + 1.0) * (1 - through)} style={{position: 'absolute', top: BAR + 46, left: 0, right: 0, textAlign: 'center', color: P.red}}>
          Scam 07 · the expensive one
        </Label>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
function Easing2(x: number) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

const Lenny: React.FC<{t: number}> = ({t}) => {
  const l = T.lenny;
  const inn = prog(t, l.in, l.in + 1.2, easeOut);
  const out = prog(t, l.exit - 0.1, l.exit + 0.35, easeIn);
  const swap = prog(t, l.swap, l.swap + 0.6, easeInOut);
  const sweep = prog(t, l.in + 0.2, l.in + 2.2, easeInOut);
  const lower = prog(t, l.lower, l.lower + 0.7, easeOut);
  return (
    <AbsoluteFill style={{opacity: inn * (1 - out)}}>
      <Plate src={img('lab')} t={t} t0={l.in} t1={l.swap + 0.6} z0={1.12} z1={1.24} ox={52} oy={58} ty={95} dim={0.15 * (1 - sweep)} />
      {/* light beam sweeping across the lab */}
      <AbsoluteFill style={{mixBlendMode: 'screen', opacity: 0.55 * Math.sin(Math.PI * sweep),
        background: `linear-gradient(105deg, rgba(0,0,0,0) ${lerp(-20, 90, sweep)}%, rgba(30,227,207,0.5) ${lerp(-10, 100, sweep)}%, rgba(0,0,0,0) ${lerp(0, 110, sweep)}%)`}} />
      <AbsoluteFill style={{opacity: swap}}>
        <Plate src={img('L09')} t={t} t0={l.swap} t1={l.exit + 0.5} z0={1.14} z1={1.04} ox={62} oy={40} />
      </AbsoluteFill>
      {/* lower third */}
      <div style={{position: 'absolute', left: 120, bottom: BAR + 80, opacity: lower * (1 - swap), transform: `translateX(${(1 - lower) * -40}px)`}}>
        <Label k={1} style={{color: P.teal}}>The host · ex-scammer</Label>
        <div style={{fontFamily: F.serif, fontSize: 120, color: P.cream, lineHeight: 1, marginTop: 8}}>Lenny</div>
        <div style={{width: 260 * lower, height: 3, background: P.teal, marginTop: 14, boxShadow: `0 0 18px ${P.tealGlow}`}} />
      </div>
      <Words text="Trust me. I ran it." italic={['ran']} t={t} t0={l.line} out={prog(t, l.exit - 0.15, l.exit + 0.25, easeIn)}
        style={{position: 'absolute', left: 120, bottom: BAR + 90, fontSize: 130}} />
    </AbsoluteFill>
  );
};

const Title: React.FC<{t: number}> = ({t}) => {
  const ti = T.title;
  const inn = prog(t, ti.in, ti.in + 0.6, easeOut);
  const track = prog(t, ti.line2, ti.line2 + 2.4, easeOut);
  const sub = prog(t, ti.sub, ti.sub + 0.8, easeOut);
  const fadeEnd = prog(t, ti.end - 0.6, ti.end, easeIn);
  return (
    <AbsoluteFill style={{background: P.black, opacity: inn * (1 - fadeEnd), alignItems: 'center', justifyContent: 'center'}}>
      <AbsoluteFill style={{background: `radial-gradient(ellipse 40% 35% at 50% 52%, rgba(255,74,61,${0.18 * track}) 0%, rgba(0,0,0,0) 70%)`}} />
      <div style={{textAlign: 'center', marginTop: -30}}>
        <Words text="Don't fall for" t={t} t0={ti.line1} style={{fontSize: 96, display: 'inline-block', color: P.creamDim}} />
        <div style={{fontFamily: F.serif, fontStyle: 'italic', fontSize: 250, lineHeight: 1, color: P.red, marginTop: 10,
          letterSpacing: `${lerp(0.35, -0.01, track)}em`, opacity: prog(t, ti.line2, ti.line2 + 0.5, easeOut),
          textShadow: `0 0 70px ${P.redGlow}`}}>
          scam #7
        </div>
        <div style={{marginTop: 40, opacity: sub, transform: `translateY(${(1 - sub) * 16}px)`}}>
          <Label k={1} style={{color: P.cream}}>
            Lenny's Scam Lab <span style={{color: P.teal}}>·</span> New episode
          </Label>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Trailer: React.FC = () => {
  useFonts();
  const frame = useCurrentFrame();
  const t = frame / TFPS;
  const m = T.montage, s = T.seven, ti = T.title;
  // light leaks and flares bridge the big cuts
  const leak = Math.max(
    Math.sin(Math.PI * clamp01((t - (T.open.exit - 0.3)) / 0.7)),
    ...m.cards.slice(1).map((c) => 0.55 * Math.sin(Math.PI * clamp01((t - (c - 0.08)) / 0.42))),
    Math.sin(Math.PI * clamp01((t - (T.lenny.in - 0.2)) / 0.8)) * 0.7,
  );
  const flare = Math.max(1 - band(t, s.hit, s.hit + 1.1), 0) * (t >= s.hit ? 1 : 0) + (t >= ti.line2 ? (1 - band(t, ti.line2, ti.line2 + 1.4)) * 0.8 : 0);
  return (
    <AbsoluteFill style={{background: P.black}}>
      {t < T.open.exit + 0.4 && <ColdOpen t={t} />}
      {t >= m.start && t < m.exit + 0.4 && <Montage t={t} />}
      {t >= s.hit - 0.05 && t < s.exit + 0.4 && <Seven t={t} />}
      {t >= T.lenny.in && t < T.lenny.exit + 0.4 && <Lenny t={t} />}
      {t >= ti.in && <Title t={t} />}
      <LightLeak k={leak} x={30 + 40 * rand(Math.floor(t * 2))} />
      <Flare k={flare} y={t >= ti.in ? 560 : 520} color={t >= ti.in ? P.red : P.teal} />
      <Grain frame={frame} opacity={0.08} />
      {/* letterbox */}
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: BAR, background: '#000'}} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: BAR, background: '#000'}} />
      {/* voice */}
      {(['vo1', 'vo2', 'vo3', 'vo4', 'vo5'] as const).map((k) => {
        const at = k === 'vo1' ? T.open.vo1 : k === 'vo2' ? m.vo2 : k === 'vo3' ? s.vo3 : k === 'vo4' ? T.lenny.vo4 : ti.vo5;
        return (
          <Sequence key={k} from={Math.round(at * TFPS)}>
            <Audio src={staticFile(`lenny/${k}.wav`)} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
