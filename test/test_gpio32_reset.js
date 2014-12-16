#!/usr/local/bin/node

var fs = require('fs'),
	debug = require('debug')('TIO-test'),
	TIO = require('../index').TIO;

var config = JSON.parse(fs.readFileSync('./data/config.json'));
//config.ioCfgFile = './data/gpio32_io.json';
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
	var gpio_id = tio.typeId( { id: 'GPIO32-1'});
	console.timeEnd('board id');	
	console.log('GPIO32-1 FPGA id: ', gpio_id);

	console.time('1x W GPIO32 reset out');
	tio.writeHSGPIO32Digital16({ id: 'GPIO32-1', values: 0 });
	console.timeEnd('1x W GPIO32 reset out');

	console.time('GPIO32 reset leds');
	tio.leds({ id: 'GPIO32-1', led1: 0, led2: 0, led3: 0 });
	console.timeEnd('GPIO32 reset leds');

	console.time('1x W GPIO32 reset out');
	tio.writeHSGPIO32Digital16({ id: 'GPIO32-2', values: 0 });
	console.timeEnd('1x W GPIO32 reset out');

	console.time('GPIO32 reset leds');
	tio.leds({ id: 'GPIO32-2', led1: 0, led2: 0, led3: 0 });
	console.timeEnd('GPIO32 reset leds');

	console.time('setDigitalPattern');
	tio.setDigitalPattern({
		name: 'DO00',
		pattern: 0x55
	});
	console.timeEnd('setDigitalPattern');

	console.time('setDigitalPattern');
	tio.setDigitalPattern({
		name: 'DO02',
		pattern: 0x55
	});
	console.timeEnd('setDigitalPattern');
	
	console.time('setDigitalFreq2ch reset');
	tio.setDigitalFreq2ch([{
		name: 'DO00',
		freq: 0,
		offset: 90
	}, {
		name: 'DO02',
		freq: 0,
		offset: 0
	}]);
	console.timeEnd('setDigitalFreq2ch reset');	

	setTimeout(function() {
		tio.end();
		debug('All pins unexported');
		process.exit(0);
	}, 100);

} else {
	debug('TIO not initialized');
}
