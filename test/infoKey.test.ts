// `info` is the keyboard's Back button, and it had none.
//
// A pad has spent its Back button on `info` since the beginning; a keyboard had no equivalent at
// all, so every surface reached that way — a room panel, a help overlay — was pad-only without
// anybody deciding it should be. These pin the two properties that make CapsLock a real answer
// rather than one more binding: it is live in **both** UI modes (Enter is not), and no seat can
// take it. The Backquote alias is pinned beside it because a `pressFrame` that climbs is the one
// thing CapsLock cannot promise on macOS, and anything built on a held `info` depends on it.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
	ControlWrap,
	ControllerId,
	UIInputMode,
	KeyboardMaster,
	KEYBOARD_HARDCODE_UI_BUTTON,
	hardcodedUIKeys,
} from '../src/index';

const requirement = {
	direction: { dpad: true, analog: 0 },
	button: ['attack', 'jump'],
	ui_pair: { confirm: 'attack', cancel: 'jump' },
};

const clusters = [{ up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', attack: 'KeyF', jump: 'KeyG' }];

const down = (code: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code }));
const up = (code: string) => window.dispatchEvent(new KeyboardEvent('keyup', { code }));

describe('the info key', () => {
	let cw: ControlWrap;

	beforeEach(() => {
		cw = ControlWrap.getInstance();
		cw.wrappedInit({
			requirement,
			defaultGamePadmapping: { attack: 'a', jump: 'b' },
			defaultKeyboardmappings: clusters,
			// The shape a couch game really runs in: the arrows and Enter released to the seats
			// that play with them, so NON_STRUCT is off and only STRUCT is left driving menus.
			preserveNavKeys: false,
		});
	});

	afterEach(() => {
		cw.dispose();
	});

	it('reaches the UI while a match is running, which is where it is wanted', () => {
		// multi + a gamepad driving = the exact shape of a live match, and the shape in which
		// Enter and the arrows are switched off.
		cw.uiInputMode = UIInputMode.multi;
		cw.mainControllerIndex = ControllerId.GAMEPAD_1;

		down('CapsLock');
		expect(cw.update().ui.ui_tap).toContain('info');
		up('CapsLock');
		cw.update();

		down('Enter'); // the contrast: NON_STRUCT, and gone in this mode
		expect(cw.update().ui.ui_tap).not.toContain('confirm');
		up('Enter');
		cw.update();
	});

	it('answers to the alias identically — one action, two ways to say it', () => {
		down('Backquote');
		expect(cw.update().ui.ui_tap).toContain('info');
		up('Backquote');
		cw.update();
	});

	it('counts a hold on the alias, which is what CapsLock cannot do on macOS', () => {
		down('Backquote');
		cw.update();
		for (let i = 0; i < 4; i++) expect(cw.update().ui.ui_pressing).toContain('info');
		up('Backquote');
		cw.update();
	});

	it('is not a key any seat may bind, alias included', () => {
		const km = KeyboardMaster.getInstance();
		expect(km.checkMapping(0, 'attack', 'CapsLock')).toBe(false);
		expect(km.checkMapping(0, 'attack', 'Backquote')).toBe(false);
		expect(hardcodedUIKeys(KEYBOARD_HARDCODE_UI_BUTTON)).toContain('Backquote');
	});
});
