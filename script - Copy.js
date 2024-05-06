let room_bottom = null; //2d array for currently loaded room. each cell is {bool traversible, int goal(0=nogoal)}
let room_top = null; //2d array for entities that can move
let room_bottom_elements = null;
let room_top_elements = null;
let width = null;
let height = null;
let input_disabled = true;
let transition_time = 500;
let mini_time = 50;
let in_transition = true;
let loaded_room_index = null;
let user_settings = {};

let subtitle_text = document.querySelector("#subtitle_text");
let display = document.querySelector("table#display");
let editor_toolbox = document.querySelector("#editor_toolbox");
let editor_errors_list = document.querySelector("#editor_errors_list");
let editor_mode_button = document.querySelector("#editor_mode_button");

let all_rooms = []; //dictionary for rooms. each room is {data_top (using chars), data_bottom (using chars)}
let campaign_metadata = {};
let mouse_down = false;
document.body.onmousedown = function(){mouse_down = true;}
document.body.onmouseup = function(){mouse_down = false;}
let url_parameters = {};
if (location.search) {
	for (pair of location.search.substring(1).split(",")) {
		let [key, val] = pair.split(":");
		url_parameters[key] = val;
	}
}
let editor_mode = "edit"; //edit: can place tiles, changes are saved into room data      play: can move around

/*
TODO
- don't use that dumb transition_time hack to make expand_level not wait for the full transition. pick out a function that literally creates the td and img. and call that
- level editor handling metadata At All
*/

function open_room(index, coming_from = "left") {
	loaded_room_index = index;
	let this_room = all_rooms[index];
	if (!this_room) return;
	arch_top["~"].img = coming_from == "left" ? "duckieright.png" : "duckieleft.png";
	//other things on screen
	set_subtitle();
	subtitle_text.style.opacity = "1";
	//do art directory
	determine_art_directory(index);
	//set room_bottom and room_top
	if (this_room.room_bottom && this_room.room_top) { //if this room has already been saved
		room_bottom = this_room.room_bottom;
		room_top = this_room.room_top;
	} else { //room has no .room_bottom/top attributes, so this is first time loading. use data
		let data_bottom = this_room.data_bottom;
		let data_top = this_room.data_top;
		room_bottom = [];
		room_top = [];
		for (data_row of data_bottom.split("|")) {
			let row = [];
			for (character of data_row.split(""))
				row.push(arch_bottom[character]);
			room_bottom.push(row);
		}
		for (data_row of data_top.split("|")) {
			let row = [];
			for (character of data_row.split(""))
				row.push(arch_top[character]);
			room_top.push(row);
		}
		this_room.room_bottom = room_bottom;
		this_room.room_top = room_top;
		//get rid of all players that already exist in room, unless first room
		if (index) for (row of room_top) for (let i = 0; i < row.length; i++) if (row[i].player) row[i] = arch_top["."];
	}
	height = room_bottom.length;
	width = room_bottom[0].length;
	//place players on appropriate exits
	if (!campaign_metadata.editor || editor_mode == "play") for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
		if (coming_from == room_bottom[y][x].exit) {
			room_top[y][x] = arch_top["~"];
		}
	}
	/*if (coming_from == "bottom") for (let x = 0; x < width; x++) if (room_bottom[height-1][x].exit) room_top[height-2][x] = arch_top["~"];
	if (coming_from == "top") for (let x = 0; x < width; x++) if (room_bottom[0][x].exit) room_top[1][x] = arch_top["~"];
	if (coming_from == "left") for (let y = 0; y < height; y++) if (room_bottom[y][0].exit) room_top[y][1] = arch_top["~"];
	if (coming_from == "right") for (let y = 0; y < height; y++) if (room_bottom[y][width-1].exit) room_top[y][width-2] = arch_top["~"];*/
	//other level data
	while (display.firstChild) display.firstChild.remove();
	//make table with images, bottom and top layers
	room_bottom_elements = [];
	room_top_elements = [];
	for (let y = 0; y < height; y++) {
		let tr = display.appendChild(document.createElement("tr"));
		room_bottom_elements[y] = [];
		room_top_elements[y] = [];
		for (let x = 0; x < width; x++) {
			let td = tr.appendChild(document.createElement("td"));
			room_bottom_elements[y][x] = td;
			visual_update_bottom(y, x);
			let img = td.appendChild(document.createElement("img"));
			td.setAttribute("onmousedown", "click_cell("+y+","+x+");");
			td.setAttribute("onmouseenter", "if (mouse_down) click_cell("+y+","+x+");");
			td.setAttribute("parity", (y+x)%2);
			room_top_elements[y][x] = img;
			visual_update_top(y, x);
		}
	}
	if (campaign_metadata.editor) { //create ui around table
		let top_row = display.querySelector("tr");
		let td_left = top_row.insertBefore(document.createElement("td"), top_row.firstChild);
		td_left.setAttribute("class", "for_editor");
		td_left.setAttribute("rowspan", height);
		let td_right = top_row.appendChild(document.createElement("td"));
		td_right.setAttribute("class", "for_editor");
		td_right.setAttribute("rowspan", height);
		let tr_up = display.insertBefore(document.createElement("tr"), display.firstChild);
		let td_up = tr_up.appendChild(document.createElement("td"));
		td_up.setAttribute("class", "for_editor");
		td_up.setAttribute("colspan", width+2);
		let tr_down = display.appendChild(document.createElement("tr"));
		let td_down = tr_down.appendChild(document.createElement("td"));
		td_down.setAttribute("class", "for_editor");
		td_down.setAttribute("colspan", width+2);
		expansion_button(td_left, "west", "left");
		expansion_button(td_right, "east", "right");
		expansion_button(td_up, "north", "up");
		expansion_button(td_down, "south", "down");
		/*expansion_button(td_left, "fullscreen_exit", "shrink-left");
		expansion_button(td_right, "fullscreen_exit", "shrink-right");
		expansion_button(td_up, "fullscreen_exit", "shrink-up");
		expansion_button(td_down, "fullscreen_exit", "shrink-down");*/
		expansion_button(td_left, "east", "negative-left");
		expansion_button(td_right, "west", "negative-right");
		expansion_button(td_up, "south", "negative-up");
		expansion_button(td_down, "north", "negative-down");
		function expansion_button(td, text, direction) {
			let button = td.appendChild(document.createElement("button"));
			button.setAttribute("class", "icon");
			button.innerText = text;
			button.setAttribute("onclick", "expand_level('"+direction+"');");
		}
	}
	//load metadata for editor
	for (input_element of document.querySelectorAll("#editor_metadata input[tier=\"room\"]")) {
		input_element.value = this_room[input_element.getAttribute("key")] ? this_room[input_element.getAttribute("key")] : "";
	}
	display.style.animation = transition_time + "ms title_enter";
	player_input(0, 0, true);
	sfx("room_up");
	setTimeout(function(){
		input_disabled = false;
		in_transition = false;
	}, transition_time);
}

