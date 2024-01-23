import {EventEmitter} from 'eventemitter3';

//import * as gamepad_standardizer from "gamepad_standardizer"
import { dpad,DP_BUTTON_NAME, getDpadDirection,xy } from "gamepad_standardizer";
import  {ButtonState ,mappingGroup,Input,AllUIButton,mappingRequirement,ControlType,latestLayoutGroup} from '../types';
import  {clone,findKeyByValue, inEnum} from '../utils/utils';
import { Button,isRepeat,getUITap, joinState } from './Button';
import InputDeviceMaster,{ listenStatus } from './InputDeviceMaster';
import {IControllerMaster} from './IControllerMaster';
import GamePadExtra,{InputPreprocess} from "./GamePadExtra";
import KeyboardMaster from './KeyboardMaster';
import { buttonLayout } from '../config';

const unchangeable=['start',...DP_BUTTON_NAME];

enum Operation {
    Plus = '+',
    Minus = '-'
}

type RawEvent =
    {
        index: number;
        type: 'axes';
        axes_index: number;
        Operation: Operation;
    } | {
        index: number;
        type: 'hat';
        axes_index: number;
        HNum:number,
    } | {
        index: number;
        type: 'button';
        button_index: number;
    };


export default class GamepadMaster extends InputDeviceMaster implements IControllerMaster{

    //static================================================================

    protected static instance: GamepadMaster;

    static getInstance(): GamepadMaster {
        if (!GamepadMaster.instance) {
            GamepadMaster.instance = new GamepadMaster();
        }
        return GamepadMaster.instance;
    }

    static isSupported(): boolean {
        if ('getGamepads' in navigator) return true;
        if ('onconnectedgamepad' in window) return true;
        return false;
    }
 
    //================================================================

    private inited:boolean=false;
    private gamePads:(GamePadExtra | undefined)[]=[];

    public count():number{
        let counter=0
        const gps=navigator.getGamepads();
        for(let i=0,t=gps.length;i<t;i++){
            if(gps[i] && gps[i]?.connected){
                counter++;
            }
        }
        return counter;
    }

    public getIndexs():number[]{
        let result:number[]=[];
        const gps=navigator.getGamepads();
        for(let i=0,t=gps.length;i<t;i++){
            if(gps[i] && gps[i]?.connected){
                result.push(i);
            }
        }
        return result;
    }

    public init(){
        if(this.inited){
            return;
        }
        this.inited=true;
        window.addEventListener("gamepadconnected", this.addGP.bind(this));
        window.addEventListener("gamepaddisconnected", this.removeGP.bind(this));
        window.addEventListener("gamepadconnected", this.addGP.bind(this));

        KeyboardMaster.getInstance().addListener("escape", this.systemEscape.bind(this));
    }

    public getGamepadExtra(index:number):GamePadExtra|undefined{
        if(this.gamePads[index]){
            return this.gamePads[index];
        }
    }

    public getName(index: number):string{
        if(this.gamePads[index]){
            const basename=this.gamePads[index]!.getName()
            for(let i=0;i<this.gamePads.length;i++){
                if(i===index)continue;
                if(this.gamePads[i] && this.gamePads[i]!.getName()===basename){
                    return basename+' '+(index+1)
                }
            }
            return basename
        }
        return '';
    }

    private addGP(event:GamepadEvent) {
        this.gamePads[event.gamepad.index]=new GamePadExtra(event.gamepad);
        this.resetDefault(event.gamepad.index);
        if(performance.now()>5000){
            this.gamePads[event.gamepad.index]!.vibration(100,1,1);
        }
        //*profile?
        this.emit('add');
    }

    private removeGP(event:GamepadEvent) {
        this.gamePads[event.gamepad.index]=undefined;
        
        if(this.listenMode!=listenStatus.none && this.listeningIndex==event.gamepad.index){
            this.cancelListen('unplug');
        }
        this.emit('remove');
    }

    public flushAll():Record<number,Input>{
        const result:Record<number,Input>={};
        const gps=navigator.getGamepads();
        for(let i=0,t=gps.length;i<t;i++){
            if(this.gamePads[i]===undefined){
                continue;
            }
            const inputResult=this.gamePads[i]!.flush(gps[i]!);//*
            if(this.listenMode===listenStatus.raw && this.listeningIndex===i){
                this.processRaw(gps[i]!)
            }else if(this.listenMode!==listenStatus.none){
                this.listenDown(i,inputResult)
            }
            result[i]=this.processInput(i,inputResult);
        }
        return result;
    }

    private getPairFromBtnName(btnName:string,swapAB:boolean=false):string{
        if(btnName=='a'){
            return !swapAB?'confirm':'cancel';
        }else if(btnName=='b'){
            return !swapAB?'cancel':'confirm';
        }else if(btnName=='start'){
            return ('escape');
        }else if(btnName=='back'){
            return ('info');
        }else if(btnName=='leftshoulder'){
            return ('prevTab');
        }else if(btnName=='rightshoulder'){
            return ('nextTab');
        }
        return '';
    }

