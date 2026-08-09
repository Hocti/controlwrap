import { EventEmitter } from "eventemitter3";

//import * as gamepad_standardizer from "gamepad_standardizer"
import { Dpad, DP_BUTTON_NAME, getDpadDirection, DirectionWrap, XY } from "gamepad_standardizer";
import {
	ButtonState,
	mappingGroup,
	Input,
	systemInput,
	AllUIButton,
	mappingRequirement,
	ControlType,
	latestLayoutGroup,
} from "../types";
import { clone, findKeyByValue, inEnum } from "../utils/utils";
import { Button, isRepeat, getUITap, joinState } from "./Button";
import InputDeviceMaster, { listenStatus } from "./InputDeviceMaster";
import { IControllerMaster } from "./IControllerMaster";
import GamePadExtra, { InputPreprocess } from "./GamePadExtra";
import KeyboardMaster from "./KeyboardMaster";
import { buttonLayout } from "../config";
import { getPairFromBtnName, getPairFromUiBtnName } from "./uiPairing";
import { isWindowActive } from "../utils/windowActive";

const unchangeable = ["start", ...DP_BUTTON_NAME];

/**
 * A stick reading as a {@link systemInput.ui_scroll} amount — `undefined` while it rests inside
 * its deadzone, so "nobody is scrolling" is one check rather than two comparisons with zero.
 */
function toScroll(d: DirectionWrap | null | undefined): XY | undefined {
	if (!d || (d.x === 0 && d.y === 0)) return undefined;
	return { x: d.x, y: d.y };
}

enum Operation {
	Plus = "+",
	Minus = "-",
}

type RawEvent =
	| {
			index: number;
			type: "axes";
			axes_index: number;
			Operation: Operation;
	  }
	| {
			index: number;
			type: "hat";
			axes_index: number;
			HNum: number;
	  }
	| {
			index: number;
			type: "button";
			button_index: number;
	  };

export default class GamepadMaster extends InputDeviceMaster implements IControllerMaster {
	//static================================================================

	protected static instance: GamepadMaster;

	static getInstance(): GamepadMaster {
		if (!GamepadMaster.instance) {
			GamepadMaster.instance = new GamepadMaster();
		}
		return GamepadMaster.instance;
	}

	static isSupported(): boolean {
		if ("getGamepads" in navigator) return true;
		if ("onconnectedgamepad" in window) return true;
		return false;
	}

	//================================================================

	private inited: boolean = false;
	private gamePads: (GamePadExtra | undefined)[] = [];

	/**
	 * Ignore every gamepad while the window does not have focus (default true).
	 *
	 * The keyboard gets this for free — a blurred window is sent no key events — but a gamepad is
	 * *polled*, so without this a pad resting against something (or a player using another window)
	 * keeps driving a game nobody is looking at. Pads are still tracked and connect/disconnect
	 * still fires; only the input is read as "nothing pressed", so a button held across the blur
	 * releases rather than sticking, and rebind listening cannot capture a background press.
	 *
	 * Set false when the window being focused is not the question — an overlay, a kiosk, a
	 * second display, or anything driven while the player is looking elsewhere.
	 */
	public ignoreWhenWindowInactive: boolean = true;

	/** True when input should be read as "nothing pressed" this frame. */
	private get suppressed(): boolean {
		return this.ignoreWhenWindowInactive && !isWindowActive();
	}

	// bound listeners kept so dispose() can remove exactly what init() added
	private _boundAddGP = this.addGP.bind(this);
	private _boundRemoveGP = this.removeGP.bind(this);
	private _boundSystemEscape = this.systemEscape.bind(this);

	public count(): number {
		let counter = 0;
		const gps = navigator.getGamepads();
		for (let i = 0, t = gps.length; i < t; i++) {
			if (gps[i] && gps[i]?.connected) {
				counter++;
			}
		}
		return counter;
	}

	public getIndexs(): number[] {
		let result: number[] = [];
		const gps = navigator.getGamepads();
		for (let i = 0, t = gps.length; i < t; i++) {
			if (gps[i] && gps[i]?.connected) {
				result.push(i);
			}
		}
		return result;
	}

