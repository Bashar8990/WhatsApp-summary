export function Logo({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="شعار ملخص الواتساب"
    >
      <rect width="64" height="64" rx="14" fill="#10b981" />
      <path
        d="M32 12c-11 0-20 7.5-20 16.7 0 4.7 2.3 9 6 12.1L16 52l11.4-3.2c1.5.4 3 .6 4.6.6 11 0 20-7.5 20-16.7S43 12 32 12z"
        fill="#fff"
      />
      <path
        d="M24 28h16M24 34h12"
        stroke="#10b981"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