function set_subtitle() {
	subtitle_text.innerHTML = all_rooms[loaded_room_index].extra_text ? all_rooms[loaded_room_index].extra_text + "<br>" : "";
	subtitle_text.innerHTML += (loaded_room_index + 1) + "/" + all_rooms.length;
}

function visual_update_bottom(y, x) {
	room_bottom_elements[y][x].setAttribute("background", full_image_url(room_bottom[y][x].img));
}
function visual_update_top(y, x) {
	room_top_elements[y][x].setAttribute("src", full_image_url(room_top[y][x].img));
}

function room_transition(index, coming_from = "left") { //actually call this to change room. open_room is called here
	if (in_transition) return;
	if (!all_rooms[index]) return;
	room_down();
	setTimeout(function(){
		open_room(index, coming_from);
	}, transition_time);
}

function room_down() {
	sfx("room_down");
	in_transition = true;
	input_disabled = true;
	subtitle_text.style.opacity = 0;
	for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (room_top[y][x].player) room_top[y][x] = arch_top["."]; //delete all players before saving
	display.style.animation = transition_time + "ms title_exit"
	setTimeout(function(){
		for (td of display.querySelectorAll("td")) {
			td.style.opacity = "0";
		}
	}, transition_time - mini_time);
}

function reset_room(short_transition = false) {
	delete all_rooms[loaded_room_index].room_bottom;
	delete all_rooms[loaded_room_index].room_top;
	if (short_transition) {
		//mess with transition_time to go fast
		let save_transition_time = transition_time;
		transition_time = 0;
		setTimeout(function(){
			transition_time = save_transition_time;
		}, mini_time);
	}
	//do the room reload
	room_transition(loaded_room_index, "left");
}

document.onkeydown = function(event) {
	if (input_disabled) return;
	if (event.target.tagName.toLowerCase() == "input") return;
	switch (event.keyCode) {
		case 65: case 37:
			player_input(0, -1);
			break;
		case 68: case 39:
			player_input(0, 1);
			break;
		case 40: case 83:
			player_input(1, 0);
			break;
		case 87: case 38:
			player_input(-1, 0);
			break;
		case 32:
			player_input(0, 0);
			break;
		case 82:
			reset_room();
			break;
		case 16:
			display.setAttribute("shift_key", "true");
			break;
	}
}

document.onkeyup = function(event) {
	switch (event.keyCode) {
		case 16:
			display.setAttribute("shift_key", "false");
			break;
	}
}

let arch_bottom = {
	//nothing's there
	".": {img: "empty.png"},
	"i": {img: "ice.png", slippery: true},
	"X": {img: "whirlpool.png", deadly: true},
	"x": {img: "babywhirlpool.png", becomes_on_walk: "X"},
	//"C": {img: "crack2.png", stop: true},
	//"c": {img: "crack1.png", becomes: "N"},
	//goals
	"1": {img: "fishhome.png", goal: 1}, /* , stack_becomes_trigger: "1", stack_becomes_bottom: ".", stack_becomes_top: "." */
	"2": {img: "goal2.png", goal: 2},
	"3": {img: "jellyfishhome.png", goal: 3},
	//boxdoor
	"4": {img: "fishdoorclosed.png", boxdoor: 1},
	"5": {img: "boxdoor2closed.png", boxdoor: 2},
	"6": {img: "jellyfishdoorclosed.png", boxdoor: 3},
	"7": {img: "fishdooropen.png", boxdoor: 1, invert: true},
	"8": {img: "boxdoor2open.png", boxdoor: 2, invert: true},
	"9": {img: "jellyfishdooropen.png", boxdoor: 3, invert: true},
	//exit
	">": {img: "nextroom.png", exit: "right", stop_boxes: true},
	"<": {img: "prevroom.png", exit: "left", stop_boxes: true},
	//two-state alternate
	"[": {img: "twostatebad.png", becomes_on_walk: "]", must_collect: true},
	"]": {img: "twostategood.png", becomes_on_walk: "["},
	//stops!
	"!": {img: "cattail.png", stop: true},
	"@": {img: "lilypad.png", stop: true},
	"#": {img: "babycattail.png", becomes_on_walk: "!"},
	"$": {img: "babybabycattail.png", becomes_on_walk: "#"},
};

