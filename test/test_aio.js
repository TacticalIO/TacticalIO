#!/usr/local/bin/node

var fs = require('fs'),
	debug = require('debug')('TIO-test'),
	TIO = require('../index').TIO;

var config = JSON.parse(fs.readFileSync('./data/config.json'));
var tio = TIO(config);

if (tio) {
	debug('TIO stack initialized [mode = ' + process.env.DEBUG + ']');
	console.time('TIO stack hardware reset');
	tio.hwReset();
	console.timeEnd('TIO stack hardware reset');

	console.time('TIO stack sync clock hardware reset');
	tio.hwSyncReset();
	console.timeEnd('TIO stack sync clock hardware reset');

	console.time('clock reset');
	tio.resetClock();
	console.timeEnd('clock reset');

	console.time('board id');
	var aio_id = tio.typeId( { id: 'AIO12-1'});
	console.timeEnd('board id');	
	console.log('AIO12-1 FPGA id: ', aio_id);

	console.time('1000x 5V sin ana out');
	for (var i=0; i<1000; i++) {
		tio.writeAnalog({ name: 'AO00', value: 5*Math.sin(i*2*Math.PI), when: 0 });
	}
	console.timeEnd('1000x 5V sin ana out');

	console.time('1000x 5V sin all ana out');
	for (var i=0; i<1000; i++) {
		tio.writeAnalog({ name: 'AO00', value: 5*Math.sin(i*2*Math.PI), when: 0 });
		tio.writeAnalog({ name: 'AO01', value: 5*Math.sin(i*2*Math.PI), when: 0 });
		tio.writeAnalog({ name: 'AO02', value: 5*Math.sin(i*2*Math.PI), when: 0 });
		tio.writeAnalog({ name: 'AO03', value: 5*Math.sin(i*2*Math.PI), when: 0 });
	}
	console.timeEnd('1000x 5V sin all ana out');

	console.time('get clock');
	var clock = tio.getClock({ id : 'AIO12-1' });
	console.timeEnd('get clock');

	debug('clock value: ' + clock);

	// read 
	console.time('read AI00');
	tio.readAIO12Analog8({
 		id : 'AIO12-1'
	});

	var ai00 = tio.readAnalog({
 		name : 'AI00'
	});
	console.timeEnd('read AI00');
	debug('AI00= ' + ai00);

  // delayed write
	tio.writeAnalog({ name: 'AO00', value: 5, when: new Date().getTime() + 1500 });
	debug('analog write with delay: command sent');

	setTimeout(function() {
		tio.end();
		debug('All pins unexported');
		process.exit(0);
	}, 1600);
} else {
	debug('TIO not initialized');
}
