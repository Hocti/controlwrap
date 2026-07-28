import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProfileMapping } from '../src/useful/ProfileMapping';

const P = (name: string, device: string, xinput: boolean) => ({ name, device, xinput, mapping: { flap: 'a' } });

// isolate every test — all blocks share storage key 't:p'
beforeEach(() => localStorage.clear());

describe('ProfileMapping CRUD', () => {
	it('save/get/list/remove round-trip via localStorage', () => {
		const s = new ProfileMapping('t:p');
		s.save(P('mine', '054c:0ce6', false));
		expect(new ProfileMapping('t:p').get('mine')!.device).toBe('054c:0ce6');
		expect(new ProfileMapping('t:p').list()).toHaveLength(1);
		expect(new ProfileMapping('t:p').remove('mine')).toBe(true);
		expect(new ProfileMapping('t:p').list()).toHaveLength(0);
	});
	it('save is upsert by name', () => {
		const s = new ProfileMapping('t:p');
		s.save(P('a', 'x:1', true));
		s.save({ ...P('a', 'x:1', true), mapping: { flap: 'b' } });
		expect(s.list()).toHaveLength(1);
		expect(s.get('a')!.mapping.flap).toBe('b');
	});
	it('corrupt json → empty library', () => {
		localStorage.setItem('t:p', '{bad');
		expect(new ProfileMapping('t:p').list()).toEqual([]);
	});
});

describe('ProfileMapping availableFor（user 規則）', () => {
	it('non-xinput device only sees same-device profiles', () => {
		const s = new ProfileMapping('t:p');
		s.save(P('sameDev', '2dc8:9018', false));
		s.save(P('otherDev', '054c:0ce6', false));
		s.save(P('xin', 'std:pad', true));
		const r = s.availableFor('2dc8:9018', false);
		expect(r.map((p) => p.name)).toEqual(['sameDev']);
	});
	it('xinput device sees all xinput profiles, same-device first', () => {
		const s = new ProfileMapping('t:p');
		s.save(P('xinOther', 'aaaa:0001', true));
		s.save(P('xinSame', 'bbbb:0002', true));
		s.save(P('nonXin', 'bbbb:0002', false));
		const r = s.availableFor('bbbb:0002', true);
		expect(r.map((p) => p.name)).toEqual(['xinSame', 'xinOther']); // 同 device 優先；非 xinput 唔入圍
	});
});

describe('ProfileMapping ↔ ControlWrap helpers', () => {
	it('captureFrom snapshots mapping + device; applyTo respects rules', () => {
		const cw = {
			getDeviceInfo: (i: number) =>
				i === 100 ? { device: '2dc8:9018', xinput: false } : { device: 'keyboard', xinput: false },
			getAllMapping: vi.fn(() => ({ flap: 'x' })),
			setAllMapping: vi.fn(),
		} as any;
		const s = new ProfileMapping('t:p');
		const prof = s.captureFrom(cw, 100, 'zero2');
		expect(prof).toMatchObject({ name: 'zero2', device: '2dc8:9018', xinput: false, mapping: { flap: 'x' } });
		expect(s.get('zero2')).toBeDefined();

		expect(s.applyTo(cw, 100, 'zero2')).toBe(true); // 同 device → 准
		expect(cw.setAllMapping).toHaveBeenCalledWith(100, { flap: 'x' });
		expect(s.applyTo(cw, 0, 'zero2')).toBe(false); // keyboard 唔啱 device → 拒
	});
});

describe('default (builtin) profiles', () => {
	it('registers the shipped layouts and refuses to delete them', () => {
		const s = new ProfileMapping('t:builtin');
		s.clear();
		s.registerDefaults([
			{ name: 'Keyboard 1', device: 'keyboard', xinput: false, mapping: { up: 'KeyW' } },
			{ name: 'Keyboard 2', device: 'keyboard', xinput: false, mapping: { up: 'KeyI' } },
		]);

		expect(s.list().map((p) => p.name)).toEqual(['Keyboard 1', 'Keyboard 2']);
		expect(s.isBuiltin('Keyboard 1')).toBe(true);
		expect(s.remove('Keyboard 1')).toBe(false);
		expect(s.get('Keyboard 1')).toBeTruthy(); // still there after the refusal
	});

	it('leaves the player their own profiles, and lets those be deleted', () => {
		const s = new ProfileMapping('t:builtin2');
		s.clear();
		s.registerDefaults([{ name: 'Keyboard 1', device: 'keyboard', xinput: false, mapping: { up: 'KeyW' } }]);
		s.save({ name: 'Mine', device: 'keyboard', xinput: false, mapping: { up: 'KeyZ' } });

		// re-registering (e.g. a corrected default shipped in an update) must not touch 'Mine'
		s.registerDefaults([{ name: 'Keyboard 1', device: 'keyboard', xinput: false, mapping: { up: 'KeyE' } }]);
		expect(s.get('Mine')?.mapping.up).toBe('KeyZ');
		expect(s.get('Keyboard 1')?.mapping.up).toBe('KeyE');

		expect(s.isBuiltin('Mine')).toBe(false);
		expect(s.remove('Mine')).toBe(true);
	});
});
