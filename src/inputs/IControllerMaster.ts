import { EventEmitter } from "eventemitter3";
import { mappingRequirement, Input, systemInput, mappingGroup, latestLayoutGroup } from "../types";
import { buttonLayout } from "../config";

//<ControllerInstance,InputType,MappingType>
export interface IControllerMaster extends EventEmitter {
	init(): void;

	count(): number;
	getIndexs(): number[];
	flushAll(): Record<number, Input>;
	flushUI(): Record<number, systemInput>;
	getName(index: number): string;

	//listen
	listenControllerIndexFromKeys(keys?: string[]): Promise<number>;
	listenKeyFromControllerIndex(index: number): Promise<number>;
	cancelListen(reason?: string): void;

	//mapping
	importRequirement(requirement: mappingRequirement): void;
	setAllMapping(index: number, mapping: mappingGroup): void;
	resetDefault(index: number): mappingGroup | undefined;
	getAllMapping(index: number): mappingGroup;
	setMapping(index: number, buttonName: string, keyCode: string): boolean;
	checkMapping(index: number, buttonName: string, keyCode: string): boolean;
	checkNotRepeat(index: number, buttonName: string, keyCode: string): boolean;
	getMappableKeys(index?: number): {
		buttons: string[];
		optional: string[];
	};

	renewSystemButtonLayout(index: number): latestLayoutGroup;
	//setDefaultMapping(index: number, mapping: mappingGroup): void;

	vibration(index: number, duration: number, strongMagnitude: number, weakMagnitude: number): void; //:Promise<GamepadHapticsResult>;
}
