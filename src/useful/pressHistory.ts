
import  {Input,gameInput} from '../types';
class pressHistory {

    //static================================================================

    protected static instance: pressHistory;

    static getInstance(): pressHistory {
        if (!pressHistory.instance) {
            pressHistory.instance = new pressHistory();
        }
        return pressHistory.instance;
    }

    public historys:Record<number,Record<number,gameInput>>={};
    public historys_lite:Record<number,Record<number,string[]>>={};
    public autoFrameNumber:number=0;
    public maxHistory:number=120;

    public cleanAll():void{
        this.historys={};
        this.historys_lite={};
        this.autoFrameNumber=0;
    }

    
    public cleanPlayer(playerID:number):void{
        for(let i in this.historys){
            if(this.historys[i][playerID]){
                delete this.historys[i][playerID];
            }
        }
        for(let i in this.historys_lite){
            if(this.historys_lite[i][playerID]){
                delete this.historys_lite[i][playerID];
            }
        }
    }

    public addHistory(inputs: Record<number, Input>):void{//,frameNumber:number=0
        //if(frameNumber===0){
            let frameNumber=++this.autoFrameNumber;
        //}
        this.historys[frameNumber]={};
        this.historys_lite[frameNumber]=[];

        for(let i in inputs){
            const {mixedDpad,directionButton,doublePressDirection,button}={...inputs[i]};
            this.historys[frameNumber][i]={}
            if(mixedDpad)this.historys[frameNumber][i].mixedDpad=mixedDpad;
            if(directionButton)this.historys[frameNumber][i].directionButton=directionButton;
            if(doublePressDirection)this.historys[frameNumber][i].doublePressDirection=doublePressDirection;
            if(button)this.historys[frameNumber][i].button=button;
            //
            const lite:string[]=[];
            //this.historys_lite[frameNumber][i]=[];
            if(mixedDpad && mixedDpad.numpad!=5){
                if(doublePressDirection){
                    //lite.push((mixedDpad.numpad*11).toString());
                    lite.push((mixedDpad.numpad).toString());
                }else{
                    lite.push(mixedDpad.numpad.toString());
                }
            }
            if(button){
                for(let bname in button){
                    if(button[bname].press){
                        lite.push(bname);
                    }
                }
            }
            this.historys_lite[frameNumber][i]=lite;
        }

        const keys=Object.keys(this.historys)
        if(keys.length>this.maxHistory){
            delete this.historys[keys[0] as unknown as number];
            delete this.historys_lite[keys[0] as unknown as number];
        }
    }

    public getHistoryFromPlayer(playerID:number,maxFrame:number=this.maxHistory):gameInput[]{
        let result:gameInput[]=[];
        for(let i=this.autoFrameNumber;i>(this.autoFrameNumber-maxFrame);i--){
            if(!this.historys[i] || !this.historys[i][playerID]){
                break;
            }
            result.unshift(this.historys[i][playerID]);
        }
        return result
    }

    public getHistoryLiteFromPlayer(playerID:number,maxFrame:number=this.maxHistory):string[][]{
        let result:string[][]=[];
        for(let i=this.autoFrameNumber;i>(this.autoFrameNumber-maxFrame);i--){
            if(!this.historys[i] || !this.historys[i][playerID]){
                break;
            }
            result.unshift(this.historys_lite[i][playerID]);
        }
        return result
    }

    public getShorten(playerID:number,maxFrame:number=this.maxHistory):string{
        let result:string[][]=this.getHistoryLiteFromPlayer(playerID,maxFrame);
        let lastInput:string[]=[];;
        let ouput:string[]=[];
        for(let fip of result){
            if(fip.join(',')===lastInput.join(',')){
                continue;
            }
            for(let i of fip){
                if(lastInput.indexOf(i)===-1){
                    ouput.push(i);
                }
            }

            lastInput=fip;
        }
        return ouput.join(',');
    }

    public doublePressDirection(playerID:number,maxFrame:number=this.maxHistory):number{
        let result:gameInput[]=this.getHistoryFromPlayer(playerID,maxFrame);
        let lastDir:number=0;
        let skiped:boolean=false;
        for(let i=result.length-1;i>=0;i--){
            const fip=result[i]
            const numpad=fip.mixedDpad?fip.mixedDpad.numpad:0;
            if(lastDir===0 && numpad>0 && numpad!=5){
                lastDir=numpad;
                continue;
            }
            if(lastDir>0 && numpad===5 && !skiped){
                skiped=true;
                continue;
            }
            if(lastDir>0 && numpad!==5){
                if(numpad===lastDir){
                    if(skiped){
                        return lastDir;
                    }
                }else{
                    return 0;
                }
            }
        }
        return 0;
    }

    public doublePress(playerID:number,buttonName:string,maxFrame:number=this.maxHistory):boolean{
        let result:gameInput[]=this.getHistoryFromPlayer(playerID,maxFrame);
        let firstPress:boolean=false;
        for(let i=result.length-1;i>=0;i--){
            const fip=result[i]
            const btn=fip.button?fip.button[buttonName]:undefined;
            if(!btn){
                return false;
            }
            if(btn.double){
                //return true;
            }
            if(btn.press && btn.just){
                if(!firstPress){
                    firstPress=true;
                }else{
                    //console.log('doublePress',buttonName,result.map((v)=>v.button!.attack));
                    return true
                }
            }
        }
        return false;
    }
}

export default pressHistory;