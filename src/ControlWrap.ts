import {EventEmitter} from 'eventemitter3';
import  {AllUIButton ,ControlType,Input,mappingGroup,mappingRequirement} from './types';

import {IControllerMaster} from './inputs/IControllerMaster';
import GamepadMaster from './inputs/GamepadMaster';
import KeyboardMaster from './inputs/KeyboardMaster';
import GamePadExtra from './inputs/GamePadExtra';
import { dpad } from 'gamepad_standardizer';
import { GAMPEPAD_INDEX_OFFSET,SYSTEM_INDEX_OFFSET,UI_INDEX_OFFSET,KEYBOARD_HARDCODE_UI_BUTTON,buttonLayout } from './config';

export default class ControlWrap extends EventEmitter implements IControllerMaster{

    protected static instance: ControlWrap;

    public static getInstance(): ControlWrap {
        if (!ControlWrap.instance) {
            ControlWrap.instance = new ControlWrap();
        }

        return ControlWrap.instance;
    }

    //static================================================================
    
    static isSupported(): Partial<Record<ControlType,boolean>> {
        return {
            [ControlType.KEYBOARD]:KeyboardMaster.isSupported(),
            [ControlType.GAMEPAD]:GamepadMaster.isSupported(),
            //[ControlType.TOUCH]:'ontouchstart' in window,
            //[ControlType.MOUSE]:'onmousedown' in window,
        };
    }
    
    static masterRecord:Partial<Record<ControlType,IControllerMaster>> = {
        [ControlType.KEYBOARD]: KeyboardMaster.getInstance(),
        [ControlType.GAMEPAD]: GamepadMaster.getInstance(),
        //[ControlType.TOUCH]: KeyboardMaster.getInstance(),
        //[ControlType.MOUSE]: KeyboardMaster.getInstance()
    };
    
    //var================================================================
    
    protected requirement:mappingRequirement | undefined;

    protected listening:Partial<Record<ControlType,boolean>>={
        [ControlType.GAMEPAD]:false,
        [ControlType.KEYBOARD]:false,
        //[ControlType.MOUSE]:false,
        //[ControlType.TOUCH]:false,
    }

    //init================================================================

    public init(listenTo:Partial<Record<ControlType,boolean>>={keyboard:true,gamepad:true}):void{
        const supports=ControlWrap.isSupported();
        for (const controlType of Object.values(ControlType)) {
            if (supports[controlType] && listenTo[controlType] && ControlWrap.masterRecord[controlType]) {
                ControlWrap.masterRecord[controlType]!.init();
                this.listening[controlType]=true;
            }
        }
    }

    public wrappedInit(
            requirement:mappingRequirement,
            defaultGamePadmapping:Record<string,string>,
            defaultKeyboardmappings:Record<string,string>[],

            keyboardCountum:number=1,
            keyboardmappings:Record<number,mappingGroup>={},
            gamepadMappings:Record<string,mappingGroup>={},
        ):void
    {
        this.init({keyboard:true,gamepad:true});
        this.importRequirement(requirement);
        this.setDefaultGamepadMapping(defaultGamePadmapping);
        for(let i=0;i<defaultKeyboardmappings.length;i++){
            this.setDefaultKeyboardMapping(i,defaultKeyboardmappings[i]);
        }
        this.setPlayerCountFromKeyboard(keyboardCountum);
        //*
        for(let keyBoardIndex in keyboardmappings){
            //this.setAllMapping(0,gamepadMappings[gamepadName]);
        }
        for(let gamepadName in gamepadMappings){
            //this.setAllMapping(0,gamepadMappings[gamepadName]);
        }
    }
    
	public importRequirement(requirement:mappingRequirement):void{
        for (const controlType of Object.values(ControlType)) {
            if (ControlWrap.masterRecord[controlType]) {
                ControlWrap.masterRecord[controlType]!.importRequirement(requirement);
            }
        }
        this.requirement=requirement;
    }
    
	public setDefaultGamepadMapping(mapping:Record<string,string>):void{
        (ControlWrap.masterRecord[ControlType.GAMEPAD] as GamepadMaster).setDefaultGamepadMapping(mapping);
    }
    
	public setDefaultKeyboardMapping(index:number=0,mapping:Record<string,string>):void{
        (ControlWrap.masterRecord[ControlType.KEYBOARD] as KeyboardMaster).setDefaultKeyboardMapping(index,mapping);
    }
    
