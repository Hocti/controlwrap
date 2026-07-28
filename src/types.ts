import { Dpad } from "gamepad_standardizer";
import type { DpadPress, DirectionWrap, XY } from "gamepad_standardizer";
export { Dpad };
export type { DpadPress, DirectionWrap, XY };

import {
	GAMEPAD_INDEX_OFFSET,
	SYSTEM_INDEX_OFFSET,
	UI_INDEX_OFFSET,
	KEYBOARD_HARDCODE_UI_BUTTON,
	buttonLayout,
} from "./config";

export const UIButton = {
	...Dpad,
	confirm: "confirm",
	escape: "escape",
};
export enum UIButtonOptional {
	cancel = "cancel",
	info = "info",
	prevTab = "prevTab",
	nextTab = "nextTab",
}
export const AllUIButton = { ...UIButton, ...UIButtonOptional };

/**
 * Who the shared UI channel (`InputGroup.ui`) listens to. A game is two different things at
 * different moments and the two want opposite answers:
 *
 * - `single` — **one person is driving** (title, main menu, settings, results). Every connected
 *   device feeds the UI channel, so whichever pad is in reach works, and the keyboard's fixed
 *   menu keys (arrows / Enter / Backspace / Tab / Escape) are always live no matter what the
 *   four keyboard seats have mapped for themselves. This is the default: a game starts in a
 *   menu, and a menu that answers to only one of two plugged-in pads is a bug every time.
 *
 * - `multi` — **everyone is playing at once** (a lobby where each seat joins itself, the match).
 *   Only the main controller feeds the shared channel; every other device is read per seat from
 *   `InputGroup.player`, through that seat's own mapping. Without this, one player pressing
 *   their confirm to join would also press whatever the shared cursor happens to be on.
 *
 * Escape reaches the UI in both modes — it is the way out, and it is never a seat's private key.
 */
export enum UIInputMode {
	single = "single",
	multi = "multi",
}

export enum ControlType {
	system = "system",
	KEYBOARD = "keyboard",
	GAMEPAD = "gamepad",
	VIRTUAL = "virtual",
	//MOUSE="mouse",
}

export enum InputSource {
	system = "system",
	ui = "ui",
	player = "player",
	mouse = "mouse",
}

export type ButtonState = {
	press: boolean;
	just: boolean;
	double: boolean;
	tap: boolean;
	pressFrame: number;
};

export type gameInput = {
	//raw direction
	dpad?: DpadPress & { numpad: number } & XY; //gamepad dpad only, not analog
	analog?: DirectionWrap; //left analog only
	analog_right?: DirectionWrap; //right analog only

	//processed direction, mixed with left analog and dpad
	mixedDpad?: DpadPress & { numpad: number } & XY;
	directionButton?: Record<Dpad, ButtonState>;
	doublePressDirection?: boolean;

	//button
	button?: Record<string, ButtonState>;

	//extra
	/**
	 * Free-form one-frame messages a device can raise alongside the button/direction state.
	 * A physical gamepad has no such channel and never sets this — it exists for injected
	 * input (a touch UI: `'super'`, `'touchmove:10,-5'`). Cleared every frame.
	 */
	command?: string[];
};
export type systemInput = {
	source?: ControlType;
	sourceIndex?: number;
	//有system時，所有其他keyboard UI input無效

	//ui
	ui_tap: string[]; //confirm,pause
	ui_pressing: string[]; //confirm,pause
	ui_repeat: string[]; //confirm,pause
};
export type Input = systemInput & gameInput;

export type mappingRequirement = {
	//type:ControlType,
	direction: {
		dpad: boolean; //need pure gamepad dpad?
		analog: 0 | 1 | 2;
	};
	button: string[];
	optional?: string[];
	ui_button?: string[]; //up down left right confirm escape
	ui_optional?: string[];
	ui_pair: Record<string, string>; //ui_tap,button     e.g. 'confirm':'attack' jump:cancel,
};

export type mappingGroup = Record<string, string | string[]>;

export type latestLayoutGroup = {
	name: string;
	layout: buttonLayout;
	mapping: mappingGroup;
};

export type mouseInput = {
	xy?: XY;
	xyDelta?: XY;
	delta: number;
	buttons: Record<string, ButtonState>;
};

export type InputGroup = {
	[InputSource.ui]: Input;
	[InputSource.system]: Input;
	[InputSource.player]: Record<number, Input>;
	[InputSource.mouse]?: mouseInput;
};
// NOTE: the old draft `ControllerInfo` / `ControllerProfile` types were removed here —
// the new profile model lives in `useful/ProfileMapping.ts` (`ControllerProfile`).
