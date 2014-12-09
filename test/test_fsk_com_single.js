#!/usr/local/bin/node

var fs = require('fs'),
	debug = require('debug')('TIO-test'),
	TIO = require('../index').TIO;

var config = JSON.parse(fs.readFileSync('./data/config.json'));
config.ioCfgFile = './data/fskcom_io.json';
var tio = TIO(config);
var buf = new Buffer([ 0x12, 0x13, 0x13, 0x12, 0x11, 0x10, 0x09, 0x08, 0x07, 0x06, 0x05, 0x04, 0x03 ]);
if (tio) {
	debug('TIO stack initialized [mode = ' + process.env.DEBUG + ']');

	console.time('FSKCOM write leds');
	tio.leds({ id: 'FSKCOM-1', led1: 1, led2: 1, led3: 1 });
	console.timeEnd('FSKCOM write leds');

	tio.enableComTX({ name: 'COM1', enable: 1 });
	tio.enableComTX({ name: 'COM2', enable: 1 });

	console.time('Write COM2');
	tio.writeCom({ name: 'COM2', data: buf });
	console.timeEnd('Write COM2');

	setTimeout(function() {
		tio.end();
		debug('All pins unexported');
		process.exit(0);
	}, 2000);
} else {
	debug('TIO not initialized');
}
