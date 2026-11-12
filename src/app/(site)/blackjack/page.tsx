import type { Metadata, ResolvingMetadata } from "next";
import Blackjack from "@/components/Blackjack";
import { extras } from "@/lib/content";
import { pageMetadata } from "@/lib/metadata";

const page = extras.find(entry => entry.id === "blackjack")!;

export function generateMetadata(_: unknown, parent: ResolvingMetadata): Promise<Metadata> {
  return pageMetadata(page, parent);
}

export default function BlackjackPage() {
  return (
    <div className="panel-enter">
      <Blackjack />
    </div>
  );
}
