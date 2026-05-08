"use client";

export default function PerspectiveGrid() {
  return (
    <div
      className="absolute bottom-0 left-0 right-0 pointer-events-none overflow-hidden"
      style={{ height: 200 }}
    >
      <svg
        viewBox="0 0 1200 200"
        preserveAspectRatio="none"
        className="w-full h-full"
        style={{ animation: "grid-pulse 4s ease-in-out infinite" }}
      >
        <defs>
          <linearGradient id="gridFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(139,92,246,0.15)" />
            <stop offset="100%" stopColor="rgba(139,92,246,0)" />
          </linearGradient>
          <linearGradient id="hFade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(0,0,0,0)" />
            <stop offset="20%" stopColor="rgba(139,92,246,0.25)" />
            <stop offset="80%" stopColor="rgba(139,92,246,0.25)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </linearGradient>
        </defs>

        {/* Perspective vertical lines converging to vanishing point at 600,0 */}
        {Array.from({ length: 13 }, (_, i) => {
          const spread = (i - 6) * 100;
          return (
            <line
              key={i}
              x1={600 + spread * 0}
              y1={0}
              x2={600 + spread}
              y2={200}
              stroke="rgba(139,92,246,0.18)"
              strokeWidth="0.8"
            />
          );
        })}

        {/* Horizontal lines */}
        {Array.from({ length: 6 }, (_, i) => {
          const y = (i + 1) * 33;
          const perspective = i / 5;
          const halfW = 50 + perspective * 550;
          return (
            <line
              key={i}
              x1={600 - halfW}
              y1={y}
              x2={600 + halfW}
              y2={y}
              stroke={`rgba(139,92,246,${0.06 + perspective * 0.12})`}
              strokeWidth="0.7"
            />
          );
        })}

        {/* Fade overlay */}
        <rect x="0" y="0" width="1200" height="200" fill="url(#gridFade)" opacity="0.4" />
      </svg>
    </div>
  );
}
