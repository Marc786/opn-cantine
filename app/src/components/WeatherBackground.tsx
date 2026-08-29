'use client';

import { WeatherTheme } from '@/lib/domain/entities/config.entity';

interface WeatherBackgroundProps {
  theme: WeatherTheme;
}

// --- Sunny: clouds ---
const CLOUDS = [
  { top: '12%', left: '8%',  width: 120, delay: '0s',   duration: '18s', opacity: 0.75 },
  { top: '22%', left: '55%', width: 90,  delay: '-7s',  duration: '22s', opacity: 0.6  },
  { top: '8%',  left: '75%', width: 150, delay: '-12s', duration: '26s', opacity: 0.5  },
];

// --- Rain: 38 drops with staggered positions, sizes, speeds ---
const RAIN_DROPS = Array.from({ length: 38 }, (_, i) => ({
  id: i,
  left: `${(i * 2.7 + 1.3) % 100}%`,
  delay: `${-(i * 0.11 % 1.4)}s`,
  duration: `${0.55 + (i % 6) * 0.09}s`,
  opacity: 0.35 + (i % 5) * 0.1,
  height: `${50 + (i % 6) * 14}px`,
  width: i % 4 === 0 ? '2px' : '1.5px',
}));

// --- Snow: 45 flakes with dual animation ---
const FLAKES = Array.from({ length: 45 }, (_, i) => ({
  id: i,
  left: `${(i * 2.22 + 0.8) % 100}%`,
  size: `${4 + (i % 5) * 2.5}px`,
  fallDuration: `${6 + (i % 7) * 1.2}s`,
  swayDuration: `${3 + (i % 4) * 0.8}s`,
  swayAmp: `${8 + (i % 6) * 4}px`,
  delay: `${-(i * 0.31 % 7)}s`,
  opacity: 0.5 + (i % 4) * 0.12,
  blur: i % 5 === 0 ? '1px' : i % 3 === 0 ? '0.5px' : '0px',
}));

// --- Thunderstorm: heavy rain + lightning ---
const STORM_DROPS = Array.from({ length: 50 }, (_, i) => ({
  id: i,
  left: `${(i * 2.05 + 0.5) % 100}%`,
  delay: `${-(i * 0.09 % 1.2)}s`,
  duration: `${0.45 + (i % 5) * 0.07}s`,
  opacity: 0.45 + (i % 4) * 0.1,
  height: `${60 + (i % 5) * 16}px`,
}));

