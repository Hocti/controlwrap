# ControlWrap

wrap all gamepad,keyboard,mouse input in one place, output as your custumized standard's input format

## Rules

-   for local-multi-play game made in HTML
-   you don't need to know what's the raw input on keyboard or gamepad, the UI input `up` is from dpad or analog, all input are wrapped to you
-   by using [gamepad standardizer](https://github.com/Hocti/gamepad_standardizer), all controller even not a XInput standard, still wrapped as a standard controller
-   allow setting 1~4 players on keyboard, also each gamepad count as on player(max 4), total max 8 players. all keyboard players share "ESC" key as pause key
-   Player's input grouped into ui/other, if your game key `attack` is `confirm` in UI, press it would appear in both side
-   all UI input with justPress,Pressing,Repeat(for UI) 3 category
-   UI button with`up down left right confirm escape`, and `cancel info prevTab nextTab` as optional. gamepad's UI key are fixed, so you need to mapping the game key (`attack`,`jump` etc) only.
-   when press a optional special key `double`, all direction key will count as double press
-   you can select one player as main player (with a async listen method to select the first player press start/A)
-   Keyboard's Arrow, Enter, Backspace, Tab, Esc always map as system input (menu keys — see UI input mode)
-   categorized input with players,system,ui(mixed system and the main player)

## demo

prepare you controller then [try here](https://hocti-demo.s3.ap-southeast-1.amazonaws.com/controlwrap/demo/controlWrap.html)

## install

```
npm install controlwrap
```

or using jsdelivr

```
<script src="https://cdn.jsdelivr.net/npm/controlwrap@latest/dist/controlwrap.js"></script>
```

## how to use

```typescript
import { ControlWrap } from "../dist/controlwrap.esm.js";

const cwi = ControlWrap.getInstance();

cwi.wrappedInit(
	{
		requirement: {
			direction: { dpad: false, analog: 0 }, //using dpad(up/down/left/right),and how many analog is needed(0~2)
			button: ["attack", "jump"], //keys
			optional: ["double"], //optional keys
			ui_pair: {
				//pair system key to key for keyboard,optional
				confirm: "attack",
				cancel: "jump",
			},
			//skipped some config...
		},
		defaultGamePadmapping: {
			//default gamepad pair
			attack: "x",
			jump: "a",
		},
		defaultKeyboardmappings: [
			{
				//default keyboard pair
				up: "KeyW",
				down: "KeyS",
				left: "KeyA",
				right: "KeyD",
				attack: "KeyF",
				jump: "KeyG",
			},
			{
				//default keyboard2 pair
				up: "KeyI",
				down: "KeyK",
				left: "KeyJ",
				right: "KeyL",
				attack: "KeyP",
				jump: "BracketLeft",
			},
		],
	} //number of players from keyboard,max 4
);

//under game loop
const etf = () => {
	const allInputs = cwi.update();
	//all input from gamepad,keyboard,mouse are wrapped here
	// watch the demo site to see what result would got
};
setInterval(etf, 1000 / 60);
```

## Controller ids

Every input source has a numeric id. Use the `ControllerId` constants instead of raw
numbers for readability (values are unchanged):

| Range     | Source        | Constants                                   |
| --------- | ------------- | ------------------------------------------- |
| `0–3`     | keyboard 1–4  | `ControllerId.KEYBOARD_1 … KEYBOARD_4`      |
| `100–103` | gamepad 1–4   | `ControllerId.GAMEPAD_1 … GAMEPAD_4`        |
| `200–203` | virtual 1–4   | `ControllerId.VIRTUAL_1 … VIRTUAL_4`        |
| `1000`    | system        | `ControllerId.SYSTEM`                       |
| `2000`    | ui (mixed)    | `ControllerId.UI`                           |

```ts
import { ControllerId } from "controlwrap";
ControllerId.isKeyboard(3); // true
ControllerId.isGamepad(101); // true
ControllerId.isVirtual(200); // true
```

`cw.parseIndex(id)` → `[ControlType, localIndex]`, `cw.makeIndex(type, localIndex)` → id.

## UI input mode

A game is two different things at different moments, and the shared UI channel
(`InputGroup.ui`) should answer to different people in each:

```ts
import { UIInputMode } from "controlwrap";

cw.uiInputMode = UIInputMode.single; // menus (default)
cw.uiInputMode = UIInputMode.multi; // lobby / match
```

| | `single` — one person driving | `multi` — everyone playing |
| --- | --- | --- |
| feeds `ips.ui` | **every** connected device | the main controller only |
| keyboard menu keys | ↑↓←→ `Enter` `Backspace` `Tab` `Esc` always live | each seat's own mapping |
| where the others are read | — | `ips.player[index]`, per seat |

`single` is the default, because a game opens on a menu — and a menu that answers to only one of
two plugged-in pads is a bug every time. Switch to `multi` when the lobby opens and back when it
closes.

Note that this is **not** `preserveNavKeys`, which answers a different question: whether a player
may *bind* the arrows and Enter for themselves. A game can free the arrows for a keyboard-3
player (`preserveNavKeys: false`) and still have arrow-key menus — in `single` the fixed menu
keys are live either way. `Esc` reaches the UI in both modes and under any flag.

## Gamepad while the window is not focused

```ts
cw.ignoreGamepadWhenWindowInactive = true; // default
// or up front: cw.wrappedInit({ ..., ignoreGamepadWhenWindowInactive: false })
```

A keyboard already respects focus for free — a window that lost focus is sent no key events. A
gamepad does not: it is *polled*, so a pad resting against something (or a player driving another
window) keeps walking the menus of a game nobody is looking at, and a rebind screen in the
background answers a button meant for somewhere else.

While the window is inactive every pad reads as "nothing pressed": a button held across the blur
is released rather than left stuck, and whatever is still held when focus comes back is ignored
until it is let go — the same as a key held while away, which the browser never reports on return.
Pads stay tracked either way (connect/disconnect, names, vibration are unaffected).

Turn it off for a window that is *meant* to be driven unfocused — an overlay, a second display, a
kiosk. `isWindowActive()` is exported if you want the same answer for your own code.

## Lifecycle

- `cw.update(uiOnly?)` — call once per frame; returns the grouped `InputGroup`. Calling it
  twice in one frame drops the input in between (a `debugLog` warns when this happens).
- `cw.dispose()` — removes every window listener the masters added and resets the singleton.
- `setDebug(true)` — enables internal debug logging (off by default; nothing else logs).

## Virtual gamepad (touch)

`VirtualGamepadMaster` is a **UI-less input injection point**. Any touch UI (your own, or a
library) pushes input in; the game keeps reading from `cw.update()` and never needs to know a
virtual pad exists. It contains **zero DOM/UI code** — building the on-screen buttons is the
app's job.

```ts
cw.wrappedInit({ requirement, defaultGamePadmapping, defaultKeyboardmappings, virtual: true });

// from your touch UI — button names match a standard xbox pad:
const vpad = VirtualGamepadMaster.getInstance();
vpad.setButton("a", true); // press / release
vpad.setDirection(x, y); // left-analog semantics, x,y ∈ -1..1
vpad.setDpad("up", true); // or inject dpad directly
vpad.releaseAll(); // when the UI hides — avoids stuck keys
```

Fixed UI pairing (always xbox layout): `a→confirm`, `b→cancel`, `start→escape`, `back→info`,
`leftshoulder→prevTab`, `rightshoulder→nextTab`.

## Optional utilities

These live in `useful/` and are **optional add-ons, not controlwrap core**. Two are ready for
use; two are experimental.

### `ProfileMapping` — named mapping profiles (localStorage)

CRUD for named controller mappings plus device-aware selection rules:

- a **non-xinput** controller may only pick **same-device** profiles;
- an **xinput** controller may pick **any xinput** profile, same-device sorted first.

```ts
const store = new ProfileMapping();
store.captureFrom(cw, controllerId, "my layout"); // snapshot current mapping
store.availableFor(device, xinput); // selectable profiles, sorted
store.applyTo(cw, controllerId, "my layout"); // false if rules don't allow it

// The layouts your game ships. Call at boot with the same list every time: each is rewritten
// from the definition (so a corrected default reaches players who already have the old copy),
// while profiles the player saved are left alone.
store.registerDefaults([{ name: "Keyboard 1", device: "keyboard", xinput: false, mapping }]);
store.isBuiltin("Keyboard 1"); // true
store.remove("Keyboard 1"); // false — a builtin is the way back, so it cannot be deleted
```

Device identity comes from `cw.getDeviceInfo(id)` → `{ device: 'vendor:product' | 'keyboard' |
'virtual', xinput }`.

### `PlayerIndexMapper` — Smash-style lobby seats

N seats claimed by up to M sources. Owns seat assignment + ready state only; the countdown /
start is the game's job, driven by the `readyToStart` event.

```ts
const lobby = new PlayerIndexMapper(4, 2); // max 4, min 2
lobby.join(controllerId); // → slot id, or -1 when full
lobby.setReady(controllerId); // ready / setReady(id, false) to revoke
lobby.on("readyToStart", (ok) => {
	/* start or cancel countdown */
});
lobby.leave(controllerId); // free the seat
```

### `fighterHelper` / `pressHistory`

Experimental fighting-game helpers — unchanged, not covered by tests. Use at your own risk.

## API

Everything is exported from the package root: `ControlWrap`, `GamepadMaster`, `KeyboardMaster`,
`VirtualGamepadMaster`, `MouseMaster`, `PlayerIndexMapper`, `ProfileMapping`, `ControllerId`,
`GAMEPAD_INDEX_OFFSET` (+ deprecated `GAMPEPAD_INDEX_OFFSET`), `setDebug`, `isWindowActive`, and
the input types.

# License

MIT License.
