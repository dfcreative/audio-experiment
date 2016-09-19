//melodic sequence walker component

//TODO: add focusing
//TODO: random walk
//TODO: separate seq component (audio) from visual part
//TODO: replace dynamic oscs with gate nodes

require('enable-mobile');
const ctx = require('audio-context');
const extend = require('just-extend');
const css = require('insert-styles');
const uid = require('get-uid');

css(`
	.mel-circle {
		position: absolute;
		width: 300px;
		height: 300px;
		top: 50%;
		left: 50%;
		margin-top: -150px;
		margin-left: -150px;
		border: 2px solid gray;
		border-radius: 50%;
	}
	.mel-circle-step {
		position: absolute;
		width: 2rem;
		height: 2rem;
		margin-top: -1rem;
		margin-left: -1rem;
	}
	.mel-circle-step
`);

//main class
function MelCircle (opts) {
	if (!(this instanceof MelCircle)) return new MelCircle(opts);

	extend(this, opts);

	this.id = uid();
	this.width = 300;
	this.height = 300;

	//sound params
	if (!this.context) this.context = ctx;
	this.output = this.context.destination;


	//create element
	if (!this.container) this.container = document.body;

	this.element = this.container.appendChild(document.createElement('div'));
	this.element.className = 'mel-circle';
	this.element.style.cssString = `
		width: ${this.width}px;
		height: ${this.height}px;
	`;


	//create steps - melodic elements
	this.steps = [];
	this.currentStep = 0;
	for (let i = 0; i < this.stepsNumber; i++) {
		this.addStep(i, this.f * (i + 1)/this.stepsNumber);
	}


	//click outside stops it
	document.addEventListener('click', e => {
		if (this.element.contains(e.target)) {
			return;
		}
		this.stop();
	})

	this.update();
}


MelCircle.prototype.width = 300;
MelCircle.prototype.height = 300;

MelCircle.prototype.random = false;
MelCircle.prototype.tempo = 128;
MelCircle.prototype.step = 1/16;
MelCircle.prototype.f = 440;
MelCircle.prototype.stepsNumber = 6;
MelCircle.prototype.type = 'sawtooth';


//add a new possible step
MelCircle.prototype.addStep = function (id, f) {
	let stepEl = this.element.appendChild(document.createElement('input'));
	stepEl.type = 'radio';
	// stepEl.name = this.id;
	stepEl.className = 'mel-circle-step';
	stepEl.id = id;

	stepEl.title = id + ': ' + f + 'Hz';

	stepEl.f = f || this.f;

	stepEl.addEventListener('click', e => {
		let stepEl = e.currentTarget;
		if (!stepEl.osc) {
			this.start(parseInt(stepEl.id));
		}
		else {
			this.stop(parseInt(stepEl.id));
		}
	});

	this.steps.push(stepEl);

	return this;
}


//Place elements properly within a circle
MelCircle.prototype.update = function (opts) {
	extend(this, opts);

	let cx = this.width / 2, cy = this.height / 2;
	let n = this.steps.length;

	// if (n > 12) throw 'Implement more than 12 steps placing';

	this.steps.forEach((step, i) => {
		let angle = Math.PI*2 * i/n ;
		step.style.left = cx + cx * Math.sin(angle) + 'px';
		step.style.top = cy + cy * -Math.cos(angle) + 'px';
		step.f = this.f * (i + 1)/this.stepsNumber;
	});

	return this;
}

MelCircle.prototype.destroy = function () {
	this.stop();
	this.container.removeChild(this.element);
}


//playback option
MelCircle.prototype.start = function (i) {
	if (i == null) return this;

	let step = this.steps[i];

	if (!step || step.osc) return this;

	let osc = this.context.createOscillator();
	osc.type = this.type;
	osc.frequency.value = step.f;
	osc.start(this.context.currentTime);
	osc.connect(this.output);
	step.osc = osc;
	step.checked = true;

	return step;
}
MelCircle.prototype.stop = function (i) {
	if (i == null) {
		this.steps.forEach((step, i) => this.stop(i));
		return this;
	}

	let step = this.steps[i];

	if (!step || !step.checked) return this;

	step.checked = false;
	step.osc.stop(this.context.currentTime);
	let osc = step.osc;
	step.osc = null;
	setTimeout(() => {
		osc.disconnect();
	})
}