    private getPairFromUiBtnName(UiBtnName:string,swapAB:boolean=false):string{
        if(UiBtnName=='confirm'){
            return !swapAB?'a':'b';
        }else if(UiBtnName=='cancel'){
            return swapAB?'a':'b';
        }else if(UiBtnName=='escape'){
            return ('start');
        }else if(UiBtnName=='info'){
            return ('back');
        }else if(UiBtnName=='prevTab'){
            return ('leftshoulder');
        }else if(UiBtnName=='nextTab'){
            return ('rightshoulder');
        }
        return '';
    }

    public renewSystemButtonLayout(index:number):latestLayoutGroup{
        const mapping:mappingGroup={...this.currentMapping[index]}

        for(let uikeyName in AllUIButton){
            if(inEnum(uikeyName,dpad))continue;
            mapping[uikeyName]=this.getPairFromUiBtnName(uikeyName,this.gamePads[index]!.swapAB)
        }

        return {
            name: this.gamePads[index]!.getName(),
            layout:this.gamePads[index]!.layout,
            mapping
        }
    }

    private processInput(index:number,inputResult:InputPreprocess):Input{
        let doublePressDirection=false;
        let justDouble=false;
        const button:Record<string,ButtonState>={};
        const ui_tap:string[]=[];
        const ui_pressing:string[]=[];
        const ui_repeat:string[]=[];

        //ui button
        for(let btnName in inputResult.button){
            //button[btnName]=inputResult.button[btnName];
            const uiBtnName=this.getPairFromBtnName(btnName,this.gamePads[index]!.swapAB)
            
            if(uiBtnName!=''){    
                if(getUITap(inputResult.button[btnName])){
                    ui_tap.push(uiBtnName);
                }
                if(inputResult.button[btnName].press){
                    ui_pressing.push(uiBtnName);
                }
                if(isRepeat(inputResult.button[btnName])){
                    ui_repeat.push(uiBtnName);
                }
            }
        }

        //ui button direction
        for(let btnName in inputResult.directionButton){
            if(getUITap(inputResult.directionButton[btnName])){
                ui_tap.push(btnName);
            }
            if(inputResult.directionButton[btnName].press){
                ui_pressing.push(btnName);
            }
            if(isRepeat(inputResult.directionButton[btnName])){
                ui_repeat.push(btnName);
            }
            doublePressDirection=doublePressDirection || inputResult.directionButton[btnName].double;
        }

        const mixedDpad:any=getDpadDirection({
            up:     inputResult.directionButton.up.press,
            down:   inputResult.directionButton.down.press,
            left:   inputResult.directionButton.left.press,
            right:  inputResult.directionButton.right.press
        })
        delete mixedDpad['type']
        delete mixedDpad['radian']
        delete mixedDpad['degree']
        delete mixedDpad['distance']

        //button
        for(let keyName in this.currentMapping[index]){
            const btnNames:string[]=typeof this.currentMapping[index][keyName]==='string'?[this.currentMapping[index][keyName] as string]:this.currentMapping[index][keyName] as string[];

            for(let btnName of btnNames){
                if(!inputResult.button[btnName])continue;
                if(keyName==='double'){
                    if(inputResult.button[btnName].press && mixedDpad.numpad!=5){//mixedDpad.numpad%2==0
                        doublePressDirection=true;
                        justDouble=inputResult.button[btnName].just
                    }
                    continue;
                }
                if(!button[keyName]){
                    button[keyName]=inputResult.button[btnName]
                }else{
                    button[keyName]=joinState(button[keyName],inputResult.button[btnName]) 
                }
            }
        }

        if(doublePressDirection){
            for(let btnName in inputResult.directionButton){
                if(inputResult.directionButton[btnName].just && inputResult.directionButton[btnName].press){
                    inputResult.directionButton[btnName].double=true;
                }else if(justDouble && inputResult.directionButton[btnName].press){
                    inputResult.directionButton[btnName].double=true;
                }
            }
        }

        const result:Input={
            source:ControlType.GAMEPAD,
            sourceIndex:index,

            ui_tap,
            ui_pressing,
            ui_repeat,

            mixedDpad,
            doublePressDirection,
            directionButton:inputResult.directionButton,
            
            button,
            //mapping:this.currentMapping[index]

        };
        if(this.requirement!.direction.dpad){
            result.dpad=inputResult.direction!.dpad!
        }
        if(this.requirement!.direction.analog>=1){
            result.analog=inputResult.direction!.leftAnalog!
        }
        if(this.requirement!.direction.analog>=2){
            result.dpad=inputResult.direction!.rightAnalog!
        }
        
        return result
    }

