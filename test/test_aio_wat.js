#!/usr/local/bin/node

var fs = require('fs'),
	debug = require('debug')('TIO-test'),
	TIO = require('../index').TIO;

var config = JSON.parse(fs.readFileSync('./data/config.json'));
//config.ioCfgFile = './data/aio12_io.json';
var tio = TIO(config);

if (tio) {
	debug('TIO stack initialized [mode = ' + process.env.DEBUG + ']');

	console.time('AIO write leds');
	tio.leds({ id: 'AIO12-1', led1: 1, led2: 0, led3: 1 });
	console.timeEnd('AIO write leds');

	console.time('AIO write x1');
	tio.writeAnalog({ name: 'AO'+process.argv[2], value: -5, when: 0 });
	console.timeEnd('AIO write x1');

	// read 
	for (var i = 0; i < 8; i++) {
		var paddedCounter = String('00' + i).slice(-2);
		if (i != 8) {
			var fct = function(pc) {
				return function(value) {
					debug('->AI' + pc + '= ' + value);
				};
			} 
			tio.on('AI'+paddedCounter, fct(paddedCounter));
		}
	}

	console.time('read AIO');
	tio.readAIO12Analog8({ id : 'AIO12-1' });
	console.timeEnd('read AIO');

	setTimeout(function() {
		tio.end();
		debug('All pins unexported');
		process.exit(0);
	}, 1000);
} else {
	debug('TIO not initialized');
}
