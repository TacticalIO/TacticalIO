#!/usr/local/bin/node

var fs = require('fs'),
	debug = require('debug')('TIO-test'),
	TIO = require('../index').TIO;

var config = JSON.parse(fs.readFileSync('./data/config.json'));
//config.ioCfgFile = './data/gpio32_io.json';
var tio = TIO(config);

if (tio) {
	debug('TIO stack initialized [mode = ' + process.env.DEBUG + ']');

	var on = false;

	for (var cc = 0; cc < 16; cc++) {
		var paddedCounter = String('00' + cc).slice(-2);
		tio.ds.set('TIO.DO'+paddedCounter, on);
		debug(cc + ' =========> TIO.DO'+paddedCounter + ' = ' + on);
		on = !on;
	}

	tio.writeHSGPIO32Digital16({ id: 'GPIO32-1' });

	setTimeout(function() {
			tio.end();
			debug('All pins unexported');
			process.exit(0);
		}, 100);

} else {
	debug('TIO not initialized');
}
