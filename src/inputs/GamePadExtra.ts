import {
	getGamepadInfo,
	getDirection,
	getDirectionAvailable,
	getAnalogDirection,
	getDpadDirection,
	DirectSource,
	getButtonPress,
	getButtonName,
	DP_BUTTON_NAME,
	type GamepadInfo,
	Dpad,
	DpadPress,
	DirectionWrap,
	XY,
} from "gamepad_standardizer";
import { ButtonState } from "../types";
import { debugLog } from "../utils/debug";
import { Button } from "./Button";
import { buttonLayout } from "../config";

export type InputPreprocess = {
	direction?: Record<DirectSource, DirectionWrap | null>;
	button: Record<string, ButtonState>;
	directionButton: Record<string, ButtonState>;
};

/**
 * get:
 * info (name,defaultSwapAB,standard)
 * btn_names
 * btn_display_names
 * directionAvailable
 *
 * method:
 * flush: btn_standard_name : ButtonState , directionButton(mixed analog+dpad)
 * vibration
 */

declare global {
	interface Gamepad {
		hapticActuators?: GamepadHapticActuator[];
	}
}

export default class GamePadExtra {
	//last
	public lastGamepad: Gamepad;

	//info
	private info: GamepadInfo | undefined;
	private btn_names: (string | null)[] = [];
	private directionAvailable: Record<DirectSource, boolean> | undefined;

	private buttons: Record<string, Button> = {};

	private directionButton: Record<Dpad, Button> = {
		up: new Button(),
		down: new Button(),
		left: new Button(),
		right: new Button(),
	};

	public analogThreshold: number = 0.15;
	public swapAB: boolean = false;
	public layout: buttonLayout = buttonLayout.xbox;

	public getName(): string {
		return this.info?.name ?? "";
	}
	/** SDL vendor id (hex string) or '' if unknown/not loaded yet. */
	public getVendor(): string {
		return this.info?.vendor ?? "";
	}
	/** SDL product id (hex string) or '' if unknown/not loaded yet. */
	public getProduct(): string {
		return this.info?.product ?? "";
	}
	/** Whether the browser already reports this pad as standard (xinput) mapping. */
	public isStandard(): boolean {
		return this.info?.standard ?? false;
	}
	public getButtonNames(): (string | null)[] {
		return this.btn_names;
	}
	public getDirectionAvailable(): Record<DirectSource, boolean> {
		if (!this.directionAvailable) {
			return {
				dpad: false,
				leftAnalog: false,
				rightAnalog: false,
			};
		}
		return this.directionAvailable;
	}

	constructor(gamepad: Gamepad) {
		this.lastGamepad = gamepad;

		getGamepadInfo(gamepad).then((info) => {
			this.info = info;
			//one shared name set for every vendor — the per-vendor *look* is a webfont
			//choice, see `layout` / gamepad_standardizer's `padFontId`
			this.btn_names = getButtonName(this.info!);
			this.directionAvailable = getDirectionAvailable(this.info!);
			this.swapAB = this.info!.defaultSwapAB ?? false;

			for (let k in this.btn_names) {
				if (this.btn_names[k] && DP_BUTTON_NAME.indexOf(this.btn_names[k]!) < 0) {
					this.buttons[this.btn_names[k]!] = new Button();
				}
			}

			if (info.standard) {
				this.layout = buttonLayout.xbox;
			} else {
				this.layout = buttonLayout.unknown;
			}
			if (info.vendor) {
				if (info.vendor == "054c") {
					this.layout = buttonLayout.sony;
				} else if (info.vendor == "057e") {
					this.layout = buttonLayout.nintendo;
				}
			}
			//this.flush(gamepad);
		});
	}

	private unchangeCache: Record<string, number> = {};

	/**
	 * What {@link getDirection} would report for a pad at rest — same shape, same `null`s for the
	 * sources this pad does not have, so a caller reading `direction.dpad` cannot tell a released
	 * pad from an ignored one.
	 */
	private neutralDirection(): Record<DirectSource, DirectionWrap | null> {
		const available = this.getDirectionAvailable();
		const centre: XY = { x: 0, y: 0 };
		return {
			dpad: available.dpad
				? getDpadDirection({ up: false, down: false, left: false, right: false })
				: null,
			leftAnalog: available.leftAnalog ? getAnalogDirection(centre, this.analogThreshold) : null,
			rightAnalog: available.rightAnalog ? getAnalogDirection(centre, this.analogThreshold) : null,
		};
	}

	// Buttons / directions that were held when the window went away, and so must be physically
	// let go before they count again — see `flush`'s forceRelease.
	private heldThroughRelease: Set<string> = new Set();
	private wasForceReleased: boolean = false;

	/** `press` as the game should see it: false while `key` is still being held from before. */
	private holdBlock(key: string, press: boolean, resumed: boolean): boolean {
		if (resumed && press) {
			this.heldThroughRelease.add(key);
		}
		if (!this.heldThroughRelease.has(key)) return press;
		if (!press) this.heldThroughRelease.delete(key);
		return false;
	}

