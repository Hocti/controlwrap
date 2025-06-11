import { dpadPress, directionWrap, xy, dpad } from "gamepad_standardizer";
import {
	GAMPEPAD_INDEX_OFFSET,
	SYSTEM_INDEX_OFFSET,
	UI_INDEX_OFFSET,
	KEYBOARD_HARDCODE_UI_BUTTON,
	buttonLayout,
} from "./config";

export const UIButton = {
	...dpad,
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

export enum ControlType {
	system = "system",
	KEYBOARD = "keyboard",
	GAMEPAD = "gamepad",
	//TOUCH="touch",
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
	dpad?: dpadPress & { numpad: number } & xy; //gamepad dpad only, not analog
	analog?: directionWrap; //left analog only
	analog_right?: directionWrap; //right analog only

	//processed direction, mixed with left analog and dpad
	mixedDpad?: dpadPress & { numpad: number } & xy;
	directionButton?: Record<dpad, ButtonState>;
	doublePressDirection?: boolean;

	//button
	button?: Record<string, ButtonState>;

	//extra
	//command?:string[],
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
	xy?: xy;
	xyDelta?: xy;
	delta: number;
	buttons: Record<string, ButtonState>;
};

export type InputGroup = {
	[InputSource.ui]: Input;
	[InputSource.system]: Input;
	[InputSource.player]: Record<number, Input>;
	[InputSource.mouse]?: mouseInput;
};
export type ControllerInfo = {
	wrappedIndex: number; //0 mixed keyboard+gamepad
	type: ControlType;
	index: number; //gamepad index / keyboard index
	name: string; //'keyboard' / gamepad_codeName
	profile?: string;
	isMainPlayer: boolean;
};

export type ControllerProfile = {
	name: string;
	type: "keyboard" | "xinput" | "gamepadName"; //gamepad_codeName
	gamepadName?: string;
	isDefault: boolean; //for 'keyboard'|'xinput' only
	mapping: mappingGroup;
};

/*
developer need input:

mappingRequirement:
default gamepad mappingRequirement
default Keyboard mappingRequirement

ControllerProfile:
default xinput ControllerProfile
default Keyboard ControllerProfile [array of 1~4]

player可自己再加減ControllerProfile
*/
