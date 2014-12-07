#!/usr/local/bin/node

var fs = require('fs'),
	debug = require('debug')('TIO-test'),
	TIO = require('../index').TIO;

var config = JSON.parse(fs.readFileSync('./data/config.json'));
config.ioCfgFile = './data/gpio64_io.json';

var tio = TIO(config);

if (tio) {
	debug('TIO stack initialized [mode = ' + process.env.DEBUG + ']');

	var on = false;

	for (var cc = 0; cc < 32; cc++) {
		var paddedCounter = String('00' + cc).slice(-2);
		tio.ds.set('TIO.DO'+paddedCounter, 0);
		debug('TIO.DO'+paddedCounter+ '= ' + 0);
	}

	tio.ds.set('DO00', 1);
	tio.ds.set('DO07', 1);
	tio.ds.set('DO13', 1);
	tio.ds.set('DO31', 1);
	tio.ds.set('DO30', 1);

	console.time('W GPIO64 out (data)');
	tio.writeGPIO64Digital32({ id: 'GPIO64-1' });
	console.timeEnd('W GPIO64 out (data)');

	setTimeout(function() {
			tio.end();
			debug('All pins unexported');
			process.exit(0);
		}, 60000);

} else {
	debug('TIO not initialized');
}
