import {EventEmitter} from 'eventemitter3';


import { dpad,dpadPress, getDpadDirection,xy } from "gamepad_standardizer";
import  {ButtonState ,mappingGroup,Input,ControlType,mappingRequirement,latestLayoutGroup} from '../types';
import  {inEnum,findKeyByValue,stopEvent,clone} from '../utils/utils';
import { Button,getUITap,joinState,isRepeat } from './Button';
import InputDeviceMaster,{ listenStatus } from './InputDeviceMaster';
import {IControllerMaster} from './IControllerMaster';
import { SYSTEM_INDEX_OFFSET,KEYBOARD_HARDCODE_UI_BUTTON,buttonLayout } from '../config';

const MAX_KEYBOARD=4;
const ignoreKeys:string[]=['Escape','MetaLeft','MetaRight','PrintScreen','NumLock','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12'];
const ignoreFunction:string[]=['Escape','Tab','MetaLeft','MetaRight','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12'];
//'ContextMenu','OSLeft','OSRight','BrowserBack','BrowserForward','BrowserRefresh','BrowserStop','BrowserSearch','BrowserFavorites','BrowserHome','VolumeMute','VolumeDown','VolumeUp','MediaTrackNext','MediaTrackPrevious','MediaStop','MediaPlayPause'];


export default class KeyboardMaster extends InputDeviceMaster implements IControllerMaster{

    protected static instance: KeyboardMaster;
    public static getInstance(): KeyboardMaster {
        if (!KeyboardMaster.instance) {
            KeyboardMaster.instance = new KeyboardMaster();
        }

        return KeyboardMaster.instance;
    }

    static isSupported(): boolean {
        return 'onkeydown' in window;
    }

    //================================================================
    

    private downKey:Set<string>=new Set();
    //private lastDownKey:Set<string>=new Set();

    private buttons:Record<string,Button>={}
    private inited:boolean=false;

    public init(){
        if(this.inited){
            return;
        }
        this.inited=true;
        window.addEventListener("keydown", (event: KeyboardEvent) => {
            if(event.code && !event.repeat){
                if(ignoreFunction.indexOf(event.code)>=0){
                    stopEvent(event);
                }
                this.listenDown(event.code);
                this.downKey.add(event.code);
                if(!this.buttons[event.code]){
                    this.buttons[event.code]=new Button();
                }
                this.buttons[event.code].press();
            }
        });
        
        window.addEventListener("keyup", (event: KeyboardEvent) => {
            if(event.code){
                this.downKey.delete(event.code);
                if(!this.buttons[event.code]){
                    this.buttons[event.code]=new Button();
                }
                this.buttons[event.code].release();
            }
        });
        window.addEventListener("blur", (event:Event) => {
            for(let keyCode in this.buttons){
                this.buttons[keyCode].release();
            }
            this.downKey.clear();
        });
        this.totalKeyboard=1;
    }
    
	public importRequirement(requirement:mappingRequirement):void{
        /*
        if(requirement.type!==ControlType.KEYBOARD){
            throw new Error('mapping type must be keyboard');
        }
        if(!(requirement.direction.dpad && requirement.direction.analog==0)){
            throw new Error('keyboard must have dpad and no analog');
        }
        */
        if(requirement.ui_button && requirement.ui_button.indexOf('escape')>=0){
            throw new Error('not allow set escape');
        }
        this.requirement=clone(requirement) as mappingRequirement;
        //this.requirement=requirement;
        
        //this.setCount(1);
    }

    //================================================================

    private totalKeyboard:number=0;
    //private controllers:KeyboardController[]=[];
    
    public count():number{
        return this.totalKeyboard;
    }

    public getIndexs():number[]{
        let result:number[]=[];
        for(let i=0;i<this.totalKeyboard;i++){
            result.push(i);
        }
        return result;
    }

    public getName(index: number):string{
        if(this.totalKeyboard===1){
            return 'Keyboard';
        }
        return `Keyboard ${index+1}`;
    }