let arch_top = {
	//nothing's there
	".": {img: "empty.png"},
	//something immovable is there
	//boxen
	"1": {img: "fish.png", box: 1},
	"2": {img: "box2.png", box: 2},
	"3": {img: "jellyfish.png", box: 3, stop: true},
	//people
	"~": {img: "duckieright.png", player: true, stop: true},
	"?": {img: "girlduckieright.png", wanderer: true, stop: true},
	//collect
	"$": {img: "bread.png", must_collect: true, stop_boxes: true}
};
let box_data_to_weight = {"1":1,"2":0.000000001,"3":1};
let box_data_pushing = [1, 2, 3];
let box_data_pulling = [3];
let box_satisfied = {"1":true,"2":true,"3":true};
let must_collect_satisfied = true;

for (catalogue of [arch_bottom, arch_top]) for (character of Object.keys(catalogue)) {
	catalogue[character].character = character; //put these identifying characters into the objects. just in case i want to access them
}

function player_input(input_dy, input_dx, only_do_static_checks = false) {
	if (!only_do_static_checks && input_disabled) return;
	if (!only_do_static_checks && campaign_metadata.editor && editor_mode != "play") return;
	if (input_dx > 0) arch_top["~"].img = "duckieright.png";
	if (input_dx < 0) arch_top["~"].img = "duckieleft.png";
	let [girl_dy, girl_dx] = [[1,0],[-1,0],[0,1],[0,-1]][Math.floor(Math.random()*4)]; //the motion for the wandering girl duck
	if (girl_dx > 0) arch_top["?"].img = "girlduckieright.png";
	if (girl_dx < 0) arch_top["?"].img = "girlduckieleft.png";
	//move the players and wanderers
	if (!only_do_static_checks) for ([creature, [dy, dx]] of [["player", [input_dy, input_dx]], ["wanderer", [girl_dy, girl_dx]]]) { //for each pass of this movement code
		let [y_start, y_end, y_step] = dy < 0 ? [0, height - 1, 1] : [height - 1, 0, -1];
		let [x_start, x_end, x_step] = dx < 0 ? [0, width - 1, 1] : [width - 1, 0, -1];
		for (let y = y_start; y != y_end + y_step; y += y_step) {
			for (let x = x_start; x != x_end + x_step; x += x_step) {
				if (!room_top[y][x][creature]) continue;
				let new_y = y + dy;
				let new_x = x + dx;
				if (space_blocked_but_allowing_boxes(new_y, new_x)) {
					visual_update_top(y, x);
					continue;
				}
				//we are walking into walkable, box, or box-stoppable
				//do player motion
				if (box_data_pushing.includes(room_top[new_y][new_x].box)) { //if walking into box
					//at present, x,y=player, new=first box, super=final box
					let total_box_weight = box_data_to_weight[room_top[new_y][new_x].box]; //the weights from boxes bein moved
					if (dy < -1) dy = -1; if (dy > 1) dy = 1; if (dx < -1) dx = -1; if (dx > 1) dx = 1;
					let super_y = new_y + dy;
					let super_x = new_x + dx;
					if (space_blocked_but_allowing_boxes(super_y, super_x)) continue;
					if (room_top[super_y][super_x].stop_boxes || room_bottom[super_y][super_x].stop_boxes) continue;
					while (room_top[super_y][super_x].box && !space_blocked_but_allowing_boxes(super_y+dy, super_x+dx)) {
						total_box_weight += box_data_to_weight[room_top[super_y][super_x].box];
						super_y += dy;
						super_x += dx;
					}
					if (total_box_weight > 1) continue;
					if (room_top[super_y][super_x].box) continue; //try to push 2+ boxes but super space blocked
					room_top[super_y][super_x] = room_top[new_y][new_x];
					room_top[new_y][new_x] = room_top[y][x];
					room_top[y][x] = arch_top["."];
					visual_update_top(super_y, super_x);
					visual_update_top(new_y, new_x);
					visual_update_top(y, x);
					sfx("pushbox");
				} else { //validly walking into something else. in theory a nothing top or a box-stoppable
					//while slipping on ice (or the beyond is too much) lets slip and slide
					while (room_bottom[new_y][new_x].slippery && !space_blocked(new_y+dy, new_x+dx)) [new_y, new_x] = [new_y + dy, new_x + dx];
					room_top[new_y][new_x] = room_top[y][x];
					room_top[y][x] = arch_top["."];
					visual_update_top(new_y, new_x);
					visual_update_top(y, x);
				}
				//check if we're pulling
				if (!oob(y-dy,x-dx) && box_data_pulling.includes(room_top[y-dy][x-dx].box)) {
					room_top[y][x] = room_top[y-dy][x-dx];
					room_top[y-dy][x-dx] = arch_top["."];
					visual_update_top(y-dy, x-dx);
					visual_update_top(y, x);
					sfx("pushbox");
				}
				//affect floor behind us
				if (room_bottom[y][x].becomes_on_walk) {
					room_bottom[y][x] = arch_bottom[room_bottom[y][x].becomes_on_walk];
					visual_update_bottom(y, x);
				}
				//check for death
				if (room_bottom[new_y][new_x].deadly) {
					reset_room();
				}
			}
		}
	}
	//do box + must_collect checks
	box_satisfied = {"1":true,"2":true,"3":true};
	must_collect_satisfied = true;
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (room_bottom[y][x].goal && room_bottom[y][x].goal != room_top[y][x].box) {
				box_satisfied[room_bottom[y][x].goal] = false;
			}
			if (room_top[y][x].must_collect || room_bottom[y][x].must_collect) must_collect_satisfied = false;
		}
	}
	//non inverted box doors
	arch_bottom["4"].stop = !box_satisfied["1"];
	arch_bottom["5"].stop = !box_satisfied["2"];
	arch_bottom["6"].stop = !box_satisfied["3"];
	arch_bottom["4"].img = !box_satisfied["1"] ? "fishdoorclosed.png" : "fishdooropen.png";
	arch_bottom["5"].img = !box_satisfied["2"] ? "boxdoor2closed.png" : "boxdoor2open.png";
	arch_bottom["6"].img = !box_satisfied["3"] ? "jellyfishdoorclosed.png" : "jellyfishdooropen.png";
	//inverted box doors
	arch_bottom["7"].stop = box_satisfied["1"];
	arch_bottom["8"].stop = box_satisfied["2"];
	arch_bottom["9"].stop = box_satisfied["3"];
	arch_bottom["7"].img = box_satisfied["1"] ? "fishdoorclosed.png" : "fishdooropen.png";
	arch_bottom["8"].img = box_satisfied["2"] ? "boxdoor2closed.png" : "boxdoor2open.png";
	arch_bottom["9"].img = box_satisfied["3"] ? "jellyfishdoorclosed.png" : "jellyfishdooropen.png";
	//must_collect
	arch_bottom[">"].img = must_collect_satisfied ? "nextroom.png" : "nextroomdisabled.png";
	arch_bottom[">"].stop = !must_collect_satisfied;
	for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (room_bottom[y][x].boxdoor || room_bottom[y][x].exit) visual_update_bottom(y, x);
	let coming_from = {
		"0": "left",
		"-2": "bottom",
		"3": "right",
		"2": "top"
	}[Math.round(Math.atan2(input_dy, input_dx))];
	if (Math.abs(input_dx)+Math.abs(input_dy)==0) coming_from = "static";
	if (!only_do_static_checks) sfx(coming_from);
	//do auxiliary functions on room layout
	for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
		let bottom = room_bottom[y][x];
		let top = room_top[y][x];
		//stack_becomes_trigger, stack_becomes_bottom, stack_becomes_top
		if (arch_top[bottom.stack_becomes_trigger] == top) {
			if (bottom.stack_becomes_bottom) {
				room_bottom[y][x] = arch_bottom[bottom.stack_becomes_bottom];
				visual_update_bottom(y, x);
			}
			if (bottom.stack_becomes_top) {
				room_top[y][x] = arch_top[bottom.stack_becomes_top];
				visual_update_top(y, x);
			}
		}
	}
	//exit check
	let all_exits_have_player = {left: true, right: true};
	for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (room_bottom[y][x].exit) {
		if (!room_top[y][x].player) all_exits_have_player[room_bottom[y][x].exit] = false;
	}
	if (coming_from != "static") if (!only_do_static_checks)
	if (all_exits_have_player.left || all_exits_have_player.right) { //ok we are going somewhere!
		let destination = loaded_room_index;
		if (all_exits_have_player.right) destination++; else destination--;
		let coming_from_direction = "";
		if (all_exits_have_player.right) coming_from_direction = "left"; else coming_from_direction = "right";
		if (all_rooms[destination]) { //going to room that exists
			room_transition(destination, coming_from_direction);
		} else if (campaign_metadata.editor) { //room that doesn't exist. as editor, go to mode
			swap_editor_mode();
		} else if (destination == all_rooms.length) { //end of campaign
			end_of_campaign();
		}
	}
}

