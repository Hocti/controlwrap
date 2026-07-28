
			import {
				ControlWrap,
				GamepadMaster,
				ControlType,
				buttonLayout,
				gamepad_standardizer,
			} from "controlwrap";

			const output = document.getElementById("output");
			const glyphLegendEl = document.getElementById("glyph_legend");

			// Inject the controller + keyboard glyph webfonts (gamepad_fonts) once.
			// One call installs every @font-face, pad and keyboard alike.
			gamepad_standardizer.installPadFonts();

			// Xbox pads ship two looks: 'one' (grey chip) and '360' (coloured chip).
			// Everything re-renders on toggle, so it doubles as a font-swap demo.
			let xboxStyle = "one";
			document.getElementById("cb_xbox360").addEventListener("change", (e) => {
				xboxStyle = e.target.checked ? "360" : "one";
			});

			//controlwrap detects the controller family as a buttonLayout; that maps 1:1
			//onto a gamepad_fonts font id
			const LAYOUT_FONT_ID = {
				[buttonLayout.sony]: "playstation",
				[buttonLayout.nintendo]: "switch",
			};

			const padFontFamily = (index) => {
				const layout = cwi.getGamepadExtra(index)?.layout;
				const id = LAYOUT_FONT_ID[layout] ?? (xboxStyle === "360" ? "xbox-360" : "xbox-one");
				return gamepad_standardizer.fontFamily(id);
			};

			//a direction looks identical on every pad, so the four d-pad slots are drawn
			//from the one shared "common" sheet instead of the vendor-styled one
			const DPAD_SLOTS = ["up", "down", "left", "right"];

			const padGlyph = (index, sdlButtonName) => {
				//gamepad mappings hold SDL names ('a','leftshoulder','dpup'), and the
				//standard name order lines up 1:1 with the neutral font slots
				const slot = gamepad_standardizer.buttonSlot(
					gamepad_standardizer.SYSTEM_BUTTON_NAME.indexOf(sdlButtonName)
				);
				if (!slot) return "";
				if (DPAD_SLOTS.includes(slot)) {
					return `<span class="pad-glyph" style="font-family:'${gamepad_standardizer.COMMON_FONT_FAMILY}'">${gamepad_standardizer.directionGlyphChar("dpad", slot)}</span>`;
				}
				return `<span class="pad-glyph" style="font-family:'${padFontFamily(index)}'">${gamepad_standardizer.glyphChar(slot)}</span>`;
			};

			/** The live d-pad / stick state of one player, as three common-font glyphs. */
			const directionGlyphs = (input) => {
				const cell = (label, source, wrap, double) => {
					if (!wrap) return "";
					const char = gamepad_standardizer.directionGlyphChar(
						source,
						gamepad_standardizer.numpadDirection(wrap.numpad),
						double
					);
					return `<td>${label}<br /><span class="pad-glyph" style="font-family:'${gamepad_standardizer.COMMON_FONT_FAMILY}'">${char}</span></td>`;
				};
				return `<table><tr>
					${cell("dpad", "dpad", input.mixedDpad, input.doublePressDirection)}
					${cell("L", "lstick", input.analog)}
					${cell("R", "rstick", input.analog_right)}
				</tr></table>`;
			};

			const kbGlyph = (code) => {
				//keyboard mappings hold KeyboardEvent.code ('KeyW','Numpad8'); installPadFonts()
				//already injected the key-cap font alongside the pad ones
				const char = gamepad_standardizer.kbGlyphChar(code);
				if (!char) return "";
				return `<span class="kb-glyph" style="font-family:'${gamepad_standardizer.KEYBOARD_FONT_FAMILY}'">${char}</span>`;
			};

			/** Glyph for one mapped key, picking the font from the controller type. */
			const glyphOf = (index, keyName) => {
				const [cType] = cwi.parseIndex(index);
				return cType === ControlType.GAMEPAD ? padGlyph(index, keyName) : kbGlyph(keyName);
			};

			const cwi = ControlWrap.getInstance();

			cwi.wrappedInit({
				requirement: {
					direction: {
						dpad: true,
						analog: 2,
					},
					button: ["attack", "jump", "defend", "special"],
					optional: ["double", "command"],
					ui_optional: ["prevTab", "nextTab", "info"],
					ui_pair: {
						confirm: "attack",
						cancel: "jump",
					},
				},
				defaultGamePadmapping: {
					attack: "x",
					jump: "a",
					defend: "b",
					special: "y",

					//optional
					double: "leftshoulder",
					command: "rightshoulder",

					/*
                ui button no need to assign in gamepad
                //ui
                'info':'back',
                'prevTab':'leftshoulder',
                'nextTab':'rightshoulder',
                */
				},
				defaultKeyboardmappings: [
					{
						up: "KeyW",
						down: "KeyS",
						left: "KeyA",
						right: "KeyD",

						attack: "KeyF",
						jump: "KeyG",
						defend: ["KeyH", "KeyB"],
						special: "KeyR",

						double: "ShiftLeft",
						info: "Tab",
						command: "KeyQ",
						prevTab: "KeyQ",
						nextTab: "KeyE",
					},
					{
						up: "KeyI",
						down: "KeyK",
						left: "KeyJ",
						right: "KeyL",

						attack: "KeyP",
						jump: "BracketLeft",
						defend: "BracketRight",
						special: "Semicolon",
					},
				],
				mouse: true,
			});

			/*
        console.log(cwi.getMappableKeys(0))
        console.log(cwi.getMappableKeys(2))
        console.log(cwi.getAllMapping(0))
        console.log(cwi.getAllMapping(1))
        */

			cwi.setAllMapping(2, {
				up: "Numpad8",
				down: "Numpad2",
				left: "Numpad4",
				right: "Numpad6",
				attack: "Numpad5",
				jump: "Numpad1",
				defend: "Numpad3",
				special: "Numpad0",
			});

			let f = 0;

			/** Wrap pre-rendered markup so dict2Table prints it instead of JSON. */
			const rawHTML = (html) => ({ __html: html });

			/** The mapping table, with each mapped key shown as its glyph + name. */
			const mapping2Table = (index, mapping) => {
				let h = `<table>`;
				for (let btnName in mapping) {
					const keys = [].concat(mapping[btnName] ?? []);
					const cells = keys
						.map((key) => `${glyphOf(index, key)}<span class="key-name">${key}</span>`)
						.join(" / ");
					h += `<tr><td>${btnName}</td><td>${cells}</td></tr>`;
				}
				return h + `</table>`;
			};

			/** Every standard button of each connected pad, in that pad's own font. */
			const glyphLegend = () => {
				let h = "";
				for (const index of cwi.getIndexs()) {
					const [cType] = cwi.parseIndex(index);
					if (cType !== ControlType.GAMEPAD) continue;
					const chips = gamepad_standardizer.SYSTEM_BUTTON_NAME.map((name) =>
						padGlyph(index, name)
					).join("");
					h += `<div>${index}: ${cwi.getName(index)}<br />${chips}</div>`;
				}
				return h;
			};

			const dict2Table = (dict) => {
				let h = `<table>`;
				for (let key in dict) {
					if (dict[key] && dict[key].__html !== undefined) {
						h += `<tr>
                    <td>${key}</td>
                    <td>${dict[key].__html}</td>
                    </tr>`;
					} else if (dict[key] && dict[key].constructor == Object) {
						h += `<tr>
                    <td>${key}</td>
                    <td>${dict2Table(dict[key])}</td>
                    </tr>`;
					} else {
						h += `<tr>
                    <td>${key}</td>
                    <td>${JSON.stringify(dict[key])}</td>
                    </tr>
                    `;
					}
				}
				h += `</table>`;
				return h;
			};
			let lastH = "";
			let lastLegend = "";
			let framePassed = 0;
			const etf = () => {
				let h = "";

				//full flush, not uiOnly — the direction glyphs below need the dpad/analog state
				const all = cwi.update(false);

				h += `<h1>Main player id:${cwi.mainControllerIndex}</h1>`;

				for (let index in all.player) {
					const indexNum = parseInt(index);
					const input = all.player[indexNum];
					const extra = {};
					extra["type"] = "player";
					extra["index"] = indexNum;
					extra["name"] = cwi.getName(indexNum);

					const mapping = cwi.getAllMapping(indexNum);

					h += dict2Table({
						type: "player",
						index: indexNum,
						name: cwi.getName(indexNum),
						direction: rawHTML(directionGlyphs(input)),
						...input,
						mapping: rawHTML(mapping2Table(indexNum, mapping)),
					});
				}

				if (all.mouse) {
					h += dict2Table({
						type: "mouse",
						...all.mouse,
					});
				}

				h += dict2Table({
					type: "system keyboard",
					...all.system,
				});

				h += dict2Table({
					type: "ui mixed",
					...all.ui,
				});

				if (all.ui.ui_tap.length != 0) {
					console.log("framePassed", framePassed, all.ui.ui_tap);
				}

				if (lastH != h) {
					output.innerHTML = h;
					lastH = h;
				}

				const legend = glyphLegend();
				if (lastLegend != legend) {
					glyphLegendEl.innerHTML = legend;
					lastLegend = legend;
				}
				//output_f.innerHTML=++f
				framePassed++;
			};
			setInterval(etf, 1000 / 60);

			document.getElementById("btn_listen_controller").addEventListener("click", () => {
				const index = parseInt(document.getElementById("ip_index").value);
				console.log(index);

				cwi.listenKeyFromControllerIndex(index)
					.then((key_name) => {
						console.log("key_name", key_name);
					})
					.catch(function (error) {
						console.log("catch", error);
					});
			});

			//cwi.allowMainPlayerUseAllController=true;

			document.getElementById("btn_listen_attack").addEventListener("click", () => {
				cwi.listenControllerIndexFromKeys(["attack", "start", "cancel"])
					.then((controller_index) => {
						console.log("controller_index", controller_index);
						cwi.mainControllerIndex = controller_index;
					})
					.catch(function (error) {
						console.log("catch", error);
					});
			});

			const mapAllInConsole = async (index) => {
				const [cType] = cwi.parseIndex(index);
				const buttonNames = cwi.getMappableKeys(index);

				const newMapping = {};
				let breakFlag = false;
				for (let btnName of buttonNames.buttons) {
					console.info("please press", btnName);
					await cwi
						.listenKeyFromControllerIndex(index)
						.then((key_name) => {
							console.log("mapped", btnName, key_name);
							newMapping[btnName] = key_name;
						})
						.catch(function (error) {
							breakFlag = true;
							//console.log('catch',error);
						});
					if (breakFlag) {
						console.log("mapping cancel");
						return Promise.reject("mapping cancel");
					}
				}
				for (let btnName of buttonNames.optional) {
					console.info("please press", btnName, "(press start or escape to skip)");
					await cwi
						.listenKeyFromControllerIndex(index)
						.then((key_name) => {
							console.log("key_name", key_name);
							newMapping[btnName] = key_name;
						})
						.catch(function (error) {
							console.info("skiped ", btnName);
						});
				}
				console.info("finish mapping:", newMapping);
				return newMapping;
			};

			document.getElementById("btn_map_all").addEventListener("click", () => {
				const index = parseInt(document.getElementById("ip_index").value);

				const oldMapping = cwi.getAllMapping(index);

				mapAllInConsole(index)
					.then((newMapping) => {
						cwi.setAllMapping(index, newMapping);
					})
					.catch(function (error) {
						console.log("catch cancel", error);
					});
			});

			document.getElementById("btn_reset_Default").addEventListener("click", async () => {
				const index = parseInt(document.getElementById("ip_index").value);
				cwi.resetDefault(index);
			});

			/*
        //TODO : mapping with long press bug, should be jump to next step mapping when the button released
        const mappingRaw=async(index,analog=2)=>{
            if(analog>2){
                console.log('max 2 analog')
                return;
            }
            const [cType,cIndex]=cwi.parseIndex(index);
            const gpExtra=gmi.getGamepadExtra(cIndex)
            if(!gpExtra){
                console.log('no gamepad')
                return;
            }
            if(gpExtra.info.standard){
                console.log('standard gamepad no need to mapping')
                //return;
            }
            const maxAxes=gpExtra.info.originInfo.axes.length;
            const maxBtn=gpExtra.info.originInfo.buttons.length;
            if(maxAxes<analog*2){
                console.log('analog not enough')
                return;
            }
        
            const usedButton=new Set();
            const usedAxes=new Set();
            const usedHat=new Set();
        
            let btn_mapping={};
            let axes_mapping={};
            let hat_mapping={};
        
            let step=1;
            let quit=false;
        
            const directions=['up','down','left','right']
            let currDpadIndex=0
        
            const analogs=['left','right']
            let currAnalogIndex=0
            let currAnalogXYIndex=0
        
            const ab=['a','b']
            let currABIndex=0
            const otherButtons=['x','y','leftshoulder','rightshoulder','lefttrigger','righttrigger','back','leftstick','rightstick']
            let currOtherIndex=0
            let dpadType='';
        
            gmi.saveAllRelaseGPState(cIndex);
        
            do{
                if(step===1){//start
                    console.info('press start button (press keyboard esc to cancel)')
                    await gmi.listenRaw(cIndex,true,false).then((e)=>{
                        btn_mapping['start']=e.button_index;
                        usedButton.add(e.button_index);
                        console.info('mapped start button to: '+e.button_index)
        
                        step++;
        
                    }).catch(function(error) {
                        quit=true;
                    })
                }
                
                if(step===2){//dpad
                    console.info(`press dpad ${directions[currDpadIndex]} (press keyboard esc to cancel)`)
                    await gmi.listenRaw(cIndex,true,true).then((e)=>{
                            console.log(e)
                        if(e.type==='button'){
                            if(usedButton.has(e.button_index)){
                                return;
                            }
                            btn_mapping[directions[currDpadIndex]]=e.button_index;
                            usedButton.add(e.button_index);
                            currDpadIndex++;
                            dpadType='button';
                        }else if(e.type==='axes'){
                            const axesName=`${e.Operation}${e.axes_index}`;
                            if(usedAxes.has(axesName)){
                                return;
                            }
        
                            usedAxes.add(axesName);
                            axes_mapping[directions[currDpadIndex]]=axesName;
        
                            currDpadIndex++;
                            const axesName2=`${e.Operation=='+'?'-':'+'}${e.axes_index}`;
                            axes_mapping[directions[currDpadIndex]]=axesName2;
                            usedAxes.add(axesName2);
        
                            currDpadIndex++;
                            dpadType='axes';
        
                        }else if(e.type==='hat'){
                            if(usedHat.has(e.HNum)){
                                return;
                            }
        
                            dpadType='hat';
                            axes_mapping['hat']=e.axes_index;
                            usedAxes.add(e.axes_index);
        
                            usedHat.add(e.HNum);
                            hat_mapping[directions[currDpadIndex]]=e.HNum;
        
                            currDpadIndex++;
                            const hat2=gamepad_standardizer.oppositeDpad[e.HNum];
                            hat_mapping[directions[currDpadIndex]]=hat2;
                            usedHat.add(hat2);
        
                            currDpadIndex++;
                        }
                                        
                        console.info(e)
                    }).catch(function(error) {
                        console.log('step2 catch',error);
                        quit=true;
                    })
                    if(currDpadIndex>=directions.length){
                        step++;
                    }
                }
        
                if(step===3){//analog
                    if(currAnalogIndex>=analog){
                        step++;
                        continue;
                    }
        
                    console.info(`push ${analogs[currAnalogIndex]} analog ${directions[currAnalogXYIndex]} (press keyboard esc to quit)`)
                    await gmi.listenRaw(cIndex,false,true).then((e)=>{
                            const axesName=`${e.Operation}${e.axes_index}`;
                            if(usedAxes.has(axesName)){
                                return;
                            }
        
                            usedAxes.add(axesName);
                            axes_mapping[`${analogs[currAnalogIndex]}${directions[currAnalogXYIndex]}`]=axesName;
        
                            currAnalogXYIndex++;
                            const axesName2=`${e.Operation=='+'?'-':'+'}${e.axes_index}`;
                            axes_mapping[`${analogs[currAnalogIndex]}${directions[currAnalogXYIndex]}`]=axesName2;
                            usedAxes.add(axesName2);
        
                            currAnalogXYIndex++;
                    }).catch(function(error) {
                        quit=true;
                    })
                    if(currAnalogXYIndex>=directions.length){
                        currAnalogIndex++;
                        currAnalogXYIndex=0;
                    }
                }
        
                //confirm,cancel=a,b
                //1) [right side panel] button on down side
                //2) the button on (1) right side
                if(step===4){
                    console.info(`press ${ab[currABIndex]} (press keyboard esc to cancel)`)
                    await gmi.listenRaw(cIndex,true,false).then((e)=>{
                        if(usedButton.has(e.button_index)){
                            return;
                        }
                        btn_mapping[ab[currABIndex]]=e.button_index;
                        usedButton.add(e.button_index);
                        currABIndex++;
                    }).catch(function(error) {
                        quit=true;
                    })
                    if(currABIndex>=ab.length){
                        step++;
                    }
                }
        
                if(step===5){//optional button
                    console.info(`press ${otherButtons[currOtherIndex]} (press keyboard esc or gamepad start to skip)`)
                    await gmi.listenRaw(cIndex,true,false).then((e)=>{
                        if(e.button_index===btn_mapping['start']){
                            btn_mapping[otherButtons[currOtherIndex]]=undefined;
                            currOtherIndex++
                            return;
                        }
                        if(usedButton.has(e.button_index)){
                            return;
                        }
                        btn_mapping[otherButtons[currOtherIndex]]=e.button_index;
                        usedButton.add(e.button_index);
                        currOtherIndex++
                    }).catch(function(error) {
                        btn_mapping[otherButtons[currOtherIndex]]=undefined;
                        currOtherIndex++
                    })
                    if(currOtherIndex>=otherButtons.length || usedButton.size==maxBtn){
                        step++
                    }
                }
                
                if(quit){
                    console.log('mapping cancel')
                    return Promise.reject('mapping cancel');
                }
            }while(step<6)
            
            return {
                btn_mapping,
                axes_mapping,
                hat_mapping
            };
        }
        
        document.getElementById("map_raw_btn").addEventListener('click',async()=>{
            const index=parseInt(document.getElementById("ip_index").value);
            
        
            //set set layout (for swapAB)
            //set analog 0~2
        
            mappingRaw(index,2).then((e)=>{
                console.log('map result',e)
            }).catch(function(error) {
                console.log('map unchange')
            })
        
        })
        */