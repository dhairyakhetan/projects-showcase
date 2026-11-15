import { MOD_KEY_INIT } from "@/components/ShortcutKey";
import { INTRO_INIT } from "@/lib/intro";
import { THEME_INIT } from "@/lib/theme";

/** Everything that has to be settled before first paint, for both root layouts. */
export const PREPAINT = THEME_INIT + MOD_KEY_INIT + INTRO_INIT;
