import { Dpad, DpadPress, getDpadDirection, XY } from "gamepad_standardizer";
import {
	ButtonState,
	mappingGroup,
	Input,
	ControlType,
	mappingRequirement,
	latestLayoutGroup,
	systemInput,
} from "../types";
import { inEnum, findKeyByValue, stopEvent, clone } from "../utils/utils";
import { Button, getUITap, joinState, isRepeat } from "./Button";
import InputDeviceMaster, { listenStatus } from "./InputDeviceMaster";
import { IControllerMaster } from "./IControllerMaster";
import {
	SYSTEM_INDEX_OFFSET,
	KEYBOARD_HARDCODE_UI_BUTTON,
	KEYBOARD_HARDCODE_UI_BUTTON_STRUCT,
	buttonLayout,
} from "../config";

const MAX_KEYBOARD = 4;
const F_ALL: string[] = ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12"];
// Keys no game may bind at all: the OS or the browser owns them, so a mapping would never
// fire reliably. Checked by checkMapping().
const ignoreKeys: string[] = ["Escape", "MetaLeft", "MetaRight", "PrintScreen", "NumLock"];
// Keys whose browser default is suppressed (F1 help, F5 reload, F11 fullscreen, Tab focus).
// They are still recorded as buttons, so a game that binds them does receive the press.
const ignoreFunction: string[] = ["Escape", "MetaLeft", "MetaRight", "Tab", ...F_ALL];
// Keys the *rebind UI* must not capture: someone hitting F5 means "reload", not "assign this
// key to jump". A game may still hard-code an F-key as a fixed default mapping — that is a
// deliberate choice by the game, not something a player fell into. Deliberately wider than
// ignoreKeys; keep the two apart.
const unlistenableKeys: string[] = [...ignoreKeys, ...F_ALL];
//'ContextMenu','OSLeft','OSRight','BrowserBack','BrowserForward','BrowserRefresh','BrowserStop','BrowserSearch','BrowserFavorites','BrowserHome','VolumeMute','VolumeDown','VolumeUp','MediaTrackNext','MediaTrackPrevious','MediaStop','MediaPlayPause'];

const defaultKBEventToKey = (event: KeyboardEvent) => {
	if (event.code) {
		return event.code;
	}
	if (event.location) {
		return `${event.key}-${event.location}`;
	}
	return event.key;
};

export default class KeyboardMaster extends InputDeviceMaster implements IControllerMaster {
	protected static instance: KeyboardMaster;
	public static getInstance(): KeyboardMaster {
		if (!KeyboardMaster.instance) {
			KeyboardMaster.instance = new KeyboardMaster();
		}
		return KeyboardMaster.instance;
	}

	static isSupported(): boolean {
		return "onkeydown" in window;
	}

	//================================================================

	private downKey: Set<string> = new Set();
	private downKey2: Set<string> = new Set();
	//private lastDownKey:Set<string>=new Set();

	private buttons: Record<string, Button> = {};
	private inited: boolean = false;

	/**
	 * When true (default) the arrow keys and Enter are *preserved* as global keyboard
	 * UI-navigation keys: they always feed the system input (menu up/down/left/right/confirm)
	 * AND cannot be remapped to any keyboard other than keyboard 0. Set it false to release
	 * them so they can be bound to any player (e.g. an arrow-keys player on keyboard 2); they
	 * then stop acting as global nav keys and menu navigation follows each player's own mapping.
	 *
	 * Escape is ALWAYS preserved regardless of this flag — it is the structural system key and
	 * can never be remapped or disabled.
	 */
	public preserveNavKeys: boolean = true;

	/**
	 * True while the app is in {@link UIInputMode.single} — one person driving a menu. The fixed
	 * menu keys are live then *whatever* `preserveNavKeys` says, because the two flags answer
	 * different questions: `preserveNavKeys` decides whether a player may **bind** the arrows and
	 * Enter for themselves, this one decides whether those keys **drive a menu**. Releasing the
	 * arrows so keyboard 3 can play with them never meant "menus no longer respond to arrows" —
	 * that was one flag doing two jobs, and it left a game with no keyboard menu keys at all.
	 *
	 * Set by ControlWrap when the mode changes; not meant to be written directly.
	 */
	public singleUserUI: boolean = true;

	/** @deprecated confusing inverse name — use {@link preserveNavKeys} instead. */
	public get allowNonStructedSystemKey(): boolean {
		return !this.preserveNavKeys;
	}
	public set allowNonStructedSystemKey(v: boolean) {
		this.preserveNavKeys = !v;
	}

