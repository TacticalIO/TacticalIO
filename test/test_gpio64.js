#!/usr/local/bin/node

var fs = require('fs'),
	debug = require('debug')('TIO-test'),
	TIO = require('../index').TIO;

var config = JSON.parse(fs.readFileSync('./data/config.json'));
//config.ioCfgFile = './data/gpio64_io.json';

var tio = TIO(config);

if (tio) {
	debug('TIO stack initialized [mode = ' + process.env.DEBUG + ']');

	var on = false;

	for (var cc = 0; cc < 32; cc++) {
		var o = Math.round(Math.random());

		var paddedCounter = String('00' + cc).slice(-2);
		tio.ds.set('TIO.DO'+paddedCounter, o);
		debug('TIO.DO'+paddedCounter+ '= ' + o)
	}

	console.time('1000x W GPIO64 out (data)');
	for (var i=0; i<1000; i++) {
		tio.writeGPIO64Digital32({ id: 'GPIO64-1' });
	}
	console.timeEnd('1000x W GPIO64 out (data)');
	
	console.time('1000x W GPIO64 out (bits)');
	for (var i=0; i<1000; i++) {
		tio.writeGPIO64Digital32({ id: 'GPIO64-1', values: '10101010101010101010101010101010' });
	}
	console.timeEnd('1000x W GPIO64 out (bits)');

	console.time('1000x W GPIO64 out (array)');
	for (var i=0; i<1000; i++) {
		tio.writeGPIO64Digital32({ id: 'GPIO64-1', 
			values: [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0] });
	}
	console.timeEnd('1000x W GPIO64 out (array)');

	console.time('1000x W GPIO64 out (number)');
	for (var i=0; i<1000; i++) {
		tio.writeGPIO64Digital32({ id: 'GPIO64-1', 
			values: 2863311530 });
	}
	console.timeEnd('1000x W GPIO64 out (number)');

	console.time('1000x on/off GPIO64 1x out');
	for (var i=0; i<1000; i++) {
		on = !on;
		tio.writeDigital({ name: 'DO16', value:  on });
	}
	console.timeEnd('1000x on/off GPIO64 1x out');

	// reset outputs
	tio.writeGPIO64Digital32({ id: 'GPIO64-1', 
		values: 0 });

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
