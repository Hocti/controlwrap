# ControlWrap

wrap all gamepad,keyboard,mouse input in one place, output as your custumized standard's input format

## Rules

- for local-multi-play game made in HTML
- you don't need to know what's the raw input on keyboard or gamepad, the UI input `up` is from dpad or analog, all input are wrapped to you
- by using [gamepad standardizer](https://github.com/Hocti/gamepad_standardizer), all controller even not a XInput standard, still wrapped as a standard controller
- allow setting 1~4 players on keyboard, also each gamepad count as on player(max 4), total max 8 players. all keyboard players share "ESC" key as pause key
- Player's input grouped into ui/other, if your game key `attack` is `confirm` in UI, press it would appear in both side
- all UI input with justPress,Pressing,Repeat(for UI) 3 category
- UI button with`up down left right confirm escape`, and `cancel info prevTab nextTab` as optional. gamepad's UI key are fixed, so you need to mapping the game key (`attack`,`jump` etc) only. 
- when press a optional special key `double`, all direction key will count as double press 
- you can select one player as main player (with a async listen method to select the first player press start/A)
- Keyboard's Arrow, Enter, Esc always map as system input
- categorized input with players,system,ui(mixed system and the main player)

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
import {ControlWrap} from "../dist/controlwrap.esm.js";

const cwi=ControlWrap.getInstance();

cwi.wrappedInit({
    direction:{dpad:false,analog:0},    //using dpad(up/down/left/right),and how many analog is needed(0~2)
    button:['attack','jump'],           //keys
    optional:['double'],                //optional keys
    ui_pair:{                           //pair system key to key for keyboard,optional
        'confirm':'attack',
        'cancel':'jump'
    }
    //skipped some config...
},
{   //default gamepad pair
    'attack':'x',
    'jump':'a',
},[ 
    {   //default keyboard pair
        'up':'KeyW',
        'down':'KeyS',
        'left':'KeyA',
        'right':'KeyD',
        'attack':'KeyF',
        'jump':'KeyG',
    },
    {   //default keyboard2 pair
        'up':'KeyI',
        'down':'KeyK',
        'left':'KeyJ',
        'right':'KeyL',
        'attack':'KeyP',
        'jump':'BracketLeft',
    }
],
2   //number of players from keyboard,max 4
);

//under game loop
const etf=()=>{
    const allInputs=cwi.update();
    //all input from gamepad,keyboard,mouse are wrapped here
    // watch the demo site to see what result would got
}
setInterval(etf,1000/60);

```

## API

TBC

# License

MIT License.