	public customStopEventFn: ((event: KeyboardEvent) => boolean) | undefined;

	public get downKeyArray() {
		return Array.from(this.downKey2);
	}

	public kbEventToKey: (event: KeyboardEvent) => string = defaultKBEventToKey;

	// bound listeners kept so dispose() can remove exactly what init() added
	private _boundKeyDown = this.onKeyDown.bind(this);
	private _boundKeyUp = this.onKeyUp.bind(this);
	private _boundBlur = this.onBlur.bind(this);

	public init() {
		if (this.inited) {
			return;
		}
		this.inited = true;
		window.addEventListener("keydown", this._boundKeyDown);
		window.addEventListener("keyup", this._boundKeyUp);
		window.addEventListener("blur", this._boundBlur);

		this.totalKeyboard = 1;
	}

	public dispose(): void {
		if (!this.inited) return;
		window.removeEventListener("keydown", this._boundKeyDown);
		window.removeEventListener("keyup", this._boundKeyUp);
		window.removeEventListener("blur", this._boundBlur);
		this.inited = false;
	}

	private onKeyDown(event: KeyboardEvent): void {
		const keyCode = this.kbEventToKey(event);
		if (keyCode && !event.repeat) {
			if (this.customStopEventFn ? this.customStopEventFn(event) : ignoreFunction.indexOf(keyCode) >= 0) {
				stopEvent(event);
			}
			// A press consumed by a listen is spent: it does not also reach the game on the next
			// flush. Keyboard listening is answered here, on the DOM event — a frame or more
			// before anything reads the input — so without this the press did both jobs. The
			// Escape that cancelled a rebind went on to close the panel the rebind was in (and,
			// held, the panel under that); the key you assigned to "jump" also fired whatever it
			// had been bound to a moment earlier.
			if (this.listenDown(keyCode)) return;
			this.downKey.add(keyCode);
			this.downKey2.add(keyCode);
			if (!this.buttons[keyCode]) {
				this.buttons[keyCode] = new Button();
			}
			this.buttons[keyCode].press();
		}
	}

	private onKeyUp(event: KeyboardEvent): void {
		const keyCode = this.kbEventToKey(event);
		if (keyCode) {
			this.downKey.delete(keyCode);
			this.downKey2.delete(keyCode);
			if (!this.buttons[keyCode]) {
				this.buttons[keyCode] = new Button();
			}
			this.buttons[keyCode].release();
		}
	}

	private onBlur(_event: Event): void {
		for (let keyCode in this.buttons) {
			this.buttons[keyCode].release();
		}
		this.downKey.clear();
		this.downKey2.clear();
	}

	public importRequirement(requirement: mappingRequirement): void {
		/*
        if(requirement.type!==ControlType.KEYBOARD){
            throw new Error('mapping type must be keyboard');
        }
        if(!(requirement.direction.dpad && requirement.direction.analog==0)){
            throw new Error('keyboard must have dpad and no analog');
        }
        */
		if (requirement.ui_button && requirement.ui_button.indexOf("escape") >= 0) {
			throw new Error("not allow set escape");
		}
		this.requirement = clone(requirement) as mappingRequirement;
		//this.requirement=requirement;

		//this.setCount(1);
	}

	//================================================================

	private totalKeyboard: number = 0;
	//private controllers:KeyboardController[]=[];

	public count(): number {
		return this.totalKeyboard;
	}

	public getIndexs(): number[] {
		let result: number[] = [];
		for (let i = 0; i < this.totalKeyboard; i++) {
			result.push(i);
		}
		return result;
	}

	public getName(index: number): string {
		if (this.totalKeyboard === 1) {
			return "Keyboard";
		}
		return `Keyboard ${index + 1}`;
	}

