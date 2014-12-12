#!/usr/local/bin/node

var fs = require('fs'),
	debug = require('debug')('TIO-test'),
	TIO = require('../index').TIO;

var config = JSON.parse(fs.readFileSync('./data/config.json'));
//config.ioCfgFile = './data/aio12_io.json';
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
	debug('AIO12-1 FPGA id: ', aio_id);

	console.time('get clock');
	var clock = tio.getClock({ id : 'AIO12-1' });
	console.timeEnd('get clock');

	debug('clock value: ' + clock);

	console.time('AIO reset x4');
	tio.writeAnalog({ name: 'AO00', value: 0, when: 0 });
	tio.writeAnalog({ name: 'AO01', value: 0, when: 0 });
	tio.writeAnalog({ name: 'AO02', value: 0, when: 0 });
	tio.writeAnalog({ name: 'AO03', value: 0, when: 0 });
	console.timeEnd('AIO reset x4');

	console.time('AIO reset leds');
	tio.leds({ id: 'AIO12-1', led1: 0, led2: 0, led3: 0 });
	console.timeEnd('AIO reset leds');

	setTimeout(function() {
		tio.end();
		debug('All pins unexported');
		process.exit(0);
	}, 1000);
} else {
	debug('TIO not initialized');
}
