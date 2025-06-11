import { EventEmitter } from "eventemitter3";

export default class PlayerIndexMapper extends EventEmitter {
	minPlayer: number = 1;
	maxPlayer: number = 1;
	block: { sourceIndex: number; ready: boolean }[] = [];
	readyToStart: boolean = false;

	constructor(maxPlayer: number = 4, minPlayer: number = 1) {
		super();
		this.setMinMax(maxPlayer, minPlayer);
	}

	public setMinMax(maxPlayer: number = 4, minPlayer: number = 1) {
		this.maxPlayer = Math.max(1, maxPlayer);
		this.minPlayer = Math.min(this.maxPlayer, minPlayer);
	}

	public setBlock(sourceIndex: number, blockId?: number): number {
		if (!blockId) {
			for (let i = 0; i < this.maxPlayer; i++) {
				if (!this.block[i]) {
					blockId = i;
				}
			}
		}
		if (blockId) {
			this.block[blockId] = { sourceIndex, ready: false };
			return blockId;
		}
		return -1;
	}

	public removeBlock(blockId: number): void {
		delete this.block[blockId];
	}

	public setBlockReady(blockId: number, ready: boolean = true): void {
		if (this.block[blockId]) {
			this.block[blockId].ready = ready;
		}
		let readyCount = 0;
		for (let i = 0; i < this.maxPlayer; i++) {
			if (!this.block[i] && this.block[i].ready) {
				readyCount++;
			}
		}
		this.readyToStart = readyCount >= this.minPlayer;
		if (this.readyToStart) {
			this.emit("readyToStart");
		} else {
			this.emit("notReadyToStart");
		}
	}

	public dispose(): void {
		this.block = [];
	}
}