	protected getInput(id: number, keyStatus: Record<string, ButtonState>): Input {
		const button: Record<string, ButtonState> = {};
		const ui_tap: string[] = [];
		const ui_pressing: string[] = [];
		const ui_repeat: string[] = [];
		const dpadPressed: DpadPress = {
			up: false,
			down: false,
			left: false,
			right: false,
		};
		const directionButton: Record<string, ButtonState> = {};
		let doublePress = false;
		let justDouble = false;
		let doublePressDirection = false;
		let ui_dpad_just: string = "";

		// currentMapping[id] maps buttonName (action) → keyCode(s); keyStatus is keyed by keyCode. (B16 fix: names were reversed)
		for (const buttonName in this.currentMapping[id]) {
			const keyCodes = this.currentMapping[id][buttonName];
			let status: ButtonState = {
				press: false,
				just: false,
				double: false,
				tap: false,
				pressFrame: 0,
			};
			if (typeof keyCodes === "string") {
				if (keyStatus[keyCodes]) {
					status = keyStatus[keyCodes];
				}
			} else {
				for (let i = 0; i < keyCodes.length; i++) {
					if (keyStatus[keyCodes[i]]) {
						status = joinState(status, keyStatus[keyCodes[i]]);
					}
				}
			}

			if (buttonName === "double") {
				doublePress = status.press;
				justDouble = status.just;
				continue;
			}

			//is dpad
			if (inEnum(buttonName, Dpad)) {
				dpadPressed[buttonName as Dpad] = status !== undefined && (status.press || status.tap);
				directionButton[buttonName] = status;

				if ((status.press && status.just) || status.tap) {
					ui_dpad_just = buttonName;
				}
				if (status.press) {
					ui_pressing.push(buttonName);
				}
				if (isRepeat(status)) {
					ui_repeat.push(buttonName);
				}

				doublePressDirection = doublePressDirection || status.double;
				continue;
			}

			//other ui button
			if (
				this.requirement!.button.indexOf(buttonName) >= 0 ||
				(this.requirement!.optional && this.requirement!.optional.indexOf(buttonName) >= 0)
			) {
				button[buttonName] = status;
				const ui_btn_name = findKeyByValue(this.requirement!.ui_pair, buttonName);
				if (ui_btn_name) {
					if ((status.press && status.just) || status.tap) {
						ui_tap.push(ui_btn_name);
					}
					if (status.press) {
						ui_pressing.push(ui_btn_name);
					}
					if (isRepeat(status)) {
						ui_repeat.push(ui_btn_name);
					}
				}
			} else if (
				status &&
				((this.requirement!.ui_button && this.requirement!.ui_button.indexOf(buttonName) >= 0) ||
					(this.requirement!.ui_optional && this.requirement!.ui_optional.indexOf(buttonName) >= 0))
			) {
				if ((status.press && status.just) || status.tap) {
					ui_tap.push(buttonName);
				}
				if (status.press) {
					ui_pressing.push(buttonName);
				}
				if (isRepeat(status)) {
					ui_repeat.push(buttonName);
				}
			}
		}

		const dpadResult: any = getDpadDirection(dpadPressed);
		delete dpadResult["radian"];
		delete dpadResult["degree"];
		delete dpadResult["distance"];
		delete dpadResult["type"];

		if (dpadResult.numpad % 2 == 0 && ui_dpad_just != "") {
			ui_tap.push(ui_dpad_just);
		}

		//double
		if (doublePress) {
			if (dpadResult.numpad !== 5) {
				for (let dir in directionButton) {
					if (
						!directionButton[dir].double &&
						(directionButton[dir].just || justDouble) &&
						directionButton[dir].press
					) {
						directionButton[dir].double = true;
					}
				}

				doublePressDirection = true;
			}
			for (let keyName in button) {
				if (button[keyName].tap || (button[keyName].just && button[keyName].press)) {
					button[keyName].double = true;
				}
			}
		}

		return {
			source: ControlType.KEYBOARD,
			sourceIndex: id,

			ui_tap,
			ui_pressing,
			ui_repeat,

			mixedDpad: dpadResult as DpadPress & { numpad: number } & XY,
			doublePressDirection,
			directionButton: directionButton as Record<Dpad, ButtonState>,

			button,

			//mapping:this.currentMapping[id]
		};
	}

	protected getSystemInput(keyStatus: Record<string, ButtonState>): Input {
		const sdf: Record<string, ButtonState> = {};
		// Escape (STRUCT) is always a system key. The rest — arrows, Enter, Backspace, Tab — are
		// system keys whenever one person is driving the UI (see singleUserUI), and additionally
		// whenever they are reserved from player mappings altogether (preserveNavKeys).
		const navKeys =
			this.preserveNavKeys || this.singleUserUI
				? KEYBOARD_HARDCODE_UI_BUTTON
				: KEYBOARD_HARDCODE_UI_BUTTON_STRUCT;
		for (let keyName in navKeys) {
			sdf[keyName] = keyStatus[navKeys[keyName]];
		}
		const ui_tap: string[] = [];
		const ui_pressing: string[] = [];
		const ui_repeat: string[] = [];

		for (const key in sdf) {
			if (!sdf[key]) continue;
			//key=ui_btn_name
			//sdf[key]=buttonState

			if (getUITap(sdf[key])) {
				ui_tap.push(key);
			}
			if (sdf[key].press) {
				ui_pressing.push(key);
			}
			if (isRepeat(sdf[key])) {
				ui_repeat.push(key);
			}
		}

		return {
			source: ControlType.system,
			ui_tap,
			ui_pressing,
			ui_repeat,
		};
	}