function unload_campaign() { //get rid of all remnants of the campaign from having been loaded. good riddance
	all_rooms = [];
	campaign_metadata = {};
	loaded_room_index = null;
	while (display.firstChild) display.firstChild.remove();
	editor_toolbox.style.display = "none";
	display.setAttribute("editor", "false");
}

function end_of_campaign() {
	fullscreen_message(campaign_metadata.completion_message ? campaign_metadata.completion_message : "<b>level pack complete!</b> good job", back_to_main_menu);
}

function abandon_campaign() {
	fullscreen_message("abandoning campaign", back_to_main_menu);
}

function fullscreen_message(text, next_function) {
	room_down();
	setTimeout(function(){
		//bring message up
		let h1 = document.body.appendChild(document.createElement("h1"));
		h1.setAttribute("class", "fullscreen_message");
		h1.innerHTML = text;
		h1.style.animation = transition_time + "ms title_enter";
		sfx("room_up");
		setTimeout(function(){
			h1.style.animation = transition_time + "ms title_exit";
			if (next_function) next_function();
		}, transition_time * 4);
		setTimeout(function(){
			h1.remove();
		}, transition_time * 5 - mini_time);
	}, transition_time);
}

function back_to_main_menu() {
	in_transition = false;
	swap_to_article("main_menu");
	unload_campaign();
	setTimeout(function() {
		change_art_directory("art/pond");
	}, transition_time);
}

