import { EventEmitter } from "eventemitter3";
import {
	latestLayoutGroup,
	InputGroup,
	ControlType,
	Input,
	systemInput,
	mappingGroup,
	mappingRequirement,
	InputSource,
	UIInputMode,
	XY,
} from "../types";

import { IControllerMaster } from "./IControllerMaster";
import GamepadMaster from "./GamepadMaster";
import KeyboardMaster from "./KeyboardMaster";
import VirtualGamepadMaster from "./VirtualGamepadMaster";
import GamePadExtra from "./GamePadExtra";
import {
	GAMEPAD_INDEX_OFFSET,
	VIRTUAL_INDEX_OFFSET,
	SYSTEM_INDEX_OFFSET,
	UI_INDEX_OFFSET,
	KEYBOARD_HARDCODE_UI_BUTTON,
	buttonLayout,
} from "../config";
import { checkAnyKeypress } from "./common";
import MouseMaster from "./MouseMaster";
import { debugLog } from "../utils/debug";

/** Whichever of two scroll readings is being pushed further — see `systemInput.ui_scroll`. */
function strongerScroll(a: XY | undefined, b: XY | undefined): XY | undefined {
	if (!a) return b;
	if (!b) return a;
	return b.x * b.x + b.y * b.y > a.x * a.x + a.y * a.y ? b : a;
}

export default class ControlWrap extends EventEmitter implements IControllerMaster {
	protected static instance: ControlWrap;

	public static getInstance(): ControlWrap {
		if (!ControlWrap.instance) {
			ControlWrap.instance = new ControlWrap();
		}

		return ControlWrap.instance;
	}

	//static================================================================

	static isSupported(): Partial<Record<ControlType, boolean>> {
		return {
			[ControlType.KEYBOARD]: KeyboardMaster.isSupported(),
			[ControlType.GAMEPAD]: GamepadMaster.isSupported(),
			[ControlType.VIRTUAL]: VirtualGamepadMaster.isSupported(),
			//[ControlType.TOUCH]:'ontouchstart' in window,
			//[ControlType.MOUSE]:'onmousedown' in window,
		};
	}

	static masterRecord: Partial<Record<ControlType, IControllerMaster>> = {
		[ControlType.KEYBOARD]: KeyboardMaster.getInstance(),
		[ControlType.GAMEPAD]: GamepadMaster.getInstance(),
		[ControlType.VIRTUAL]: VirtualGamepadMaster.getInstance(),
		//[ControlType.TOUCH]: KeyboardMaster.getInstance(),
		//[ControlType.MOUSE]: KeyboardMaster.getInstance()
	};

	//var================================================================

	protected requirement: mappingRequirement | undefined;

	protected listening: Partial<Record<ControlType, boolean>> = {
		[ControlType.GAMEPAD]: false,
		[ControlType.KEYBOARD]: false,
		[ControlType.VIRTUAL]: false,
		//[ControlType.MOUSE]:false,
		//[ControlType.TOUCH]:false,
	};

	//init================================================================

	public init(
		listenTo: Partial<Record<ControlType, boolean>> = {
			keyboard: true,
			gamepad: true,
		},
	): void {
		const supports = ControlWrap.isSupported();
		for (const controlType of Object.values(ControlType)) {
			if (supports[controlType] && listenTo[controlType] && ControlWrap.masterRecord[controlType]) {
				ControlWrap.masterRecord[controlType]!.init();
				this.listening[controlType] = true;
			}
		}
	}

	protected listenToMouse: boolean = false;

	/** Remove every window listener the masters added and reset the singleton. */
	public dispose(): void {
		(ControlWrap.masterRecord[ControlType.GAMEPAD] as GamepadMaster).dispose();
		(ControlWrap.masterRecord[ControlType.KEYBOARD] as KeyboardMaster).dispose();
		if (this.listenToMouse) {
			MouseMaster.getInstance().dispose();
		}
		for (const controlType of Object.values(ControlType)) {
			this.listening[controlType] = false;
		}
		this.listenToMouse = false;
		this.removeAllListeners();
		ControlWrap.instance = undefined as unknown as ControlWrap;
	}

