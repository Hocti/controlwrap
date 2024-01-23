import { ButtonState } from "../types";

export const UI_REPEAT_STARTFRAME=60
export const UI_REPEAT_FRAME=30

//have press:press || (!press && tap)
//have press:press || (!press && tap)
//have release:!press || (press && tap)

export function isRepeat(bs:ButtonState):boolean{
    return bs.press && bs.pressFrame>=UI_REPEAT_STARTFRAME && (bs.pressFrame-UI_REPEAT_STARTFRAME)%UI_REPEAT_FRAME==0
    //* && GLOBALFRAME_PASS%UI_REPEAT_FRAME==0
}
export function getUITap(bs:ButtonState | undefined):boolean{
    if(!bs)return false
    return (bs.press && bs.just) || (!bs.press && bs.tap) || bs.double;
}
export function getUIsTap(bss:Record<string,ButtonState>):Record<string,boolean>{
    const result:Record<string,boolean>={}
    for(const key in bss){
        result[key]=getUITap(bss[key])
    }
    return result;
}

export function joinState(a:ButtonState,b:ButtonState):ButtonState{
    const press=a.press || b.press;
    const double=a.double || b.double;
    
    const just=!((a.press && !a.just) || (b.press && !b.just)) && (a.just || b.just);
    const tap=!((a.press && !a.just) || (b.press && !b.just)) && (a.tap || b.tap);
    const pressFrame=a.pressFrame || b.pressFrame;

    return {
        press,
        just,
        double,
        tap,
        pressFrame
    }
}


let minDoubleFrame:number=30;

export function setMinDoubleFrame(frame:number){
    minDoubleFrame=frame;
}

export class Button{

    private lastPress:boolean=false;
    private Press:boolean=false;
    private currFrameHistory:boolean[]=[];
    private pressFrame:number=0;

    //mix multi frame
    mixFrameHistory:boolean[][]=[[]];

    constructor(){
        this.currFrameHistory=[false];
    }

    public flush():ButtonState{

        //tap
        let tap:boolean=false;
        if(this.currFrameHistory.length>=3){
            if(this.Press){
                tap=this.currFrameHistory.toString().indexOf('true,false,true')>=0;
            }else{
                tap=this.currFrameHistory.toString().indexOf('false,true,false')>=0;
            }
        }

        //double
        let double:boolean=false;
        if(this.currFrameHistory.length>=4){
            double=this.currFrameHistory.toString().indexOf('false,true,false,true')>=0;
        }
        if(!double){
            if(this.mixFrameHistory.length>minDoubleFrame){
                this.mixFrameHistory.shift();
            }
            this.mixFrameHistory.push(this.currFrameHistory)

            let mixString:boolean[]=[]
            for(let i=0,t=Math.min(minDoubleFrame,this.mixFrameHistory.length);i<t;i++){
                if(this.mixFrameHistory[i].length>1){
                    for(let j=0;j<this.mixFrameHistory[i].length;j++){
                        if(this.mixFrameHistory[i][j]!=mixString[mixString.length-1]){
                            mixString.push(this.mixFrameHistory[i][j])
                        }
                    }
                }
                    
            }
            double=mixString.toString().indexOf('false,true,false,true')>=0;
        }

        if(this.Press){
            if(this.pressFrame<999){
                this.pressFrame++
            }
        }else if(this.pressFrame!==0){
            this.pressFrame=0;
        }

        //
        const result:ButtonState={
            press:this.Press,
            just:this.Press!=this.lastPress,
            double,
            tap,
            pressFrame:this.pressFrame
        }
        if(double){
            this.mixFrameHistory=[];
        }
        this.currFrameHistory=[this.Press];
        this.lastPress=this.Press
        return result;
    }

    public press():void{
        this.Press=true;
        if(this.currFrameHistory[this.currFrameHistory.length-1]!==true){
            this.currFrameHistory.push(true);
        }
    }

    public release():void{
        this.Press=false;
        if(this.currFrameHistory[this.currFrameHistory.length-1]!==false){
            this.currFrameHistory.push(false);
        }
    }
}