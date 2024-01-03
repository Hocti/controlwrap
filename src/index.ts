//import "keyboard_mouse"
//import "gamepad"

import ControlWrap from "./ControlWrap";

//import {IControllerMaster} from "./inputs/IControllerMaster";

import GamepadMaster from "./inputs/GamepadMaster";
import KeyboardMaster from "./inputs/KeyboardMaster";

import PlayerIndexMapper from "./PlayerIndexMapper";

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



export {getUITap,getUIsTap,joinState} from "./inputs/Button";