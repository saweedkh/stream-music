/** Animated SVG background waves — identical to the auth experience page. */
export function LandingWaves() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <svg
        className="absolute inset-x-0 bottom-0 h-[55%] w-full"
        viewBox="0 0 1440 560"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="lwg1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.09" />
            <stop offset="50%" stopColor="#10b981" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.03" />
          </linearGradient>
          <linearGradient id="lwg2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.02" />
            <stop offset="40%" stopColor="#22c55e" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="lwg3" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.025" />
            <stop offset="60%" stopColor="#10b981" stopOpacity="0.015" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0.03" />
          </linearGradient>
        </defs>
        <g style={{ animation: "auth-wave-1 7s ease-in-out infinite" }}>
          <path
            fill="url(#lwg1)"
            d="M0,320 C240,140 420,380 680,260 C920,160 1120,340 1440,240 L1440,560 L0,560 Z"
          />
        </g>
        <g style={{ animation: "auth-wave-2 5s ease-in-out infinite" }}>
          <path
            fill="url(#lwg2)"
            d="M0,380 C320,300 560,420 820,340 C1040,280 1240,400 1440,360 L1440,560 L0,560 Z"
          />
        </g>
        <g style={{ animation: "auth-wave-3 9s ease-in-out infinite" }}>
          <path
            fill="url(#lwg3)"
            d="M0,430 C400,390 720,460 1080,400 C1260,380 1360,420 1440,410 L1440,560 L0,560 Z"
          />
        </g>
      </svg>
    </div>
  );
}
