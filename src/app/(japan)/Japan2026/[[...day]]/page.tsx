import JapanTrip from "@/japan/JapanTrip";

/** /Japan2026 and /Japan2026/countdown — the planner reads which from the URL. Days switch in place. */
export function generateStaticParams() {
  return [{ day: [] }, { day: ["countdown"] }];
}

export const dynamicParams = false;

export default function JapanPage() {
  return <JapanTrip />;
}
