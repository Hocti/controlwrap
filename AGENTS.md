# AGENTS.md — ControlWrap

This file teaches an AI how to use `controlwrap` without reading the whole source again.

## What this package does

`controlwrap` takes raw input from **keyboard, gamepad, and mouse** and turns it into one clean stream of game actions. The game code does not need to know if the player pressed `KeyF` on keyboard or button `X` on gamepad — both just show up as `attack`. This makes local multiplayer (up to 4 keyboard players + 4 gamepads = 8) simple.

It wraps `gamepad_standardizer`, so even non-XInput pads work as a standard controller.

## The mental model (read this first)

- You list the game buttons you need (`attack`, `jump`, ...) once in a **requirement**.
- You give default mappings for gamepad and for each keyboard player.
- Every frame you call `cwi.update()` and get back an **InputGroup**.
- The InputGroup has three buckets of input:
  - `system` — one global keyboard (arrows, Enter, Esc). Always works.
  - `player` — one Input per player, keyed by controller index.
  - `ui` — a **merged** UI input from the system keyboard + the main player. Use this for menus.
- Inside each player Input you find direction (`dpad`, `analog`, `mixedDpad`) and buttons (`attack`, `jump`, ...), each with `press / just / tap / double / pressFrame`.

A button can be both a game key and a UI key at the same time. Example: `ui_pair: { confirm: "attack" }` means pressing `attack` also counts as `confirm` in menus.

## Controller index numbers

One number identifies every controller in the whole system.

| Range | Meaning |
|---|---|
| `0`–`3` | keyboard players 1–4 |
| `100`–`103` | gamepad slots 1–4 |
| `1000` | system keyboard (arrows / Enter / Esc) |
| `2000` | UI bucket (system + main player mixed) |

Helpers: `cwi.parseIndex(n)` → `[ControlType, localIndex]`, `cwi.makeIndex(type, localIndex)` → number.

## Setup (typical)

```ts
import { ControlWrap } from "controlwrap";

const cwi = ControlWrap.getInstance();

cwi.wrappedInit({
  requirement: {
    direction: { dpad: true, analog: 2 },   // need dpad? how many analog sticks (0..2)?
    button: ["attack", "jump", "defend", "special"], // game buttons
    optional: ["double", "command"],        // optional game buttons
    ui_optional: ["prevTab", "nextTab", "info"], // extra UI buttons
    ui_pair: { confirm: "attack", cancel: "jump" }, // game button → UI role
  },
  defaultGamePadmapping: {
    attack: "x", jump: "a", defend: "b", special: "y",
    double: "leftshoulder", command: "rightshoulder",
  },
  defaultKeyboardmappings: [
    { up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD",
      attack: "KeyF", jump: "KeyG", defend: ["KeyH","KeyB"], special: "KeyR" },
    { up: "KeyI", down: "KeyK", left: "KeyJ", right: "KeyL",
      attack: "KeyP", jump: "BracketLeft", defend: "BracketRight", special: "Semicolon" },
  ], // length of this array = number of keyboard players (max 4)
  mouse: true, // optional
});
```

Note: the number of keyboard players is taken from `defaultKeyboardmappings.length`. No extra `setPlayerCountFromKeyboard` call is needed after `wrappedInit`.

## The game loop

```ts
setInterval(() => {
  const ips = cwi.update();       // full update — game + UI
  // or: cwi.update(true)          // UI-only update (use while the game is paused)

  // system keyboard (arrows/Enter/Esc)
  ips.system.ui_tap;               // e.g. ["escape"]

  // merged UI — read this for menu screens
  ips.ui.ui_tap;                   // tap this frame
  ips.ui.ui_pressing;              // held down now
  ips.ui.ui_repeat;                // auto-repeat for held direction

  // per player — read these for gameplay
  for (const idx in ips.player) {
    const p = ips.player[idx];
    p.mixedDpad?.numpad;           // 1..9 on numpad layout, 5 = neutral
    p.button?.attack.press;        // held?
    p.button?.attack.just;         // state changed this frame (press or release)
    p.button?.attack.tap;          // very short press (for tap detection)
    p.button?.attack.double;       // double tap
    p.directionButton?.up.press;   // direction as a button
    p.doublePressDirection;        // true if any direction was double-tapped
  }

  // mouse (only if you passed mouse:true)
  ips.mouse?.xy; ips.mouse?.delta; ips.mouse?.buttons.left.just;
}, 1000 / 60);
```

### `update(uiOnly: boolean)`

