export const GAMPEPAD_INDEX_OFFSET:number=100;
export const SYSTEM_INDEX_OFFSET:number=1000;
export const UI_INDEX_OFFSET:number=2000;

export const KEYBOARD_HARDCODE_UI_BUTTON:Record<string,string>={
    up:'ArrowUp',
    down:'ArrowDown',
    left:'ArrowLeft',
    right:'ArrowRight',
    confirm:'Enter',
    escape:'Escape',
}

export enum buttonLayout {
    xbox='xbox',
    sony='sony',
    nintendo='nintendo',
    unknown='unknown',
    keyboard='keyboard',
}