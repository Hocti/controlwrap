// Fixed xbox-layout pairing between physical gamepad button names and UI action names.
// Shared by GamepadMaster and VirtualGamepadMaster (virtual always uses swapAB=false).

/** physical button (a/b/start/back/shoulders) → UI action (confirm/cancel/escape/info/tabs). */
export function getPairFromBtnName(btnName: string, swapAB: boolean = false): string {
	if (btnName == "a") {
		return !swapAB ? "confirm" : "cancel";
	} else if (btnName == "b") {
		return !swapAB ? "cancel" : "confirm";
	} else if (btnName == "start") {
		return "escape";
	} else if (btnName == "back") {
		return "info";
	} else if (btnName == "leftshoulder") {
		return "prevTab";
	} else if (btnName == "rightshoulder") {
		return "nextTab";
	}
	return "";
}

/** UI action → physical button (inverse of {@link getPairFromBtnName}). */
export function getPairFromUiBtnName(UiBtnName: string, swapAB: boolean = false): string {
	if (UiBtnName == "confirm") {
		return !swapAB ? "a" : "b";
	} else if (UiBtnName == "cancel") {
		return swapAB ? "a" : "b";
	} else if (UiBtnName == "escape") {
		return "start";
	} else if (UiBtnName == "info") {
		return "back";
	} else if (UiBtnName == "prevTab") {
		return "leftshoulder";
	} else if (UiBtnName == "nextTab") {
		return "rightshoulder";
	}
	return "";
}