	public wrappedInit({
		requirement,
		defaultGamePadmapping,
		defaultKeyboardmappings,
		mouse = false,
		virtual = false,
		preserveNavKeys = true,
		ignoreGamepadWhenWindowInactive = true,
	}: {
		requirement: mappingRequirement;
		defaultGamePadmapping: mappingGroup;
		defaultKeyboardmappings: mappingGroup[];
		mouse?: boolean;
		virtual?: boolean;
		/**
		 * Keep arrow keys + Enter reserved as global keyboard UI-nav keys (default true). Set
		 * false to free them for player mappings (e.g. an arrow-keys player on keyboard 2).
		 * Escape is always preserved regardless. See {@link setPreserveNavKeys}.
		 */
		preserveNavKeys?: boolean;
		/**
		 * Drop gamepad input while the window has no focus (default true).
		 * See {@link ignoreGamepadWhenWindowInactive}.
		 */
		ignoreGamepadWhenWindowInactive?: boolean;
	}): void {
		this.init({ keyboard: true, gamepad: true, virtual });
		this.setPreserveNavKeys(preserveNavKeys);
		this.ignoreGamepadWhenWindowInactive = ignoreGamepadWhenWindowInactive;
		this.importRequirement(requirement);
		this.setDefaultGamepadMapping(defaultGamePadmapping);
		for (let i = 0; i < defaultKeyboardmappings.length; i++) {
			this.setDefaultKeyboardMapping(i, defaultKeyboardmappings[i]);
		}
		this.setPlayerCountFromKeyboard(defaultKeyboardmappings.length);

		if (virtual) {
			// virtual pad shares the gamepad button layout / default mapping
			const vm = ControlWrap.masterRecord[ControlType.VIRTUAL] as VirtualGamepadMaster;
			vm.setDefaultMapping(defaultGamePadmapping);
			vm.connect(0);
		}

		if (mouse) {
			this.listenToMouse = true;
			MouseMaster.getInstance().init();
		}
		/*
			TODO?
			for(let keyBoardIndex in keyboardmappings){
				//this.setAllMapping(0,gamepadMappings[gamepadName]);
			}
			for(let gamepadName in gamepadMappings){
				//this.setAllMapping(0,gamepadMappings[gamepadName]);
			}
			*/
	}

	public importRequirement(requirement: mappingRequirement): void {
		for (const controlType of Object.values(ControlType)) {
			if (ControlWrap.masterRecord[controlType]) {
				ControlWrap.masterRecord[controlType]!.importRequirement(requirement);
			}
		}
		this.requirement = requirement;
	}

	public setDefaultGamepadMapping(mapping: mappingGroup): void {
		(ControlWrap.masterRecord[ControlType.GAMEPAD] as GamepadMaster).setDefaultMapping(mapping);
	}

	public setDefaultKeyboardMapping(index: number = 0, mapping: mappingGroup): void {
		(ControlWrap.masterRecord[ControlType.KEYBOARD] as KeyboardMaster).setDefaultKeyboardMapping(index, mapping);
	}

	public setPlayerCountFromKeyboard(num: number = 1): void {
		(ControlWrap.masterRecord[ControlType.KEYBOARD] as KeyboardMaster).setPlayerCountFromKeyboard(num);
	}

	/**
	 * Toggle whether the keyboard's arrow keys + Enter are preserved as global UI-navigation
	 * keys. Default true = they always drive menu navigation and cannot be remapped away from
	 * keyboard 0. Set false to free them for player mappings (e.g. an arrow-keys player on a
	 * second keyboard); menu navigation then follows each player's own mapping. Escape is
	 * ALWAYS preserved — no flag can disable it.
	 */
	public setPreserveNavKeys(preserve: boolean): void {
		(ControlWrap.masterRecord[ControlType.KEYBOARD] as KeyboardMaster).preserveNavKeys = preserve;
	}

