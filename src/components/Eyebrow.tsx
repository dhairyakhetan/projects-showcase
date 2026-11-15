import { panels, type PanelId } from "@/lib/content";

/** "about.md" → ".md", "projects/" → "/": the code tag beside a plain page name. */
export function fileTag(file: string) {
  if (file.endsWith("/")) return "/";
  const dot = file.lastIndexOf(".");
  return dot === -1 ? "" : file.slice(dot);
}

/** "02 / About.md" — the number and name every page opens with, as in its tab. */
export default function Eyebrow({ id }: { id: PanelId }) {
  const index = panels.findIndex(panel => panel.id === id);
  const panel = panels[index];

  return (
    <p className="text-xs text-dim">
      <span className="text-accent">{String(index + 1).padStart(2, "0")}</span> / {panel.label}
      <span className="text-faint">{fileTag(panel.file)}</span>
    </p>
  );
}
