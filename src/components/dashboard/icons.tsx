import type { SVGProps } from "react";

/** Small inline stroke icons used sparingly across the dashboard. */

type IconProps = SVGProps<SVGSVGElement>;

const shared = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...shared} strokeWidth={2} {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function ChatBubbleIcon(props: IconProps) {
  return (
    <svg {...shared} strokeWidth={1.75} {...props}>
      <path d="M4 5.5h16v10H9.5L6 19v-3.5H4v-10Z" />
    </svg>
  );
}
