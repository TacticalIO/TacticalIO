#!/usr/local/bin/node

var fs = require('fs'),
	debug = require('debug')('TIO-test'),
	TIO = require('../index').TIO;

var config = JSON.parse(fs.readFileSync('./data/config.json'));
config.ioCfgFile = './data/gpio32_io.json';
var tio = TIO(config);

if (tio) {
	debug('TIO stack initialized [mode = ' + process.env.DEBUG + ']');

	var on = false;

	for (var cc = 0; cc < 16; cc++) {
		tio.ds.set('TIO.DO'+cc, Math.round(Math.random()));
	}

	console.time('1000x W GPIO32 out (data)');
	for (var i=0; i<1000; i++) {
		tio.writeHSGPIO32Digital16({ id: 'GPIO32-1' });
	}
	console.timeEnd('1000x W GPIO32 out (data)');

	console.time('1000x W GPIO32 out (bits)');
	for (var i=0; i<1000; i++) {
		tio.writeHSGPIO32Digital16({ id: 'GPIO32-1', values: '1010101010101010' });
	}
	console.timeEnd('1000x W GPIO32 out (bits)');

	console.time('1000x W GPIO32 out (array)');
	for (var i=0; i<1000; i++) {
		tio.writeHSGPIO32Digital16({ id: 'GPIO32-1', 
			values: [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0] });
	}
	console.timeEnd('1000x W GPIO32 out (array)');

	console.time('1000x W GPIO32 out (number)');
	for (var i=0; i<1000; i++) {
		tio.writeHSGPIO32Digital16({ id: 'GPIO32-1', 
			values: 43690 });
	}
	console.timeEnd('1000x W GPIO32 out (number)');

	console.time('1000x on/off GPIO32 1x out');
	for (var i=0; i<1000; i++) {
		on = !on;
		tio.writeDigital({ name: 'DO16', value:  on });
	}
	console.timeEnd('1000x on/off GPIO32 1x out');

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

	console.time('read GPIO32');
	tio.readHSGPIO32Digital16({
 		id : 'GPIO32-1'
	});
	console.timeEnd('read GPIO32');

} else {
	debug('TIO not initialized');
}
