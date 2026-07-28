import { mappingGroup } from "../types";
import { debugLog } from "../utils/debug";

/**
 * A named, persisted controller mapping profile.
 * `device` is a `vendor:product` string (or 'keyboard' / 'virtual'); `xinput` marks
 * whether the source reports the standard (xinput) layout.
 */
export type ControllerProfile = {
	name: string; // unique key
	device: string; // 'vendor:product' / 'keyboard' / 'virtual'
	xinput: boolean;
	mapping: mappingGroup;
	/**
	 * A profile the game ships (see {@link ProfileMapping.registerDefaults}) rather than one
	 * the player captured. It can be loaded and overwritten by a re-register, but never
	 * deleted — `remove()` refuses, so the player always has the factory layouts to go back to.
	 */
	builtin?: boolean;
};

/** Minimal ControlWrap surface ProfileMapping needs — keeps it decoupled from internals. */
interface ControlWrapLike {
	getDeviceInfo(index: number): { device: string; xinput: boolean };
	getAllMapping(index: number): mappingGroup;
	setAllMapping(index: number, mapping: mappingGroup): void;
}

/**
 * CRUD + selection rules for named controller profiles, persisted in localStorage.
 * Optional utility — not controlwrap core; only touches ControlWrap through its public API.
 *
 * Selection rules (user spec):
 *  - non-xinput controller → only same-device profiles are selectable;
 *  - xinput controller → all xinput profiles are selectable, same-device sorted first.
 */
export class ProfileMapping {
	private storageKey: string;

	constructor(storageKey: string = "controlwrap:profiles:v1") {
		this.storageKey = storageKey;
	}

	//CRUD================================================================

	public list(): ControllerProfile[] {
		try {
			const raw = localStorage.getItem(this.storageKey);
			if (!raw) return [];
			const parsed = JSON.parse(raw);
			return Array.isArray(parsed) ? (parsed as ControllerProfile[]) : [];
		} catch {
			// corrupt JSON / no localStorage → treat as empty library
			return [];
		}
	}

	public get(name: string): ControllerProfile | undefined {
		return this.list().find((p) => p.name === name);
	}

	/** Upsert by name. */
	public save(profile: ControllerProfile): void {
		const all = this.list().filter((p) => p.name !== profile.name);
		all.push(profile);
		this.write(all);
	}

	/** True when this profile is one the game shipped, and so cannot be deleted. */
	public isBuiltin(name: string): boolean {
		return this.get(name)?.builtin === true;
	}

	/** Delete a profile. Refuses (returns false) for a builtin one, and for an unknown name. */
	public remove(name: string): boolean {
		const all = this.list();
		if (all.find((p) => p.name === name)?.builtin) return false;
		const next = all.filter((p) => p.name !== name);
		if (next.length === all.length) return false;
		this.write(next);
		return true;
	}

	/**
	 * Install the game's factory profiles. Call it at boot with the same list every time: each
	 * entry is (re)written from the definition, so shipping a corrected default fixes it for
	 * players who already have the old copy, while their own saved profiles are untouched.
	 */
	public registerDefaults(profiles: Omit<ControllerProfile, "builtin">[]): void {
		const names = new Set(profiles.map((p) => p.name));
		const mine = this.list().filter((p) => !names.has(p.name));
		this.write([...mine, ...profiles.map((p) => ({ ...p, builtin: true }))]);
	}

	public clear(): void {
		try {
			localStorage.removeItem(this.storageKey);
		} catch {
			/* ignore */
		}
	}

	/** Profiles selectable by a source with the given device/xinput, already sorted. */
	public availableFor(device: string, xinput: boolean): ControllerProfile[] {
		const all = this.list();
		let pool: ControllerProfile[];
		if (xinput) {
			// all xinput profiles; same-device first, then by name
			pool = all.filter((p) => p.xinput);
		} else {
			// non-xinput → only same device
			pool = all.filter((p) => !p.xinput && p.device === device);
		}
		return pool.sort((a, b) => {
			const aSame = a.device === device ? 0 : 1;
			const bSame = b.device === device ? 0 : 1;
			if (aSame !== bSame) return aSame - bSame;
			return a.name.localeCompare(b.name);
		});
	}

	//ControlWrap helpers================================================================

	/** Snapshot a controller's current mapping into a profile (and save it). */
	public captureFrom(cw: ControlWrapLike, controllerIndex: number, name: string): ControllerProfile {
		const { device, xinput } = cw.getDeviceInfo(controllerIndex);
		const profile: ControllerProfile = {
			name,
			device,
			xinput,
			mapping: cw.getAllMapping(controllerIndex),
		};
		this.save(profile);
		return profile;
	}

	/**
	 * Apply a saved profile to a controller. Returns false (without applying) when the
	 * profile is not selectable for that controller (device/xinput rules) or on error.
	 */
	public applyTo(cw: ControlWrapLike, controllerIndex: number, name: string): boolean {
		const profile = this.get(name);
		if (!profile) return false;
		const { device, xinput } = cw.getDeviceInfo(controllerIndex);
		const allowed = this.availableFor(device, xinput).some((p) => p.name === name);
		if (!allowed) return false;
		try {
			cw.setAllMapping(controllerIndex, profile.mapping);
			return true;
		} catch (e) {
			debugLog("applyTo failed", name, e);
			return false;
		}
	}

	//================================================================

	private write(all: ControllerProfile[]): void {
		try {
			localStorage.setItem(this.storageKey, JSON.stringify(all));
		} catch (e) {
			debugLog("ProfileMapping write failed", e);
		}
	}
}
