#!/usr/local/bin/node

var fs = require('fs'),
	debug = require('debug')('TIO-test'),
	TIO = require('../index').TIO;

var config = JSON.parse(fs.readFileSync('./data/config.json'));
var tio = TIO(config);

if (tio) {
	debug('TIO stack initialized [mode = ' + process.env.DEBUG + ']');

	var on = false;
	console.time('1000x on/off GPIO64 out');
	for (var i=0; i<1000; i++) {
		on = !on;
		for (var c = 16; c < 48; c++) {
			tio.writeDigital({ name: 'DO'+c, value:  on });
		}
	}
	console.timeEnd('1000x on/off GPIO64 out');

	console.time('1000x on/off GPIO64 1x out');
	for (var i=0; i<1000; i++) {
		on = !on;
		tio.writeDigital({ name: 'DO16', value:  on });
	}
	console.timeEnd('1000x on/off GPIO64 1x out');

	// read 
	console.time('read DI16');
	tio.on('DI16', function(value) {
		console.timeEnd('read DI16');
		debug('DI16= ' + value);

		setTimeout(function() {
				tio.end();
				debug('All pins unexported');
				process.exit(0);
			}, 100);
	});

	console.time('read GPIO64');
	tio.readGPIO64Digital32({
 		id : 'GPIO64-1'
	});
	console.timeEnd('read GPIO64');

} else {
	debug('TIO not initialized');
}
