import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import {band, clamp01, easeIn, easeInOut, easeOut, lerp, prog, rand, sp} from '../lib';
import {Grain} from '../components/primitives';
import {useFonts} from '../components/useFonts';
import {Cap, F, Glass, Label, LightLeak, P, RichWords, sentence} from './Episode';

export const SW = 1080;
export const SH = 1920;
const FPS = 30;
const OV = 0.5;

type SSeg = {s: number; e: number; img: string; ov: Record<string, any> | null; words: [string, number][]; k: number};
export type ShortData = {duration: number; segs: SSeg[]; caps: Cap[]; screen: string; title: string};

/** A 16:9 plate filling a 9:16 frame: slow pan across the wide image, push in, grade, vignette. */
const VPlate: React.FC<{src: string; t: number; t0: number; t1: number; k: number}> = ({src, t, t0, t1, k}) => {
  const p = prog(t, t0 - OV, t1 + OV, (x) => x * 0.85 + 0.15 * easeInOut(x));
  // image is 3413 px wide at full height; pan within ±600 px of its centre
  const dir = k % 2 ? 1 : -1;
  const x = lerp(-380 * dir, 380 * dir, p) + (rand(k) - 0.5) * 300;
  const z = lerp(1.04, 1.12, p);
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <Img src={src} style={{position: 'absolute', height: '100%', width: 3413, left: (SW - 3413) / 2, objectFit: 'cover',
        transform: `translate(${x}px, 170px) scale(${z})`, transformOrigin: '50% 0%', filter: 'contrast(1.1) saturate(0.85) brightness(0.86)'}} />
      <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(10,60,70,0.32), rgba(0,0,0,0) 45%, rgba(120,50,20,0.16))', mixBlendMode: 'soft-light'}} />
      <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(5,8,10,0.95) 0%, rgba(5,8,10,0.6) 14%, rgba(5,8,10,0) 30%, rgba(5,8,10,0) 48%, rgba(5,8,10,0.9) 100%)'}} />
    </AbsoluteFill>
  );
};

const VCaptions: React.FC<{caps: Cap[]; t: number}> = ({caps, t}) => {
  let lo = 0, hi = caps.length - 1, idx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (caps[mid].a <= t + 0.05) { idx = mid; lo = mid + 1; } else hi = mid - 1;
  }
  if (idx < 0) return null;
  const c = caps[idx];
  if (t > c.b + 0.12) return null;
  const inn = prog(t, c.a - 0.05, c.a + 0.16, easeOut);
  const out = prog(t, c.b, c.b + 0.12, easeIn);
  return (
    <div style={{position: 'absolute', left: 70, right: 70, top: 1470, textAlign: 'center', opacity: inn * (1 - out), transform: `scale(${lerp(0.94, 1, inn)})`}}>
      {c.w.map(([w, at], i) => {
        const said = t >= at - 0.02;
        const next = c.w[i + 1]?.[1] ?? c.b;
        const active = said && t < next;
        const pop = prog(t, at - 0.02, at + 0.14, easeOut);
        return (
          <span key={i} style={{fontFamily: F.sans, fontWeight: 800, fontSize: 86, letterSpacing: '-0.02em', lineHeight: 1.15,
            color: active ? P.teal : P.cream, opacity: said ? 1 : 0.35, display: 'inline-block', marginRight: '0.24em',
            transform: `translateY(${(1 - pop) * 10}px)`,
            textShadow: active ? `0 0 30px ${P.tealGlow}, 0 4px 18px rgba(0,0,0,0.8)` : '0 4px 18px rgba(0,0,0,0.8)'}}>{w}</span>
        );
      })}
    </div>
  );
};

