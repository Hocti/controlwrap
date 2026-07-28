let enabled = false;

/** Toggle controlwrap's internal debug logging (off by default). */
export function setDebug(on: boolean): void {
	enabled = on;
}

/** Log only when debug is enabled — the single sanctioned console path in controlwrap. */
export function debugLog(...args: unknown[]): void {
	if (enabled) console.log('[controlwrap]', ...args);
}
