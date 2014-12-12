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

	console.time('AIO write x4');
	tio.writeAnalog({ name: 'AO00', value: 5, when: 0 });
	tio.writeAnalog({ name: 'AO01', value: -5, when: 0 });
	tio.writeAnalog({ name: 'AO02', value: 5, when: 0 });
	tio.writeAnalog({ name: 'AO03', value: -5, when: 0 });
	console.timeEnd('AIO write x4');

	setTimeout(function() {
		tio.end();
		debug('All pins unexported');
		process.exit(0);
	}, 5000);
} else {
	debug('TIO not initialized');
}
