import {EventEmitter} from 'eventemitter3';
import  {AllUIButton ,ControlType,Input,mappingGroup,mappingRequirement} from '../types';
import { dpad } from 'gamepad_standardizer';

import {IControllerMaster} from './IControllerMaster';
import GamepadMaster from './GamepadMaster';
import KeyboardMaster from './KeyboardMaster';
import GamePadExtra from './GamePadExtra';
import { GAMPEPAD_INDEX_OFFSET,SYSTEM_INDEX_OFFSET,UI_INDEX_OFFSET,KEYBOARD_HARDCODE_UI_BUTTON,buttonLayout } from '../config';


export function checkAnyKeypress(input:Input,ui_only:boolean=false):boolean{
    if(input.ui_tap.length>0){
        return true;
    }
    if(ui_only){
        return false;
    }
    for(let key in input.button){
        if(input.button[key].just){
            return true;
        }
    }
    for(let key in input.directionButton){
        if(input.directionButton[key as dpad].just){
            return true;
        }
    }
    return false;
}