	public init() {
		if (this.inited) {
			return;
		}
		this.inited = true;
		window.addEventListener("gamepadconnected", this._boundAddGP);
		window.addEventListener("gamepaddisconnected", this._boundRemoveGP);

		KeyboardMaster.getInstance().addListener("escape", this._boundSystemEscape);
	}

	public dispose(): void {
		if (!this.inited) return;
		window.removeEventListener("gamepadconnected", this._boundAddGP);
		window.removeEventListener("gamepaddisconnected", this._boundRemoveGP);
		KeyboardMaster.getInstance().removeListener("escape", this._boundSystemEscape);
		this.inited = false;
	}

	public getGamepadExtra(index: number): GamePadExtra | undefined {
		if (this.gamePads[index]) {
			return this.gamePads[index];
		}
	}

	public getName(index: number): string {
		if (this.gamePads[index]) {
			const basename = this.gamePads[index]!.getName();
			for (let i = 0; i < this.gamePads.length; i++) {
				if (i === index) continue;
				if (this.gamePads[i] && this.gamePads[i]!.getName() === basename) {
					return basename + " " + (index + 1);
				}
			}
			return basename;
		}
		return "";
	}

	private addGP(event: GamepadEvent) {
		this.gamePads[event.gamepad.index] = new GamePadExtra(event.gamepad);
		this.resetDefault(event.gamepad.index);
		if (performance.now() > 5000) {
			this.gamePads[event.gamepad.index]!.vibration(100, 1, 1);
		}
		//*profile?
		this.emit("add");
	}

	private removeGP(event: GamepadEvent) {
		this.gamePads[event.gamepad.index] = undefined;

		if (this.listenMode != listenStatus.none && this.listeningIndex == event.gamepad.index) {
			this.cancelListen("unplug");
		}
		this.emit("remove");
	}

	public flushAll(): Record<number, Input> {
		return this.flushInner(false);
	}

	public flushUI(): Record<number, systemInput> {
		return this.flushInner(true);
	}

	private flushInner(uiOnly: boolean = false): Record<number, Input> {
		const result: Record<number, Input> = {};
		const gps = navigator.getGamepads();
		// Read once per flush, not per pad: every pad must agree on whether this frame counts.
		const suppressed = this.suppressed;
		for (let i = 0, t = gps.length; i < t; i++) {
			if (this.gamePads[i] === undefined) {
				continue;
			}
			const inputResult = this.gamePads[i]!.flush(gps[i]!, uiOnly, suppressed);
			// A rebind must not be answered by a window the player is not looking at — the press
			// that assigns a button belongs to whoever has focus.
			if (suppressed) {
				result[i] = this.processInput(i, inputResult, uiOnly);
				continue;
			}
			if (this.listenMode === listenStatus.raw && this.listeningIndex === i) {
				this.processRaw(gps[i]!);
			} else if (this.listenMode !== listenStatus.none) {
				this.listenDown(i, inputResult);
			}
			result[i] = this.processInput(i, inputResult, uiOnly);
		}
		return result;
	}

	public renewSystemButtonLayout(index: number): latestLayoutGroup {
		const mapping: mappingGroup = { ...this.currentMapping[index] };

		for (let uikeyName in AllUIButton) {
			if (inEnum(uikeyName, Dpad)) continue;
			mapping[uikeyName] = getPairFromUiBtnName(uikeyName, this.gamePads[index]!.swapAB);
		}

		return {
			name: this.gamePads[index]!.getName(),
			layout: this.gamePads[index]!.layout,
			mapping,
		};
	}