function xor(a, b) {if (a && b) return false; if (!a && !b) return false; return true;}

//if bottom is stop, or if top is stop, or oob
function space_blocked(y, x) {
	if (oob(y, x)) return true;
	if (room_top[y][x].must_collect) return false;
	if (room_bottom[y][x].stop || room_top[y][x].stop || room_top[y][x].box) return true;
	return false;
}
function space_blocked_but_allowing_boxes(y, x) {
	if (oob(y, x)) return true;
	if (room_bottom[y][x].stop || room_top[y][x].stop) return true;
	return false;
}
function oob(y, x) {
	if (y < 0 || y >= height || x < 0 || x >= width) return true;
	return false;
}

//read pre into all_rooms
function read_into_all_rooms(text) {
	all_rooms = [];
	campaign_metadata = {
		errors: []
	};
	let currently_making_room = 0;
	let on_metadata = true; //about campaign-level metadata
	for (paragraph of text.trim().split("\n\n")) {
		if (!paragraph) {
			campaign_metadata.errors.push("Level data is empty");
			return;
		}
		paragraph = paragraph.split("\n");
		if (on_metadata) {
			for (data_line of paragraph) {
				let colon_place = data_line.indexOf(":");
				if (colon_place == -1) {
					campaign_metadata.errors.push("Metadata line '"+data_line+"' lacks colon separator");
				} else {
					let key = data_line.substring(0, colon_place).trim();
					let val = data_line.substring(colon_place+1).trim();
					if (["art_directory", "author", "title", "completion_message", "editor"].includes(key)) campaign_metadata[key] = val;
					else campaign_metadata.errors.push("'"+key+"' is not a level pack metadata field");
				}
			}
			on_metadata = false;
		} else {
			all_rooms[currently_making_room] = interpret_level_data(paragraph);
			currently_making_room++;
		}
	}
	if (!all_rooms.length) campaign_metadata.errors.push("Level pack has 0 rooms");
}

function start_game(text, just_error_checking = false, error_list = "#campaign_input_errors_list") {
	if (in_transition) just_error_checking = true;
	read_into_all_rooms(text.trim());
	//if there was any error, cause a panic
	error_list = document.querySelector(error_list);
	while (error_list.firstChild) error_list.firstChild.remove();
	for (error_text of campaign_metadata.errors) {
		let p = error_list.appendChild(document.createElement("p"));
		p.innerText = error_text;
	}
	for (let i = 0; i < all_rooms.length; i++) if (all_rooms[i].errors.length) for (error_text of all_rooms[i].errors) {
		let p = error_list.appendChild(document.createElement("p"));
		p.innerText = "(Room "+(i+1)+") " + error_text;
	}
	if (just_error_checking) return;
	if (error_list.firstChild) return;
	for (input_element of document.querySelectorAll("#editor_metadata input[tier=\"campaign\"]")) {
		input_element.value = campaign_metadata[input_element.getAttribute("key")] ? campaign_metadata[input_element.getAttribute("key")] : "";
	}
	swap_to_article(null);
	setTimeout(function() {
		display.setAttribute("editor", campaign_metadata.editor ? "true" : "false");
		document.querySelector("#editor_toolbox").style.display = campaign_metadata.editor ? "block" : "none";
		open_room(0, 'left');
		//debug: make all room shortcuts
		if (false) for (label of Object.keys(all_rooms)) {
			let button = document.createElement("button");
			button.setAttribute("class", "shortcut")
			button.innerText = label;
			button.setAttribute("onclick", "room_transition("+label+")");
			document.body.appendChild(button);
		}
	}, transition_time);
}
//make some text areas empty that involve start_game
for (textarea_id of ["#campaign_input_textarea", "#level_editor_input_textarea"]) {
	document.querySelector(textarea_id).value = "";
	//start_game("", true, textarea_id.replaceAll("textarea", "errors_list"));
}

