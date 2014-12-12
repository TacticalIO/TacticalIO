#!/usr/local/bin/node

var fs = require('fs'),
	debug = require('debug')('TIO-test'),
	TIO = require('../index').TIO;

var config = JSON.parse(fs.readFileSync('./data/config.json'));
//config.ioCfgFile = './data/aio12_io.json';
var tio = TIO(config);

if (tio) {
	debug('TIO stack initialized [mode = ' + process.env.DEBUG + ']');

	console.time('board id');
	var aio_id = tio.typeId( { id: 'AIO12-1'});
	console.timeEnd('board id');	
	console.log('AIO12-1 FPGA id: ', aio_id);

	var t=0;
	var sinTimer = setInterval(function() {
		var y = 5*Math.sin(t*2*Math.PI);
		tio.writeAnalog({ name: 'AO00', value: y, when: 0 });
		tio.writeAnalog({ name: 'AO01', value: y, when: 0 });
		tio.writeAnalog({ name: 'AO02', value: y, when: 0 });
		tio.writeAnalog({ name: 'AO03', value: y, when: 0 });
		t += 0.01;
	}, 10);

	setTimeout(function() {
		clearInterval(sinTimer);
		tio.end();
		debug('All pins unexported');
		process.exit(0);
	}, 20000);
} else {
	debug('TIO not initialized');
}
