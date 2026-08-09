import { EventEmitter } from "eventemitter3";
import { mappingGroup, mappingRequirement } from "../types";
import { clone } from "../utils/utils";
import { IControllerMaster } from "./IControllerMaster";

export enum listenStatus {
	none,
	anyKey,
	ControllerIndexFromKeys,
	raw,
}

export default abstract class InputDeviceMaster extends EventEmitter {
	// implements IControllerMaster

	protected requirement: mappingRequirement | undefined;
	protected currentMapping: Record<number, mappingGroup> = {};

	//listen================================================================

	protected listenMode: listenStatus = listenStatus.none;
	protected listenKeys: string[] = [];

	public listenControllerIndexFromKeys(keys: string[] = []): Promise<number> {
		this.listenMode = listenStatus.ControllerIndexFromKeys;
		this.listenKeys = keys;

		this.removeAllListeners("cancelListen");
		this.removeAllListeners("listenControllerIndexFromKeys");

		return new Promise((resolve, reject) => {
			this.addListener("cancelListen", (e) => {
				this.listenMode = listenStatus.none;
				this.removeAllListeners("cancelListen");
				this.removeAllListeners("listenControllerIndexFromKeys");
				reject(e);
			});
			this.addListener("listenControllerIndexFromKeys", (i) => {
				this.listenMode = listenStatus.none;
				this.removeAllListeners("cancelListen");
				this.removeAllListeners("listenControllerIndexFromKeys");
				resolve(i);
			});
		});
	}

	public cancelListen(reason?: string): void {
		this.listenMode = listenStatus.none;
		this.emit("cancelListen", reason);
	}

	//mapping================================================================

	/**
	 * A **copy** of the controller's current mapping.
	 *
	 * It has to be a copy. The stored mapping is handed around freely — a settings panel reads it
	 * every render, `ProfileMapping.captureFrom` puts it straight into a profile it saves — and
	 * `setMapping` writes into the live object, so a caller that kept the returned reference would
	 * watch its "snapshot" change under it on the next rebind.
	 */
	public getAllMapping(id: number): mappingGroup {
		return this.currentMapping[id] ? clone(this.currentMapping[id]) : this.currentMapping[id];
	}

	public abstract checkMapping(id: number, buttonName: string, keyCode: string): boolean;

	public setAllMapping(id: number, mapping: mappingGroup): void {
		for (let buttonName in mapping) {
			if (typeof mapping[buttonName] === "string") {
				if (!this.checkMapping(id, buttonName, mapping[buttonName] as string)) {
					throw new Error(`mapping error: ${id} ${buttonName} ${mapping[buttonName]}`);
				}
			} else {
				for (let bname of mapping[buttonName] as string[]) {
					if (!this.checkMapping(id, buttonName, bname)) {
						throw new Error(`mapping error: ${id} ${buttonName} ${bname}`);
					}
				}
			}
		}
		// Cloned, never adopted. Every caller of this passes an object it keeps using afterwards:
		// the boot-time default tables (which `resetDefault` must be able to restore *from*), a
		// profile freshly parsed out of localStorage, the game's own constant. Storing the
		// reference made `setMapping` — which writes into `currentMapping[id]` — edit the caller's
		// object too, so rebinding one key quietly rewrote the default it was supposed to be
		// resettable to, and "reset to default" became a no-op.
		this.currentMapping[id] = clone(mapping);
	}

	public setMapping(id: number, buttonName: string, keyCode: string): boolean {
		if (!this.checkMapping(id, buttonName, keyCode)) {
			return false;
		}
		this.currentMapping[id][buttonName] = keyCode;
		return true;
	}

	public getMappableKeys(id: number = 0): {
		buttons: string[];
		optional: string[];
	} {
		let buttons: string[] = [
			//'up', 'down', 'left', 'right',
			...this.requirement!.button,
		];
		let optional: string[] = [];

		if (this.requirement!.optional) {
			optional = [...optional, ...this.requirement!.optional];
		}

		if (this.requirement!.ui_button) {
			if (this.requirement!.ui_pair) {
				for (let i = 0; i < this.requirement!.ui_button.length; i++) {
					const btnName = this.requirement!.ui_button[i];
					if (!this.requirement!.ui_pair[btnName]) {
						buttons.push(btnName);
					}
				}
			} else {
				buttons = [...buttons, ...this.requirement!.ui_button];
			}
		}

		if (this.requirement!.ui_optional) {
			if (this.requirement!.ui_pair) {
				for (let i = 0; i < this.requirement!.ui_optional.length; i++) {
					const btnName = this.requirement!.ui_optional[i];
					if (btnName && !this.requirement!.ui_pair[btnName]) {
						optional.push(btnName);
					}
				}
			} else {
				optional = [...optional, ...this.requirement!.ui_optional];
			}
		}

		return {
			buttons,
			optional,
		};
	}

	public vibration(id: number, duration: number, strongMagnitude: number, weakMagnitude: number): void {}
}
