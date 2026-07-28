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
export const KEYBOARD_HARDCODE_UI_BUTTON_STRUCT: Record<string, string> = {
	escape: "Escape",
};

export const KEYBOARD_HARDCODE_UI_BUTTON: Record<string, string> = {
	...KEYBOARD_HARDCODE_UI_BUTTON_NON_STRUCT,
	...KEYBOARD_HARDCODE_UI_BUTTON_STRUCT,
};

export enum buttonLayout {
	xbox = "xbox",
	sony = "sony",
	nintendo = "nintendo",
	unknown = "unknown",
	keyboard = "keyboard",
}
