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
	tio.writeDigital({ name: 'DO08', value:  1 });
	console.timeEnd('1x on/off GPIO32 1x out');

	// read 
	for (var i = 0; i < 15; i++) {
		var paddedCounter = String('00' + i).slice(-2);
		if (i != 8) {
			var fct = function(pc) {
				return function(value) {
					debug('->DI' + pc + '= ' + value);
				};
			} 
			tio.on('DI'+paddedCounter, fct(paddedCounter));
		}
	}

	console.time('read DI08');
	tio.on('DI08', function(value, old) {
		console.timeEnd('read DI08');
		debug('DI08= ' + value);

		setTimeout(function() {
				debug('TIO.DI08= ' + tio.ds.get('TIO.DI08'));
				tio.end();
				debug('All pins unexported');
				process.exit(0);
			}, 100);
	});

	console.time('read GPIO32');
	tio.readHSGPIO32Digital16({
 		id : 'GPIO32-1'
	});
	console.timeEnd('read GPIO32');

} else {
	debug('TIO not initialized');
}