//this turns duckieleft => art/duckieleft0.png
//eventually useful for changing the art directory
let current_art_directory = null;
function full_image_url(filename) {
	return current_art_directory+"/"+filename;
}
change_art_directory("art/pond");
document.querySelector("link[rel=\"icon\"]").setAttribute("href", full_image_url(Math.random() > 0.05 ? "duckieright.png" : "girlduckieright.png"));
function determine_art_directory() { //called whenever we should check and see what art directory to use
	let should_art_directory = "art/pond";
	if (user_settings.art_directory) should_art_directory = user_settings.art_directory;
	if (campaign_metadata.art_directory) should_art_directory = campaign_metadata.art_directory;
	if (loaded_room_index != null) if (all_rooms[loaded_room_index].art_directory) should_art_directory = all_rooms[loaded_room_index].art_directory;
	if (loaded_room_index == null) should_art_directory = "art/pond"; //sorry if ur not gaming its pond mode
	if (should_art_directory != current_art_directory) change_art_directory(should_art_directory);
}
function change_art_directory(directory) { //actually changes art directory
	current_art_directory = directory;
	document.body.style.backgroundImage = "url('"+directory+"/backgroundcolor.png')";
	for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
		visual_update_top(y, x);
		visual_update_bottom(y, x);
	}
	if (campaign_metadata.editor) make_editor();
}
function swap_to_article(destination_article) {
	if (in_transition) return;
	destination_article = document.querySelector("article#"+destination_article);
	sfx("room_down");
	in_transition = true;
	for (article of document.querySelectorAll("article")) {
		article.style.animation = article.hasAttribute("long") ? transition_time + "ms title_exit_long" : transition_time + "ms title_exit";
	}
	setTimeout(function() {
		for (article of document.querySelectorAll("article")) {
			article.style.display = "none";
		}
	}, transition_time - mini_time);
	if (!destination_article) return;
	setTimeout(function() {
		sfx("room_up");
		destination_article.style.display = "block";
		destination_article.style.animation = destination_article.hasAttribute("long") ? transition_time + "ms title_enter_long" : transition_time + "ms title_enter";
		destination_article.style.opacity = "1";
	}, transition_time);
	setTimeout(function() {
		in_transition = false;
	}, transition_time * 2);
}

