#!/usr/local/bin/node

var fs = require('fs'),
	debug = require('debug')('TIO-test'),
	TIO = require('../index').TIO;

var config = JSON.parse(fs.readFileSync('./data/config.json'));
//config.ioCfgFile = './data/gpio32_io.json';
var tio = TIO(config);

if (tio) {
	debug('TIO stack initialized [mode = ' + process.env.DEBUG + ']');

	console.time('board id');
	var gpio_id = tio.typeId( { id: 'GPIO32-1'});
	console.timeEnd('board id');	
	console.log('GPIO32-1 FPGA id: ', gpio_id);

	tio.setDigitalPattern({
		name: 'DO00',
		pattern: 0xAA
	});

	tio.setDigitalFreq({
		name: 'DO00',
		freq: 300,
		offset: 90
	});

	tio.setDigitalPattern({
		name: 'DO02',
		pattern: 0xAA
	});

	tio.setDigitalFreq({
		name: 'DO02',
		freq: 600,
		offset: 90
	});

	console.time('GPIO32 set leds');
	tio.leds({ id: 'GPIO32-1', led1: 1, led2: 1, led3: 1 });
	console.timeEnd('GPIO32 set leds');

	setTimeout(function() {
		tio.end();
		debug('All pins unexported');
		process.exit(0);
	}, 20000);

} else {
	debug('TIO not initialized');
}
