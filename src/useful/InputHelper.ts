
import {Input,UIButton,UIButtonOptional,InputSource,InputGroup} from '../types'
import {xy } from "gamepad_standardizer";

export function tapOrRepeat(ip:Input,key:string,only:boolean=true):boolean{
    if(only){
        return (ip.ui_tap.length===1 && ip.ui_tap[0]===key) || (ip.ui_repeat.length===1 && ip.ui_repeat[0]===key);
    }
    return ip.ui_tap.includes(key) || ip.ui_repeat.includes(key);
}

export function tap(ip:Input,key:string,only:boolean=true):boolean{
    if(only){
        return (ip.ui_tap.length===1 && ip.ui_tap[0]===key);
    }
    return ip.ui_tap.includes(key);
}

export function pressing(ip:Input,key:string):boolean{
    return ip.ui_pressing.includes(key);
}



export function YES(ip:Input):boolean{
    return tap(ip,UIButton.confirm,false);
}

export function NO(ip:Input):boolean{
    return tap(ip,UIButtonOptional.cancel,false) || tap(ip,UIButton.escape,false);
}

export function PAUSE(ip:Input):boolean{
    return tap(ip,UIButton.escape,false);
}


export function UD(ip:Input):number{
    return tapOrRepeat(ip,UIButton.up)?-1:(tapOrRepeat(ip,UIButton.down)?1:0);
}

export function LR(ip:Input):number{
    return tapOrRepeat(ip,UIButton.left)?-1:(tapOrRepeat(ip,UIButton.right)?1:0);
}

export function L1R1(ip:Input):number{
    return tapOrRepeat(ip,UIButtonOptional.prevTab)?-1:(tapOrRepeat(ip,UIButtonOptional.nextTab)?1:0);
}


export function UDLRpressing(ip:Input):xy{
    return {
        x:pressing(ip,UIButton.up)?-1:(pressing(ip,UIButton.down)?1:0),
        y:pressing(ip,UIButton.left)?-1:(pressing(ip,UIButton.right)?1:0),
    }       
}

export function UDLR(ip:Input):xy{
    return {
        x:tapOrRepeat(ip,UIButton.up)?-1:(tapOrRepeat(ip,UIButton.down)?1:0),
        y:tapOrRepeat(ip,UIButton.left)?-1:(tapOrRepeat(ip,UIButton.right)?1:0),
    }       
}



export function mouseTap(ips:InputGroup,keyName:string):boolean{
    if(!ips[InputSource.mouse] || !ips[InputSource.mouse].buttons[keyName]){
        return false;
    }
    return ips[InputSource.mouse].buttons[keyName].just && ips[InputSource.mouse].buttons[keyName].press;
}
export function click(ips:InputGroup):boolean{
    return mouseTap(ips,'left');
}