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

	console.time('1x W GPIO32 reset out');
	tio.writeHSGPIO32Digital16({ id: 'GPIO32-1', values: 0 });
	console.timeEnd('1x W GPIO32 reset out');

	console.time('1x W GPIO32 out (pattern)');
	tio.writeHSGPIO32Digital16({ id: 'GPIO32-1', values: '1111111111111111' });
	console.timeEnd('1x W GPIO32 out (pattern)');

	console.time('GPIO32 set leds');
	tio.leds({ id: 'GPIO32-1', led1: 1, led2: 0, led3: 1 });
	console.timeEnd('GPIO32 set leds');

	setTimeout(function() {
		tio.end();
		debug('All pins unexported');
		process.exit(0);
	}, 100);
} else {
	debug('TIO not initialized');
}
