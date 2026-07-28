// The shared UI channel answers to different people at different moments — see UIInputMode.
//
// Both halves of the mode are pinned here, because both were bugs found in a real game:
//  · a settings panel opened to configure gamepad B, which then ignored every button on B
//    because A happened to be the main controller;
//  · a game that freed the arrow keys for a keyboard-3 player and thereby lost arrow-key menu
//    navigation for everyone — one flag ("may a player bind these?") having silently answered a
//    second question ("do these drive menus?").
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ControlWrap, ControllerId, UIInputMode, KeyboardMaster } from '../src/index';

const requirement = {
	direction: { dpad: true, analog: 0 },
	button: ['attack', 'jump'],
	ui_pair: { confirm: 'attack', cancel: 'jump' },
};

/** Two keyboard seats: seat 1 on WASD/F, seat 2 on the arrows + Enter (only legal when freed). */
const clusters = [
	{ up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', attack: 'KeyF', jump: 'KeyG' },
	{ up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', attack: 'Enter', jump: 'KeyM' },
];

const down = (code: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code }));
const up = (code: string) => window.dispatchEvent(new KeyboardEvent('keyup', { code }));

/** One frame of input, as the game loop would take it. */
function frame(cw: ControlWrap) {
	return cw.update();
}

describe('UIInputMode', () => {
	let cw: ControlWrap;

	beforeEach(() => {
		cw = ControlWrap.getInstance();
		cw.wrappedInit({
			requirement,
			defaultGamePadmapping: { attack: 'a', jump: 'b' },
			defaultKeyboardmappings: clusters,
			// the case that used to cost every menu its arrow keys
			preserveNavKeys: false,
		});
	});

	afterEach(() => {
		cw.dispose();
	});

	it('starts in single: a menu is what a game opens on', () => {
		expect(cw.uiInputMode).toBe(UIInputMode.single);
		expect(KeyboardMaster.getInstance().singleUserUI).toBe(true);
	});

	it('keeps the fixed menu keys live even with the arrows released to a player', () => {
		down('ArrowUp');
		expect(frame(cw).ui.ui_tap).toContain('up');
		up('ArrowUp');
		frame(cw);

		// …and the rest of the fixed set with it
		down('Enter');
		expect(frame(cw).ui.ui_tap).toContain('confirm');
		up('Enter');
		frame(cw);

		down('Backspace');
		expect(frame(cw).ui.ui_tap).toContain('cancel');
		up('Backspace');
		frame(cw);

		down('Tab');
		expect(frame(cw).ui.ui_tap).toContain('nextTab');
		up('Tab');
		frame(cw);
	});

	it('in multi, a released arrow key is the seat that owns it and nothing more', () => {
		cw.uiInputMode = UIInputMode.multi;
		cw.mainControllerIndex = ControllerId.KEYBOARD_1;

		down('ArrowUp');
		const ips = frame(cw);
		// seat 2's own channel has it — that is the player it belongs to
		expect(ips.player[ControllerId.KEYBOARD_2].ui_tap).toContain('up');
		// but the shared cursor is seat 1's, and seat 2 must not move it
		expect(ips.ui.ui_tap).not.toContain('up');
		up('ArrowUp');
		frame(cw);
	});

	it('escape reaches the UI in either mode — it is the way out of anything', () => {
		cw.uiInputMode = UIInputMode.multi;
		cw.mainControllerIndex = ControllerId.GAMEPAD_1; // not even a keyboard

		down('Escape');
		expect(frame(cw).ui.ui_tap).toContain('escape');
		up('Escape');
		frame(cw);
	});

	it('in single, a seat that is not the main controller still drives the UI', () => {
		cw.mainControllerIndex = ControllerId.KEYBOARD_1;

		// seat 2's own confirm key (Enter is its `attack`, paired to confirm)
		down('KeyM'); // seat 2's jump → cancel
		expect(frame(cw).ui.ui_tap).toContain('cancel');
		up('KeyM');
		frame(cw);

		// the same press in multi belongs to seat 2 alone
		cw.uiInputMode = UIInputMode.multi;
		down('KeyM');
		const ips = frame(cw);
		expect(ips.ui.ui_tap).not.toContain('cancel');
		expect(ips.player[ControllerId.KEYBOARD_2].ui_tap).toContain('cancel');
		up('KeyM');
		frame(cw);
	});
});
