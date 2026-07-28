import { describe, it, expect } from 'vitest';
import { ControllerId } from '../src/config';
import { ControlWrap } from '../src/index';

describe('ControllerId', () => {
	it('matches parseIndex/makeIndex round trip', () => {
		const cw = ControlWrap.getInstance();
		expect(cw.makeIndex('gamepad' as any, 0)).toBe(ControllerId.GAMEPAD_1);
		expect(cw.parseIndex(ControllerId.GAMEPAD_2)[1]).toBe(1);
		expect(ControllerId.isGamepad(101)).toBe(true);
		expect(ControllerId.isKeyboard(3)).toBe(true);
		expect(ControllerId.isKeyboard(100)).toBe(false);
		cw.dispose();
	});
	it('dispose resets singleton', () => {
		const a = ControlWrap.getInstance();
		a.dispose();
		expect(ControlWrap.getInstance()).not.toBe(a);
	});
	it('parseIndex handles virtual range', () => {
		const cw = ControlWrap.getInstance();
		expect(cw.parseIndex(200)).toEqual(['virtual', 0]);
		expect(cw.parseIndex(101)).toEqual(['gamepad', 1]);
		expect(cw.makeIndex('virtual' as any, 1)).toBe(201);
		cw.dispose();
	});
});
