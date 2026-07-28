import { describe, it, expect } from 'vitest';
import { Button, joinState, getUITap } from '../src/inputs/Button';

const IDLE = { press: false, just: false, double: false, tap: false, pressFrame: 0 };

describe('Button basics', () => {
	it('press → flush: press+just, next flush: press only, release → just again', () => {
		const b = new Button();
		b.press();
		expect(b.flush()).toMatchObject({ press: true, just: true });
		expect(b.flush()).toMatchObject({ press: true, just: false });
		expect(b.flush().pressFrame).toBe(3);
		b.release();
		expect(b.flush()).toMatchObject({ press: false, just: true, pressFrame: 0 });
	});
	it('within-frame tap: press+release before flush → tap=true', () => {
		const b = new Button();
		b.press();
		b.release();
		const s = b.flush();
		expect(s.press).toBe(false);
		expect(s.tap).toBe(true);
		expect(getUITap(s)).toBe(true);
	});
	it('double tap across frames within window', () => {
		const b = new Button();
		b.press();
		b.flush();
		b.release();
		b.flush();
		b.press();
		expect(b.flush().double).toBe(true);
	});
	it('no double when gap exceeds minDoubleFrame', () => {
		const b = new Button();
		b.press();
		b.flush();
		b.release();
		for (let i = 0; i < 40; i++) b.flush(); // 40 > default 30
		b.press();
		expect(b.flush().double).toBe(false);
	});
});

describe('joinState', () => {
	it('or-merges press, suppresses just when other key held', () => {
		const held = { press: true, just: false, double: false, tap: false, pressFrame: 10 };
		const justNow = { press: true, just: true, double: false, tap: false, pressFrame: 1 };
		const j = joinState(held, justNow);
		expect(j.press).toBe(true);
		expect(j.just).toBe(false);
	});
	it('idle + tap = tap', () => {
		const tap = { press: false, just: true, double: false, tap: true, pressFrame: 0 };
		expect(joinState(IDLE, tap).tap).toBe(true);
	});
});
