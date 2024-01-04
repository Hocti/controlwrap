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

    type ControllerInfo,
    type ControllerProfile,
} from "./types";

export {
    buttonLayout
} from "./config";

export {getUITap,getUIsTap,joinState,setMinDoubleFrame} from "./inputs/Button";

export * as gamepad_standardizer from "gamepad_standardizer"