//STUFF FOR THE LEVEL EDITOR
let editor_selected_layer = "top";
let editor_selected_character = "~";
make_editor();
function make_editor() {
	for ([div_id, arch, layer_name] of [["#editor_toolbox_bottom", arch_bottom, "bottom"], ["#editor_toolbox_top", arch_top, "top"]]) {
		let div = document.querySelector(div_id);
		div.innerHTML = layer_name + " layer";
		for (character of Object.keys(arch)) {
			let img = div.appendChild(document.createElement("img"));
			img.src = full_image_url(arch[character].img);
			img.setAttribute("character", character);
			img.setAttribute("layer", layer_name);
			img.setAttribute("onclick", "editor_select_state('"+layer_name+"', '"+character+"')");
		}
	}
	editor_select_state("top", "1");
}
function click_cell(y, x) {
	if (!campaign_metadata.editor) return;
	if (in_transition) return;
	if (editor_mode != "edit") return;
	if (editor_selected_layer == "top") {
		room_top[y][x] = arch_top[editor_selected_character];
		visual_update_top(y, x);
	} else if (editor_selected_layer == "bottom") {
		room_bottom[y][x] = arch_bottom[editor_selected_character];
		visual_update_bottom(y, x);
	}
	player_input(0, 0, true);
	save_state();
}
function editor_select_state(layer, character) { //pick a state to start painting with
	editor_selected_character = character;
	editor_selected_layer = layer;
	for (editor_selector of document.querySelectorAll("#editor_toolbox img[onclick]")) {
		editor_selector.style.borderColor = character == editor_selector.getAttribute("character") && layer == editor_selector.getAttribute("layer") ? "white" : "#ffffff22";
	}
}
function room_layer_to_level_data(layer) {
	let list = [];
	for (row of layer) {
		let txt = "";
		for (cell of row) txt += cell.character;
		list.push(txt);
	}
	return list.join("|");
}
function save_state() { //overwrites the original level data to the current state of the level. only for the level editor
	if (!campaign_metadata.editor) return;
	//remove players in the save states. cant have any of that
	for (row of room_top) for (let i = 0; i < row.length; i++) if (row[i].player) row[i] = arch_top["."];
	all_rooms[loaded_room_index].data_bottom = room_layer_to_level_data(room_bottom);
	all_rooms[loaded_room_index].data_top = room_layer_to_level_data(room_top);
	let errors = interpret_level_data([all_rooms[loaded_room_index].data_bottom, all_rooms[loaded_room_index].data_top]).errors; //probably inefficient lolol
	while (editor_errors_list.firstChild) editor_errors_list.firstChild.remove();
	for (error_text of errors) {
		let p = editor_errors_list.appendChild(document.createElement("p"));
		p.innerText = error_text;
	}
}
function interpret_level_data(paragraph) { //paragraph is already list. turns a paragraph into {data_bottom, data_top, [other_metadata], errors}. doesn't actually construct room using arch!
	let room = {
		errors: []
	};
	if (paragraph.length == 1) room.errors.push("No top layer provided");
	else if (paragraph.length == 0) room.errors.push("Paragraph is empty string, somehow");
	if (room.errors.length) return room; //if we already have an error just give up bro
	//advice about room dimensions (using paragraph[0] and paragraph[1] while they still exist)
	[paragraph[0], paragraph[1]] = [paragraph[0].split("|"), paragraph[1].split("|")];
	let bottom_rectangular = true;
	for (let i = 1; i < paragraph[0].length && bottom_rectangular; i++)
		if (paragraph[0][i-1].length != paragraph[0][i].length)
			bottom_rectangular = false;
	let top_rectangular = true;
	for (let i = 1; i < paragraph[1].length && top_rectangular; i++)
		if (paragraph[1][i-1].length != paragraph[1][i].length)
			top_rectangular = false;
	if (!bottom_rectangular && !top_rectangular) room.errors.push("Neither layer is rectangular");
	else if (!bottom_rectangular) room.errors.push("Bottom layer is not rectangular");
	else if (!top_rectangular) room.errors.push("Top layer is not rectangular");
	else if (paragraph[0].length != paragraph[1].length || paragraph[0][0].length != paragraph[1][0].length) room.errors.push("Top and bottom layers do not match in size");
	//ok save the first two lines, carry on to metadata
	room.data_bottom = paragraph[0].join("|");
	room.data_top = paragraph[1].join("|");
	paragraph.shift(); paragraph.shift();
	//advice about making sure all the tiles we reference actually exist
	for (let i = 0; i < room.data_bottom.length; i++) {
		let character = room.data_bottom.charAt(i);
		if (!arch_bottom[character] && character != "|") {
			room.errors.push("'"+character+"' doesn't represent any bottom layer tile")
		}
	}
	for (let i = 0; i < room.data_top.length; i++) {
		let character = room.data_top.charAt(i);
		if (!arch_top[character] && character != "|") {
			room.errors.push("'"+character+"' doesn't represent any top layer tile")
		}
	}
	//advice about exits
	let left_exits = (room.data_bottom.match(/</g) || []).length;
	let right_exits = (room.data_bottom.match(/>/g) || []).length;
	if (left_exits <= 0 && right_exits <= 0) room.errors.push("Room needs at least one entrance and one exit");
	else if (left_exits <= 0) room.errors.push("Room needs at least one entrance");
	else if (right_exits <= 0) room.errors.push("Room needs at least one exit");
	else if (left_exits > right_exits) room.errors.push("There are more entrances than exits");
	else if (left_exits < right_exits) room.errors.push("There are more exits than entrances");
	for (let i = 0; i < room.data_bottom.length; i++) if (room.data_bottom.charAt(i) == "<" && room.data_top.charAt(i) != ".") room.errors.push("Something is blocking the left exit");
	//lines 2+ in the level thing are just read as keys
	for (data_line of paragraph) {
		let colon_place = data_line.indexOf(":");
		if (colon_place == -1) {
			room.errors.push("Metadata line '"+data_line+"' lacks colon separator");
		} else {
			let key = data_line.substring(0, colon_place).trim();
			let val = data_line.substring(colon_place+1).trim();
			if (["extra_text", "art_directory"].includes(key)) room[key] = val;
			else (room.errors.push("'"+key+"' is not a room metadata field"));
		}
	}
	return room;
}
function expand_level(direction) {
	if (!campaign_metadata.editor) return;
	if (in_transition) return;
	if (editor_mode != "edit") return;
	let [list_bottom, list_top] = [[], []];
	//add empty cells into room_bottom and room_top
	switch (direction) {
		case "right":
			for (row of room_bottom) row.push(arch_bottom["."]);
			for (row of room_top) row.push(arch_top["."]);
			break;
		case "left":
			for (row of room_bottom) row.unshift(arch_bottom["."]);
			for (row of room_top) row.unshift(arch_top["."]);
			break;
		case "down":
			for (cell of room_bottom[0]) list_bottom.push(arch_bottom["."]);
			room_bottom.push(list_bottom);
			for (cell of room_top[0]) list_top.push(arch_top["."]);
			room_top.push(list_top);
			break;
		case "up":
			for (cell of room_bottom[0]) list_bottom.push(arch_bottom["."]);
			room_bottom.unshift(list_bottom);
			for (cell of room_top[0]) list_top.push(arch_top["."]);
			room_top.unshift(list_top);
			break;
		case "negative-right":
			if (width <= 1) break;
			for (row of room_bottom) row.pop();
			for (row of room_top) row.pop();
			break;
		case "negative-left":
			if (width <= 1) break;
			for (row of room_bottom) row.shift();
			for (row of room_top) row.shift();
			break;
		case "negative-down":
			if (height <= 1) break;
			room_bottom.pop();
			room_top.pop();
			break;
		case "negative-up":
			if (height <= 1) break;
			room_bottom.shift();
			room_top.shift();
			break;
		case "shrink-up":
			if (entirely_empty()) break;
			while (true) { //shrink from up
				let important_things_found = false;
				for (cell of room_bottom[0]) if (cell != arch_bottom["."]) important_things_found = true;
				for (cell of room_top[0]) if (cell != arch_top["."]) important_things_found = true;
				if (important_things_found) break;
				room_bottom.shift();
				room_top.shift();
			}
			break;
		case "shrink-down":
			if (entirely_empty()) break;
			while (true) { //shrink from down
				let important_things_found = false;
				for (cell of room_bottom[room_bottom.length-1]) if (cell != arch_bottom["."]) important_things_found = true;
				for (cell of room_top[room_top.length-1]) if (cell != arch_top["."]) important_things_found = true;
				if (important_things_found) break;
				room_bottom.pop();
				room_top.pop();
			}
			break;
		case "shrink-right":
			if (entirely_empty()) break;
			while (true) { //shrink from right
				let important_things_found = false;
				for (row of room_bottom) if (row[row.length-1] != arch_bottom["."]) important_things_found = true;
				for (row of room_top) if (row[row.length-1] != arch_top["."]) important_things_found = true;
				if (important_things_found) break;
				for (row of room_bottom) row.pop();
				for (row of room_top) row.pop();
			}
			break;
		case "shrink-left":
			if (entirely_empty()) break;
			while (true) { //shrink from left
				if (!room_bottom[0].length) break;
				let important_things_found = false;
				for (row of room_bottom) if (row[0] != arch_bottom["."]) important_things_found = true;
				for (row of room_top) if (row[0] != arch_top["."]) important_things_found = true;
				if (important_things_found) break;
				for (row of room_bottom) row.shift();
				for (row of room_top) row.shift();
			}
			break;
	}
	height = room_bottom.length;
	width = room_bottom[0].length;
	save_state();
	reset_room(true);
}

