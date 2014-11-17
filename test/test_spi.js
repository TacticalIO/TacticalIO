#!/usr/local/bin/node

var fs = require('fs'),
	debug = require('debug')('TIO-test'),
	TIO = require('../index').TIO;

var config = JSON.parse(fs.readFileSync('./data/config.json'));
var tio = TIO(config);

if (tio) {
	debug('TIO stack initialized [mode = ' + process.env.DEBUG + ']');
	debug('Result => ' + tio.spiTransfer({ data: Buffer("Hello, World!") }));
	for (var i=0; i<1000; i++) {
		console.time('spi write');
		tio.spiTransfer({ data: Buffer("Hello, World!") });
		console.timeEnd('spi write');
	}
	tio.end();
	debug('All pins unexported');
} else {
	debug('TIO not initialized');
}
process.exit(0);