export function WeatherBackground({ theme }: WeatherBackgroundProps) {
  if (theme === 'default') return null;

  // ─── SUNNY ───────────────────────────────────────────────────────────────
  if (theme === 'sunny') {
    return (
      <>
        <style>{`
          @keyframes sun-pulse {
            0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.92; }
            50%       { transform: translate(-50%, -50%) scale(1.06); opacity: 1; }
          }
          @keyframes sun-rays-spin {
            from { transform: rotate(0deg); }
            to   { transform: rotate(360deg); }
          }
          @keyframes cloud-drift {
            0%, 100% { transform: translateX(0px); }
            50%       { transform: translateX(14px); }
          }
        `}</style>

        {/* Sky gradient */}
        <div style={{
          position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
          background: 'linear-gradient(160deg, #38bdf8 0%, #7dd3fc 35%, #bae6fd 70%, #e0f2fe 100%)',
        }} />

        {/* Sun glow halo */}
        <div style={{
          position: 'fixed', top: '-80px', right: '-80px',
          width: '320px', height: '320px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,220,50,0.45) 0%, rgba(255,160,0,0.18) 50%, transparent 70%)',
          zIndex: 1, pointerEvents: 'none',
        }} />

        {/* Conic-gradient rotating rays */}
        <div style={{
          position: 'fixed', top: '50px', right: '50px',
          width: '260px', height: '260px',
          background: `conic-gradient(
            from 0deg,
            transparent 0deg, rgba(255,210,0,0.28) 8deg, transparent 16deg,
            transparent 45deg, rgba(255,210,0,0.28) 53deg, transparent 61deg,
            transparent 90deg, rgba(255,210,0,0.28) 98deg, transparent 106deg,
            transparent 135deg, rgba(255,210,0,0.28) 143deg, transparent 151deg,
            transparent 180deg, rgba(255,210,0,0.28) 188deg, transparent 196deg,
            transparent 225deg, rgba(255,210,0,0.28) 233deg, transparent 241deg,
            transparent 270deg, rgba(255,210,0,0.28) 278deg, transparent 286deg,
            transparent 315deg, rgba(255,210,0,0.28) 323deg, transparent 331deg
          )`,
          borderRadius: '50%',
          zIndex: 1, pointerEvents: 'none',
          animation: 'sun-rays-spin 28s linear infinite',
          transformOrigin: '50% 50%',
        }} />

        {/* Sun core */}
        <div style={{
          position: 'fixed', top: '100px', right: '100px',
          width: '160px', height: '160px', borderRadius: '50%',
          background: 'radial-gradient(circle, #fef08a 20%, #fde047 55%, #facc15 80%, #eab308 100%)',
          boxShadow: '0 0 40px 12px rgba(250,204,21,0.45), 0 0 80px 30px rgba(234,179,8,0.2)',
          zIndex: 2, pointerEvents: 'none',
          animation: 'sun-pulse 5s ease-in-out infinite',
          transform: 'translate(-50%, -50%)',
        }} />

        {/* Floating clouds */}
        {CLOUDS.map((c, i) => (
          <div key={i} style={{
            position: 'fixed', top: c.top, left: c.left,
            width: `${c.width}px`, height: `${c.width * 0.38}px`,
            background: 'rgba(255,255,255,0.72)',
            borderRadius: '50px',
            filter: 'blur(1px)',
            zIndex: 1, pointerEvents: 'none',
            opacity: c.opacity,
            animation: `cloud-drift ${c.duration} ease-in-out ${c.delay} infinite`,
          }}>
            {/* Cloud bump */}
            <div style={{
              position: 'absolute',
              top: `-${c.width * 0.22}px`,
              left: `${c.width * 0.22}px`,
              width: `${c.width * 0.44}px`,
              height: `${c.width * 0.44}px`,
              borderRadius: '50%',
              background: 'inherit',
            }} />
          </div>
        ))}
      </>
    );
  }

  // ─── RAINY ───────────────────────────────────────────────────────────────
  if (theme === 'rainy') {
    return (
      <>
        <style>{`
          @keyframes rain-fall {
            0%   { transform: translateY(-60px) skewX(-8deg); opacity: 0; }
            8%   { opacity: 1; }
            88%  { opacity: 1; }
            100% { transform: translateY(108vh) skewX(-8deg); opacity: 0; }
          }
        `}</style>

        {/* Overcast sky */}
        <div style={{
          position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
          background: 'linear-gradient(180deg, #94a3b8 0%, #b0bec5 45%, #cfd8dc 100%)',
          opacity: 0.55,
        }} />

        {RAIN_DROPS.map((d) => (
          <div key={d.id} style={{
            position: 'fixed', top: 0, left: d.left,
            width: d.width, height: d.height,
            background: 'linear-gradient(180deg, transparent 0%, rgba(51,105,153,0.8) 100%)',
            borderRadius: '2px',
            zIndex: 1, pointerEvents: 'none',
            opacity: d.opacity,
            animation: `rain-fall ${d.duration} linear ${d.delay} infinite`,
            willChange: 'transform',
          }} />
        ))}
      </>
    );
  }

  // ─── SNOW ────────────────────────────────────────────────────────────────
  if (theme === 'snow') {
    return (
      <>
        <style>{`
          @keyframes snow-fall {
            0%   { transform: translateY(-10vh); opacity: 0; }
            6%   { opacity: 1; }
            100% { transform: translateY(115vh); opacity: 0.2; }
          }
          @keyframes snow-sway {
            0%, 100% { margin-left: 0; }
            25%       { margin-left: var(--sway); }
            75%       { margin-left: calc(var(--sway) * -1); }
          }
        `}</style>

        {/* Cold overcast sky */}
        <div style={{
          position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
          background: 'linear-gradient(180deg, #dbeafe 0%, #eff6ff 50%, #f8fafc 100%)',
          opacity: 0.75,
        }} />

        {/* Ice-glow at top */}
        <div style={{
          position: 'fixed', top: '-80px', left: '50%',
          transform: 'translateX(-50%)',
          width: '140%', height: '300px', borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(186,230,253,0.35) 0%, transparent 70%)',
          zIndex: 1, pointerEvents: 'none',
        }} />

        {FLAKES.map((f) => (
          <div key={f.id} style={{
            position: 'fixed', top: 0, left: f.left,
            width: f.size, height: f.size, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.98), rgba(200,230,255,0.5))',
            filter: f.blur ? `blur(${f.blur})` : undefined,
            boxShadow: '0 0 3px rgba(186,230,253,0.6)',
            zIndex: 1, pointerEvents: 'none',
            opacity: f.opacity,
            // @ts-expect-error CSS custom property
            '--sway': f.swayAmp,
            animation: `snow-fall ${f.fallDuration} linear ${f.delay} infinite, snow-sway ${f.swayDuration} ease-in-out ${f.delay} infinite`,
            willChange: 'transform',
          }} />
        ))}
      </>
    );
  }

  // ─── THUNDERSTORM ────────────────────────────────────────────────────────
  if (theme === 'storm') {
    return (
      <>
        <style>{`
          @keyframes storm-rain {
            0%   { transform: translateY(-60px) skewX(-12deg); opacity: 0; }
            6%   { opacity: 1; }
            90%  { opacity: 1; }
            100% { transform: translateY(110vh) skewX(-12deg); opacity: 0; }
          }
          @keyframes lightning-flash {
            0%, 80%, 86%, 89%, 100% { opacity: 0; }
            81%  { opacity: 0.7; }
            82%  { opacity: 0.05; }
            84%  { opacity: 0.9; }
            85%  { opacity: 0.05; }
            87%  { opacity: 0.6; }
            88%  { opacity: 0; }
          }
        `}</style>

        {/* Dark storm sky — subtle so dark text stays readable */}
        <div style={{
          position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
          background: 'linear-gradient(160deg, #1e293b 0%, #334155 50%, #475569 100%)',
          opacity: 0.45,
        }} />

        {/* Purple storm cloud center */}
        <div style={{
          position: 'fixed', top: '-60px', left: '50%',
          transform: 'translateX(-50%)',
          width: '150%', height: '280px', borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(70,20,150,0.18) 0%, transparent 70%)',
          filter: 'blur(20px)',
          zIndex: 1, pointerEvents: 'none',
        }} />

        {/* Lightning flash overlay (triple flicker) */}
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(220,230,255,0.38)',
          zIndex: 2, pointerEvents: 'none',
          animation: 'lightning-flash 7s ease-in-out infinite',
          mixBlendMode: 'screen',
        }} />

        {/* Heavy rain */}
        {STORM_DROPS.map((d) => (
          <div key={d.id} style={{
            position: 'fixed', top: 0, left: d.left,
            width: '1.5px', height: d.height,
            background: 'linear-gradient(180deg, transparent 0%, rgba(140,200,240,0.75) 100%)',
            borderRadius: '2px',
            zIndex: 1, pointerEvents: 'none',
            opacity: d.opacity,
            animation: `storm-rain ${d.duration} linear ${d.delay} infinite`,
            willChange: 'transform',
          }} />
        ))}
      </>
    );
  }

  // ─── SUNSET ──────────────────────────────────────────────────────────────
  if (theme === 'sunset') {
    return (
      <>
        <style>{`
          @keyframes sunset-shift {
            0%   { background-position: 0% 0%; }
            50%  { background-position: 0% 55%; }
            100% { background-position: 0% 0%; }
          }
          @keyframes sun-glow-pulse {
            0%, 100% { opacity: 0.55; transform: translateX(-50%) scale(1); }
            50%       { opacity: 0.8;  transform: translateX(-50%) scale(1.08); }
          }
        `}</style>

        {/* Animated multi-stop sunset gradient */}
        <div style={{
          position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
          background: `linear-gradient(180deg,
            #fbbf24 0%,
            #f97316 18%,
            #ef4444 32%,
            #9333ea 52%,
            #4f46e5 68%,
            #1e1b4b 85%,
            #0c0a1e 100%
          )`,
          backgroundSize: '100% 220%',
          animation: 'sunset-shift 14s ease-in-out infinite',
          opacity: 0.55,
        }} />

        {/* Sun at horizon glow */}
        <div style={{
          position: 'fixed', bottom: '28%', left: '50%',
          width: '300px', height: '300px',
          background: 'radial-gradient(circle, rgba(255,200,50,0.5) 0%, rgba(251,146,60,0.28) 40%, transparent 70%)',
          borderRadius: '50%',
          zIndex: 1, pointerEvents: 'none',
          animation: 'sun-glow-pulse 6s ease-in-out infinite',
        }} />

        {/* Horizon shimmer */}
        <div style={{
          position: 'fixed', bottom: '26%', left: 0, right: 0,
          height: '2px',
          background: 'linear-gradient(90deg, transparent, rgba(251,191,36,0.6), rgba(249,115,22,0.7), rgba(251,191,36,0.6), transparent)',
          zIndex: 1, pointerEvents: 'none',
          filter: 'blur(1px)',
        }} />
      </>
    );
  }

  return null;
}