	/**
	 * Whether the fixed nav keys are reserved — see {@link setPreserveNavKeys}.
	 *
	 * Readable because it is not only an input-routing switch: it is the answer to "which key
	 * should a menu *tell* the player to press". With it on, Enter and the arrows are the
	 * navigation keys for everyone whatever they have mapped; with it off, each seat navigates
	 * with its own keys and those are the ones worth naming.
	 */
	public get preserveNavKeys(): boolean {
		return (ControlWrap.masterRecord[ControlType.KEYBOARD] as KeyboardMaster).preserveNavKeys;
	}

	/**
	 * Ignore gamepad input while the window does not have focus (default true).
	 *
	 * A keyboard already behaves this way — an unfocused window receives no key events — but a
	 * gamepad is polled, so a pad resting on a button, or a player using another window, would
	 * otherwise keep walking this game's menus in the background. Turn it off for a window that
	 * is *meant* to be driven unfocused (an overlay, a second display, a kiosk).
	 */
	public get ignoreGamepadWhenWindowInactive(): boolean {
		return (ControlWrap.masterRecord[ControlType.GAMEPAD] as GamepadMaster).ignoreWhenWindowInactive;
	}
	public set ignoreGamepadWhenWindowInactive(ignore: boolean) {
		(ControlWrap.masterRecord[ControlType.GAMEPAD] as GamepadMaster).ignoreWhenWindowInactive = ignore;
	}

	//ui input mode================================================================

	private _uiInputMode: UIInputMode = UIInputMode.single;

	/**
	 * Who drives the shared UI channel — see {@link UIInputMode}. Menus want `single` (the
	 * default), a lobby and the match itself want `multi`. Switch it as the game changes screen.
	 */
	public get uiInputMode(): UIInputMode {
		return this._uiInputMode;
	}
	public set uiInputMode(mode: UIInputMode) {
		this._uiInputMode = mode;
		(ControlWrap.masterRecord[ControlType.KEYBOARD] as KeyboardMaster).singleUserUI =
			mode === UIInputMode.single;
	}

	/** Whether every connected device — not just the main one — feeds the shared UI channel. */
	private everyDeviceDrivesUI(): boolean {
		return this._uiInputMode === UIInputMode.single || this.allowMainPlayerUseAllController;
	}
	public getPlayerCountFromKeyboard(): number {
		return (ControlWrap.masterRecord[ControlType.KEYBOARD] as KeyboardMaster).count();
	}

	//================================================================

	public mainControllerIndex: number = -1;
	/**
	 * Force every device into the shared UI channel even in {@link UIInputMode.multi}. Predates
	 * the mode and is subsumed by it — `uiInputMode = single` is the same thing, said as what it
	 * is for. Left in because it is a public field somebody may be setting.
	 */
	public allowMainPlayerUseAllController: boolean = false;
	private _lastInputIndex: number = -1;
	private defaultButtonLayout: latestLayoutGroup = {
		name: "system",
		layout: buttonLayout.keyboard,
		mapping: KEYBOARD_HARDCODE_UI_BUTTON,
	};
	private lastButtonLayout: latestLayoutGroup = this.defaultButtonLayout;

	/**
	 * The controller that most recently pressed something, or -1 before anything has been
	 * pressed. Unlike {@link mainControllerIndex} this is never claimed and never cleared — it is
	 * simply "who is driving right now", which is what a hint bar needs in order to name one
	 * device instead of listing every possible one.
	 *
	 * There is also a `changeLastInputIndex` event, but it fires only on a *change*: a listener
	 * that subscribes late would never learn the current value, so it cannot be the only way in.
	 */
	public get lastInputIndex(): number {
		return this._lastInputIndex;
	}

	/** The layout + live mapping of {@link lastInputIndex}, recomputed whenever it changes. */
	public get lastLayout(): latestLayoutGroup {
		return this.lastButtonLayout;
	}

	private _lastUpdateTime: number = -1;

