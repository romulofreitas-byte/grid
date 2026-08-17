"use client";

export function AngularBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-podium-navy"
    >
      <svg
        className="absolute inset-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="navyGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0B1A2E" />
            <stop offset="55%" stopColor="#12263F" />
            <stop offset="100%" stopColor="#0B1A2E" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#navyGrad)" />
      </svg>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(245,179,1,0.06),_transparent_55%)]" />
    </div>
  );
}