	private processInput(index: number, inputResult: InputPreprocess, uiOnly: boolean = false): Input {
		let doublePressDirection = false;
		let justDouble = false;
		const button: Record<string, ButtonState> = {};
		const ui_tap: string[] = [];
		const ui_pressing: string[] = [];
		const ui_repeat: string[] = [];

		//ui button
		for (let btnName in inputResult.button) {
			//button[btnName]=inputResult.button[btnName];
			const uiBtnName = getPairFromBtnName(btnName, this.gamePads[index]!.swapAB);

			if (uiBtnName != "") {
				if (getUITap(inputResult.button[btnName])) {
					ui_tap.push(uiBtnName);
				}
				if (inputResult.button[btnName].press) {
					ui_pressing.push(uiBtnName);
				}
				if (isRepeat(inputResult.button[btnName])) {
					ui_repeat.push(uiBtnName);
				}
			}
		}

		//ui button direction
		for (let btnName in inputResult.directionButton) {
			if (getUITap(inputResult.directionButton[btnName])) {
				ui_tap.push(btnName);
			}
			if (inputResult.directionButton[btnName].press) {
				ui_pressing.push(btnName);
			}
			if (isRepeat(inputResult.directionButton[btnName])) {
				ui_repeat.push(btnName);
			}
			doublePressDirection = doublePressDirection || inputResult.directionButton[btnName].double;
		}
		// The right stick is where "scroll the view" comes from on a pad — a UI action, so it goes
		// on the UI side of the input as `ui_scroll` and survives a UI-only flush, unlike every
		// other analog reading. See `systemInput.ui_scroll`.
		const ui_scroll = toScroll(inputResult.direction?.rightAnalog);

		if (uiOnly)
			return {
				source: ControlType.GAMEPAD,
				sourceIndex: index,
				ui_tap,
				ui_pressing,
				ui_repeat,
				ui_scroll,
			};

		const mixedDpad: any = getDpadDirection({
			up: inputResult.directionButton.up.press,
			down: inputResult.directionButton.down.press,
			left: inputResult.directionButton.left.press,
			right: inputResult.directionButton.right.press,
		});
		delete mixedDpad["type"];
		delete mixedDpad["radian"];
		delete mixedDpad["degree"];
		delete mixedDpad["distance"];

		//button
		for (let keyName in this.currentMapping[index]) {
			const btnNames: string[] =
				typeof this.currentMapping[index][keyName] === "string"
					? [this.currentMapping[index][keyName] as string]
					: (this.currentMapping[index][keyName] as string[]);

			for (let btnName of btnNames) {
				if (!inputResult.button[btnName]) continue;
				if (keyName === "double") {
					if (inputResult.button[btnName].press && mixedDpad.numpad != 5) {
						//mixedDpad.numpad%2==0
						doublePressDirection = true;
						justDouble = inputResult.button[btnName].just;
					}
					continue;
				}
				if (!button[keyName]) {
					button[keyName] = inputResult.button[btnName];
				} else {
					button[keyName] = joinState(button[keyName], inputResult.button[btnName]);
				}
			}
		}

		if (doublePressDirection) {
			for (let btnName in inputResult.directionButton) {
				if (inputResult.directionButton[btnName].just && inputResult.directionButton[btnName].press) {
					inputResult.directionButton[btnName].double = true;
				} else if (justDouble && inputResult.directionButton[btnName].press) {
					inputResult.directionButton[btnName].double = true;
				}
			}
		}

		const result: Input = {
			source: ControlType.GAMEPAD,
			sourceIndex: index,

			ui_tap,
			ui_pressing,
			ui_repeat,
			ui_scroll,

			mixedDpad,
			doublePressDirection,
			directionButton: inputResult.directionButton,

			button,
			//mapping:this.currentMapping[index]
		};
		if (this.requirement!.direction.dpad) {
			result.dpad = inputResult.direction!.dpad!;
		}
		if (this.requirement!.direction.analog >= 1) {
			result.analog = inputResult.direction!.leftAnalog!;
		}
		if (this.requirement!.direction.analog >= 2) {
			result.analog_right = inputResult.direction!.rightAnalog!;
		}

		return result;
	}

	//raw================================================================

	private listenRawGamepad: { axes: number[]; buttons: GamepadButton[] } | undefined;
	private listenRawType: { axes: boolean; button: boolean } = {
		axes: false,
		button: false,
	};

	public saveAllRelaseGPState(index: number): void {
		this.listenRawGamepad = {
			axes: [...this.gamePads[index]!.lastGamepad.axes],
			buttons: [...this.gamePads[index]!.lastGamepad.buttons],
		};
	}