    protected getInput(id: number, keyStatus: Record<string, ButtonState>): Input {
        const button: Record<string,ButtonState> = {};
        const ui_tap: string[] = [];
        const ui_pressing:string[]=[];
        const ui_repeat:string[]=[];
        const dpadPressed: dpadPress = {
            up:false,
            down:false,
            left:false,
            right:false,
        }
        const directionButton:Record<string,ButtonState> = {};
        let doublePress=false;
        let justDouble=false;
        let doublePressDirection=false;
        let ui_dpad_just:string='';

        for (const keyName in this.currentMapping[id]) {
            const buttonName = this.currentMapping[id][keyName];
            let status:ButtonState = {
                press: false,
                just: false,
                double: false,
                tap: false,
                pressFrame:0,
            };
            if(typeof(buttonName)==='string'){
                if(keyStatus[buttonName]){
                    status=keyStatus[buttonName];
                }
            }else{
                for(let i=0;i<buttonName.length;i++){
                    if(keyStatus[buttonName[i]]){
                        
                        status=joinState(status,keyStatus[buttonName[i]]);
                    }
                }
            }

            if(keyName==='double'){
                doublePress=status.press;
                justDouble=status.just;
                continue;
            }

            //is dpad
            if (inEnum(keyName,dpad)) {
                dpadPressed[keyName as dpad] = status!==undefined && (status.press || status.tap);
                directionButton[keyName]=status;

                if((status.press && status.just) || status.tap){
                    ui_dpad_just=keyName;
                }
                if(status.press){
                    ui_pressing.push(keyName);
                }
                if(isRepeat(status)){
                    ui_repeat.push(keyName);
                }

                doublePressDirection=doublePressDirection || status.double;
                continue;
            }

            if(this.requirement!.button.indexOf(keyName)>=0 || (this.requirement!.optional && this.requirement!.optional.indexOf(keyName)>=0)){
                button[keyName]=status;
                const ui_btn_name=findKeyByValue(this.requirement!.ui_pair,keyName);
                if(ui_btn_name){
                    if((status.press && status.just) || status.tap){
                        ui_tap.push(ui_btn_name);
                    }
                    if(status.press){
                        ui_pressing.push(ui_btn_name);
                    }
                    if(isRepeat(status)){
                        ui_repeat.push(ui_btn_name);
                    }
                }
            }else if(
                status && 
                (   (this.requirement!.ui_button && this.requirement!.ui_button.indexOf(keyName)>=0) ||
                    (this.requirement!.ui_optional && this.requirement!.ui_optional.indexOf(keyName)>=0)    )
            ){
                if((status.press && status.just) || status.tap){
                    ui_tap.push(keyName);
                }
                if(status.press){
                    ui_pressing.push(keyName);
                }
                if(isRepeat(status)){
                    ui_repeat.push(keyName);
                }
            }
        }
        

        const dpadResult:any= getDpadDirection(dpadPressed);
        delete dpadResult['radian'];
        delete dpadResult['degree'];
        delete dpadResult['distance'];
        delete dpadResult['type'];

        if(dpadResult.numpad%2==0 && ui_dpad_just!=''){
            ui_tap.push(ui_dpad_just);
        }
        //console.log(button,ui_tap,dpadResult.numpad,directionState);//);

        //double
        if(doublePress){
            if(dpadResult.numpad!==5){
                for(let dir in directionButton){
                    
                    if(!directionButton[dir].double && (directionButton[dir].just || justDouble) && directionButton[dir].press){
                        directionButton[dir].double=true;
                    }
                }

                doublePressDirection=true;
            }
            for(let keyName in button){
                if(button[keyName].tap || (button[keyName].just && button[keyName].press)){
                    button[keyName].double=true;
                }
            }
        }

        return {
            source: ControlType.KEYBOARD,
            sourceIndex: id,
            directionButton:directionButton as Record<dpad,ButtonState>,
            mixedDpad:dpadResult as (dpadPress & {numpad:number} & xy),
            
            doublePressDirection,
            ui_tap,
            ui_pressing,
            ui_repeat,
            button,

            //mapping:this.currentMapping[id]
        };
    }

