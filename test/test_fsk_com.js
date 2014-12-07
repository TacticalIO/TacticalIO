#!/usr/local/bin/node

var fs = require('fs'),
	debug = require('debug')('TIO-test'),
	TIO = require('../index').TIO;

var config = JSON.parse(fs.readFileSync('./data/config.json'));
config.ioCfgFile = './data/fskcom_io.json';
var tio = TIO(config);

if (tio) {
	debug('TIO stack initialized [mode = ' + process.env.DEBUG + ']');

	console.time('FSKCOM write leds');
	tio.leds({ id: 'FSKCOM-1', led1: 1, led2: 1, led3: 1 });
	console.timeEnd('FSKCOM write leds');

	console.time('Write COM1');
	console.timeEnd('Write COM1');

	console.time('Write COM2');
	console.timeEnd('Write COM2');

	setTimeout(function() {
		tio.end();
		debug('All pins unexported');
		process.exit(0);
	}, 1000);
} else {
	debug('TIO not initialized');
}