    //raw================================================================

 
    private listenRawGamepad:{axes:number[],buttons:GamepadButton[]}|undefined;
    private listenRawType:{axes:boolean,button:boolean}={axes:false,button:false}

    
    public saveAllRelaseGPState(index:number):void{
        this.listenRawGamepad={
            axes:[...this.gamePads[index]!.lastGamepad.axes],
            buttons:[...this.gamePads[index]!.lastGamepad.buttons]
        }
    }
    
    //* BUG: long press esc,then skip all?? should be only active on just down
    public listenRaw(index:number=0,button:boolean=true,axes:boolean=false):Promise<RawEvent>{
        if(!this.gamePads[index] || !this.gamePads[index]!.lastGamepad.connected){
            return Promise.reject(`no gamepad at ${index}`);
        }
        if(!button && !axes){
            return Promise.reject(`all false`);
        }
        if(!button && axes && this.gamePads[index]!.lastGamepad.axes.length===0){
            return Promise.reject(`not axes`);
        }
        if(button && this.gamePads[index]!.lastGamepad.buttons.length<2){
            return Promise.reject(`at least 2 buttons`);
        }
        //* BUG: on firefox, long press start then trigger cancelListen
        /*
        for(let i=0;i<this.gamePads[index]!.lastGamepad.buttons.length;i++){
            if(this.gamePads[index]!.lastGamepad.buttons[i].pressed){
                return Promise.reject(`no button should be pressing : button ${i} is pressed`);
            }
        }
        */
        this.listenRawType={axes,button};

        this.listenMode=listenStatus.raw;
        this.listeningIndex=index;
        //save old?
        this.removeAllListeners('cancelListen');
        this.removeAllListeners('listenRaw');

        return new Promise((resolve,reject)=>{
            this.addListener('cancelListen',(reason:string|undefined)=>{
                this.listenMode=listenStatus.none;
                this.removeAllListeners('cancelListen');
                this.removeAllListeners('listenRaw');
                reject(reason);
            });
            this.addListener('listenRaw',(obj:RawEvent)=>{
                this.listenMode=listenStatus.none;
                this.removeAllListeners('cancelListen');
                this.removeAllListeners('listenRaw');
                resolve(obj);
            });
        });
    }

    private processRaw(rawGamepad:Gamepad){
        if(this.listenRawType.axes){
            rawGamepad.axes.forEach((axes_value,axes_index)=>{
                const old_value=this.listenRawGamepad!.axes[axes_index];

                const HNum=Math.round(axes_value*7);
                const OHNum=Math.round(old_value*7);
                if( (OHNum==9 || (OHNum==0 && HNum!=0)) && 
                    // (!(axes_value==0 || axes_value==1 || axes_value==-1) || !(old_value==0 || old_value==1 || old_value==-1)) &&
                    (Math.abs(axes_value*7-HNum)<0.000001) && (Math.abs(old_value*7-OHNum)<0.000001)
                ){
                    if(HNum!=9 && HNum!=OHNum){
                        this.emit('listenRaw',{
                            index:this.listeningIndex,
                            type:'hat',
                            axes_index,
                            HNum
                        } as RawEvent);
                        return;
                    }
                    return;
                }

                if(
                    Math.abs((Math.abs(old_value)-Math.abs(axes_value)))>0.75
                ){
                    const Operation=axes_value>old_value?'+':'-'
                    this.emit('listenRaw',{
                        index:this.listeningIndex,
                        type:'axes',axes_index,Operation} as RawEvent);
                    return;
                }
            });
        }

        if(this.listenRawType.button){
            rawGamepad.buttons.forEach((gpBtn,button_index)=>{
                if(gpBtn.pressed){
                    this.emit('listenRaw',{
                        index:this.listeningIndex,
                        type:'button',button_index} as RawEvent);
                    return;
                }
            });
        }
    }

    //================================================================