	public update(uiOnly: boolean = false): InputGroup {
		const now = performance.now();
		if (now - this._lastUpdateTime < 1) {
			debugLog("update() called twice in the same frame — input between calls is lost");
		}
		this._lastUpdateTime = now;
		const ips: Record<number, Input> = this.flushInner(uiOnly);
		const result: InputGroup = {
			[InputSource.system]: ips[SYSTEM_INDEX_OFFSET],
			[InputSource.ui]: ips[UI_INDEX_OFFSET],
			[InputSource.player]: {},
		};
		for (let index in ips) {
			if (Number(index) != UI_INDEX_OFFSET && Number(index) != SYSTEM_INDEX_OFFSET) {
				result[InputSource.player][index] = ips[index];
			}
		}
		if (this.listenToMouse) {
			result[InputSource.mouse] = MouseMaster.getInstance().flush();
		}
		return result;
	}

	public flushUI(): Record<number, systemInput> {
		return this.flushInner(true);
	}

	public flushAll(): Record<number, Input> {
		return this.flushInner(false);
	}

	private flushInner(uiOnly: boolean = false): Record<number, Input> {
		const result: Record<number, Input> = {};
		let thisInputIndex: number = this._lastInputIndex;
		let ui_tap_set = new Set<string>();
		let ui_repeat_set = new Set<string>();
		let ui_pressing_set = new Set<string>();
		// "Scroll the view" from whichever UI-feeding device is pushing hardest this frame. Like
		// the button sets above it has to be *one* value however many pads are plugged in, so the
		// strongest deflection wins rather than the last device iterated.
		let ui_scroll: XY | undefined;

		for (const controlType of Object.values(ControlType)) {
			if (ControlWrap.masterRecord[controlType] && this.listening[controlType]) {
				const re = uiOnly
					? ControlWrap.masterRecord[controlType]!.flushUI()
					: ControlWrap.masterRecord[controlType]!.flushAll();
				for (let index in re) {
					const mixedIndex = this.makeIndex(controlType, Number(index));
					result[mixedIndex] = re[index];
					if (
						re[index].source === ControlType.system ||
						this.mainControllerIndex === mixedIndex ||
						this.everyDeviceDrivesUI()
					) {
						if (checkAnyKeypress(re[index])) {
							if (
								!(
									re[index].ui_tap.toString() === "escape" &&
									re[index].source === ControlType.system &&
									thisInputIndex !== mixedIndex &&
									this.lastButtonLayout.layout === buttonLayout.keyboard
								)
							) {
								thisInputIndex = mixedIndex;
							}
						}
						re[index].ui_tap.forEach((item) => ui_tap_set.add(item));
						re[index].ui_repeat.forEach((item) => ui_repeat_set.add(item));
						re[index].ui_pressing.forEach((item) => ui_pressing_set.add(item));
						ui_scroll = strongerScroll(ui_scroll, re[index].ui_scroll);
					}
				}
			}
		}
		if (this._lastInputIndex != thisInputIndex) {
			this._lastInputIndex = thisInputIndex;
			this.lastButtonLayout = this.renewSystemButtonLayout(thisInputIndex);
			this.emit("changeLastInputIndex", {
				index: thisInputIndex,
				buttonLayout: this.lastButtonLayout,
			});
		}
		const aggregate = {
			ui_tap: [...ui_tap_set],
			ui_pressing: [...ui_pressing_set],
			ui_repeat: [...ui_repeat_set],
			ui_scroll,
		};
		result[UI_INDEX_OFFSET] = { ...aggregate };
		// System channel = the single main-user's aggregated UI actions (keyboard hardcoded
		// keys + the main gamepad / virtual pad — same set fed into UI above). Previously only
		// KeyboardMaster wrote this channel, so escape/confirm/pause worked from the keyboard
		// but not a gamepad's start button. Feeding the aggregate here makes those actions work
		// uniformly from any device for single-user UI. Per-seat multiplayer input is untouched
		// (it stays in result[index] and is read via ips.player in the lobby).
		result[SYSTEM_INDEX_OFFSET] = { source: ControlType.system, ...aggregate };

		return result;
	}

