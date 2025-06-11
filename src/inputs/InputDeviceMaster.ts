import { EventEmitter } from "eventemitter3";
import { mappingGroup, mappingRequirement } from "../types";
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
				//console.log('cancelListen',e);
				this.listenMode = listenStatus.none;
				this.removeAllListeners("cancelListen");
				this.removeAllListeners("listenControllerIndexFromKeys");
				reject(e);
			});
			this.addListener("listenControllerIndexFromKeys", (i) => {
				//console.log('listenControllerIndexFromKeys',this,i);
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

	public getAllMapping(id: number): mappingGroup {
		return this.currentMapping[id];
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
		this.currentMapping[id] = mapping;
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
