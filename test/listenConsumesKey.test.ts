// A key press that a listen takes is spent: it does not also reach the game on the next flush.
//
// Keyboard listening is answered on the DOM event, a frame or more before anything reads the
// input — so a press used to do both jobs. In a real game that showed up as: Escape cancels the
// rebind you were in the middle of AND closes the panel it lived in (and the panel under that,
// if the key was held long enough to repeat); and the key you assign to an action also fires
// whatever that key was bound to a moment earlier.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ControlWrap, KeyboardMaster } from '../src/index';

const requirement = {
	direction: { dpad: true, analog: 0 },
	button: ['attack', 'jump'],
	ui_pair: { confirm: 'attack', cancel: 'jump' },
};

const down = (code: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code }));
const up = (code: string) => window.dispatchEvent(new KeyboardEvent('keyup', { code }));

describe('a listen consumes the press that answers it', () => {
	let cw: ControlWrap;

	beforeEach(() => {
		cw = ControlWrap.getInstance();
		cw.wrappedInit({
			requirement,
			defaultGamePadmapping: { attack: 'a', jump: 'b' },
			defaultKeyboardmappings: [
				{ up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', attack: 'KeyF', jump: 'KeyG' },
			],
		});
	});

	afterEach(() => {
		cw.dispose();
	});

	it('the Escape that cancels a rebind does not also reach the UI', async () => {
		const listen = cw.listenKeyFromControllerIndex(0).catch((r) => `cancelled:${r}`);
		down('Escape');
		expect(await listen).toBe('cancelled:escape');

		// the frame after: nothing to see. Escape closed the rebind, not the panel behind it.
		expect(cw.update().ui.ui_tap).not.toContain('escape');
		up('Escape');
		cw.update();

		// …and the next Escape is an ordinary one again
		down('Escape');
		expect(cw.update().ui.ui_tap).toContain('escape');
		up('Escape');
		cw.update();
	});

	it('the key you assign does not also fire what it used to do', async () => {
		const listen = cw.listenKeyFromControllerIndex(0);
		down('KeyF'); // F is this seat's attack → confirm
		expect(await listen).toBe('KeyF');

		expect(cw.update().ui.ui_tap).not.toContain('confirm');
		expect(KeyboardMaster.getInstance().downKeyArray).not.toContain('KeyF');
		up('KeyF');
		cw.update();

		// pressing it again is a normal press
		down('KeyF');
		expect(cw.update().ui.ui_tap).toContain('confirm');
		up('KeyF');
		cw.update();
	});

	it('Escape with nothing listening is left alone', () => {
		down('Escape');
		expect(cw.update().ui.ui_tap).toContain('escape');
		up('Escape');
		cw.update();
	});
});