    protected getSystemInput(keyStatus: Record<string, ButtonState>):Input{
        const sdf:Record<string,ButtonState>={}
        for(let keyName in KEYBOARD_HARDCODE_UI_BUTTON){
            sdf[keyName]=keyStatus[KEYBOARD_HARDCODE_UI_BUTTON[keyName]]
        }
        const ui_tap:string[]=[];
        const ui_pressing:string[]=[];
        const ui_repeat:string[]=[];


        for(const key in sdf){
            if(!sdf[key])continue;
            //key=ui_btn_name
            //sdf[key]=buttonState

            if(getUITap(sdf[key])){
                ui_tap.push(key);
            }
            if(sdf[key].press){
                ui_pressing.push(key);
            }
            if(isRepeat(sdf[key])){
                ui_repeat.push(key);
            }
        }
                
        return {
            source:ControlType.system,
            ui_tap,
            ui_pressing,
            ui_repeat,
        }
    }

    public flushAll():Record<number,Input>{
        const keyStatus:Record<string,ButtonState>={};
        for(let keyCode in this.buttons){
            keyStatus[keyCode]=this.buttons[keyCode].flush();
        };

        const result:Record<number,Input>={};


        //keyboard master:
        result[SYSTEM_INDEX_OFFSET]=this.getSystemInput(keyStatus);

        //keyboards:
        for(let i=0;i<this.totalKeyboard;i++){
            result[i]=this.getInput(i,keyStatus);
        }

        //this.lastDownKey=new Set(this.downKey);
        this.downKey.clear();

        return result;
    }

    //================================================================

    public listenControllerIndexFromKeys(keys:string[]=[]):Promise<number>{
        const keys2=[...keys];
        for(let k in this.requirement!.ui_pair){
            if(keys.indexOf(k)>=0){
                //console.log('listenControllerIndexFromKeys',k,this.requirement!.ui_pair[k]);
                keys2.push(this.requirement!.ui_pair[k]);
            }
        }
        return super.listenControllerIndexFromKeys(keys2);
    }

    private listenDown(keyCode:string){
        if(keyCode==='Escape'){
            this.emit('escape');
            if(this.listenMode!==listenStatus.none){
                this.cancelListen('escape');
            }
        }else if(this.listenMode===listenStatus.ControllerIndexFromKeys){
            for(let i=0;i<this.totalKeyboard;i++){
                for(let keyName in this.currentMapping[i]){
                    if(this.currentMapping[i][keyName]===keyCode && (this.listenKeys.length===0 || this.listenKeys.indexOf(keyName)>=0)){
                        this.listenMode=listenStatus.none;
                        this.emit('listenControllerIndexFromKeys',i);
                        return;
                    }
                }
            }
        }else if(this.listenMode===listenStatus.anyKey && ignoreKeys.indexOf(keyCode)===-1){
            this.listenMode=listenStatus.none;
            this.emit('listenKeyFromControllerIndex',keyCode);
            return;
        }
    }
 
