# Changelog

## Unreleased

### Added

- **`cw.ignoreGamepadWhenWindowInactive`** (default **true**, also a `wrappedInit` option) — a
  gamepad is polled rather than delivered, so unlike the keyboard it kept driving a window that
  had lost focus: a pad resting on a button walked the menus of a game nobody was looking at, and
  a background rebind screen answered a press meant for another window. While the window is
  inactive every pad now reads as "nothing pressed"; a button held across the blur is released
  instead of sticking, and anything still held on return is ignored until let go (what the
  keyboard does for free). `isWindowActive()` is exported for callers who want the same answer.
- **`UIInputMode`** (`cw.uiInputMode`) — who drives the shared UI channel. `single` (the new
  default) lets **every** connected device drive menus and keeps the keyboard's fixed menu keys
  live; `multi` restricts the shared channel to the main controller, for a lobby or a match where
  each seat reads its own `InputGroup.player` entry. `allowMainPlayerUseAllController` still
  works, and is now just a way of forcing the `single` behaviour on inside `multi`.
- The fixed keyboard menu keys gained **Backspace → `cancel`** and **Tab → `nextTab`**, joining
  the arrows, Enter and Escape.

### Fixed

- A keyboard press taken by a listen is now **consumed** — it no longer also reaches the game on
  the next flush. Keyboard listening is answered on the DOM event, a frame or more before
  anything reads the input, so one press used to do both jobs: the Escape that cancelled a
  rebind went on to close the panel the rebind was in, and the key you assigned to an action
  also fired whatever that key was bound to a moment earlier. Escape with nothing listening is
  untouched.
- `preserveNavKeys: false` used to cost a game its keyboard menu keys entirely: it answers "may a
  player bind the arrows and Enter?", but it was also the only thing deciding "do the arrows and
  Enter drive a menu?". Freeing the arrows for a keyboard-3 player therefore left every menu with
  no keyboard navigation at all. The second question is now `UIInputMode`'s, so a game can have
  both.

- **B5** — `GamepadMaster.init()` added the `gamepadconnected` listener twice; now added once
  (and stored as a bound field so `dispose()` can remove it).
- **B6** — `PlayerIndexMapper` rewritten (the old `setBlock`/`setBlockReady` were unusable: slot
  0 was treated as "no slot" and readiness threw). New Smash-style seat API; old method names
  kept as deprecated aliases.
- **B7** — `ProfileMapping` implemented (was an empty stub): named-profile CRUD in localStorage
  with device/xinput selection rules and ControlWrap capture/apply helpers.
- **B16** — `KeyboardMaster.getInput` had reversed variable names (`keyName`/`buttonName`);
  renamed to `buttonName`/`keyCodes` (behavior unchanged).
- Fixed the declaration build (`bundledPackages`) so a real `.d.ts` is emitted (was empty).

### Added

- **`VirtualGamepadMaster`** — UI-less touch input injection point (`setButton` / `setDirection`
  / `setDpad` / `releaseAll`). Zero DOM/UI code. Virtual index range 200–203.
- **`ControllerId`** constants + `isKeyboard`/`isGamepad`/`isVirtual` helpers (values unchanged).
- `ControlWrap.getDeviceInfo(index)` — `{ device, xinput }` used by ProfileMapping.
- `ControlWrap.dispose()` and per-master `dispose()` — remove all window listeners, reset singleton.
- Same-frame `update()` guard (warns via `debugLog`).
- `setDebug(on)` — gate all internal logging (no stray `console.log` ships).
- `GAMEPAD_INDEX_OFFSET` (correct spelling), `VIRTUAL_INDEX_OFFSET`.
- Unit tests for Button, PlayerIndexMapper, ProfileMapping, ControllerId, VirtualGamepadMaster.

### Deprecated

- `GAMPEPAD_INDEX_OFFSET` (typo) → use `GAMEPAD_INDEX_OFFSET`.
- `PlayerIndexMapper.setBlock` / `removeBlock` / `setBlockReady` / `dispose` → `join` / `leaveSlot`
  / `setReady` / `reset`.
- `SDLDB_setLink` / `SDLDB_fetch` remain available (see gamepad_standardizer) but prefer `configureDB`.

## v1.3.0

- changed