//says whether the map is entirely empty spaces or not
//used to shrink wrap a level in editor
function entirely_empty() {
	for (row of room_bottom) for (cell of row) if (cell != arch_bottom["."]) return false;
	for (row of room_top) for (cell of row) if (cell != arch_top["."]) return false;
	return true;
}
function swap_editor_mode() {
	if (in_transition) return;
	if (!campaign_metadata.editor) return;
	if (editor_errors_list.firstChild) return;
	editor_mode = { //which mode to swap to
		play: "edit",
		edit: "play"
	}[editor_mode];
	reset_room();
	setTimeout(function(){ //display attribute
		display.setAttribute("editor", {play: "false", edit: "true"}[editor_mode]);
		editor_toolbox.setAttribute("mode", editor_mode);
	}, transition_time);
	editor_mode_button.innerText = { //what material icon text to display. make it correspond to current mode (i think this is best?)
		play: "play_arrow",
		edit: "edit"
	}[editor_mode];
}
function editor_set_metadata(input_element) { //tier: "room" or "campaign"
	if (in_transition) return;
	if (!campaign_metadata.editor) return;
	let val = input_element.value;
	let tier = input_element.getAttribute("tier");
	let key = input_element.getAttribute("key");
	//todo: maybe add check to make sure key is valid field
	if (tier == "room") {
		all_rooms[loaded_room_index][key] = val;
	} else if (tier == "campaign") {
		campaign_metadata[key] = val;
	}
	if (key == "art_directory") determine_art_directory();
	if (key == "extra_text") set_subtitle();
}

function set_user_setting(input_element) {
	let key = input_element.getAttribute("key");
	let val = input_element.value;
	//todo: maybe add check to make sure key is valid user setting
	user_settings[key] = val;
	if (key == "art_directory") determine_art_directory();
}
document.querySelector("input[tier=\"user\"][key=\"art_directory\"]").value = "art/pond";

function generate_level_data() { //turns campaign_metadata and all_rooms into level data paragraphs. returned as single text string
	let paragraphs = [];
	//phase one: campaign metadata
	let p0 = [];
	for (field of ["art_directory", "author", "title", "completion_message"]) if (campaign_metadata[field]) {
		p0.push(field + ": " + campaign_metadata[field]);
	}
	if (!p0.length) p0.push("author: Unknown"); //silly trick because there has to be at least one campaign metadata field
	paragraphs.push(p0.join("\n"));
	//phase two: all the rooms
	for (room of all_rooms) {
		let p = [];
		p.push(room.data_bottom);
		p.push(room.data_top);
		for (field of ["art_directory", "extra_text"]) if (room[field]) {
			p.push(field + ": " + room[field]);
		}
		paragraphs.push(p.join("\n"));
	}
	return paragraphs.join("\n\n");
}

function editor_insert_new_room(index) {
	if (!campaign_metadata.editor) return;
	if (index < 0 || index > all_rooms.length) return;
	all_rooms.splice(index, 0, {data_bottom: '.....|.....|<...>|.....|.....', data_top: '.....|.....|.....|.....|.....'});
	room_transition(index);
}

function swap_rooms(origin, target) { //currently in origin, want to move it to target
	if (!campaign_metadata.editor) return;
	if (!all_rooms[origin] || !all_rooms[target]) return;
	[all_rooms[origin], all_rooms[target]] = [all_rooms[target], all_rooms[origin]];
	room_transition(target);
}

function sfx(aud) {
	//coming from direction: left top bottom right static
	//load unload: room_up room_down
	let a = new Audio("sound/"+{
		"left": "goright",
		"top": "godown",
		"bottom": "goup",
		"right": "goleft",
		"static": "staystill",
		"room_up": "magic",
		"room_down": "rumble",
		"pushbox": "rumble",
		"left": "goup",
		"top": "goup",
		"bottom": "goup",
		"right": "goup",
		"static": "staystill",
		"room_up": "magic",
		"room_down": "rumble",
		"pushbox": "godown"
	}[aud]+".mp3");
	a.volume = 0.5;
	a.play();
}