// A gamepad is polled, not delivered: unlike the keyboard it keeps reporting presses to a window
// that lost focus, so a pad resting against something walks the menus of a game nobody is looking
// at — and a rebind screen in the background answers a button meant for another window.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ControlWrap, ControllerId, GamepadMaster, isWindowActive } from '../src/index';

const requirement = {
	direction: { dpad: true, analog: 0 },
	button: ['attack', 'jump'],
	ui_pair: { confirm: 'attack', cancel: 'jump' },
};

/** A standard (xinput) pad — the id keeps getGamepadInfo off the SDL DB / any fetch. */
function fakePad(): Gamepad {
	return {
		id: 'Probe Pad (STANDARD GAMEPAD Vendor: 2dc8 Product: 310b)',
		index: 0,
		mapping: 'standard',
		connected: true,
		timestamp: 0,
		axes: [0, 0, 0, 0],
		buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
	} as unknown as Gamepad;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

/** jsdom has neither getGamepads nor a settable focus — both are faked here. */
let pad: Gamepad;
let focused = true;

function setFocus(v: boolean) {
	focused = v;
}

describe('window inactive → gamepad ignored', () => {
	let cw: ControlWrap;
	const realHasFocus = document.hasFocus;

	beforeEach(async () => {
		pad = fakePad();
		focused = true;
		document.hasFocus = () => focused;
		Object.defineProperty(navigator, 'getGamepads', {
			value: () => [pad],
			configurable: true,
			writable: true,
		});

		cw = ControlWrap.getInstance();
		cw.wrappedInit({
			requirement,
			defaultGamePadmapping: { attack: 'a', jump: 'b' },
			defaultKeyboardmappings: [{ up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', attack: 'KeyF' }],
		});
		const ev = new Event('gamepadconnected') as GamepadEvent & { gamepad: Gamepad };
		(ev as { gamepad: Gamepad }).gamepad = pad;
		window.dispatchEvent(ev);
		await tick(); // GamePadExtra resolves its GamepadInfo asynchronously
		cw.update(); // settle the button state machines on an untouched pad
	});

	afterEach(() => {
		cw.dispose();
		document.hasFocus = realHasFocus;
	});

	const pressA = (down: boolean) => {
		(pad.buttons as unknown as { pressed: boolean; value: number }[])[0] = {
			pressed: down,
			value: down ? 1 : 0,
		} as { pressed: boolean; value: number };
	};

	it('reads the pad normally while the window has focus', () => {
		pressA(true);
		const ips = cw.update();
		expect(ips.ui.ui_tap).toContain('confirm');
		expect(ips.player[ControllerId.GAMEPAD_1].button.attack.press).toBe(true);
	});

	it('reports nothing pressed while the window is inactive', () => {
		setFocus(false);
		pressA(true);
		const ips = cw.update();
		expect(ips.ui.ui_tap).toEqual([]);
		expect(ips.player[ControllerId.GAMEPAD_1].button.attack.press).toBe(false);
	});

	it('ignores a button held across the blur until it is let go', () => {
		setFocus(false);
		pressA(true);
		cw.update();
		cw.update();
		setFocus(true);
		// still physically held from before the blur — the same as a key held while away, which
		// the browser never reports on return
		const back = cw.update();
		expect(back.ui.ui_tap).toEqual([]);
		expect(back.player[ControllerId.GAMEPAD_1].button.attack.press).toBe(false);
		cw.update();
		expect(cw.update().player[ControllerId.GAMEPAD_1].button.attack.press).toBe(false);

		// let go, press again: an ordinary press
		pressA(false);
		cw.update();
		pressA(true);
		const again = cw.update();
		expect(again.ui.ui_tap).toContain('confirm');
		expect(again.player[ControllerId.GAMEPAD_1].button.attack.press).toBe(true);
	});

	it('can be switched off for a window meant to be driven unfocused', () => {
		expect(cw.ignoreGamepadWhenWindowInactive).toBe(true);
		cw.ignoreGamepadWhenWindowInactive = false;
		expect(GamepadMaster.getInstance().ignoreWhenWindowInactive).toBe(false);
		setFocus(false);
		pressA(true);
		expect(cw.update().ui.ui_tap).toContain('confirm');
	});
});

describe('isWindowActive', () => {
	const realHasFocus = document.hasFocus;
	afterEach(() => {
		document.hasFocus = realHasFocus;
	});

	it('follows document focus', () => {
		document.hasFocus = () => true;
		expect(isWindowActive()).toBe(true);
		document.hasFocus = () => false;
		expect(isWindowActive()).toBe(false);
	});
});
