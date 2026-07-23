import type { SVGProps } from "react";

/** Small inline stroke icons used sparingly in Chat — no new icon dependency. */

type IconProps = SVGProps<SVGSVGElement>;

const shared = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function SpeakerIcon(props: IconProps) {
  return (
    <svg {...shared} strokeWidth={1.75} {...props}>
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7" />
    </svg>
  );
}

export function StopCircleIcon(props: IconProps) {
  return (
    <svg {...shared} strokeWidth={1.75} {...props}>
      <rect x="8" y="8" width="8" height="8" rx="1.5" />
    </svg>
  );
}

export function MicIcon(props: IconProps) {
  return (
    <svg {...shared} strokeWidth={1.75} {...props}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}
