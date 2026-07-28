import { describe, it, expect, beforeEach } from 'vitest';
import VirtualGamepadMaster from '../src/inputs/VirtualGamepadMaster';

const REQ = {
	direction: { dpad: true, analog: 1 as const },
	button: ['flap'],
	ui_pair: { confirm: 'flap' },
};

describe('VirtualGamepadMaster', () => {
	let m: VirtualGamepadMaster;
	beforeEach(() => {
		m = new (VirtualGamepadMaster as any)(); // 測試用新 instance，避開 singleton state
		m.importRequirement(REQ as any);
		m.setDefaultMapping({ flap: 'a' });
		m.connect(0);
	});

	it('button press flows through mapping to game button + ui_pair', () => {
		m.setButton('a', true);
		const ips = m.flushAll();
		expect(ips[0].button!.flap.press).toBe(true);
		expect(ips[0].button!.flap.just).toBe(true);
		expect(ips[0].ui_tap).toContain('confirm');
		m.setButton('a', false);
		const ips2 = m.flushAll();
		expect(ips2[0].button!.flap.press).toBe(false);
	});

	it('start maps to escape ui_tap', () => {
		m.setButton('start', true);
		expect(m.flushAll()[0].ui_tap).toContain('escape');
	});

	it('setDirection produces analog + directionButton + mixedDpad', () => {
		m.setDirection(1, 0);
		const ip = m.flushAll()[0];
		expect(ip.analog!.right).toBe(true);
		expect(ip.directionButton!.right.press).toBe(true);
		expect(ip.mixedDpad!.numpad).toBe(6);
	});

	it('releaseAll clears everything', () => {
		m.setButton('a', true);
		m.setDirection(0, -1);
		m.flushAll();
		m.releaseAll();
		const ip = m.flushAll()[0];
		expect(ip.button!.flap.press).toBe(false);
		expect(ip.mixedDpad!.numpad).toBe(5);
	});

	it('not connected → not in flush result', () => {
		m.disconnect(0);
		expect(Object.keys(m.flushAll())).toHaveLength(0);
	});

	it('doubleDpad forces double for one flush only', () => {
		m.setDpad('right' as any, true);
		m.doubleDpad('right' as any);
		const ip = m.flushAll()[0];
		expect(ip.directionButton!.right.press).toBe(true);
		expect(ip.directionButton!.right.double).toBe(true);
		// still held, but the double flag must not stick to later frames
		expect(m.flushAll()[0].directionButton!.right.double).toBe(false);
	});

	it('pushCommand delivers once, then the command list is gone again', () => {
		m.pushCommand('super');
		expect(m.flushAll()[0].command).toEqual(['super']);
		expect(m.flushAll()[0].command).toBeUndefined();
	});

	it('setVectorCommand sums every call between flushes into one command per frame', () => {
		m.setVectorCommand('touchmove', 6, -3);
		m.setVectorCommand('touchmove', 4, -2);
		expect(m.flushAll()[0].command).toEqual(['touchmove:10,-5']);
		expect(m.flushAll()[0].command).toBeUndefined();
	});

	it('a sub-unit drag keeps accumulating instead of reporting 0,0 forever', () => {
		m.setVectorCommand('touchmove', 0.4, 0);
		expect(m.flushAll()[0].command).toBeUndefined();
		m.setVectorCommand('touchmove', 0.4, 0);
		expect(m.flushAll()[0].command).toEqual(['touchmove:1,0']);
	});

	it('doubleButton forces double on a mapped game button', () => {
		m.setButton('a', true);
		m.doubleButton('a');
		expect(m.flushAll()[0].button!.flap.double).toBe(true);
		expect(m.flushAll()[0].button!.flap.double).toBe(false);
	});
});
