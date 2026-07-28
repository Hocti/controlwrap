import { EventEmitter } from "eventemitter3";

export type PlayerSlot = { controllerIndex: number; ready: boolean };

/**
 * Smash-Bros-style seat allocation for a lobby: N seats (game max) claimed by up to
 * M input sources (M can exceed N). This class only owns seat assignment + ready state;
 * the countdown / game start is the game's job, driven by the `readyToStart` event.
 *
 * Optional utility — not part of controlwrap core. No existing code depends on it.
 *
 * Events:
 *  - `join`(slotId, controllerIndex)
 *  - `leave`(slotId)
 *  - `ready`(slotId, ready)
 *  - `readyToStart`(boolean) — emitted only when the value changes.
 */
export default class PlayerIndexMapper extends EventEmitter {
	public minPlayer: number = 1;
	public maxPlayer: number = 1;
	private slots: (PlayerSlot | undefined)[] = [];
	private _readyToStart: boolean = false;

	constructor(maxPlayer: number = 4, minPlayer: number = 1) {
		super();
		this.setMinMax(maxPlayer, minPlayer);
	}

	public setMinMax(maxPlayer: number = 4, minPlayer: number = 1): void {
		this.maxPlayer = Math.max(1, maxPlayer);
		this.minPlayer = Math.min(this.maxPlayer, Math.max(1, minPlayer));
	}

	/**
	 * Claim a seat for `controllerIndex`. Returns the slot id (smallest free slot first),
	 * -1 when full. Same controller joining again returns its existing slot.
	 */
	public join(controllerIndex: number): number {
		const existing = this.getSlot(controllerIndex);
		if (existing !== -1) return existing;

		for (let i = 0; i < this.maxPlayer; i++) {
			if (!this.slots[i]) {
				this.slots[i] = { controllerIndex, ready: false };
				this.emit("join", i, controllerIndex);
				this.recomputeReadyToStart();
				return i;
			}
		}
		return -1;
	}

	/** Cancel a controller's claim (free the seat). Returns whether anything was removed. */
	public leave(controllerIndex: number): boolean {
		const slotId = this.getSlot(controllerIndex);
		if (slotId === -1) return false;
		return this.leaveSlot(slotId);
	}

	public leaveSlot(slotId: number): boolean {
		if (!this.slots[slotId]) return false;
		this.slots[slotId] = undefined;
		this.emit("leave", slotId);
		this.recomputeReadyToStart();
		return true;
	}

	/** Set (or revoke, with `ready=false`) the ready state of a controller's seat. */
	public setReady(controllerIndex: number, ready: boolean = true): void {
		const slotId = this.getSlot(controllerIndex);
		if (slotId === -1) return;
		const slot = this.slots[slotId]!;
		if (slot.ready === ready) return;
		slot.ready = ready;
		this.emit("ready", slotId, ready);
		this.recomputeReadyToStart();
	}

	/** Slot id for a controller, or -1 if it has not joined. */
	public getSlot(controllerIndex: number): number {
		for (let i = 0; i < this.slots.length; i++) {
			if (this.slots[i] && this.slots[i]!.controllerIndex === controllerIndex) return i;
		}
		return -1;
	}

	/** All seats, indexed by slot id (undefined = empty). */
	public getSlots(): (PlayerSlot | undefined)[] {
		const result: (PlayerSlot | undefined)[] = [];
		for (let i = 0; i < this.maxPlayer; i++) {
			result[i] = this.slots[i];
		}
		return result;
	}

	public joinedCount(): number {
		let n = 0;
		for (let i = 0; i < this.maxPlayer; i++) if (this.slots[i]) n++;
		return n;
	}

	public readyCount(): number {
		let n = 0;
		for (let i = 0; i < this.maxPlayer; i++) if (this.slots[i]?.ready) n++;
		return n;
	}

	/** True when at least `minPlayer` have joined and every joined seat is ready. */
	public get readyToStart(): boolean {
		return this._readyToStart;
	}

	public reset(): void {
		this.slots = [];
		this.setReadyToStart(false);
	}

	private recomputeReadyToStart(): void {
		const joined = this.joinedCount();
		const value = joined >= this.minPlayer && this.readyCount() === joined;
		this.setReadyToStart(value);
	}

	private setReadyToStart(value: boolean): void {
		if (this._readyToStart === value) return;
		this._readyToStart = value;
		this.emit("readyToStart", value);
	}

	//deprecated aliases (old, buggy API — kept for back-compat)==================

	/** @deprecated use {@link join} */
	public setBlock(sourceIndex: number): number {
		return this.join(sourceIndex);
	}

	/** @deprecated use {@link leaveSlot} */
	public removeBlock(blockId: number): void {
		this.leaveSlot(blockId);
	}

	/** @deprecated use {@link setReady} — note this takes a slot id, not a controller index */
	public setBlockReady(blockId: number, ready: boolean = true): void {
		const slot = this.slots[blockId];
		if (slot) this.setReady(slot.controllerIndex, ready);
	}

	/** @deprecated use {@link reset} */
	public dispose(): void {
		this.reset();
	}
}
