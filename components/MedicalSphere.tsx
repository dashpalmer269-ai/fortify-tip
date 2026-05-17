"use client";

/**
 * Wireframe globe with an embedded medical cross at the center.
 * Pure SVG — no three.js dependency. Latitude / longitude ellipses give
 * the 3D illusion. A soft atmospheric halo and a slow rotation make it feel
 * alive without being noisy.
 */
export default function MedicalSphere() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Outer atmospheric halo */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at center, rgba(139,92,246,0.35) 0%, rgba(139,92,246,0.12) 25%, rgba(139,92,246,0) 60%)",
          filter: "blur(20px)",
        }}
      />

      <svg
        viewBox="0 0 400 400"
        className="relative w-[90%] max-w-[440px] aspect-square"
        style={{ filter: "drop-shadow(0 0 60px rgba(139,92,246,0.4))" }}
      >
        <defs>
          {/* Sphere fill — gives depth */}
          <radialGradient id="sphere-fill" cx="38%" cy="32%">
            <stop offset="0%" stopColor="#c4b5fd" stopOpacity="0.18" />
            <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#1e0a3a" stopOpacity="0.4" />
          </radialGradient>

          {/* Specular highlight */}
          <radialGradient id="sphere-highlight" cx="35%" cy="28%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
            <stop offset="35%" stopColor="rgba(255,255,255,0.05)" />
            <stop offset="60%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>

          {/* Cross gradient — light at top, deeper violet at bottom */}
          <linearGradient id="cross-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f5f3ff" />
            <stop offset="55%" stopColor="#c4b5fd" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>

          {/* Edge rim glow */}
          <radialGradient id="sphere-rim" cx="50%" cy="50%">
            <stop offset="86%" stopColor="rgba(167,139,250,0)" />
            <stop offset="98%" stopColor="rgba(167,139,250,0.55)" />
            <stop offset="100%" stopColor="rgba(167,139,250,0.95)" />
          </radialGradient>
        </defs>

        {/* Base sphere fill */}
        <circle cx="200" cy="200" r="160" fill="url(#sphere-fill)" />

        {/* Rotating wireframe — slow drift */}
        <g
          stroke="rgba(167,139,250,0.28)"
          strokeWidth="0.6"
          fill="none"
          style={{
            transformOrigin: "200px 200px",
            animation: "sphere-rotate 60s linear infinite",
          }}
        >
          {/* Latitude rings */}
          <ellipse cx="200" cy="200" rx="160" ry="22" />
          <ellipse cx="200" cy="200" rx="160" ry="60" />
          <ellipse cx="200" cy="200" rx="160" ry="100" />
          <ellipse cx="200" cy="200" rx="160" ry="140" />
          {/* Equator — brighter */}
          <line x1="40" y1="200" x2="360" y2="200" stroke="rgba(167,139,250,0.45)" strokeWidth="0.7" />
          {/* Longitude lines */}
          <ellipse cx="200" cy="200" rx="22" ry="160" />
          <ellipse cx="200" cy="200" rx="60" ry="160" />
          <ellipse cx="200" cy="200" rx="100" ry="160" />
          <ellipse cx="200" cy="200" rx="140" ry="160" />
          {/* Prime meridian */}
          <line x1="200" y1="40" x2="200" y2="360" stroke="rgba(167,139,250,0.45)" strokeWidth="0.7" />
        </g>

        {/* Outer sphere outline */}
        <circle cx="200" cy="200" r="160" fill="none" stroke="rgba(167,139,250,0.45)" strokeWidth="1" />

        {/* Rim glow */}
        <circle cx="200" cy="200" r="160" fill="url(#sphere-rim)" />

        {/* Specular highlight (top-left, gives 3D feel) */}
        <circle cx="200" cy="200" r="160" fill="url(#sphere-highlight)" />

        {/* Soft pulse around the cross */}
        <circle
          cx="200"
          cy="200"
          r="55"
          fill="rgba(196,181,253,0.18)"
          style={{
            transformOrigin: "200px 200px",
            animation: "sphere-pulse 4s ease-in-out infinite",
          }}
        />

        {/* Medical cross — embedded at the center of the globe */}
        <g
          transform="translate(200, 200)"
          style={{ filter: "drop-shadow(0 0 12px rgba(196,181,253,0.55))" }}
        >
          <path
            d="M -34 -11 H -11 V -34 H 11 V -11 H 34 V 11 H 11 V 34 H -11 V 11 H -34 Z"
            fill="url(#cross-grad)"
            stroke="rgba(245,243,255,0.7)"
            strokeWidth="0.8"
            strokeLinejoin="round"
          />
        </g>
      </svg>

      {/* Distant orbital ring (decorative) */}
      <div
        className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center pointer-events-none"
        aria-hidden
      >
        <div
          className="rounded-full"
          style={{
            width: "115%",
            paddingBottom: "20%",
            border: "1px solid rgba(167,139,250,0.1)",
            transform: "rotateX(75deg)",
          }}
        />
      </div>
    </div>
  );
}