	public renewSystemButtonLayout(index: number): latestLayoutGroup {
		if (index === SYSTEM_INDEX_OFFSET) {
			return this.defaultButtonLayout;
		}
		const [cType, cIndex] = this.parseIndex(index);
		if (cType == ControlType.GAMEPAD) {
			return (ControlWrap.masterRecord[ControlType.GAMEPAD] as GamepadMaster).renewSystemButtonLayout(cIndex);
		} else if (cType == ControlType.KEYBOARD) {
			return (ControlWrap.masterRecord[ControlType.KEYBOARD] as KeyboardMaster).renewSystemButtonLayout(cIndex);
		} else if (cType == ControlType.VIRTUAL) {
			// The virtual master has always implemented this; nothing called it, so a touch player
			// fell through to `defaultButtonLayout` — the *keyboard* table — and every %token% in
			// their hints and help text came back as a key cap.
			return (ControlWrap.masterRecord[ControlType.VIRTUAL] as VirtualGamepadMaster).renewSystemButtonLayout(
				cIndex
			);
		}
		return this.defaultButtonLayout;
	}

	public getGamepadExtra(index: number): GamePadExtra | undefined {
		const [cType, cIndex] = this.parseIndex(index);
		if (cType == ControlType.GAMEPAD) {
			return (ControlWrap.masterRecord[ControlType.GAMEPAD] as GamepadMaster).getGamepadExtra(cIndex);
		}
		return undefined;
	}

	/**
	 * Device identity used by ProfileMapping to decide profile compatibility.
	 *  - keyboard → { device: 'keyboard', xinput: false }
	 *  - gamepad  → { device: `${vendor}:${product}`, xinput: standard } (falls back to
	 *               the controller name when vendor/product are unavailable)
	 */
	public getDeviceInfo(index: number): { device: string; xinput: boolean } {
		const [cType] = this.parseIndex(index);
		if (cType === ControlType.KEYBOARD) {
			return { device: "keyboard", xinput: false };
		}
		if (cType === ControlType.VIRTUAL) {
			return { device: "virtual", xinput: true }; // virtual pad emulates the standard layout
		}
		if (cType === ControlType.GAMEPAD) {
			const extra = this.getGamepadExtra(index);
			if (extra) {
				const vendor = extra.getVendor();
				const product = extra.getProduct();
				if (vendor && product) {
					return { device: `${vendor}:${product}`, xinput: extra.isStandard() };
				}
				return { device: this.getName(index) || "gamepad", xinput: extra.isStandard() };
			}
		}
		return { device: this.getName(index) || "gamepad", xinput: false };
	}

	//indexing================================================================

	public count(): number {
		let result: number = 0;
		for (const controlType of Object.values(ControlType)) {
			if (this.listening[controlType]) {
				result += ControlWrap.masterRecord[controlType]!.count();
			}
		}
		return result;
	}

	public getIndexs(): number[] {
		let result: number[] = [];
		for (const controlType of Object.values(ControlType)) {
			if (this.listening[controlType]) {
				ControlWrap.masterRecord[controlType]!.getIndexs().forEach((i) => {
					result.push(this.makeIndex(controlType, i));
				});
			}
		}
		return result;
	}

	public parseIndex(index: number = 0): [ControlType, number] {
		if (index < GAMEPAD_INDEX_OFFSET) {
			return [ControlType.KEYBOARD, index];
		}
		if (index < VIRTUAL_INDEX_OFFSET) {
			return [ControlType.GAMEPAD, index - GAMEPAD_INDEX_OFFSET];
		}
		return [ControlType.VIRTUAL, index - VIRTUAL_INDEX_OFFSET];
	}

