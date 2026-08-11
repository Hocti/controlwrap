//import "keyboard_mouse"
//import "gamepad"

import ControlWrap from "./inputs/ControlWrap";

//import {IControllerMaster} from "./inputs/IControllerMaster";

import GamepadMaster from "./inputs/GamepadMaster";
import KeyboardMaster from "./inputs/KeyboardMaster";
import VirtualGamepadMaster from "./inputs/VirtualGamepadMaster";
export type { VirtualButtonName } from "./inputs/VirtualGamepadMaster";
export { VIRTUAL_BUTTON_NAMES } from "./inputs/VirtualGamepadMaster";

import PlayerIndexMapper from "./useful/PlayerIndexMapper";
export type { PlayerSlot } from "./useful/PlayerIndexMapper";
export { ProfileMapping } from "./useful/ProfileMapping";
export type { ControllerProfile } from "./useful/ProfileMapping";

export {
	//IControllerMaster,
	ControlWrap,
	GamepadMaster,
	KeyboardMaster,
	VirtualGamepadMaster,
	PlayerIndexMapper,
};

export * from "./types";

export { buttonLayout, ControllerId, GAMEPAD_INDEX_OFFSET, VIRTUAL_INDEX_OFFSET } from "./config";
// The fixed keyboard menu keys. Exported because a UI that *names* a key needs to be able to
// ask which one — they are not in any player mapping, so `renewSystemButtonLayout` cannot
// answer for them (see ControlWrap.preserveNavKeys).
export {
	KEYBOARD_HARDCODE_UI_BUTTON,
	KEYBOARD_HARDCODE_UI_BUTTON_NON_STRUCT,
	KEYBOARD_HARDCODE_UI_BUTTON_STRUCT,
	KEYBOARD_HARDCODE_UI_ALIAS,
	hardcodedUIKeys,
} from "./config";
export { getPairFromBtnName, getPairFromUiBtnName } from "./inputs/uiPairing";

export * from "./useful/InputHelper";
export * from "./useful/fighterHelper";
import pressHistory from "./useful/pressHistory";
export { pressHistory };

export { getUITap, getUIsTap, joinState, setMinDoubleFrame } from "./inputs/Button";

export { setDebug } from "./utils/debug";

export { isWindowActive } from "./utils/windowActive";

export * as gamepad_standardizer from "gamepad_standardizer";

import MouseMaster from "./inputs/MouseMaster";
export { MouseMaster };
