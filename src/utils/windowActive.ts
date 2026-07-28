/**
 * "Is this window the one the player is actually looking at?"
 *
 * Keyboard and mouse answer this for free — the browser stops delivering their events to a
 * window that lost focus. A gamepad does not: `navigator.getGamepads()` is polled, not
 * delivered, so a pad left on a desk (or a player driving *another* window) keeps walking the
 * menu of a game nobody is looking at. Every consumer that wants to respect focus asks here, so
 * "active" means one thing across the libraries.
 *
 * Deliberately queried per call rather than cached behind focus/blur listeners: it is two cheap
 * DOM reads, and a cache would need an owner, an init and a dispose — plus it can go stale when
 * a window is focused before any listener is attached.
 */
export function isWindowActive(): boolean {
	// No DOM (unit tests, SSR): nothing can steal focus, so never suppress input.
	if (typeof document === "undefined") return true;
	if (typeof document.hasFocus === "function" && !document.hasFocus()) return false;
	// Minimised / background tab. hasFocus() usually already covers it; this catches the
	// browsers that keep reporting focus for a hidden tab.
	if (document.visibilityState === "hidden") return false;
	return true;
}
