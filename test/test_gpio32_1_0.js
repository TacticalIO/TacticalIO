#!/usr/local/bin/node

var fs = require('fs'),
	debug = require('debug')('TIO-test'),
	TIO = require('../index').TIO;

var config = JSON.parse(fs.readFileSync('./data/config.json'));
config.ioCfgFile = './data/gpio32_io.json';
var tio = TIO(config);

if (tio) {
	debug('TIO stack initialized [mode = ' + process.env.DEBUG + ']');

	console.time('1x W GPIO32 reset out');
	tio.writeGPIO32Digital16({ id: 'GPIO32-1', values: 0 });
	console.timeEnd('1x W GPIO32 reset out');

	console.time('1x W GPIO32 out (pattern)');
	tio.writeGPIO32Digital16({ id: 'GPIO32-1', values: '1010101010101010' });
	console.timeEnd('1x W GPIO32 out (pattern)');
	
	// read 
	console.time('read DI00');
	tio.on('DI00', function(value) {
		console.timeEnd('read DI00');
		debug('DI00= ' + value);

		setTimeout(function() {
				debug('DI00= ' + tio.ds.get('TIO.DI00'));
				tio.end();
				debug('All pins unexported');
				process.exit(0);
			}, 100);
	});

	console.time('read GPIO32');
	tio.readGPIO32Digital16({
 		id : 'GPIO32-1'
	});
	console.timeEnd('read GPIO32');

} else {
	debug('TIO not initialized');
}
