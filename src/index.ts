//import "keyboard_mouse"
//import "gamepad"

import ControlWrap from "./inputs/ControlWrap";

//import {IControllerMaster} from "./inputs/IControllerMaster";

import GamepadMaster from "./inputs/GamepadMaster";
import KeyboardMaster from "./inputs/KeyboardMaster";

import PlayerIndexMapper from "./useful/PlayerIndexMapper";

export {
    //IControllerMaster,
    ControlWrap,
    GamepadMaster,
    KeyboardMaster,
    PlayerIndexMapper
};

export {
    UIButton,UIButtonOptional,ControlType,

    type ButtonState,
    type Input,
    type mappingRequirement,
    type InputGroup,
    InputSource,

    type ControllerInfo,
    type ControllerProfile,
} from "./types";

export {
    buttonLayout,
} from "./config";

export * from "./useful/InputHelper";
export * from "./useful/fighterHelper";
import pressHistory from "./useful/pressHistory";
export {pressHistory};

export {getUITap,getUIsTap,joinState,setMinDoubleFrame} from "./inputs/Button";

export * as gamepad_standardizer from "gamepad_standardizer"


import MouseMaster from "./inputs/MouseMaster";
export {MouseMaster};