const VOverlay: React.FC<{g: SSeg; t: number}> = ({g, t}) => {
  const o = g.ov;
  if (!o) return null;
  const life = 1 - prog(t, g.e - 0.4, g.e - 0.05, easeIn);
  const fr = t * FPS;
  const k = sp(fr, g.s + 0.25, {damping: 16, stiffness: 150, mass: 0.9}, FPS);
  const box: React.CSSProperties = {position: 'absolute', left: 70, right: 70, top: 1060 + (1 - k) * -50, opacity: k * life};
  switch (o.t) {
    case 'notif':
      return (
        <div style={box}>
          <Glass>
            <div style={{fontFamily: F.mono, fontSize: 24, letterSpacing: '0.14em', color: P.creamDim, textTransform: 'uppercase'}}>{o.from}</div>
            <div style={{fontSize: 46, lineHeight: 1.28, marginTop: 12}}>
              {o.msg}{' '}{o.link ? <span style={{color: P.link, textDecoration: 'underline'}}>{o.link}</span> : null}
            </div>
          </Glass>
        </div>
      );
    case 'call':
      return (
        <div style={{...box, display: 'flex', alignItems: 'center', gap: 30}}>
          <Glass style={{display: 'flex', alignItems: 'center', gap: 30, width: '100%', border: `1px solid ${P.red}`, boxShadow: `0 0 50px ${P.redGlow}`}}>
            <div style={{width: 120, height: 120, borderRadius: 60, border: `2px solid ${P.red}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: F.serif, fontSize: 72, color: P.cream, transform: `scale(${1 + 0.05 * Math.sin(t * 8)})`}}>
              {/unknown/i.test(o.from) ? '?' : String(o.from).replace(/[^A-Za-z]/g, '')[0] || '?'}
            </div>
            <div>
              <div style={{fontFamily: F.serif, fontSize: 72, lineHeight: 1}}>{String(o.from).replace(/"/g, '')}</div>
              <Label style={{marginTop: 8}}>{o.sub}</Label>
            </div>
          </Glass>
        </div>
      );
    case 'chips':
    case 'list':
      return (
        <div style={{...box, top: 1020, opacity: life, padding: '28px 30px 10px', borderRadius: 28, background: 'rgba(5,8,10,0.62)', border: '1px solid rgba(242,238,228,0.14)'}}>
          {(o.items as string[]).map((it, i) => {
            const kk = prog(t, g.s + 0.4 + i * 0.3, g.s + 1.1 + i * 0.3, easeOut);
            return (
              <div key={i} style={{opacity: kk, transform: `translateX(${(1 - kk) * -30}px)`, display: 'flex', alignItems: 'center', gap: 22, marginBottom: 20}}>
                <div style={{width: 64, height: 64, borderRadius: 32, border: `2px solid ${P.teal}`, color: P.teal, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: F.sans, fontWeight: 700, fontSize: 34, boxShadow: `0 0 22px ${P.tealGlow}`, flexShrink: 0}}>✓</div>
                <div style={{fontFamily: F.serif, fontSize: 66, color: P.cream, lineHeight: 1.05}}>{sentence(it.replace(/^[✗✓]\s*/, ''))}</div>
              </div>
            );
          })}
        </div>
      );
    case 'stamp': {
      const kk = sp(fr, g.s + (o.at ?? 0.3), {damping: 11, stiffness: 210, mass: 0.7}, FPS);
      return (
        <div style={{position: 'absolute', left: 0, right: 0, top: 1100, display: 'flex', justifyContent: 'center', opacity: Math.min(1, kk * 2) * life}}>
          <div style={{transform: `rotate(-4deg) scale(${lerp(1.5, 1, kk)})`, border: `5px solid ${P.red}`, borderRadius: 18, padding: '20px 36px', background: 'rgba(5,8,10,0.55)',
            boxShadow: `0 0 50px ${P.redGlow}`, fontFamily: F.sans, fontWeight: 800, fontSize: 70, color: P.red, textAlign: 'center', lineHeight: 1.08}}
            dangerouslySetInnerHTML={{__html: o.s}} />
        </div>
      );
    }
    case 'cta': {
      const ring = band(t, g.s + 1.6, g.s + 2.1);
      return (
        <div style={{position: 'absolute', left: 0, right: 0, top: 1090, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: k * life}}>
<div style={{fontFamily: F.serif, fontSize: 76, color: P.cream, marginTop: 18}}>Lenny's Scam Lab</div>
          <div style={{marginTop: 18, padding: '18px 46px', borderRadius: 50, fontFamily: F.sans, fontWeight: 800, fontSize: 40,
            background: ring > 0.5 ? P.cream : P.red, color: ring > 0.5 ? P.black : P.cream, boxShadow: `0 0 40px ${P.redGlow}`}}>
            {ring > 0.5 ? '✓ Subscribed' : 'Subscribe'}
          </div>
        </div>
      );
    }
    default:
      return null;
  }
};

export const makeShort = (data: ShortData, base: string): React.FC => () => {
  useFonts();
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const {segs} = data;
  let i = 0;
  for (let j = 0; j < segs.length; j++) if (segs[j].s <= t) i = j;
  const g = segs[i];
  const nx = segs[i + 1];
  const showNext = nx && t >= nx.s - OV * 0.5;
  const cur = showNext ? nx : g;
  const prev = showNext ? g : i > 0 && t < g.s + OV * 0.5 ? segs[i - 1] : null;
  const mix = prog(t, cur.s - OV * 0.5, cur.s + OV * 0.5, easeInOut);
  const near = 1 - clamp01(Math.abs(t - cur.s) / 0.4);
  // the hook stays up top the whole time: it is what keeps a Shorts viewer from swiping
  const hookIn = prog(t, 0, 0.6, easeOut);
  const end = prog(t, data.duration - 0.6, data.duration, easeIn);
  const progress = clamp01(t / data.duration);
  return (
    <AbsoluteFill style={{background: P.black}}>
      <AbsoluteFill style={{opacity: lerp(0.55, 1, hookIn) * (1 - end)}}>
        {prev ? <VPlate src={staticFile(`${base}/${prev.img}.jpg`)} t={t} t0={prev.s} t1={prev.e} k={prev.k} /> : null}
        <AbsoluteFill style={{opacity: prev ? mix : 1}}>
          <VPlate src={staticFile(`${base}/${cur.img}.jpg`)} t={t} t0={cur.s} t1={cur.e} k={cur.k} />
        </AbsoluteFill>
        <LightLeak k={0.4 * Math.sin((Math.PI / 2) * near) * (i > 0 || showNext ? 1 : 0)} x={20 + 60 * rand(cur.k)} />
        {prev ? <VOverlay g={prev} t={t} /> : null}
        <VOverlay g={cur} t={t} />
        <VCaptions caps={data.caps} t={t} />
      </AbsoluteFill>
      {/* hook title */}
      <div style={{position: 'absolute', left: 70, right: 70, top: 210, textAlign: 'center', opacity: 1 - end}}>
        <Label k={prog(t, 0.2, 0.8, easeOut)} style={{color: P.teal, marginBottom: 18, fontSize: 24}}>Lenny's Scam Lab</Label>
        <RichWords s={data.screen} t={t} t0={0.05} stagger={0.07} style={{fontSize: 120, display: 'inline-block', textShadow: '0 6px 30px rgba(0,0,0,0.7)'}} />
      </div>
      <Grain frame={frame} opacity={0.07} />
      {/* progress line */}
      <div style={{position: 'absolute', left: 0, bottom: 0, height: 8, width: `${progress * 100}%`, background: P.teal, boxShadow: `0 0 16px ${P.tealGlow}`}} />
    </AbsoluteFill>
  );
};
