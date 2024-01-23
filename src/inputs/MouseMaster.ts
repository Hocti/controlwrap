import {EventEmitter} from 'eventemitter3';
import {xy } from "gamepad_standardizer";
import  {mouseInput} from '../types';
import  {stopEvent} from '../utils/utils';
import { Button } from './Button';

const MOUSE_BUTTON_NAME:string[]=["left","right","middle","prev","next"];

export default class MouseMaster extends EventEmitter{

    protected static instance: MouseMaster;
    public static getInstance(): MouseMaster {
        if (!MouseMaster.instance) {
            MouseMaster.instance = new MouseMaster();
        }

        return MouseMaster.instance;
    }

    static isSupported(): boolean {
        return 'onkeydown' in window;
    }

    //================================================================

    protected lastxy:xy={x:0,y:0};
    protected latestxy:xy={x:0,y:0};
    protected delta:number=0;
    protected lastPress:boolean[]=[false,false,false,false,false];
    private buttons:Record<string,Button>={}
    private inited:boolean=false;

    public init(){
        if(this.inited){
            return;
        }
        this.inited=true;
        window.addEventListener("mousemove", this.mEvent.bind(this));

        window.addEventListener("mousedown", this.mEvent.bind(this));
        window.addEventListener("mouseup",this.mEvent.bind(this));
        //window.addEventListener("click",this.mEvent.bind(this));

        //window.addEventListener("mouseout", this.mEvent);
        window.addEventListener("blur", this.onBlur.bind(this));
        window.addEventListener("wheel", this.wEvent.bind(this))
        document.oncontextmenu = this.onRightClick.bind(this);

        for(let i=0;i<5;i++){
            this.buttons[MOUSE_BUTTON_NAME[i]]=new Button();
        }
    }

    protected wEvent(event:WheelEvent){
        if(event.deltaY!=0){
            this.delta=event.deltaY>0?1:-1;
        }
    }


    protected mEvent(event:MouseEvent){
        if(event.type==='mousemove'){
            this.latestxy.x=event.clientX;
            this.latestxy.y=event.clientY;
            return;
        }

        /*
        console.log(`${event.type}: 
        ${event.clientY}, ${event.pageY}, ${event.offsetY  }, ${event.screenY }, 
        ${event.buttons.toString(2)},${event.button}`);
        //stopEvent(e);
        */

        if(event.type==='mousedown' || event.type==='mouseup'){
            const buttonPress:boolean[]=[false,false,false,false,false];
            const btns=event.buttons.toString(2);
            for(let i=0;i<btns.length;i++){
                if(btns[i]==='1'){
                    buttonPress[btns.length-i-1]=true;
                }
            }
            for(let i=0;i<5;i++){
                if(buttonPress[i]!=this.lastPress[i]){
                    this.lastPress[i]=buttonPress[i];
                    if(buttonPress[i]){
                        this.buttons[MOUSE_BUTTON_NAME[i]].press();
                    }else{
                        this.buttons[MOUSE_BUTTON_NAME[i]].release();
                    }
                }
            }

            if(this.blockPrevNext && (event.button==3 || event.button==4)){
                stopEvent(event);
            }
            if(this.blockMiddle && (event.button==1)){
                stopEvent(event);
            }
        }
    }

    protected onRightClick(e:MouseEvent){
        if(this.blockRightClick){
            stopEvent(e);
        }
    }

    protected onBlur(e:FocusEvent){
        for(let i=0;i<5;i++){
            if(this.lastPress[i]){
                this.lastPress[i]=false;
                this.buttons[MOUSE_BUTTON_NAME[i]].release();
            }
        }
    }

    public flush(): mouseInput{
        let result:mouseInput={
            xy:{x:this.latestxy.x,y:this.latestxy.y},
            xyDelta:{
                x:this.lastxy.x-this.latestxy.x,
                y:this.lastxy.y-this.latestxy.y
            },
            delta:this.delta,
            buttons:{}
        };
        for(let key in this.buttons){
            result.buttons[key]=this.buttons[key].flush();
        }

        this.lastxy.x=this.latestxy.x;
        this.lastxy.y=this.latestxy.y;
        this.delta=0;

        return result;
    }

    public blockRightClick:boolean=false;
    public blockPrevNext:boolean=false;
    public blockMiddle:boolean=false;

    public hideCursor():void{
        document.body.style.cursor = 'none';
    }
    
    public showCursor():void{
        document.body.style.removeProperty('cursor');
    }
    
    public getCursorDisplay():boolean{
        return document.body.style.cursor !== 'none';
    }

    /**
     * lock:
     * move
     */
    
}