//
const XflipList: Record<string, number> = {
	"1": 3,
	"3": 1,
	"6": 4,
	"4": 6,
	"7": 9,
	"9": 7,
};
const nextTo: Record<string, number[]> = {
	"1": [2, 4],
	"2": [1, 3],
	"3": [2, 6],
	"4": [1, 7],
	"6": [3, 9],
	"7": [4, 8],
	"8": [7, 9],
	"9": [6, 8],
};

//623,26(236),426,6426,16,22,646,28,46,
//2426,8426

//fightingInput('623',['a','c'],['3','','2','3,a'])
type fightingInputCommand = {
	directions: string;
	buttons: string[] | string;
	needAllbuttons?: boolean;
	directionTimes?: number;
};

//export function fightingInput(directions:string,command.buttons:string[]|string,inputs:string[],flip:boolean=false,directionTimes:number=1):boolean{
export function fightingInput(command: fightingInputCommand, inputs: string[], flip: boolean = false): boolean {
	let directions = command.directions;
	if (flip) {
		directions = command.directions
			.split("")
			.map((v) => XflipList[v] ?? v)
			.join("");
	}
	if (command.directionTimes) {
		let temp = directions;
		for (let i = 1; i < command.directionTimes; i++) {
			directions += temp;
		}
	}
	for (let i = inputs.length - 1; i >= 0; i--) {
		const btns = inputs[i].split(",");
		let buttonOK = false;
		//let button:string='';
		let buttonPressed = 0;
		if (command.buttons.length === 0) {
			buttonOK = true;
		} else {
			for (const b of btns) {
				if (typeof command.buttons === "string") {
					if (command.buttons === b) {
						buttonOK = true;
						//button=b;
						break;
					}
				} else if (Array.isArray(command.buttons)) {
					if (command.buttons.includes(b)) {
						if (command.needAllbuttons) {
							buttonPressed++;
							if (buttonPressed === command.buttons.length) {
								buttonOK = true;
								break;
							}
							continue;
						}
						buttonOK = true;
						//button=b;
						break;
					}
				}
			}
		}
		if (buttonOK) {
			let dirStr = "";
			let lastDir = "";
			for (const b of btns) {
				if (parseInt(b) > 0 && b !== "5") {
					dirStr = lastDir = b;
					break;
				}
			}
			for (let j = i - 1; j >= 0; j--) {
				if (inputs[j].length > 1) {
					break;
				} else if (inputs[j].length === 1) {
					if (!(parseInt(inputs[j]) > 0)) {
						break;
					}
					/*
                    if(inputs[j]==='5'){
                        lastDir='5';
                    }else 
                    */
					if (inputs[j] != lastDir) {
						dirStr = inputs[j] + dirStr;
						lastDir = inputs[j];
					}
				} else {
					//dirStr='5'+dirStr;
					if (inputs[j] != lastDir) {
						dirStr = inputs[j] + dirStr;
						lastDir = inputs[j];
					}
					lastDir = "5";
				}
			}
			if (dirStr.length >= directions.length) {
				if (dirStr === directions) {
					return true;
				}
				//check [7]4[1]23[6] or 313 is fit to 623
				//*TBD
				let passed = 0;
				for (let kk = 0; kk < dirStr.length - directions.length + 1; kk++) {
					for (let k = kk; k < dirStr.length; k++) {
						if (
							dirStr[k] === directions[passed] ||
							nextTo[dirStr[k]]?.includes(parseInt(directions[passed]))
						) {
							passed++;
						} else {
							if (
								dirStr[k] === "5" ||
								(passed > 0 && dirStr[k] === directions[passed - 1]) ||
								nextTo[dirStr[k]]?.includes(parseInt(directions[passed - 1]))
							) {
								continue;
							}
							break;
						}
						if (passed === directions.length) {
							return true;
						}
					}
				}
			}
		}
	}
	return false;
}

export function fightingInputMulti(
	commands: Record<string, fightingInputCommand>,
	inputs: string[],
	flip: boolean = false,
): Record<string, boolean> {
	const result: Record<string, boolean> = {};
	for (const name in commands) {
		result[name] = fightingInput(commands[name], inputs, flip);
	}
	return result;
}

export function str2Command(str: string): fightingInputCommand | undefined {
	if (str.length === 0) {
		return undefined;
	}
	const reg = /^([\d]*)([a-zA-Z0-9\/+]*)$/g;
	const regre = reg.exec(str);
	if (regre && regre.length > 2) {
		let directions = regre[1];
		let buttons: string[] | string = regre[2];
		//let directionTimes=1;
		const needAllbuttons = buttons.includes("+");
		if (needAllbuttons) {
			buttons = buttons.split("+");
		} else if (buttons.includes("/")) {
			buttons = buttons.split("/");
		}
		console.log({
			directions,
			buttons,
			needAllbuttons,
		});
		return {
			directions,
			buttons,
			needAllbuttons,
		};
	}
	return undefined;
}
//*beta,not tested

/*
to do:
232唔會出到22
計算有幾多個miss

瞬獄殺?
*/
