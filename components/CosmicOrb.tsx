"use client";

/**
 * "Cosmic Observatory" hero orb.
 *
 * A rendered-feeling orb built entirely from layered CSS gradients and SVG —
 * no three.js dependency, no rendered raster, zero runtime cost beyond CSS
 * paint. Stacks atmospheric halos, a multi-gradient glass sphere body, a
 * specular highlight, rim light, slow rotating inner latitude wireframes,
 * and an embedded glowing medical cross. Particles drift around it.
 */
export default function CosmicOrb() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* ── Far atmospheric halo ───────────────────────────────────────── */}
      <div
        className="absolute w-[170%] h-[170%] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(139,92,246,0.22) 0%, rgba(139,92,246,0.08) 35%, transparent 60%)",
          filter: "blur(60px)",
          animation: "orb-breathe 10s ease-in-out infinite",
        }}
      />

      {/* ── Mid atmospheric halo ───────────────────────────────────────── */}
      <div
        className="absolute w-[125%] h-[125%] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(167,139,250,0.4) 0%, rgba(139,92,246,0.15) 40%, transparent 65%)",
          filter: "blur(28px)",
        }}
      />

      {/* ── Orb body ───────────────────────────────────────────────────── */}
      <div className="relative w-[68%] aspect-square">
        {/* Base sphere — multi-gradient depth */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `
              radial-gradient(circle at 35% 25%, rgba(255,255,255,0.45) 0%, transparent 22%),
              radial-gradient(circle at 70% 78%, rgba(139,92,246,0.55) 0%, transparent 50%),
              radial-gradient(circle at 25% 75%, rgba(76,29,149,0.5) 0%, transparent 45%),
              radial-gradient(circle at 50% 50%, rgba(46,16,101,0.95) 0%, rgba(10,4,30,1) 75%)
            `,
            boxShadow: `
              inset 0 0 90px rgba(139,92,246,0.45),
              inset 0 0 180px rgba(196,181,253,0.18),
              inset 30px -25px 70px rgba(0,0,0,0.55),
              0 0 120px rgba(139,92,246,0.45),
              0 0 240px rgba(167,139,250,0.22),
              0 30px 80px rgba(0,0,0,0.5)
            `,
          }}
        />

        {/* Static wireframe latitudes — gives subtle 3D depth without motion noise */}
        <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <g fill="none" stroke="rgba(196,181,253,0.2)" strokeWidth="0.15">
              <ellipse cx="50" cy="50" rx="49" ry="8" />
              <ellipse cx="50" cy="50" rx="49" ry="22" />
              <ellipse cx="50" cy="50" rx="49" ry="36" />
            </g>
            <g fill="none" stroke="rgba(196,181,253,0.12)" strokeWidth="0.12">
              <ellipse cx="50" cy="50" rx="8" ry="49" />
              <ellipse cx="50" cy="50" rx="22" ry="49" />
              <ellipse cx="50" cy="50" rx="36" ry="49" />
            </g>
          </svg>
        </div>

        {/* Rim light — defines the sphere edge */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, transparent 84%, rgba(196,181,253,0.55) 94%, rgba(167,139,250,0.95) 99%, rgba(196,181,253,1) 100%)",
          }}
        />

        {/* Specular highlight — top-left */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 48% 36% at 32% 28%, rgba(255,255,255,0.55) 0%, transparent 55%)",
          }}
        />

        {/* Secondary highlight — bottom rim catch */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 30% 12% at 65% 82%, rgba(196,181,253,0.35) 0%, transparent 60%)",
          }}
        />

        {/* Embedded glowing medical cross */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ animation: "cross-pulse 5s ease-in-out infinite" }}
        >
          <svg width="44%" viewBox="0 0 100 100" style={{ filter: "drop-shadow(0 0 14px rgba(196,181,253,0.95)) drop-shadow(0 0 30px rgba(167,139,250,0.7))" }}>
            <defs>
              <linearGradient id="cross-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="40%" stopColor="#e9d5ff" />
                <stop offset="100%" stopColor="#a78bfa" />
              </linearGradient>
            </defs>
            <path
              d="M 32 14 H 68 V 32 H 86 V 68 H 68 V 86 H 32 V 68 H 14 V 32 H 32 Z"
              fill="url(#cross-fill)"
              stroke="rgba(245,243,255,0.85)"
              strokeWidth="0.8"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Inner soft cross halo — subtle */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          aria-hidden
        >
          <div
            className="rounded-full"
            style={{
              width: "55%",
              height: "55%",
              background: "radial-gradient(circle, rgba(196,181,253,0.16) 0%, transparent 65%)",
              filter: "blur(6px)",
            }}
          />
        </div>
      </div>

      {/* ── A small constellation of particles around the orb (8, not 18) ── */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        {Array.from({ length: 8 }).map((_, i) => {
          const angle = (i * 360) / 8 + 22;
          const radius = 52 + (i % 2) * 6;
          const rad = (angle * Math.PI) / 180;
          const x = 50 + Math.cos(rad) * radius;
          const y = 50 + Math.sin(rad) * radius;
          const size = 1.4 + (i % 3) * 0.6;
          const delay = (i * 0.6) % 4;
          return (
            <span
              key={i}
              className="absolute rounded-full"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                width: `${size}px`,
                height: `${size}px`,
                background: "rgba(196,181,253,0.85)",
                boxShadow: "0 0 6px rgba(196,181,253,0.9)",
                animation: `particle-drift 9s ease-in-out infinite`,
                animationDelay: `${delay}s`,
              }}
            />
          );
        })}
      </div>

      {/* ── Pedestal base glow — implies the orb is "resting" ─────────── */}
      <div
        className="absolute bottom-[10%] w-[40%] h-[10%] rounded-[100%] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse, rgba(167,139,250,0.55) 0%, transparent 65%)",
          filter: "blur(12px)",
        }}
      />
    </div>
  );
}