- `update(false)` (default) — flush everything. Use during gameplay.
- `update(true)` — only UI input is updated this frame. Game button state freezes. Use this while the game is paused, so the pause menu still reacts to input but the player cannot "store" attacks during the pause.

## Input shape

Every player's `Input` is `gameInput & systemInput`:

```ts
// gameInput
dpad?:        { up, down, left, right, numpad, x, y }    // gamepad dpad only
analog?:      directionWrap                               // left analog
analog_right?:directionWrap                               // right analog
mixedDpad?:   { up, down, left, right, numpad, x, y }    // dpad + left analog merged
directionButton?: Record<"up"|"down"|"left"|"right", ButtonState>
doublePressDirection?: boolean
button?:      Record<string, ButtonState>                 // game buttons

// systemInput
source?:      "keyboard" | "gamepad" | "system"
sourceIndex?: number
ui_tap:       string[]    // e.g. ["confirm"]
ui_pressing:  string[]
ui_repeat:    string[]    // auto-repeat for menu navigation

// ButtonState
{ press: boolean; just: boolean; tap: boolean; double: boolean; pressFrame: number }
```

`press` = currently held. `just` = state changed this frame (both press and release). `tap` = short press (`false,true,false` pattern). `double` = double tap within a short window. `pressFrame` = how many frames the button has been held.

## UI button names

Always built-in: `up`, `down`, `left`, `right`, `confirm`, `escape`.
Optional (list them in `requirement.ui_optional`): `cancel`, `info`, `prevTab`, `nextTab`.

**Gamepad UI is fixed** — confirm/cancel/escape are mapped to standard buttons automatically. You do NOT map them in `defaultGamePadmapping`.

**Keyboard UI rules** — this is the tricky part:

- Enter → `confirm`, Esc → `escape`, Arrows → `up/down/left/right`. These are **hardcoded on the system keyboard** (`index 1000`) and always work, even with no player mapped.
- All keyboard players **share the same Esc** as escape / pause. You cannot give each keyboard player their own Esc.
- For multi-player on one keyboard, give each player their own `confirm` and `cancel` via `ui_pair` (e.g. `confirm: "attack"`, `cancel: "jump"`). The player's game button then also fires the matching UI role.
- For a single-player "global system UI" (main menu of a single-player game): you do NOT need a `cancel` — Enter is confirm, Esc is cancel. `cancel` in `ui_pair` is only useful for per-player menus in multiplayer.

## Main player

The main player is the one whose input also appears in the merged `ui` bucket. It is optional. Common patterns:

```ts
// Pattern A — pick the first controller that presses start/attack/cancel
cwi.listenControllerIndexFromKeys(["attack", "start", "cancel"])
  .then(i => cwi.mainControllerIndex = i);

// Pattern B — auto-switch main to whichever controller the player uses
// (e.g. single-player with both keyboard and gamepad connected)
cwi.allowMainPlayerUseAllController = true;

// Pattern C — hard-code player 1
cwi.mainControllerIndex = 0;        // keyboard player 1
// or cwi.mainControllerIndex = 100; // gamepad slot 1
```

When main player changes, ControlWrap emits `changeLastInputIndex` with the new index and the new button layout (xbox / sony / nintendo / keyboard) — use this to swap button icons in the UI.

## Mapping at runtime

```ts
cwi.getAllMapping(index)                         // current mapping for a controller
cwi.setAllMapping(index, mappingGroup)           // replace mapping
cwi.setMapping(index, "attack", "KeyF")          // set one button
cwi.checkMapping(index, "attack", "KeyF")        // is this key already used?
cwi.checkNotRepeat(index, "attack", "KeyF")      // is this key free for this button?
cwi.resetDefault(index)                          // back to defaults
cwi.getMappableKeys(index) // → { buttons:[...], optional:[...] }

// listen = wait for the player to press a key
cwi.listenKeyFromControllerIndex(index)          // Promise<keyName>
cwi.listenControllerIndexFromKeys(["attack"])    // Promise<controllerIndex>
cwi.cancelListen("reason")
```

Use `listenKeyFromControllerIndex` in a loop over `getMappableKeys(index).buttons` to build a "press each key in turn" remap screen (see `demo/controlWrap.html` for a full example).

## Helper functions

Import from `controlwrap` directly:

```ts
import { tap, tapOrRepeat, pressing, YES, NO, PAUSE,
         UD, LR, L1R1, UDLR, UDLRpressing, click, mouseTap } from "controlwrap";

YES(ip)            // confirm was tapped
NO(ip)             // cancel OR escape was tapped
PAUSE(ip)          // escape was tapped
UD(ip)             // -1 up, 1 down, 0 none (with auto-repeat)
LR(ip)             // -1 left, 1 right
UDLR(ip)           // {x,y} with auto-repeat — menu navigation
UDLRpressing(ip)   // {x,y} using pressing (for analog-style continuous)
L1R1(ip)           // prevTab / nextTab as -1/1
tap(ip, "attack") / pressing(ip, "attack") / tapOrRepeat(ip, "up")
click(ips) / mouseTap(ips, "right")
```

`tap` and `tapOrRepeat` have an `only` flag (default `true`) — require that the tap is the *only* UI input this frame. Pass `false` to allow it alongside other inputs.

## Fighting-game commands (optional)

For directional commands like `236+attack` (hadouken):

```ts
import { pressHistory, str2Command, fightingInput, fightingInputMulti } from "controlwrap";

const Commands = {
  hadouken: str2Command("236attack"),      // down, down-forward, forward + attack
  shoryuken: str2Command("623attack"),
  super:    str2Command("2426attack+jump"), // + means all buttons needed, / means any
};

// every frame, after cwi.update():
pressHistory.getInstance().addHistory(ips.player);

// check commands against the main player's recent input
const mainHistory = pressHistory.getInstance().getShorten(cwi.mainControllerIndex);
const result = fightingInputMulti(Commands, recentInputs, flip /* mirror for P2 side */);
if (result.hadouken) { /* fire attack */ }

// Simpler checks:
pressHistory.getInstance().doublePressDirection(mainIdx, 20);  // e.g. double-tap forward → dash
pressHistory.getInstance().doublePress(mainIdx, "attack", 20); // double-tap a button
```

Numpad notation: `1=down-back 2=down 3=down-forward 4=back 5=neutral 6=forward 7=up-back 8=up 9=up-forward`.

## Useful extras

- `cwi.getName(index)` — controller name (e.g. `"keyboard"`, gamepad code name).
- `cwi.vibration(gamepadIndex, duration, strong, weak)` — rumble a gamepad.
- `cwi.getGamepadExtra(index)` — raw gamepad info (buttons/axes/hat).
- `buttonLayout` enum — `xbox | sony | nintendo | unknown | keyboard` — used to pick icons.
- Event `cwi.on("changeLastInputIndex", ({ index, buttonLayout }) => ...)` — fires when the active controller changes.

## Common mistakes to avoid

- **Do not map `confirm` / `cancel` / `escape` in `defaultGamePadmapping`.** Gamepad UI is fixed.
- **Do not expect per-keyboard-player `escape`.** All keyboard players share Esc.
- **`ui_pair` is one-way:** `{ confirm: "attack" }` means `attack` triggers `confirm`, not the other way around.
- **Call `update()` once per frame.** It is a flush — calling it twice throws away input between the calls.
- **While the game is paused, call `update(true)`** so held buttons do not keep ticking `pressFrame` and do not fire `just` on resume.
- **Button state is one-frame.** `just` is only true on the frame the state flipped. Read it every frame or it is gone.
- **`mixedDpad.numpad === 5`** means "no direction". Check for this before using the direction.

## File map (for when you need to dig)

```
src/
  index.ts              — public exports
  types.ts              — Input / InputGroup / mappingRequirement / enums
  config.ts             — index offsets + hardcoded keyboard UI keys
  inputs/
    ControlWrap.ts      — main singleton, update(), main-player logic
    IControllerMaster.ts— interface for keyboard/gamepad masters
    InputDeviceMaster.ts— shared base class
    KeyboardMaster.ts   — keyboard handling, multi-player split
    GamepadMaster.ts    — gamepad handling (uses gamepad_standardizer)
    GamePadExtra.ts     — raw gamepad info / remapping
    MouseMaster.ts      — mouse handling
    Button.ts           — ButtonState / tap / double-tap / UI repeat
    common.ts           — checkAnyKeypress
  useful/
    InputHelper.ts      — YES/NO/UD/LR/tap/pressing helpers
    fighterHelper.ts    — fightingInput / str2Command
    pressHistory.ts     — frame history for commands
    PlayerIndexMapper.ts— map controller slots → player slots (ready-up lobbies)
    ProfileMapping.ts   — save/load mapping profiles
demo/
  controlWrap.html      — full demo with remap UI
  fightTest.html        — fighting-command demo
  keyboardMaster.html / gamepadMaster.html — single-device demos
```