    private listenDown(index:number,inputResult:InputPreprocess){
        if(this.listenMode===listenStatus.anyKey && index===this.listeningIndex){
            
            if(getUITap(inputResult.button['start'])){
                this.cancelListen('start');
                return;
            }

            if(this.listenMode===listenStatus.anyKey){
                for(let btnName in inputResult.button){
                    if(unchangeable.indexOf(btnName)>=0){
                        continue;
                    }
                    if(getUITap(inputResult.button[btnName])){
                        this.listenMode=listenStatus.none;
                        this.emit('listenKeyFromControllerIndex',btnName);
                        return;
                    }
                }
            }
            return;
        }else if(this.listenMode===listenStatus.ControllerIndexFromKeys){
            for(let btnName in inputResult.button){

                if(this.listenKeys.length===0){
                    this.listenMode=listenStatus.none;
                    this.emit('listenControllerIndexFromKeys',index);
                    return;
                }

                //key name (attack,jump)
                for(let keyName in this.currentMapping[index]){
                    if(
                        (this.listenKeys.indexOf(keyName)>=0) && 
                        this.currentMapping[index][keyName]===btnName && 
                        getUITap(inputResult.button[btnName])
                    ){
                        this.listenMode=listenStatus.none;
                        this.emit('listenControllerIndexFromKeys',index);
                        return;
                    }
                }

                //ui button name (confirm,escape)
                for(let uikeyName in AllUIButton){
                    const btnName=this.getPairFromUiBtnName(uikeyName,this.gamePads[index]!.swapAB)
                    if(this.listenKeys.indexOf(uikeyName)>=0 && (getUITap(inputResult.button[btnName]) || getUITap(inputResult.directionButton[uikeyName])) ){
                        this.listenMode=listenStatus.none;
                        this.emit('listenControllerIndexFromKeys',index);
                        return;
                    }
                }

                //button name (a,start)
                for(let btnName in inputResult.button){
                    if(this.listenKeys.indexOf(btnName)>=0 && getUITap(inputResult.button[btnName])){
                        this.listenMode=listenStatus.none;
                        this.emit('listenControllerIndexFromKeys',index);
                        return;
                    }
                }

            }
            return;
        }
    }

    private listeningIndex:number=0;
 
    public listenKeyFromControllerIndex(index:number):Promise<number>{
        this.listenMode=listenStatus.anyKey;
        this.listeningIndex=index;

        this.removeAllListeners('cancelListen');
        this.removeAllListeners('listenKeyFromControllerIndex');

        return new Promise((resolve,reject)=>{
            this.addListener('cancelListen',(reason?:string)=>{
                this.listenMode=listenStatus.none;
                this.removeAllListeners('cancelListen');
                this.removeAllListeners('listenKeyFromControllerIndex');
                reject(reason);
            });
            this.addListener('listenKeyFromControllerIndex',(i)=>{
                this.listenMode=listenStatus.none;
                this.removeAllListeners('cancelListen');
                this.removeAllListeners('listenKeyFromControllerIndex');
                resolve(i);
            });
        });
    }

    private systemEscape(){
        if(this.listenMode!==listenStatus.none){
            this.cancelListen('escape');
        }
    }

    //mapping================================================================

    
	public importRequirement(requirement:mappingRequirement):void{
        /*
        if(requirement.type!==ControlType.GAMEPAD){
            throw new Error('mapping type must be GAMEPAD');
        }
        */
        this.requirement=clone(requirement) as mappingRequirement;
        if(this.requirement.ui_button){
            for(const i in this.requirement.ui_button){
                const btnName=this.requirement.ui_button[i];
                if(btnName in AllUIButton){
                    delete this.requirement.ui_button[i]
                    //console.log(`ui_tap ${btnName} is reserved`);
                }
            }
        }
        if(this.requirement.ui_optional){
            for(const i in this.requirement.ui_optional){
                const btnName=this.requirement.ui_optional[i];
                if(btnName in AllUIButton){
                    delete this.requirement.ui_optional[i]
                    //console.log(`ui_optional ${btnName} is reserved`);
                }
            }
        }
        if(this.requirement.ui_pair){
            this.requirement.ui_pair={};
            /*
            for(const btnName in this.requirement.ui_pair){
                if(btnName in AllUIButton){
                    delete this.requirement.ui_pair[btnName]
                    //console.log(`ui_pair ${btnName} is reserved`);
                }
            }
            */
        }
        //this.requirement=requirement;
    }
    
    protected defaultStandardMapping:mappingGroup={};

    
	public resetDefault(index:number):mappingGroup|undefined{
        if(this.defaultStandardMapping){
            this.currentMapping[index]=clone(this.defaultStandardMapping);
        }
        //*
        return this.defaultStandardMapping;
    }

    public setDefaultMapping(mapping:mappingGroup):void{
        this.defaultStandardMapping=mapping;                  
    }

	public checkMapping(index:number,buttonName:string,keyCode:string):boolean{
        if(unchangeable.indexOf(buttonName)>=0)return false;
        return true;
    }

	public checkNotRepeat(index:number,buttonName:string,keyCode:string):boolean{
        for(let key in this.currentMapping[index]){
            if(this.currentMapping[index][key]===keyCode && !(buttonName==key)){
                return false
            }
        }
        return true;
    }

    

    public override vibration(index: number,duration:number=300,strongMagnitude:number=1,weakMagnitude:number=1):void{//Promise<GamepadHapticsResult>{
        if(this.gamePads[index]){
            this.gamePads[index]!.vibration(duration,strongMagnitude,weakMagnitude);
        }
        //return Promise.reject('no vibration');
    }
}

