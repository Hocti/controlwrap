import { describe, it, expect, vi } from 'vitest';
import PlayerIndexMapper from '../src/useful/PlayerIndexMapper';

describe('PlayerIndexMapper', () => {
	it('assigns slot 0 first (not last free slot)', () => {
		const m = new PlayerIndexMapper(4, 2);
		expect(m.join(100)).toBe(0);
		expect(m.join(0)).toBe(1);
	});
	it('same controller joins once', () => {
		const m = new PlayerIndexMapper(4, 1);
		expect(m.join(100)).toBe(0);
		expect(m.join(100)).toBe(0);
		expect(m.joinedCount()).toBe(1);
	});
	it('slot 0 releases and is reused', () => {
		const m = new PlayerIndexMapper(2, 1);
		m.join(100);
		m.join(101);
		expect(m.join(102)).toBe(-1); // full
		expect(m.leave(100)).toBe(true);
		expect(m.join(102)).toBe(0); // 重用 slot 0（blockId=0 舊 bug 位）
	});
	it('readyToStart needs minPlayer readies and all joined ready', () => {
		const m = new PlayerIndexMapper(4, 2);
		const spy = vi.fn();
		m.on('readyToStart', spy);
		m.join(0);
		m.join(1);
		m.setReady(0);
		expect(m.readyToStart).toBe(false); // 1 ready < min 2
		m.setReady(1);
		expect(m.readyToStart).toBe(true);
		expect(spy).toHaveBeenLastCalledWith(true);
		m.join(100); // 第三人加入未 ready → 不可 start
		expect(m.readyToStart).toBe(false);
	});
	it('un-ready during countdown revokes readyToStart (反悔)', () => {
		const m = new PlayerIndexMapper(4, 2);
		const spy = vi.fn();
		m.on('readyToStart', spy);
		m.join(0);
		m.join(1);
		m.setReady(0);
		m.setReady(1);
		expect(m.readyToStart).toBe(true);
		m.setReady(0, false); // 倒數期間反悔
		expect(m.readyToStart).toBe(false);
		expect(spy).toHaveBeenLastCalledWith(false);
	});
	it('non-ready source can cancel claim to free the seat', () => {
		const m = new PlayerIndexMapper(2, 2);
		m.join(0);
		m.join(1);
		expect(m.join(100)).toBe(-1); // 滿座，申請無效
		m.leave(1); // 未 ready 者讓位
		expect(m.join(100)).toBe(1); // 其他 source 補上
	});
});