	public flushAll(): Record<number, Input> {
		const keyStatus: Record<string, ButtonState> = {};
		for (let keyCode in this.buttons) {
			keyStatus[keyCode] = this.buttons[keyCode].flush();
		}

		const result: Record<number, Input> = {};

		//keyboard master:
		result[SYSTEM_INDEX_OFFSET] = this.getSystemInput(keyStatus);

		//keyboards:
		for (let i = 0; i < this.totalKeyboard; i++) {
			result[i] = this.getInput(i, keyStatus);
		}

		//this.lastDownKey=new Set(this.downKey);
		this.downKey.clear();

		return result;
	}

	private unchangeCache: Record<string, number> = {};
	public flushUI(): Record<number, systemInput> {
		const keyStatus: Record<string, ButtonState> = {};
		for (let keyCode in this.buttons) {
			const press = this.downKey.has(keyCode);
			const lastPress = this.unchangeCache[keyCode] ?? 0;
			this.unchangeCache[keyCode] = press
				? this.unchangeCache[keyCode]
					? this.unchangeCache[keyCode] + 1
					: 1
				: 0;
			keyStatus[keyCode] = {
				press: press,
				just: press && lastPress == 0,
				double: false,
				tap: false,
				pressFrame: this.unchangeCache[keyCode],
			};
		}

		const result: Record<number, systemInput> = {};

		//keyboard master:
		result[SYSTEM_INDEX_OFFSET] = this.getSystemInput(keyStatus);

		//keyboards:
		for (let i = 0; i < this.totalKeyboard; i++) {
			const { source, sourceIndex, ui_tap, ui_pressing, ui_repeat } = this.getInput(i, keyStatus);
			result[i] = { source, sourceIndex, ui_tap, ui_pressing, ui_repeat };
		}

		return result;
	}

	//================================================================

	public listenControllerIndexFromKeys(keys: string[] = []): Promise<number> {
		const keys2 = [...keys];
		for (let k in this.requirement!.ui_pair) {
			if (keys.indexOf(k) >= 0) {
				keys2.push(this.requirement!.ui_pair[k]);
			}
		}
		return super.listenControllerIndexFromKeys(keys2);
	}

	/**
	 * Offer a key press to whatever is listening.
	 *
	 * @returns true when the listen took the press — the caller must then drop it, so the one
	 * press does one thing. Escape only counts as taken when a listen was really cancelled by
	 * it; with nothing listening it is an ordinary system key and must reach the game.
	 */
	private listenDown(keyCode: string): boolean {
		if (keyCode === "Escape") {
			this.emit("escape");
			if (this.listenMode !== listenStatus.none) {
				this.cancelListen("escape");
				return true;
			}
		} else if (this.listenMode === listenStatus.ControllerIndexFromKeys) {
			for (let i = 0; i < this.totalKeyboard; i++) {
				for (let keyName in this.currentMapping[i]) {
					if (
						this.currentMapping[i][keyName] === keyCode &&
						(this.listenKeys.length === 0 || this.listenKeys.indexOf(keyName) >= 0)
					) {
						this.listenMode = listenStatus.none;
						this.emit("listenControllerIndexFromKeys", i);
						return true;
					}
				}
			}
		} else if (this.listenMode === listenStatus.anyKey && unlistenableKeys.indexOf(keyCode) === -1) {
			this.listenMode = listenStatus.none;
			this.emit("listenKeyFromControllerIndex", keyCode);
			return true;
		}
		return false;
	}

	public listenKeyFromControllerIndex(): Promise<number> {
		this.listenMode = listenStatus.anyKey;

		this.removeAllListeners("cancelListen");
		this.removeAllListeners("listenKeyFromControllerIndex");

		return new Promise((resolve, reject) => {
			this.addListener("cancelListen", (reason?: string) => {
				this.listenMode = listenStatus.none;
				this.removeAllListeners("cancelListen");
				this.removeAllListeners("listenKeyFromControllerIndex");
				reject(reason);
			});
			this.addListener("listenKeyFromControllerIndex", (i) => {
				this.listenMode = listenStatus.none;
				this.removeAllListeners("cancelListen");
				this.removeAllListeners("listenKeyFromControllerIndex");
				resolve(i);
			});
		});
	}

	//mapping================================================================

	private defaultMapping: Record<number, mappingGroup> = {};

	public resetDefault(index: number): mappingGroup | undefined {
		if (this.defaultMapping[index]) {
			this.currentMapping[index] = clone(this.defaultMapping[index]);
		}
		return this.defaultMapping[index];
	}

