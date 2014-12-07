#!/usr/local/bin/node

var fs = require('fs'),
	debug = require('debug')('TIO-test'),
	TIO = require('../index').TIO;

var config = JSON.parse(fs.readFileSync('./data/config.json'));
config.ioCfgFile = './data/gpio64_io.json';

var tio = TIO(config);

if (tio) {
	debug('TIO stack initialized [mode = ' + process.env.DEBUG + ']');

	// read 
	console.time('read DI16');
	tio.on('DI16', function(value) {
		console.timeEnd('read DI16');
		debug('DI16= ' + value);

		setTimeout(function() {
				debug('DI16= ' + tio.ds.get('TIO.DI16'));
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
