import { Dpad, DpadPress, XY, getAnalogDirection, getDpadDirection } from "gamepad_standardizer";
import {
	ButtonState,
	mappingGroup,
	Input,
	systemInput,
	mappingRequirement,
	ControlType,
	latestLayoutGroup,
} from "../types";
import { clone } from "../utils/utils";
import { Button, getUITap, isRepeat, joinState } from "./Button";
import InputDeviceMaster, { listenStatus } from "./InputDeviceMaster";
import { IControllerMaster } from "./IControllerMaster";
import { buttonLayout } from "../config";
import { getPairFromBtnName, getPairFromUiBtnName } from "./uiPairing";

// Injectable button names = standard gamepad names, so mapping / ui_pair logic is fully reused.
export type VirtualButtonName =
	| "a"
	| "b"
	| "x"
	| "y"
	| "leftshoulder"
	| "rightshoulder"
	| "lefttrigger"
	| "righttrigger"
	| "back"
	| "start";

export const VIRTUAL_BUTTON_NAMES: VirtualButtonName[] = [
	"a",
	"b",
	"x",
	"y",
	"leftshoulder",
	"rightshoulder",
	"lefttrigger",
	"righttrigger",
	"back",
	"start",
];

const unchangeable = ["start", "up", "down", "left", "right"];

type PadState = {
	buttons: Record<string, Button>;
	directionButtons: Record<Dpad, Button>;
	dpadState: DpadPress;
	analogXY: XY;
	/** one-shot commands queued for the next flush */
	commands: string[];
	/** per-key vectors summed between flushes (see setVectorCommand) */
	vectors: Record<string, XY>;
};

/**
 * A UI-less virtual gamepad: an input injection point for any touch UI. The UI calls
 * `setButton` / `setDirection` / `setDpad`; the game keeps reading input from `cwi.update()`
 * and never needs to know a virtual pad exists. Contains **zero DOM / UI code**.
 *
 * Injectable button names mirror a standard xbox pad, so mapping/ui_pair logic is reused.
 * Virtual index range is 200–203 (see ControllerId).
 */
export default class VirtualGamepadMaster extends InputDeviceMaster implements IControllerMaster {
	protected static instance: VirtualGamepadMaster;

	static getInstance(): VirtualGamepadMaster {
		if (!VirtualGamepadMaster.instance) {
			VirtualGamepadMaster.instance = new VirtualGamepadMaster();
		}
		return VirtualGamepadMaster.instance;
	}

	/** Always true — whether touch is available is a UI-layer concern, not this master's. */
	static isSupported(): boolean {
		return true;
	}

	public analogThreshold: number = 0.15;

	private pads: (PadState | undefined)[] = [];

	public init(): void {
		// nothing to listen to — input is injected via setButton/setDirection.
	}

	//connection================================================================

	public connect(index: number = 0): void {
		if (this.pads[index]) return;
		const buttons: Record<string, Button> = {};
		for (const name of VIRTUAL_BUTTON_NAMES) buttons[name] = new Button();
		this.pads[index] = {
			buttons,
			directionButtons: { up: new Button(), down: new Button(), left: new Button(), right: new Button() },
			dpadState: { up: false, down: false, left: false, right: false },
			analogXY: { x: 0, y: 0 },
			commands: [],
			vectors: {},
		};
		this.resetDefault(index);
		this.emit("add", index);
	}

	public disconnect(index: number = 0): void {
		if (!this.pads[index]) return;
		this.pads[index] = undefined;
		this.emit("remove", index);
	}

	public count(): number {
		let n = 0;
		for (const p of this.pads) if (p) n++;
		return n;
	}

	public getIndexs(): number[] {
		const result: number[] = [];
		for (let i = 0; i < this.pads.length; i++) if (this.pads[i]) result.push(i);
		return result;
	}

	public getName(index: number): string {
		return index === 0 ? "Virtual Pad" : `Virtual Pad ${index + 1}`;
	}

	//input injection (the only functions a touch UI needs)=====================

	public setButton(name: VirtualButtonName, pressed: boolean, index: number = 0): void {
		const pad = this.pads[index];
		if (!pad) return;
		if (pressed) pad.buttons[name].press();
		else pad.buttons[name].release();
	}

	/** leftAnalog semantics: x,y ∈ -1..1, run through getAnalogDirection (same threshold as gamepad). */
	public setDirection(x: number, y: number, index: number = 0): void {
		const pad = this.pads[index];
		if (!pad) return;
		pad.analogXY = { x, y };
	}

	/** Convenience for dpad-style UIs: inject the four directions directly. */
	public setDpad(dir: Dpad, pressed: boolean, index: number = 0): void {
		const pad = this.pads[index];
		if (!pad) return;
		pad.dpadState[dir] = pressed;
	}

