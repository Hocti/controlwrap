import {EventEmitter} from 'eventemitter3';
import  {latestLayoutGroup ,InputGroup,ControlType,Input,mappingGroup,mappingRequirement,InputSource} from '../types';

import {IControllerMaster} from './IControllerMaster';
import GamepadMaster from './GamepadMaster';
import KeyboardMaster from './KeyboardMaster';
import GamePadExtra from './GamePadExtra';
import { GAMPEPAD_INDEX_OFFSET,SYSTEM_INDEX_OFFSET,UI_INDEX_OFFSET,KEYBOARD_HARDCODE_UI_BUTTON,buttonLayout } from '../config';
import { checkAnyKeypress } from './common';
import MouseMaster from './MouseMaster';

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

    protected listenToMouse:boolean=false;

    public wrappedInit(
            requirement:mappingRequirement,
            defaultGamePadmapping:mappingGroup,
            defaultKeyboardmappings:mappingGroup[],

            keyboardCountum:number=1,
            mouse:boolean=false,
            //keyboardmappings:Record<number,mappingGroup>={},
            //gamepadMappings:Record<string,mappingGroup>={},
        ):void
    {
        this.init({keyboard:true,gamepad:true});
        this.importRequirement(requirement);
        this.setDefaultGamepadMapping(defaultGamePadmapping);
        for(let i=0;i<defaultKeyboardmappings.length;i++){
            this.setDefaultKeyboardMapping(i,defaultKeyboardmappings[i]);
        }
        this.setPlayerCountFromKeyboard(keyboardCountum);

        if(mouse){
            this.listenToMouse=true;
            MouseMaster.getInstance().init();
        }
        /*
        TODO?
        for(let keyBoardIndex in keyboardmappings){
            //this.setAllMapping(0,gamepadMappings[gamepadName]);
        }
        for(let gamepadName in gamepadMappings){
            //this.setAllMapping(0,gamepadMappings[gamepadName]);
        }
        */
    }
    
	public importRequirement(requirement:mappingRequirement):void{
        for (const controlType of Object.values(ControlType)) {
            if (ControlWrap.masterRecord[controlType]) {
                ControlWrap.masterRecord[controlType]!.importRequirement(requirement);
            }
        }
        this.requirement=requirement;
    }
    
	public setDefaultGamepadMapping(mapping:mappingGroup):void{
        (ControlWrap.masterRecord[ControlType.GAMEPAD] as GamepadMaster).setDefaultMapping(mapping);
    }
    
	public setDefaultKeyboardMapping(index:number=0,mapping:mappingGroup):void{
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
    private defaultButtonLayout:latestLayoutGroup={
        name:'system',
        layout:buttonLayout.keyboard,
        mapping:KEYBOARD_HARDCODE_UI_BUTTON
    };
    private lastButtonLayout:latestLayoutGroup=this.defaultButtonLayout;
    
    public update():InputGroup{
        const ips=this.flushAll();
        const result:InputGroup={
            [InputSource.system]:ips[SYSTEM_INDEX_OFFSET],
            [InputSource.ui]:ips[UI_INDEX_OFFSET],
            [InputSource.player]:{},
        };
        for(let index in ips){
            if(Number(index)!=UI_INDEX_OFFSET && Number(index)!=SYSTEM_INDEX_OFFSET){
                result[InputSource.player][index]=ips[index];
            }
        }
        if(this.listenToMouse){
            result[InputSource.mouse]=MouseMaster.getInstance().flush();
        }
        return result;
    }

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
                        if(checkAnyKeypress(re[index])){
                            if(!(
                                re[index].ui_tap.toString()==='escape' && 
                                re[index].source===ControlType.system && 
                                thisInputIndex!==mixedIndex && 
                                this.lastButtonLayout.layout===buttonLayout.keyboard
                                )){
                                thisInputIndex=mixedIndex;
                            }
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
            //console.log(this.lastButtonLayout)
            this.emit('changeLastInputIndex',{
                index:thisInputIndex,
                buttonLayout:this.lastButtonLayout
            });
        }
        result[UI_INDEX_OFFSET]={
            //source:ControlType.KEYBOARD,
            ui_tap:[...ui_tap_set],
            ui_pressing:[...ui_pressing_set],
            ui_repeat:[...ui_repeat_set],
        };
        
        return result;
    }

    public renewSystemButtonLayout(index:number):latestLayoutGroup {
        if(index===SYSTEM_INDEX_OFFSET){
            return this.defaultButtonLayout
        }
        const [cType,cIndex]=this.parseIndex(index);
        if(cType==ControlType.GAMEPAD){
            return (ControlWrap.masterRecord[ControlType.GAMEPAD] as GamepadMaster).renewSystemButtonLayout(cIndex);
        }else if(cType==ControlType.KEYBOARD){
            return (ControlWrap.masterRecord[ControlType.KEYBOARD] as KeyboardMaster).renewSystemButtonLayout(cIndex);
        }
        return this.defaultButtonLayout
    }

    public getGamepadExtra(index:number):GamePadExtra|undefined{
        const [cType,cIndex]=this.parseIndex(index);
        if(cType==ControlType.GAMEPAD){
            return (ControlWrap.masterRecord[ControlType.GAMEPAD] as GamepadMaster).getGamepadExtra(cIndex);
        }
        return undefined;
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
        if(index<GAMPEPAD_INDEX_OFFSET){
            return [ControlType.KEYBOARD,index];
        }
        return [ControlType.GAMEPAD,index-GAMPEPAD_INDEX_OFFSET];
    }

    public makeIndex(cType:ControlType,index:number=0):number{
        if(cType==ControlType.KEYBOARD){
            return index;
        }
        return GAMPEPAD_INDEX_OFFSET+index;
    }

    //listen================================================================

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

    public listenKeyFromControllerIndex(index:number):Promise<number>{
        const [cType,cIndex]=this.parseIndex(index);
        return ControlWrap.masterRecord[cType]!.listenKeyFromControllerIndex(cIndex);
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

	public resetDefault(index:number):mappingGroup|undefined{
        const [cType,cIndex]=this.parseIndex(index);
        return ControlWrap.masterRecord[cType]!.resetDefault(cIndex);
    }

	public getMappableKeys(index: number = 0): { buttons: string[], optional: string[] } {
        const [cType,cIndex]=this.parseIndex(index);
        return ControlWrap.masterRecord[cType]!.getMappableKeys(cIndex);
    }

	public checkNotRepeat(index:number,buttonName:string,keyCode:string):boolean{
        const [cType,cIndex]=this.parseIndex(index);
        return ControlWrap.masterRecord[cType]!.checkNotRepeat(cIndex,buttonName,keyCode);
    }

    public getName(index: number):string{
        const [cType,cIndex]=this.parseIndex(index);
        return ControlWrap.masterRecord[cType]!.getName(cIndex);
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