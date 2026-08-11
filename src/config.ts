export const GAMEPAD_INDEX_OFFSET: number = 100; // 正字
export const VIRTUAL_INDEX_OFFSET: number = 200; // Task 6 用
export const SYSTEM_INDEX_OFFSET: number = 1000;
export const UI_INDEX_OFFSET: number = 2000;

/**
 * Readable controller-id constants. Values are unchanged from the historical magic
 * numbers — this only replaces the *reading* problem of scattered literals.
 *  keyboard 0–3, gamepad 100–103, virtual 200–203, system 1000, ui 2000.
 */
export const ControllerId = {
	KEYBOARD_1: 0,
	KEYBOARD_2: 1,
	KEYBOARD_3: 2,
	KEYBOARD_4: 3,
	GAMEPAD_1: 100,
	GAMEPAD_2: 101,
	GAMEPAD_3: 102,
	GAMEPAD_4: 103,
	VIRTUAL: 200,
	SYSTEM: 1000,
	UI: 2000,
	isKeyboard: (id: number) => id >= 0 && id < 100,
	isGamepad: (id: number) => id >= 100 && id < 200,
	isVirtual: (id: number) => id === 200,
} as const;

/**
 * The keyboard's fixed menu keys — what "driving a menu from a keyboard" means on every
 * machine, whatever the players have mapped for themselves. A menu is used by one person at a
 * time, and asking that person which of the four keyboard seats they are sitting in (so it can
 * look up *their* confirm key) is a question no menu should have to ask.
 *
 * They are always live in {@link UIInputMode.single}, and reserved from player mappings while
 * `preserveNavKeys` is on. Escape is separate (STRUCT below) because it is reserved in *both*
 * modes: it is the way out of anything, and a game may not take it away.
 */
export const KEYBOARD_HARDCODE_UI_BUTTON_NON_STRUCT: Record<string, string> = {
	up: "ArrowUp",
	down: "ArrowDown",
	left: "ArrowLeft",
	right: "ArrowRight",
	confirm: "Enter",
	cancel: "Backspace",
	nextTab: "Tab",
};
/**
 * The two keys no seat may ever claim, live in **both** UI modes.
 *
 * `escape` is the way out of anything. `info` is the same kind of thing pointing inwards: the
 * one key that opens whatever this screen has to *say* — a pad already spends its Back button
 * on it, and a keyboard had no equivalent at all, so anything reached by `info` was unreachable
 * without a pad. It cannot live in NON_STRUCT beside Enter, because NON_STRUCT is switched off
 * in {@link UIInputMode.multi} — which is exactly when a match is running and exactly when a
 * player wants it.
 *
 * CapsLock is the primary because it is the one large, idle, unbindable key every layout has.
 * Its OS lock still toggles — `preventDefault()` does not reach it in any browser — so a player
 * who opens this over a text field types in capitals until they press it again. That is the
 * price of the key, not a bug to chase. See {@link KEYBOARD_HARDCODE_UI_ALIAS} for the second
 * way in, and for the one thing CapsLock genuinely cannot do.
 */
export const KEYBOARD_HARDCODE_UI_BUTTON_STRUCT: Record<string, string> = {
	escape: "Escape",
	info: "CapsLock",
};

export const KEYBOARD_HARDCODE_UI_BUTTON: Record<string, string> = {
	...KEYBOARD_HARDCODE_UI_BUTTON_NON_STRUCT,
	...KEYBOARD_HARDCODE_UI_BUTTON_STRUCT,
};

/**
 * Extra physical keys that raise the same UI action as the entry of the same name in
 * {@link KEYBOARD_HARDCODE_UI_BUTTON}. Reserved from player mappings exactly as the primary is,
 * and merged into it frame by frame, so pressing either is indistinguishable downstream.
 *
 * It exists for one concrete reason: **CapsLock cannot be held on macOS.** WebKit and Chromium
 * report a lock key by its *lit state*, not its physical travel — one `keydown` when the light
 * comes on and one `keyup` when it goes off, with nothing in between — so `pressFrame` never
 * climbs and a hold-to-do-something gesture is not merely awkward there, it is unobservable.
 * Backquote is an ordinary key on every platform, so anything built on a *held* `info` still has
 * a way in. A tap works on both, everywhere; only the hold needs the alias.
 *
 * The hint bar names the primary — one key per action, or a legend becomes a list.
 */
export const KEYBOARD_HARDCODE_UI_ALIAS: Record<string, string[]> = {
	info: ["Backquote"],
};

/** Every physical key the hardcoded table claims for `table`'s actions, aliases included. */
export function hardcodedUIKeys(table: Record<string, string>): string[] {
	const keys: string[] = [];
	for (const action in table) {
		keys.push(table[action], ...(KEYBOARD_HARDCODE_UI_ALIAS[action] ?? []));
	}
	return keys;
}

export enum buttonLayout {
	xbox = "xbox",
	sony = "sony",
	nintendo = "nintendo",
	unknown = "unknown",
	keyboard = "keyboard",
}