	/**
	 * Force `double` on a direction for the next flush, without needing a real
	 * tap-tap history. For touch UIs with a dedicated "double-tap forward" shortcut
	 * button: one press of it should read as an already-completed double tap.
	 *
	 * Pair it with `setDpad(dir, true)` if the direction should also be held down —
	 * this only raises the `double` flag, it does not press the direction.
	 */
	public doubleDpad(dir: Dpad, index: number = 0): void {
		const pad = this.pads[index];
		if (!pad) return;
		pad.directionButtons[dir].forceDouble();
	}

	/** Same as {@link doubleDpad} for a face/shoulder button. */
	public doubleButton(name: VirtualButtonName, index: number = 0): void {
		const pad = this.pads[index];
		if (!pad) return;
		pad.buttons[name].forceDouble();
	}

	//command injection=========================================================

	/**
	 * Queue a one-frame `command` string, delivered in the next flush's `Input.command`.
	 * A touch UI can raise things a gamepad has no button for — `'super'`, `'menu:2'`.
	 */
	public pushCommand(cmd: string, index: number = 0): void {
		const pad = this.pads[index];
		if (!pad) return;
		pad.commands.push(cmd);
	}

	/**
	 * Add a delta into a per-frame vector command. Every call between two flushes **sums**,
	 * then one `"<key>:<x>,<y>"` command is emitted and the total resets — so a touch drag
	 * firing 60 pointermove events between frames still produces exactly one command per
	 * frame, e.g. `touchmove:10,-5`.
	 *
	 * Values are rounded to whole units on emit; a sub-unit remainder is carried forward
	 * rather than dropped, so even a very slow drag eventually reports.
	 */
	public setVectorCommand(key: string, x: number, y: number, index: number = 0): void {
		const pad = this.pads[index];
		if (!pad) return;
		const v = pad.vectors[key] ?? { x: 0, y: 0 };
		v.x += x;
		v.y += y;
		pad.vectors[key] = v;
	}

	private drainCommands(pad: PadState): string[] {
		const out = pad.commands;
		pad.commands = [];
		for (const key in pad.vectors) {
			const v = pad.vectors[key];
			const x = Math.round(v.x);
			const y = Math.round(v.y);
			if (x === 0 && y === 0) continue; // too small to report yet — keep accumulating
			out.push(`${key}:${x},${y}`);
			v.x -= x;
			v.y -= y;
		}
		return out;
	}

	/** Call when the UI hides, to avoid stuck keys. */
	public releaseAll(index: number = 0): void {
		const pad = this.pads[index];
		if (!pad) return;
		for (const name of VIRTUAL_BUTTON_NAMES) pad.buttons[name].release();
		pad.dpadState = { up: false, down: false, left: false, right: false };
		pad.analogXY = { x: 0, y: 0 };
		pad.commands = [];
		pad.vectors = {};
	}

	//flush================================================================

	public flushAll(): Record<number, Input> {
		return this.flushInner(false);
	}

	public flushUI(): Record<number, systemInput> {
		return this.flushInner(true);
	}

	private flushInner(uiOnly: boolean): Record<number, Input> {
		const result: Record<number, Input> = {};
		for (let index = 0; index < this.pads.length; index++) {
			if (!this.pads[index]) continue;
			result[index] = this.processInput(index, uiOnly);
		}
		return result;
	}

