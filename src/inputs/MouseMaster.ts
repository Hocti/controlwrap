import { EventEmitter } from "eventemitter3";
import { XY } from "gamepad_standardizer";
import { mouseInput } from "../types";
import { debugLog } from "../utils/debug";
import { stopEvent } from "../utils/utils";
import { Button } from "./Button";

const MOUSE_BUTTON_NAME: string[] = ["left", "right", "middle", "prev", "next"];

export default class MouseMaster extends EventEmitter {
	protected static instance: MouseMaster;
	public static getInstance(): MouseMaster {
		if (!MouseMaster.instance) {
			MouseMaster.instance = new MouseMaster();
		}

		return MouseMaster.instance;
	}

	static isSupported(): boolean {
		return "onkeydown" in window;
	}

	//================================================================

	public customStopEventFn: ((event: MouseEvent) => boolean) | undefined;

	protected lastxy: XY = { x: 0, y: 0 };
	protected latestxy: XY = { x: 0, y: 0 };
	protected delta: number = 0;
	protected lastPress: boolean[] = [false, false, false, false, false];
	private buttons: Record<string, Button> = {};
	private inited: boolean = false;

	// bound listeners kept so dispose() can remove exactly what init() added
	private _boundMEvent = this.mEvent.bind(this);
	private _boundOnBlur = this.onBlur.bind(this);
	private _boundWEvent = this.wEvent.bind(this);
	private _boundRightClick = this.onRightClick.bind(this);

	public init() {
		if (this.inited) {
			return;
		}
		this.inited = true;
		window.addEventListener("mousemove", this._boundMEvent);
		window.addEventListener("mousedown", this._boundMEvent);
		window.addEventListener("mouseup", this._boundMEvent);
		window.addEventListener("blur", this._boundOnBlur);
		window.addEventListener("wheel", this._boundWEvent);
		document.oncontextmenu = this._boundRightClick;

		for (let i = 0; i < 5; i++) {
			this.buttons[MOUSE_BUTTON_NAME[i]] = new Button();
		}
	}

	public dispose(): void {
		if (!this.inited) return;
		window.removeEventListener("mousemove", this._boundMEvent);
		window.removeEventListener("mousedown", this._boundMEvent);
		window.removeEventListener("mouseup", this._boundMEvent);
		window.removeEventListener("blur", this._boundOnBlur);
		window.removeEventListener("wheel", this._boundWEvent);
		if (document.oncontextmenu === this._boundRightClick) {
			document.oncontextmenu = null;
		}
		this.inited = false;
	}

	protected wEvent(event: WheelEvent) {
		if (event.deltaY != 0) {
			this.delta = event.deltaY > 0 ? 1 : -1;
		}
	}

	protected mEvent(event: MouseEvent) {
		if (event.type === "mousemove") {
			this.latestxy.x = event.clientX;
			this.latestxy.y = event.clientY;
			return;
		}

		if (event.type === "mousedown" || event.type === "mouseup") {
			const buttonPress: boolean[] = [false, false, false, false, false];
			const btns = event.buttons.toString(2);
			for (let i = 0; i < btns.length; i++) {
				if (btns[i] === "1") {
					buttonPress[btns.length - i - 1] = true;
				}
			}
			for (let i = 0; i < 5; i++) {
				if (buttonPress[i] != this.lastPress[i]) {
					this.lastPress[i] = buttonPress[i];
					if (buttonPress[i]) {
						this.buttons[MOUSE_BUTTON_NAME[i]].press();
					} else {
						this.buttons[MOUSE_BUTTON_NAME[i]].release();
					}
				}
			}
			if (this.customStopEventFn) {
				if (this.customStopEventFn(event)) {
					stopEvent(event);
				}
			} else {
				if (this.blockPrevNext && (event.button == 3 || event.button == 4)) {
					stopEvent(event);
				}
				if (this.blockMiddle && event.button == 1) {
					stopEvent(event);
				}
			}
		}
	}

	protected onRightClick(event: MouseEvent) {
		if (this.customStopEventFn) {
			if (this.customStopEventFn(event)) {
				stopEvent(event);
			}
		} else if (this.blockRightClick) {
			stopEvent(event);
		}
	}

	protected onBlur(e: FocusEvent) {
		for (let i = 0; i < 5; i++) {
			if (this.lastPress[i]) {
				this.lastPress[i] = false;
				this.buttons[MOUSE_BUTTON_NAME[i]].release();
			}
		}
	}

	public listenXY: boolean = false;

	public flush(): mouseInput {
		let result: mouseInput = {
			delta: this.delta,
			buttons: {},
		};
		if (this.listenXY) {
			result.xy = { x: this.latestxy.x, y: this.latestxy.y };
			result.xyDelta = {
				x: this.lastxy.x - this.latestxy.x,
				y: this.lastxy.y - this.latestxy.y,
			};
		}
		for (let key in this.buttons) {
			result.buttons[key] = this.buttons[key].flush();
		}

		this.lastxy.x = this.latestxy.x;
		this.lastxy.y = this.latestxy.y;
		this.delta = 0;

		return result;
	}

	public blockRightClick: boolean = false;
	public blockPrevNext: boolean = false;
	public blockMiddle: boolean = false;

	public hideCursor(): void {
		document.body.style.cursor = "none";
	}

	public showCursor(): void {
		document.body.style.removeProperty("cursor");
	}

	public getCursorDisplay(): boolean {
		return document.body.style.cursor !== "none";
	}

	/**
	 * lock:
	 * move
	 */
}