    public listenKeyFromControllerIndex():Promise<number>{
        this.listenMode=listenStatus.anyKey;

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

    //mapping================================================================

    private defaultMapping:Record<number,mappingGroup>={};

    

	public resetDefault(index:number):mappingGroup|undefined{
        if(this.defaultMapping[index]){
            this.currentMapping[index]=clone(this.defaultMapping[index]);
        }
        return this.defaultMapping[index];
    }

    public setDefaultMapping(mapping:mappingGroup):void{
        this.setDefaultKeyboardMapping(0,mapping);
    }

    public setDefaultKeyboardMapping(id:number,mapping:mappingGroup):void{
        /*
        for(let buttonName in mapping){
            if(!this.checkMapping(id,buttonName,mapping[buttonName])){
                throw new Error(`mapping error: ${id} ${buttonName} ${mapping[buttonName]}`);
            }
        }
        */
        this.defaultMapping[id]=mapping;
        if(!this.currentMapping[id]){
            this.setAllMapping(id,mapping);
        }
    }

	public checkMapping(id:number,buttonName:string,keyCode:string):boolean{
        if(ignoreKeys.indexOf(keyCode)!==-1)return false;
        if(buttonName==='escape')return false;
    
        if( //inEnum(buttonName,UIButton) &&
            Object.values( KEYBOARD_HARDCODE_UI_BUTTON).indexOf(keyCode)!=-1 && 
            (KEYBOARD_HARDCODE_UI_BUTTON[buttonName]!==keyCode || id!=0)
        ){ 
            return false;
        }
        
        return true;
    }

	public checkNotRepeat(id:number,buttonName:string,keyCode:string):boolean{
        for(let i=0;i<this.totalKeyboard;i++){
            for(let keyName in this.currentMapping[i]){
                if(this.currentMapping[i][keyName]===keyCode && !(id==i && buttonName==keyName)){
                    return false
                }
            }
        }
        return true;
    }
    
    public getMappableKeys(id: number = 0): { buttons: string[], optional: string[] } {
        const result=super.getMappableKeys(id)
        result.buttons=['up', 'down', 'left', 'right',...result.buttons];
        return result;
    }


    //=======================

    public renewSystemButtonLayout(index:number):latestLayoutGroup{
        return {
            name:this.getName(index),
            layout:buttonLayout.keyboard,
            mapping:{
                ...this.getAllMapping(index),
                ...this.getPairMapping(index),
                escape:'escape'
            }
        }
    }

    public getPairMapping(id:number):mappingGroup{
        let result:mappingGroup={};
        for(let ui_btn_name in this.requirement!.ui_pair){
            const btn_name=this.requirement!.ui_pair[ui_btn_name]
            result[ui_btn_name]=this.currentMapping[id][btn_name];
        }
        return result;
    }

    public setPlayerCountFromKeyboard(num:number){
        if(!this.inited){
            throw new Error('not inited');
        }
        if(!this.requirement){
            throw new Error('requirement not set');
        }
        if(!this.requirement){
            throw new Error('requirement not set');
        }
        if(num<1){
            throw new Error('totalKeyboard must >=1');
        }
        if(num>MAX_KEYBOARD){
            throw new Error(`totalKeyboard must <=${MAX_KEYBOARD}`);
        }
        const lastNum=this.totalKeyboard;
        this.totalKeyboard=num;
        if(lastNum>num){
            for(let i=num;i<lastNum;i++){
                this.emit('remove',i);
            }
        }else{
            for(let i=lastNum;i<num;i++){
                this.emit('add',i);
            }
        }
        for(let i=0;i<num;i++){
            if(!this.currentMapping[i]){
                this.currentMapping[i]={}
                Object.keys(dpad).forEach((keyName, index) => {
                    this.currentMapping[i][keyName]='';
                })
                this.requirement!.button.forEach((keyName, index) => {
                    this.currentMapping[i][keyName]='';
                })
                if(this.requirement!.optional){
                    this.requirement!.optional.forEach((keyName, index) => {
                        this.currentMapping[i][keyName]='';
                    })
                }
                if(this.requirement!.ui_button){
                    this.requirement!.ui_button.forEach((keyName, index) => {
                        this.currentMapping[i][keyName]='';
                    })
                }
                if(this.requirement!.ui_optional){
                    this.requirement!.ui_optional.forEach((keyName, index) => {
                        this.currentMapping[i][keyName]='';
                    })
                }
                //
                this.resetDefault(i);
                //console.log('setPlayerCountFromKeyboard',i,this.currentMapping[i],this.defaultMapping[i])
            }
        }
    }

}