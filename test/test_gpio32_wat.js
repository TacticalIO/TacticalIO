#!/usr/local/bin/node

var fs = require('fs'),
	debug = require('debug')('TIO-test'),
	TIO = require('../index').TIO;

var config = JSON.parse(fs.readFileSync('./data/config.json'));
config.ioCfgFile = './data/gpio32_io.json';
var tio = TIO(config);

if (tio) {
	debug('TIO stack initialized [mode = ' + process.env.DEBUG + ']');
	console.time('1x on/off GPIO32 1x out');
	tio.ds.set('TIO.DO' + process.argv[2], 1);
	tio.writeHSGPIO32Digital16({ id: 'GPIO32-1' });
	console.timeEnd('1x on/off GPIO32 1x out');
	debug('Wrote DO' + process.argv[2]);

	setTimeout(function() {
		tio.end();
		debug('All pins unexported');
		process.exit(0);
	}, 5000);

} else {
	debug('TIO not initialized');
}
