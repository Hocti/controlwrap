import { getGamepadInfo, getDirection,getDirectionAvailable,directSource, getButtonPress, getButtonName, DP_BUTTON_NAME,type gamepadInfo,dpad,dpadPress,directionWrap,xy } from "gamepad_standardizer";
import  {ButtonState } from '../types';
import { Button } from './Button';
import { buttonLayout } from '../config';


export type InputPreprocess = {
	direction?:Record<directSource, directionWrap | null>;
	button:Record<string,ButtonState>,
	directionButton:Record<string,ButtonState>
}


/**
 * get:
 * info (name,defaultSwapAB,standard)
 * btn_names 
 * btn_display_names
 * directionAvailable
 * 
 * method:
 * flush: btn_standard_name : ButtonState , directionButton(mixed analog+dpad)
 * vibration
 */
export default class GamePadExtra{


    //last
    public lastGamepad:Gamepad;

    //info
    private info:gamepadInfo|undefined;
    private btn_names:(string|null)[]=[];
    private directionAvailable:Record<directSource, boolean>|undefined;
    
    private buttons:Record<string,Button>={}
    
    private directionButton:Record<dpad,Button>={
        up:new Button(),
        down:new Button(),
        left:new Button(),
        right:new Button(),
    }

    public analogThreshold:number=0.15;
    public swapAB:boolean=false;
    //public btn_display_names:(string|null)[]=[];
    public layout:buttonLayout=buttonLayout.xbox;

    public getName():string{
        return this.info?.name??'';
    }
    public getButtonNames():(string|null)[]{
        return this.btn_names;
    }
    public getDirectionAvailable():Record<directSource, boolean>{
        if(!this.directionAvailable){
            return {
                dpad:false,
                leftAnalog:false,
                rightAnalog:false,
            }
        }
        return this.directionAvailable;
    }

    constructor(gamepad:Gamepad) {
        this.lastGamepad=gamepad;

        getGamepadInfo(gamepad).then((info)=>{
            this.info=info;
            this.btn_names=getButtonName(this.info!)
            //this.btn_display_names=getButtonName(this.info!,true)
            this.directionAvailable=getDirectionAvailable(this.info!)
            this.swapAB=this.info!.defaultSwapAB??false;

            for(let k in this.btn_names){
                if(this.btn_names[k] && DP_BUTTON_NAME.indexOf(this.btn_names[k]!)<0){
                    this.buttons[this.btn_names[k]!]=new Button();
                }
            }

            if(info.standard){
                this.layout=buttonLayout.xbox;
            }else{
                this.layout=buttonLayout.unknown;
            }
            if(info.vendor){
                if(info.vendor=="054c"){
                    this.layout=buttonLayout.sony;
                }else if(info.vendor=="057e"){
                    this.layout=buttonLayout.nintendo;
                }
            }
            //console.log(gamepad,info,this.btn_names,this.directionAvailable);
            //this.flush(gamepad);
        });

    }

    private unchangeCache:Record<string, number>={}

    public flush(gamepad:Gamepad,unchange:boolean=false):InputPreprocess{
        if(!this.info){
            return {button:{},
            directionButton:{
                up:{press:false,just:false,double:false,tap:false,pressFrame:0},
                down:{press:false,just:false,double:false,tap:false,pressFrame:0},
                left:{press:false,just:false,double:false,tap:false,pressFrame:0},
                right:{press:false,just:false,double:false,tap:false,pressFrame:0},
            },
            direction:{
                dpad:null,
                leftAnalog:null,
                rightAnalog:null,
            }};
        }
        
        /*
        if(this.lastTime==gamepad.timestamp){
            return this.lastInput!;
        }
        const thisSum=this.inputSum(gamepad);
        if(thisSum===this.lastSum){
            return this.lastInput!;
        }
        */

        let thisInput:InputPreprocess={
            direction:getDirection(gamepad,this.info!,this.analogThreshold),
            button:{},
            directionButton:{},
        };
            
        const bs=getButtonPress(gamepad,this.info!,true);
        for(let k in this.btn_names){
            if(this.btn_names[k] && this.buttons[this.btn_names[k]!]){
                const press=bs[k]===true;
                const lastPress=this.unchangeCache[k]??0;
                this.unchangeCache[k]=press?(this.unchangeCache[k]?this.unchangeCache[k]+1:1):0;
                if(unchange){//*
                    thisInput.button[this.btn_names[k]!]={
                        press:press,
                        just:press&&lastPress==0,double:false,tap:false, pressFrame:this.unchangeCache[k]
                    };
                    continue;
                }
                if(bs[k]){
                    this.buttons[this.btn_names[k]!].press()
                }else{
                    this.buttons[this.btn_names[k]!].release()
                }
                thisInput.button[this.btn_names[k]!]=this.buttons[this.btn_names[k]!].flush()
            }
        }

        for(let k in this.directionButton){
            let kk:dpad=k as dpad;
            let press:boolean=false;
            if(thisInput.direction!.dpad && thisInput.direction!.dpad![kk]){
                press=true;
            }else if(thisInput.direction!.leftAnalog && thisInput.direction!.leftAnalog![kk]){
                press=true;
            } 
            //|| (thisInput.direction!.leftAnalog?[kk]??false);
            const lastPress=this.unchangeCache[kk]??0;
            this.unchangeCache[kk]=press?(this.unchangeCache[kk]?this.unchangeCache[kk]+1:1):0;
            if(unchange){//*
                thisInput.directionButton[kk]={
                    press:press,
                    just:press&&lastPress==0,double:false,tap:false, pressFrame:this.unchangeCache[kk]
                };
                continue;
            }
            if(press){
                this.directionButton[kk].press();
            }else{
                this.directionButton[kk].release();
            }
            thisInput.directionButton[kk]=this.directionButton[kk].flush();
        }

        //this.lastGamepad=gamepad;
        //this.lastInput=thisInput;
        //this.lastSum=thisSum;
        //this.lastTime=gamepad.timestamp
        return thisInput;
    }
    
    public vibration(duration:number=500,strongMagnitude:number=1,weakMagnitude:number=0):Promise<GamepadHapticsResult>|undefined{
        if(this.lastGamepad.vibrationActuator?.type){
            return this.lastGamepad.vibrationActuator!.playEffect("dual-rumble", {
                //startDelay,
                duration,
                // A low-frequency vibration
                weakMagnitude,
                // A high-frequency vibration
                strongMagnitude
            });
        }else if(this.lastGamepad.hapticActuators){
            let re:Promise<GamepadHapticsResult> | undefined;
            console.log(this.lastGamepad,this.lastGamepad.hapticActuators)
            for(const h of this.lastGamepad.hapticActuators){
                //h.pulse(duration, strongMagnitude);
                re=h.playEffect("dual-rumble", {
                    //startDelay,
                    duration,
                    weakMagnitude,
                    strongMagnitude
                });
            }
            if(!re){
                return undefined;//Promise.reject('no vibration');
            }
            return re;
        }
        return undefined;//
        //return Promise.reject('no vibration');
    }
}

/*

navigator.getGamepads()[3].axes[0]
-0.003921568393707275
~1/255
navigator.getGamepads()[3].axes[9]
3.2857141494750977
*/