	private processInput(index: number, uiOnly: boolean): Input {
		const pad = this.pads[index]!;

		// physical button states
		const rawButton: Record<string, ButtonState> = {};
		for (const name of VIRTUAL_BUTTON_NAMES) rawButton[name] = pad.buttons[name].flush();

		// direction: dpad injection OR left-analog
		const leftAnalog = getAnalogDirection(pad.analogXY, this.analogThreshold);
		const directionButton: Record<Dpad, ButtonState> = {} as Record<Dpad, ButtonState>;
		for (const dir of ["up", "down", "left", "right"] as Dpad[]) {
			const press = pad.dpadState[dir] || leftAnalog[dir];
			if (press) pad.directionButtons[dir].press();
			else pad.directionButtons[dir].release();
			directionButton[dir] = pad.directionButtons[dir].flush();
		}

		const ui_tap: string[] = [];
		const ui_pressing: string[] = [];
		const ui_repeat: string[] = [];

		// ui button (a→confirm, start→escape, …) — virtual is always xbox layout (swapAB=false)
		for (const btnName of VIRTUAL_BUTTON_NAMES) {
			const uiBtnName = getPairFromBtnName(btnName, false);
			if (uiBtnName === "") continue;
			if (getUITap(rawButton[btnName])) ui_tap.push(uiBtnName);
			if (rawButton[btnName].press) ui_pressing.push(uiBtnName);
			if (isRepeat(rawButton[btnName])) ui_repeat.push(uiBtnName);
		}

		// ui direction
		for (const dir in directionButton) {
			const bs = directionButton[dir as Dpad];
			if (getUITap(bs)) ui_tap.push(dir);
			if (bs.press) ui_pressing.push(dir);
			if (isRepeat(bs)) ui_repeat.push(dir);
		}

		if (this.listenMode !== listenStatus.none) {
			this.listenDown(index, rawButton, directionButton);
		}

		// drained even on a UI-only frame, so a stale command can't leak into a later one
		const command = this.drainCommands(pad);

		if (uiOnly) {
			return { source: ControlType.VIRTUAL, sourceIndex: index, ui_tap, ui_pressing, ui_repeat };
		}

		const mixedDpad: any = getDpadDirection({
			up: directionButton.up.press,
			down: directionButton.down.press,
			left: directionButton.left.press,
			right: directionButton.right.press,
		});
		delete mixedDpad["type"];
		delete mixedDpad["radian"];
		delete mixedDpad["degree"];
		delete mixedDpad["distance"];

		// game buttons via currentMapping
		const button: Record<string, ButtonState> = {};
		for (const keyName in this.currentMapping[index]) {
			const btnNames: string[] =
				typeof this.currentMapping[index][keyName] === "string"
					? [this.currentMapping[index][keyName] as string]
					: (this.currentMapping[index][keyName] as string[]);
			for (const btnName of btnNames) {
				if (!rawButton[btnName]) continue;
				if (keyName === "double") continue;
				button[keyName] = !button[keyName] ? rawButton[btnName] : joinState(button[keyName], rawButton[btnName]);
			}
		}

		const result: Input = {
			source: ControlType.VIRTUAL,
			sourceIndex: index,
			ui_tap,
			ui_pressing,
			ui_repeat,
			mixedDpad,
			directionButton,
			button,
		};
		if (this.requirement?.direction.dpad) {
			result.dpad = getDpadDirection(pad.dpadState);
		}
		if (this.requirement && this.requirement.direction.analog >= 1) {
			result.analog = leftAnalog;
		}
		if (command.length > 0) {
			result.command = command;
		}
		return result;
	}

	//listen================================================================

	private listeningIndex: number = 0;

	private listenDown(
		index: number,
		rawButton: Record<string, ButtonState>,
		directionButton: Record<Dpad, ButtonState>
	): void {
		if (this.listenMode === listenStatus.anyKey && index === this.listeningIndex) {
			for (const btnName of VIRTUAL_BUTTON_NAMES) {
				if (unchangeable.indexOf(btnName) >= 0) continue;
				if (getUITap(rawButton[btnName])) {
					this.listenMode = listenStatus.none;
					this.emit("listenKeyFromControllerIndex", btnName);
					return;
				}
			}
		} else if (this.listenMode === listenStatus.ControllerIndexFromKeys) {
			for (const btnName of VIRTUAL_BUTTON_NAMES) {
				if (
					getUITap(rawButton[btnName]) &&
					(this.listenKeys.length === 0 || this.listenKeys.indexOf(btnName) >= 0)
				) {
					this.listenMode = listenStatus.none;
					this.emit("listenControllerIndexFromKeys", index);
					return;
				}
			}
		}
	}

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

	//mapping================================================================

	public importRequirement(requirement: mappingRequirement): void {
		this.requirement = clone(requirement) as mappingRequirement;
	}

	private defaultMapping: mappingGroup = {};

	public setDefaultMapping(mapping: mappingGroup): void {
		this.defaultMapping = mapping;
	}

	public resetDefault(index: number): mappingGroup | undefined {
		this.currentMapping[index] = clone(this.defaultMapping);
		return this.defaultMapping;
	}

	public checkMapping(index: number, buttonName: string, keyCode: string): boolean {
		if (unchangeable.indexOf(buttonName) >= 0) return false;
		return VIRTUAL_BUTTON_NAMES.indexOf(keyCode as VirtualButtonName) >= 0;
	}

	public checkNotRepeat(index: number, buttonName: string, keyCode: string): boolean {
		for (const key in this.currentMapping[index]) {
			if (this.currentMapping[index][key] === keyCode && buttonName !== key) return false;
		}
		return true;
	}

	public renewSystemButtonLayout(index: number): latestLayoutGroup {
		const mapping: mappingGroup = { ...this.currentMapping[index] };
		for (const uikeyName of ["confirm", "cancel", "escape", "info", "prevTab", "nextTab"]) {
			const btn = getPairFromUiBtnName(uikeyName, false);
			if (btn) mapping[uikeyName] = btn;
		}
		return { name: this.getName(index), layout: buttonLayout.unknown, mapping };
	}
}