	/**
	 * @param unchange     UI-only pass: report raw press/just without touching the {@link Button}
	 *                     state machines (no tap / double / repeat bookkeeping).
	 * @param forceRelease Read the pad as if nothing were touched — for a window that does not
	 *                     have focus (see `isWindowActive`). The button state machines are still
	 *                     driven, so a press held across the blur is *released* here rather than
	 *                     frozen: it cannot stick.
	 *
	 * Whatever was still held when the window came back is then ignored until it is let go, which
	 * is what the keyboard does for free (a blurred window is sent no `keyup`, so `onBlur` drops
	 * every key and a key still down produces nothing until it is pressed again). Without it,
	 * returning to the window would fire whatever the player happened to be resting on.
	 */
	public flush(gamepad: Gamepad, unchange: boolean = false, forceRelease: boolean = false): InputPreprocess {
		if (!this.info) {
			return {
				button: {},
				directionButton: {
					up: {
						press: false,
						just: false,
						double: false,
						tap: false,
						pressFrame: 0,
					},
					down: {
						press: false,
						just: false,
						double: false,
						tap: false,
						pressFrame: 0,
					},
					left: {
						press: false,
						just: false,
						double: false,
						tap: false,
						pressFrame: 0,
					},
					right: {
						press: false,
						just: false,
						double: false,
						tap: false,
						pressFrame: 0,
					},
				},
				direction: {
					dpad: null,
					leftAnalog: null,
					rightAnalog: null,
				},
			};
		}

		/*
		if(this.lastTime==gamepad.timestamp){
			return this.lastInput!;
		}
		const thisSum=this.inputSum(gamepad);
		if(thisSum===this.lastSum){
			return this.lastInput!;
		}
		*/

		let thisInput: InputPreprocess = {
			direction: forceRelease ? this.neutralDirection() : getDirection(gamepad, this.info!, this.analogThreshold),
			button: {},
			directionButton: {},
		};

		// The first frame back: whatever is still held was held through the blur.
		const resumed = this.wasForceReleased && !forceRelease;
		this.wasForceReleased = forceRelease;

		const bs: (boolean | null)[] = forceRelease ? [] : getButtonPress(gamepad, this.info!, true);
		for (let k in this.btn_names) {
			if (this.btn_names[k] && this.buttons[this.btn_names[k]!]) {
				const press = this.holdBlock(this.btn_names[k]!, bs[k] === true, resumed);
				const lastPress = this.unchangeCache[k] ?? 0;
				this.unchangeCache[k] = press ? (this.unchangeCache[k] ? this.unchangeCache[k] + 1 : 1) : 0;
				if (unchange) {
					//*
					thisInput.button[this.btn_names[k]!] = {
						press: press,
						just: press && lastPress == 0,
						double: false,
						tap: false,
						pressFrame: this.unchangeCache[k],
					};
					continue;
				}
				if (press) {
					this.buttons[this.btn_names[k]!].press();
				} else {
					this.buttons[this.btn_names[k]!].release();
				}
				thisInput.button[this.btn_names[k]!] = this.buttons[this.btn_names[k]!].flush();
			}
		}

		for (let k in this.directionButton) {
			let kk: Dpad = k as Dpad;
			let press: boolean = false;
			if (thisInput.direction!.dpad && thisInput.direction!.dpad![kk]) {
				press = true;
			} else if (thisInput.direction!.leftAnalog && thisInput.direction!.leftAnalog![kk]) {
				press = true;
			}
			//|| (thisInput.direction!.leftAnalog?[kk]??false);
			press = this.holdBlock(kk, press, resumed);
			const lastPress = this.unchangeCache[kk] ?? 0;
			this.unchangeCache[kk] = press ? (this.unchangeCache[kk] ? this.unchangeCache[kk] + 1 : 1) : 0;
			if (unchange) {
				//*
				thisInput.directionButton[kk] = {
					press: press,
					just: press && lastPress == 0,
					double: false,
					tap: false,
					pressFrame: this.unchangeCache[kk],
				};
				continue;
			}
			if (press) {
				this.directionButton[kk].press();
			} else {
				this.directionButton[kk].release();
			}
			thisInput.directionButton[kk] = this.directionButton[kk].flush();
		}

		//this.lastGamepad=gamepad;
		//this.lastInput=thisInput;
		//this.lastSum=thisSum;
		//this.lastTime=gamepad.timestamp
		return thisInput;
	}

	public vibration(
		duration: number = 500,
		strongMagnitude: number = 1,
		weakMagnitude: number = 0,
	): Promise<GamepadHapticsResult> | undefined {
		if (this.lastGamepad.vibrationActuator) {
			return this.lastGamepad.vibrationActuator.playEffect("dual-rumble", {
				//startDelay,
				duration,
				// A low-frequency vibration
				weakMagnitude,
				// A high-frequency vibration
				strongMagnitude,
			});
		} else if (this.lastGamepad.hapticActuators) {
			let re: Promise<GamepadHapticsResult> | undefined;
			debugLog(this.lastGamepad, this.lastGamepad.hapticActuators);
			for (const h of this.lastGamepad.hapticActuators) {
				//h.pulse(duration, strongMagnitude);
				re = h.playEffect("dual-rumble", {
					//startDelay,
					duration,
					weakMagnitude,
					strongMagnitude,
				});
			}
			if (!re) {
				return undefined; //Promise.reject('no vibration');
			}
			return re;
		}
		return undefined; //
		//return Promise.reject('no vibration');
	}
}

/*

navigator.getGamepads()[3].axes[0]
-0.003921568393707275
~1/255
navigator.getGamepads()[3].axes[9]
3.2857141494750977
*/
