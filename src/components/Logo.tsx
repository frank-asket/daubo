export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect
        x="2"
        y="4"
        width="16"
        height="6"
        rx="1"
        transform="skewY(-12)"
        className="fill-[var(--mint)]"
      />
      <rect
        x="5"
        y="11"
        width="16"
        height="6"
        rx="1"
        transform="skewY(-12)"
        className="fill-[var(--mint)] opacity-80"
      />
      <rect
        x="8"
        y="18"
        width="16"
        height="6"
        rx="1"
        transform="skewY(-12)"
        className="fill-[var(--mint)] opacity-55"
      />
    </svg>
  );
}

export function Logo({
  textClassName = "text-zinc-100",
}: {
  textClassName?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2.5 font-[family-name:var(--font-display)] font-semibold tracking-tight">
      <LogoMark />
      <span className={textClassName}>Daubo</span>
    </span>
  );
}
