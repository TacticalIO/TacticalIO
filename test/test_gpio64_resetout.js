#!/usr/local/bin/node

var fs = require('fs'),
	debug = require('debug')('TIO-test'),
	TIO = require('../index').TIO;

var config = JSON.parse(fs.readFileSync('./data/config.json'));
config.ioCfgFile = './data/gpio64_io.json';

var tio = TIO(config);

if (tio) {
	debug('TIO stack initialized [mode = ' + process.env.DEBUG + ']');

	console.time('W GPIO64 reset out');
	// reset outputs
	tio.writeGPIO64Digital32({ id: 'GPIO64-1', 
		values: 0 });
	console.timeEnd('W GPIO64 reset out');

	setTimeout(function() {
			tio.end();
			debug('All pins unexported');
			process.exit(0);
		}, 60000);

} else {
	debug('TIO not initialized');
}