	public setDefaultMapping(mapping: mappingGroup): void {
		this.setDefaultKeyboardMapping(0, mapping);
	}

	public setDefaultKeyboardMapping(id: number, mapping: mappingGroup): void {
		/*
        for(let buttonName in mapping){
            if(!this.checkMapping(id,buttonName,mapping[buttonName])){
                throw new Error(`mapping error: ${id} ${buttonName} ${mapping[buttonName]}`);
            }
        }
        */
		// Cloned: the caller's table is usually a module-level constant it goes on using (and often
		// hands to ProfileMapping as a factory profile as well), and the whole job of this copy is
		// to still say what the factory keys were after the player has rebound half of them.
		this.defaultMapping[id] = clone(mapping);
		if (!this.currentMapping[id]) {
			this.setAllMapping(id, mapping);
		}
	}

	public checkMapping(id: number, buttonName: string, keyCode: string): boolean {
		if (ignoreKeys.indexOf(keyCode) !== -1) return false;
		if (buttonName === "escape") return false;

		// Reserved system keys can't be remapped (except keyboard 0 keeping its own default).
		// Escape (STRUCT) is always reserved; arrows/Enter are reserved only while preserved.
		const reserved = this.preserveNavKeys ? KEYBOARD_HARDCODE_UI_BUTTON : KEYBOARD_HARDCODE_UI_BUTTON_STRUCT;
		if (Object.values(reserved).includes(keyCode) && (reserved[buttonName] !== keyCode || id != 0)) {
			return false;
		}

		return true;
	}

	public checkNotRepeat(id: number, buttonName: string, keyCode: string): boolean {
		for (let i = 0; i < this.totalKeyboard; i++) {
			for (let keyName in this.currentMapping[i]) {
				if (this.currentMapping[i][keyName] === keyCode && !(id == i && buttonName == keyName)) {
					return false;
				}
			}
		}
		return true;
	}

	public getMappableKeys(id: number = 0): {
		buttons: string[];
		optional: string[];
	} {
		const result = super.getMappableKeys(id);
		result.buttons = ["up", "down", "left", "right", ...result.buttons];
		return result;
	}

	//=======================

	public renewSystemButtonLayout(index: number): latestLayoutGroup {
		return {
			name: this.getName(index),
			layout: buttonLayout.keyboard,
			mapping: {
				...this.getAllMapping(index),
				...this.getPairMapping(index),
				escape: "escape",
			},
		};
	}

	public getPairMapping(id: number): mappingGroup {
		let result: mappingGroup = {};
		for (let ui_btn_name in this.requirement!.ui_pair) {
			const btn_name = this.requirement!.ui_pair[ui_btn_name];
			result[ui_btn_name] = this.currentMapping[id][btn_name];
		}
		return result;
	}

	public setPlayerCountFromKeyboard(num: number) {
		if (!this.inited) {
			throw new Error("not inited");
		}
		if (!this.requirement) {
			throw new Error("requirement not set");
		}
		if (!this.requirement) {
			throw new Error("requirement not set");
		}
		if (num < 1) {
			throw new Error("totalKeyboard must >=1");
		}
		if (num > MAX_KEYBOARD) {
			throw new Error(`totalKeyboard must <=${MAX_KEYBOARD}`);
		}
		const lastNum = this.totalKeyboard;
		this.totalKeyboard = num;
		if (lastNum > num) {
			for (let i = num; i < lastNum; i++) {
				this.emit("remove", i);
			}
		} else {
			for (let i = lastNum; i < num; i++) {
				this.emit("add", i);
			}
		}
		for (let i = 0; i < num; i++) {
			if (!this.currentMapping[i]) {
				this.currentMapping[i] = {};
				Object.keys(Dpad).forEach((keyName, index) => {
					this.currentMapping[i][keyName] = "";
				});
				this.requirement!.button.forEach((keyName, index) => {
					this.currentMapping[i][keyName] = "";
				});
				if (this.requirement!.optional) {
					this.requirement!.optional.forEach((keyName, index) => {
						this.currentMapping[i][keyName] = "";
					});
				}
				if (this.requirement!.ui_button) {
					this.requirement!.ui_button.forEach((keyName, index) => {
						this.currentMapping[i][keyName] = "";
					});
				}
				if (this.requirement!.ui_optional) {
					this.requirement!.ui_optional.forEach((keyName, index) => {
						this.currentMapping[i][keyName] = "";
					});
				}
				//
				this.resetDefault(i);
			}
		}
	}
}