	//* BUG: long press esc,then skip all?? should be only active on just down
	public listenRaw(index: number = 0, button: boolean = true, axes: boolean = false): Promise<RawEvent> {
		if (!this.gamePads[index] || !this.gamePads[index]!.lastGamepad.connected) {
			return Promise.reject(`no gamepad at ${index}`);
		}
		if (!button && !axes) {
			return Promise.reject(`all false`);
		}
		if (!button && axes && this.gamePads[index]!.lastGamepad.axes.length === 0) {
			return Promise.reject(`not axes`);
		}
		if (button && this.gamePads[index]!.lastGamepad.buttons.length < 2) {
			return Promise.reject(`at least 2 buttons`);
		}
		//* BUG: on firefox, long press start then trigger cancelListen
		/*
        for(let i=0;i<this.gamePads[index]!.lastGamepad.buttons.length;i++){
            if(this.gamePads[index]!.lastGamepad.buttons[i].pressed){
                return Promise.reject(`no button should be pressing : button ${i} is pressed`);
            }
        }
        */
		this.listenRawType = { axes, button };

		this.listenMode = listenStatus.raw;
		this.listeningIndex = index;
		//save old?
		this.removeAllListeners("cancelListen");
		this.removeAllListeners("listenRaw");

		return new Promise((resolve, reject) => {
			this.addListener("cancelListen", (reason: string | undefined) => {
				this.listenMode = listenStatus.none;
				this.removeAllListeners("cancelListen");
				this.removeAllListeners("listenRaw");
				reject(reason);
			});
			this.addListener("listenRaw", (obj: RawEvent) => {
				this.listenMode = listenStatus.none;
				this.removeAllListeners("cancelListen");
				this.removeAllListeners("listenRaw");
				resolve(obj);
			});
		});
	}

	private processRaw(rawGamepad: Gamepad) {
		if (this.listenRawType.axes) {
			rawGamepad.axes.forEach((axes_value, axes_index) => {
				const old_value = this.listenRawGamepad!.axes[axes_index];

				const HNum = Math.round(axes_value * 7);
				const OHNum = Math.round(old_value * 7);
				if (
					(OHNum == 9 || (OHNum == 0 && HNum != 0)) &&
					// (!(axes_value==0 || axes_value==1 || axes_value==-1) || !(old_value==0 || old_value==1 || old_value==-1)) &&
					Math.abs(axes_value * 7 - HNum) < 0.000001 &&
					Math.abs(old_value * 7 - OHNum) < 0.000001
				) {
					if (HNum != 9 && HNum != OHNum) {
						this.emit("listenRaw", {
							index: this.listeningIndex,
							type: "hat",
							axes_index,
							HNum,
						} as RawEvent);
						return;
					}
					return;
				}

				if (Math.abs(Math.abs(old_value) - Math.abs(axes_value)) > 0.75) {
					const Operation = axes_value > old_value ? "+" : "-";
					this.emit("listenRaw", {
						index: this.listeningIndex,
						type: "axes",
						axes_index,
						Operation,
					} as RawEvent);
					return;
				}
			});
		}

		if (this.listenRawType.button) {
			rawGamepad.buttons.forEach((gpBtn, button_index) => {
				if (gpBtn.pressed) {
					this.emit("listenRaw", {
						index: this.listeningIndex,
						type: "button",
						button_index,
					} as RawEvent);
					return;
				}
			});
		}
	}

	//================================================================

