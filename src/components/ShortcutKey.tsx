/**
 * The palette shortcut as the visitor's keyboard spells it: ⌘K on Apple
 * devices, Ctrl K everywhere else.
 *
 * Both are rendered and CSS shows one, keyed off <html data-mod>, which
 * MOD_KEY_INIT sets before first paint, so a Windows visitor never sees ⌘
 * flash first. No JS means ⌘.
 */

const APPLE = /Mac|iPhone|iPad|iPod/;

export const MOD_KEY_INIT = `
(function () {
  try {
    if (!${APPLE}.test(navigator.platform || navigator.userAgent)) document.documentElement.dataset.mod = "ctrl";
  } catch (e) {}
})();
`;

export default function ShortcutKey() {
  return (
    <>
      <span className="key-mac">⌘K</span>
      <span className="key-ctrl">Ctrl K</span>
    </>
  );
}