//setup demo
let Panel = require('settings-panel');

//current state
let stepsNumber = 12;
let type = 'sawtooth';
let seq = 'random';
let period = 1;
let frequency = 440;
let connections = 2;

//just recreate the whole thing
let circle = null;
let interval;
let connSet = new Set();
let last = 0;
function update () {
	if ((circle && stepsNumber != circle.stepsNumber) || !circle) {
		circle && circle.destroy();
		circle = MelCircle({
			stepsNumber: stepsNumber,
			type: type,
			f: frequency
		});
	}
	else {
		circle.update({
			type: type,
			f: frequency
		});
	}
}

function updateInterval () {
	clearInterval(interval);

	let pause = period*1000 * connections / stepsNumber;

	//setup playback
	if (seq === 'manual') {
		circle.stop()
	}
	else if (seq === 'random') {
		interval = setInterval(() => {
			connSet.forEach(conn => {
				circle.stop(conn);
			});
			connSet.clear();

			for (let i = 0; i < connections; ) {
				let conn = Math.floor(Math.random() * stepsNumber);
				if (!connSet.has(conn)){
					connSet.add(conn);
					circle.start(conn);
					i++
				}
			}

		}, pause);
	}
	else if (seq === 'cw') {
		interval = setInterval(() => {
			connSet.forEach(conn => {
				circle.stop(conn);
			});
			connSet.clear();

			last = (last + 1) % stepsNumber;

			for (let i = 0; i < connections; i++) {
				let idx = last + Math.floor(i * stepsNumber / connections);
				idx = idx % stepsNumber;
				connSet.add(idx);
				circle.start(idx);
			}
		}, pause);
	}
	else if (seq === 'counter-cw') {
		interval = setInterval(() => {
			connSet.forEach(conn => {
				circle.stop(conn);
			});
			connSet.clear();

			last = (last - 1 + stepsNumber) % stepsNumber;

			for (let i = 0; i < connections; i++) {
				let idx = last + Math.floor(i * stepsNumber / connections);
				idx = idx % stepsNumber;
				connSet.add(idx);
				circle.start(idx);
			}
		}, pause);
	}
}


let panel = Panel([
	{id: 'frequency', type: 'range', precision: .01, min: 20, log: true, value: frequency, max: 15000, change: v => {
		frequency = v;
	}},
	{id: 'steps', type: 'range', min: 1, max: 64, step: 1, value: 12, change: v => {
		stepsNumber = v;
		updateInterval();
	}},
	{id: 'connections', type: 'range', min: 1, max: 64, step: 1, value: connections, change: v => {
		connections = v;
		updateInterval();
	}},
	{id: 'sequence', type: 'switch', value: seq, options: ['manual', 'random', 'cw', 'counter-cw'], change: v => {
		seq = v;
		updateInterval();
	}},
	{id: 'period, s', type: 'range', step: 1, min: .05, max: 4, step: 0.05, value: period, change: v => {
		period = v;
		updateInterval();
	}},
	{id: 'wave', type: 'switch', value: type, options: ['sawtooth', 'square', 'triangle', 'sine'], change: v => {
		type = v;
	}}
], {
	title: '<a href="https://github.com/dfcreative/audio-experiment">Melodic circle</a>',
	css: `
		:host {
			z-index: 1;
			background: none;
		}
		:host a {
			text-decoration: none;
			border-bottom: 1px solid rgba(0,0,0,.25);
		}
		:host a:hover {
			border-bottom: 1px solid rgba(0,0,0,1);
		}
	`
}).on('change', () => {
	if (this.wait) return;
	this.wait = true;
	setTimeout(() => {
		update();
		this.wait = false;
	}, 50);
});
