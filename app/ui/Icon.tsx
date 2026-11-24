const shapes = {
  wand: <><path d="m4 20 12-12 4 4-12 12ZM14 10l4 4M5 3v4M3 5h4M19 1v4M17 3h4M21 17v4M19 19h4" /></>,
  arrow: <path d="M5 19 19 5M6 5h13v13" />,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" /><path d="M12 2V1" /></>,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  groups: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M2 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m1 3a5 5 0 0 1 5 5" />
    </>
  ),
  requests: (
    <>
      <path d="M20 14a3 3 0 0 1-3 3h-6l-6 4v-4a3 3 0 0 1-2-3V6a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3zM7 8h9M7 12h6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M7 3v4m10-4v4M3 10h18m-14 5h3" />
    </>
  ),
  teacher: (
    <>
      <path d="m2 9 10-5 10 5-10 5zM6 11v5c3 3 9 3 12 0v-5m4-2v7" />
    </>
  ),
  bookmark: <path d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-4-6 4z" />,
  filters: (
    <>
      <path d="M3 7h6m5 0h7M3 17h10m5 0h3" />
      <circle cx="11.5" cy="7" r="2.5" />
      <circle cx="15.5" cy="17" r="2.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  pin: (
    <>
      <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0z" />
      <circle cx="12" cy="10" r="2" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  star: (
    <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.8-5.4 2.8 1-6L3.2 9.4l6.1-.9L12 3Z" />
  ),
  rotate: <path d="M4 9a8 8 0 1 1-.2 5M4 3v6h6" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  send: <path d="m21 3-7 18-4-7-7-4 18-7ZM10 14 21 3" />,
};
export type IconName = keyof typeof shapes;
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {shapes[name]}
    </svg>
  );
}
