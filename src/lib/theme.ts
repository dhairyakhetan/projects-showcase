export type Theme = "dark" | "light";

/**
 * The browser's own bar colour (theme-color) for each theme: the page
 * background. It follows the site's theme, not the OS — dark is the default
 * here whatever the phone prefers, and a cream bar over a black page looks
 * broken.
 */
export const THEME_COLOR: Record<Theme, string> = {
  dark: "#0b0c0a",
  light: "#f3f1e9",
};

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
}

/**
 * Applies a stored theme before first paint. Has to be inline and blocking:
 * anything deferred is already too late and the wrong theme flashes. Dark is
 * the site's default whatever the OS prefers — light is opt-in.
 */
export const THEME_INIT = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") {
      document.documentElement.dataset.theme = stored;
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", ${JSON.stringify(THEME_COLOR)}[stored]);
    }
  } catch (e) {}
})();
`;
