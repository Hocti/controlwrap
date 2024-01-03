import { stopEvent } from "../utils/utils";

const mousefn=(event: MouseEvent) => {
    console.log(`${event.type}: 
    ${event.clientY}, ${event.pageY}, ${event.offsetY  }, ${event.screenY }, 
    ${event.buttons.toString(2)},${event.button}`);
    //client=window x
    //page=page
    //offset=element
}

document.oncontextmenu = function(e){
    stopEvent(e);
}

window.addEventListener("mousemove", (event: MouseEvent) => {
    console.log(`Mouse move: ${event.clientX}, ${event.clientY}`);
});

window.addEventListener("mousedown", (event: MouseEvent) => {
    console.log(`Mouse down: ${event.button}`);
});
window.addEventListener("mouseup", (event: MouseEvent) => {
    console.log(`${event.type}: ${event.button}`);
});

window.addEventListener("mouseout", (event: MouseEvent) => {
    console.log(`${event.type}: ${event.button}`);
});