import { useId } from "react";

/** Geometric vector wordmark based on the supplied Jup edu reference. */
export function Brand() {
  const gradient = useId();
  return (
    <svg className="jupBrand" viewBox="0 0 410 148" width="124" height="45" role="img" aria-label="Jup edu" focusable="false">
      <defs>
        <linearGradient id={gradient} gradientUnits="userSpaceOnUse" x1="4" y1="0" x2="408" y2="0">
          <stop stopColor="#83edf1" />
          <stop offset=".42" stopColor="#4b8bfa" />
          <stop offset=".76" stopColor="#2d41ff" />
          <stop offset="1" stopColor="#1800ff" />
        </linearGradient>
      </defs>
      <g fill={`url(#${gradient})`}>
        <text x="94" y="27" fontFamily="Arial, sans-serif" fontSize="25" fontWeight="800" letterSpacing="-1.5">edu</text>
        <path d="M94 38h42v62c0 34-23 46-64 46S4 135 4 99h42c0 17 10 23 26 23s22-7 22-24Z" />
        <path d="M141 38h43v59c0 18 9 25 24 25s24-7 24-25V38h43v62c0 34-24 46-67 46s-67-12-67-46Z" />
        <path fillRule="evenodd" d="M284 38h69c36 0 55 13 55 36s-19 36-55 36h-27v34h-42Zm42 26v22h23c13 0 18-3 18-11s-5-11-18-11Z" />
      </g>
    </svg>
  );
}