	private listenDown(index: number, inputResult: InputPreprocess) {
		if (this.listenMode === listenStatus.anyKey && index === this.listeningIndex) {
			if (getUITap(inputResult.button["start"])) {
				this.cancelListen("start");
				return;
			}

			if (this.listenMode === listenStatus.anyKey) {
				for (let btnName in inputResult.button) {
					if (unchangeable.indexOf(btnName) >= 0) {
						continue;
					}
					if (getUITap(inputResult.button[btnName])) {
						this.listenMode = listenStatus.none;
						this.emit("listenKeyFromControllerIndex", btnName);
						return;
					}
				}
			}
			return;
		} else if (this.listenMode === listenStatus.ControllerIndexFromKeys) {
			for (let btnName in inputResult.button) {
				if (this.listenKeys.length === 0) {
					this.listenMode = listenStatus.none;
					this.emit("listenControllerIndexFromKeys", index);
					return;
				}

				//key name (attack,jump)
				for (let keyName in this.currentMapping[index]) {
					if (
						this.listenKeys.indexOf(keyName) >= 0 &&
						this.currentMapping[index][keyName] === btnName &&
						getUITap(inputResult.button[btnName])
					) {
						this.listenMode = listenStatus.none;
						this.emit("listenControllerIndexFromKeys", index);
						return;
					}
				}

				//ui button name (confirm,escape)
				for (let uikeyName in AllUIButton) {
					const btnName = getPairFromUiBtnName(uikeyName, this.gamePads[index]!.swapAB);
					if (
						this.listenKeys.indexOf(uikeyName) >= 0 &&
						(getUITap(inputResult.button[btnName]) || getUITap(inputResult.directionButton[uikeyName]))
					) {
						this.listenMode = listenStatus.none;
						this.emit("listenControllerIndexFromKeys", index);
						return;
					}
				}

				//button name (a,start)
				for (let btnName in inputResult.button) {
					if (this.listenKeys.indexOf(btnName) >= 0 && getUITap(inputResult.button[btnName])) {
						this.listenMode = listenStatus.none;
						this.emit("listenControllerIndexFromKeys", index);
						return;
					}
				}
			}
			return;
		}
	}

	private listeningIndex: number = 0;

	public listenKeyFromControllerIndex(index: number): Promise<number> {
		this.listenMode = listenStatus.anyKey;
		this.listeningIndex = index;

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

	private systemEscape() {
		if (this.listenMode !== listenStatus.none) {
			this.cancelListen("escape");
		}
	}

	//mapping================================================================

	public importRequirement(requirement: mappingRequirement): void {
		/*
        if(requirement.type!==ControlType.GAMEPAD){
            throw new Error('mapping type must be GAMEPAD');
        }
        */
		this.requirement = clone(requirement) as mappingRequirement;
		if (this.requirement.ui_button) {
			for (const i in this.requirement.ui_button) {
				const btnName = this.requirement.ui_button[i];
				if (btnName in AllUIButton) {
					delete this.requirement.ui_button[i];
				}
			}
		}
		if (this.requirement.ui_optional) {
			for (const i in this.requirement.ui_optional) {
				const btnName = this.requirement.ui_optional[i];
				if (btnName in AllUIButton) {
					delete this.requirement.ui_optional[i];
				}
			}
		}
		if (this.requirement.ui_pair) {
			this.requirement.ui_pair = {};
			/*
            for(const btnName in this.requirement.ui_pair){
                if(btnName in AllUIButton){
                    delete this.requirement.ui_pair[btnName]
                }
            }
            */
		}
		//this.requirement=requirement;
	}

	protected defaultStandardMapping: mappingGroup = {};

	public resetDefault(index: number): mappingGroup | undefined {
		if (this.defaultStandardMapping) {
			this.currentMapping[index] = clone(this.defaultStandardMapping);
		}
		//*
		return this.defaultStandardMapping;
	}

	public setDefaultMapping(mapping: mappingGroup): void {
		// See KeyboardMaster.setDefaultKeyboardMapping — the default is a copy, so that a rebind
		// (which writes into `currentMapping`) can never reach the thing `resetDefault` restores.
		this.defaultStandardMapping = clone(mapping);
	}

	public checkMapping(index: number, buttonName: string, keyCode: string): boolean {
		if (unchangeable.indexOf(buttonName) >= 0) return false;
		return true;
	}

	public checkNotRepeat(index: number, buttonName: string, keyCode: string): boolean {
		for (let key in this.currentMapping[index]) {
			if (this.currentMapping[index][key] === keyCode && !(buttonName == key)) {
				return false;
			}
		}
		return true;
	}

	public override vibration(
		index: number,
		duration: number = 300,
		strongMagnitude: number = 1,
		weakMagnitude: number = 1,
	): void {
		//Promise<GamepadHapticsResult>{
		if (this.gamePads[index]) {
			this.gamePads[index]!.vibration(duration, strongMagnitude, weakMagnitude);
		}
		//return Promise.reject('no vibration');
	}
}