	public setPlayerCountFromKeyboard(num:number=1):void{
        (ControlWrap.masterRecord[ControlType.KEYBOARD] as KeyboardMaster).setPlayerCountFromKeyboard(num);
    }
	public getPlayerCountFromKeyboard():number{
        return (ControlWrap.masterRecord[ControlType.KEYBOARD] as KeyboardMaster).count();
    }

    //================================================================

    public mainControllerIndex:number=-1;
	public allowMainPlayerUseAllController:boolean=false;
    private _lastInputIndex:number=-1;
    private lastButtonLayout:{
        name:string,
        layout:buttonLayout,
        mapping:mappingGroup
    }={
        name:'system',
        layout:buttonLayout.keyboard,
        mapping:KEYBOARD_HARDCODE_UI_BUTTON
    };
    
    public flushAll():Record<number,Input>{
        const result:Record<number,Input>={};
        let thisInputIndex:number=this._lastInputIndex;
        let ui_tap_set=new Set<string>();
        let ui_repeat_set=new Set<string>();
        let ui_pressing_set=new Set<string>();

        for (const controlType of Object.values(ControlType)) {
            if (ControlWrap.masterRecord[controlType] && this.listening[controlType]) {
                const re=ControlWrap.masterRecord[controlType]!.flushAll()
                for(let index in re){
                    const mixedIndex=this.makeIndex(controlType,Number(index));
                    result[mixedIndex]=re[index];
                    if((re[index].source===ControlType.system || this.mainControllerIndex===mixedIndex || this.allowMainPlayerUseAllController)){
                        if(this.checkAnyKeypress(re[index])){
                            thisInputIndex=mixedIndex;
                        }
                        re[index].ui_tap.forEach(item => ui_tap_set.add(item));
                        re[index].ui_repeat.forEach(item => ui_repeat_set.add(item));
                        re[index].ui_pressing.forEach(item => ui_pressing_set.add(item));
                    }
                }
            }
        }
        if(this._lastInputIndex!=thisInputIndex){
            this._lastInputIndex=thisInputIndex;
            this.lastButtonLayout=this.renewSystemButtonLayout(thisInputIndex)
            console.log(this.lastButtonLayout)
            this.emit('changeLastInputIndex',{
                index:thisInputIndex,
                buttonLayout:this.lastButtonLayout
            });
        }
        result[UI_INDEX_OFFSET]={
            source:ControlType.system,
            ui_tap:[...ui_tap_set],
            ui_pressing:[...ui_pressing_set],
            ui_repeat:[...ui_repeat_set],
        };
        
        return result;
    }

    public renewSystemButtonLayout(index:number):{
        name:string,
        layout:buttonLayout,
        mapping:mappingGroup
    }{
        if(index===SYSTEM_INDEX_OFFSET){
            //console.log('renewSystemButtonLayout','system',KEYBOARD_HARDCODE_UI_BUTTON)
            return {
                name:'system',
                layout:buttonLayout.keyboard,
                mapping:KEYBOARD_HARDCODE_UI_BUTTON
            }
        }

        const [cType,cIndex]=this.parseIndex(index);
        if(cType==ControlType.GAMEPAD){
            return (ControlWrap.masterRecord[ControlType.GAMEPAD] as GamepadMaster).renewSystemButtonLayout(cIndex);
        }
        return (ControlWrap.masterRecord[ControlType.KEYBOARD] as KeyboardMaster).renewSystemButtonLayout(cIndex);
    }

