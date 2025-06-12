import { Input } from "../types";
import { dpad } from "gamepad_standardizer";

export function checkAnyKeypress(input: Input, ui_only: boolean = false): boolean {
	if (input.ui_tap.length > 0) {
		return true;
	}
	if (ui_only) {
		return false;
	}
	for (let key in input.button) {
		if (input.button[key].just) {
			return true;
		}
	}
	for (let key in input.directionButton) {
		if (input.directionButton[key as dpad].just) {
			return true;
		}
	}
	return false;
}
