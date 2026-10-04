import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Fonts for the Open Graph images. The image renderer (Satori) can't use the
 * site's woff2 files or next/font, so TTFs are committed in src/og-fonts. The
 * two Japanese fonts are subset to Latin glyphs — the full files are megabytes
 * of kanji these images never draw.
 */
export async function ogFont(file: string) {
  return readFile(join(process.cwd(), "src/og-fonts", file));
}

export const OG_SIZE = { width: 1200, height: 630 };