    private checkAnyKeypress(input:Input,ui_only:boolean=false):boolean{
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

    public getGamepadInfo(index:number):GamePadExtra|undefined{
        const [cType,cIndex]=this.parseIndex(index);
        if(cType==ControlType.GAMEPAD){
            return (ControlWrap.masterRecord[ControlType.GAMEPAD] as GamepadMaster).getGamepadInfo(cIndex);
        }
        return undefined;
    }

    public getName(index: number):string{
        const [cType,cIndex]=this.parseIndex(index);
        return ControlWrap.masterRecord[cType]!.getName(cIndex);
    }

    //indexing================================================================

    public count():number{
        let result:number=0;
        for (const controlType of Object.values(ControlType)) {
            if (this.listening[controlType]) {
                result+=ControlWrap.masterRecord[controlType]!.count();
            }
        }
        return result;
    }

    public getIndexs():number[]{
        let result:number[]=[];
        for (const controlType of Object.values(ControlType)) {
            if (this.listening[controlType]) {
                ControlWrap.masterRecord[controlType]!.getIndexs().forEach((i)=>{
                    result.push(this.makeIndex(controlType,i));
                })
            }
        }
        return result;
    }

    public parseIndex(index:number=0):[ControlType,number]{
        //let kbCount=KeyboardMaster.getInstance().count();
        //console.log(kbCount,gpCount)
        if(index<GAMPEPAD_INDEX_OFFSET){
            return [ControlType.KEYBOARD,index];
        }
        //let gpCount=GamepadMaster.getInstance().count();
        return [ControlType.GAMEPAD,index-GAMPEPAD_INDEX_OFFSET];
    }

    public makeIndex(cType:ControlType,index:number=0):number{
        if(cType==ControlType.KEYBOARD){
            return index;
        }
        //let kbCount=KeyboardMaster.getInstance().count();
        return GAMPEPAD_INDEX_OFFSET+index;
    }

    //listen================================================================

    public listenKeyFromControllerIndex(index:number):Promise<number>{
        const [cType,cIndex]=this.parseIndex(index);
        return ControlWrap.masterRecord[cType]!.listenKeyFromControllerIndex(cIndex);
    }

    public listenControllerIndexFromKeys(keys:string[]=[]):Promise<number>{
        return new Promise((resolve,reject)=>{
            for (const controlType of Object.values(ControlType)) {
                if (this.listening[controlType] && ControlWrap.masterRecord[controlType]) {
                    ControlWrap.masterRecord[controlType]!.listenControllerIndexFromKeys(keys).then((i)=>{
                        const mixIndex=this.makeIndex(controlType,i);
                        //console.log('race result',mixIndex,controlType,i)
                        resolve(mixIndex)
                        this.cancelListen('race success');
                    }).catch((e)=>{
                        if(e==='escape'){
                            reject(e);
                        }
                        this.cancelListen();
                    })
                }
            }
        })
    }
 
    public cancelListen(reason?:string):void{
        for (const controlType of Object.values(ControlType)) {
            if (this.listening[controlType] && ControlWrap.masterRecord[controlType]) {
                ControlWrap.masterRecord[controlType]!.cancelListen(reason);
            }
        }
    }

    //pass to child================================================================

    public getAllMapping(index:number):mappingGroup{
        const [cType,cIndex]=this.parseIndex(index);
        return ControlWrap.masterRecord[cType]!.getAllMapping(cIndex);
    }

	public checkMapping(index:number,buttonName:string,keyCode:string):boolean{
        const [cType,cIndex]=this.parseIndex(index);
        return ControlWrap.masterRecord[cType]!.checkMapping(cIndex,buttonName,keyCode);
    }

	public setMapping(index:number,buttonName:string,keyCode:string):boolean{
        const [cType,cIndex]=this.parseIndex(index);
        return ControlWrap.masterRecord[cType]!.setMapping(cIndex,buttonName,keyCode);
    }

	public setAllMapping(index:number,mapping:mappingGroup):void{
        const [cType,cIndex]=this.parseIndex(index);
        ControlWrap.masterRecord[cType]!.setAllMapping(cIndex,mapping);
    }

	public getMappableKeys(index: number = 0): { buttons: string[], optional: string[] } {
        const [cType,cIndex]=this.parseIndex(index);
        return ControlWrap.masterRecord[cType]!.getMappableKeys(cIndex);
    }

	public checkNotRepeat(index:number,buttonName:string,keyCode:string):boolean{
        const [cType,cIndex]=this.parseIndex(index);
        return ControlWrap.masterRecord[cType]!.checkNotRepeat(cIndex,buttonName,keyCode);
        return true;
    }

    public vibration(index: number,duration:number=300,strongMagnitude:number=1,weakMagnitude:number=1):void{//Promise<GamepadHapticsResult>
        const [cType,cIndex]=this.parseIndex(index);
        if(cType==ControlType.GAMEPAD){
            (ControlWrap.masterRecord[ControlType.GAMEPAD] as GamepadMaster).vibration(cIndex,duration,strongMagnitude,weakMagnitude);
        }
        //return Promise.reject('no vibration');
    }
}

/*
TODO:
get btnDisplayName of main

setAllMapping
	getMappableKeys

profile
map 4p

    raw
*/