	public makeIndex(cType: ControlType, index: number = 0): number {
		if (cType == ControlType.KEYBOARD) {
			return index;
		}
		if (cType == ControlType.VIRTUAL) {
			return VIRTUAL_INDEX_OFFSET + index;
		}
		return GAMEPAD_INDEX_OFFSET + index;
	}

	//listen================================================================

	public listenControllerIndexFromKeys(keys: string[] = []): Promise<number> {
		return new Promise((resolve, reject) => {
			for (const controlType of Object.values(ControlType)) {
				if (this.listening[controlType] && ControlWrap.masterRecord[controlType]) {
					ControlWrap.masterRecord[controlType]!.listenControllerIndexFromKeys(keys)
						.then((i) => {
							const mixIndex = this.makeIndex(controlType, i);
							debugLog('listenControllerIndexFromKeys race result', mixIndex, controlType, i);
							resolve(mixIndex);
							this.cancelListen("race success");
						})
						.catch((e) => {
							if (e === "escape") {
								reject(e);
							}
							this.cancelListen();
						});
				}
			}
		});
	}

	public listenKeyFromControllerIndex(index: number): Promise<number> {
		const [cType, cIndex] = this.parseIndex(index);
		return ControlWrap.masterRecord[cType]!.listenKeyFromControllerIndex(cIndex);
	}

	public cancelListen(reason?: string): void {
		for (const controlType of Object.values(ControlType)) {
			if (this.listening[controlType] && ControlWrap.masterRecord[controlType]) {
				ControlWrap.masterRecord[controlType]!.cancelListen(reason);
			}
		}
	}

	//pass to child================================================================

	public getAllMapping(index: number): mappingGroup {
		const [cType, cIndex] = this.parseIndex(index);
		return ControlWrap.masterRecord[cType]!.getAllMapping(cIndex);
	}

	public checkMapping(index: number, buttonName: string, keyCode: string): boolean {
		const [cType, cIndex] = this.parseIndex(index);
		return ControlWrap.masterRecord[cType]!.checkMapping(cIndex, buttonName, keyCode);
	}

	public setMapping(index: number, buttonName: string, keyCode: string): boolean {
		const [cType, cIndex] = this.parseIndex(index);
		return ControlWrap.masterRecord[cType]!.setMapping(cIndex, buttonName, keyCode);
	}

	public setAllMapping(index: number, mapping: mappingGroup): void {
		const [cType, cIndex] = this.parseIndex(index);
		ControlWrap.masterRecord[cType]!.setAllMapping(cIndex, mapping);
	}

	public resetDefault(index: number): mappingGroup | undefined {
		const [cType, cIndex] = this.parseIndex(index);
		return ControlWrap.masterRecord[cType]!.resetDefault(cIndex);
	}

	public getMappableKeys(index: number = 0): {
		buttons: string[];
		optional: string[];
	} {
		const [cType, cIndex] = this.parseIndex(index);
		return ControlWrap.masterRecord[cType]!.getMappableKeys(cIndex);
	}

	public checkNotRepeat(index: number, buttonName: string, keyCode: string): boolean {
		const [cType, cIndex] = this.parseIndex(index);
		return ControlWrap.masterRecord[cType]!.checkNotRepeat(cIndex, buttonName, keyCode);
	}

	public getName(index: number): string {
		const [cType, cIndex] = this.parseIndex(index);
		return ControlWrap.masterRecord[cType]!.getName(cIndex);
	}

	public vibration(
		index: number,
		duration: number = 300,
		strongMagnitude: number = 1,
		weakMagnitude: number = 1,
	): void {
		//Promise<GamepadHapticsResult>
		const [cType, cIndex] = this.parseIndex(index);
		if (cType == ControlType.GAMEPAD) {
			(ControlWrap.masterRecord[ControlType.GAMEPAD] as GamepadMaster).vibration(
				cIndex,
				duration,
				strongMagnitude,
				weakMagnitude,
			);
		}
		//return Promise.reject('no vibration');
	}
}

/*
TODO:
	get btnDisplayName of main

setAllMapping
  getMappableKeys

profile
map 4p

	raw
*/
