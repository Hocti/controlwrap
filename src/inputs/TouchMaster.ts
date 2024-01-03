import {IControllerMaster} from './IControllerMaster';

export default class TouchMaster extends EventTarget implements IControllerMaster<KeyboardController,KeyboardInputType,KeyboardMappingType>{

    protected static instance: TouchMaster;
    public static getInstance(): TouchMaster {
        if (!TouchMaster.instance) {
            TouchMaster.instance = new TouchMaster();
        }

        return TouchMaster.instance;
    }

    //================================================================
    
    protected constructor(){
        super();
    }

    public listen(){
        
    }
    
    public count():number{
        return 1;
    }
    
    //*
    public getById(id:number=0):KeyboardController | undefined{
        return undefined;
    }
    
    public getAllInput():(KeyboardInputType | undefined)[]{
        let result:(KeyboardInputType | undefined)[]=[];
        for(let i=0;i<this.totalKeyboard;i++){
            result[i]=this.getInput(i);
        }
        return result;
    }
    
    //* 
    public getInput(id:number):(KeyboardInputType | undefined){
        return undefined;
    }
    
    //* 
	public importMaping(maping:KeyboardMappingType):void{
        
    }

    //* 
	public getEditableMappingKeys(id:number):Record<string,string>{
        return {};
    }

	public setAllMapping(id:number,mapping:Record<string,string>):void{
        for(let key in mapping){
            this.setMapping(id,key,mapping[key]);
        }
    }

    //* 
	public setMapping(id:number,key:string,value:string):void{
        
    }

    //*
    public flushAll():(KeyboardInputType | undefined)[]{
        return this.getAllInput();
    }

    //* 
    public async listenControllerIndexFromKeys(btnName:string):Promise<number>{
        return 0;
    }

    //=======================

    private hElement?:HTMLElement;
    private display:boolean=false;

    public setElement(element:HTMLElement){
        this.hElement=element;
    }

    public show(layout?:string){
        if(layout){
            this.updateLayout(layout)
        }
        this.display=true;
    }

    public updateLayout(layout:string){
        
    }

    public hide(){
        this.hElement!.innerHTML='';
        this.display=false;
    }

}



export class KeyboardController{

    constructor(){

    }



}