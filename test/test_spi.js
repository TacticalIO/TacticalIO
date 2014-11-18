#!/usr/local/bin/node

var fs = require('fs'),
	spawn = require('child_process').spawn,
	debug = require('debug')('TIO-test'),
	TIO = require('../index').TIO;

spawn('ionice', ['-c3', '-p', process.pid]);

var config = JSON.parse(fs.readFileSync('./data/config.json'));
var tio = TIO(config);

if (tio) {
	debug('TIO stack initialized [mode = ' + process.env.DEBUG + ']');
	debug('Result => ' + tio.spiTransfer({ data: Buffer("Hello, World!") }));
	console.time('1000x spi write (13 bytes)');
	for (var i=0; i<1000; i++) {
		tio.spiTransfer({ data: Buffer("Hello, World!") });
	}
	console.timeEnd('1000x spi write (13 bytes)');
	
	console.time('1000x spi write (3 bytes)');
	for (var i=0; i<1000; i++) {
		tio.spiTransfer({ data: Buffer("Hel") });
	}
	console.timeEnd('1000x spi write (3 bytes)');

	console.time('1000x spi write with cs (3 bytes)');
	for (var i=0; i<1000; i++) {
		tio.cs( { id: "GPIO64-1", enable: true });
		tio.spiTransfer({ data: Buffer("Hel") });
		tio.cs( { id: "GPIO64-1", enable: false });
	}
	console.timeEnd('1000x spi write with cs (3 bytes)');

	var timer = setInterval(tio.spiTransfer, 50, { data: Buffer("Hel") });

	setTimeout(function() {
		tio.end();
		debug('All pins unexported');
	}, 3000);
} else {
	debug('TIO not initialized');
}
process.exit(0);
