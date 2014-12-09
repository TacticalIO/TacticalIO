#!/usr/local/bin/node

var fs = require('fs'),
	debug = require('debug')('TIO-test'),
	TIO = require('../index').TIO;

function sleep(milliseconds) {
  var start = Date.now();
  for (var i = 0; i < 1e7; i++) {
    if ((Date.now() - start) > milliseconds){
      break;
    }
  }
}

var config = JSON.parse(fs.readFileSync('./data/config.json'));
config.ioCfgFile = './data/gpio32_io.json';
var tio = TIO(config);

if (tio) {
	debug('TIO stack initialized [mode = ' + process.env.DEBUG + ']');

	var on = false;

	console.time('1000x W GPIO32 out (array 10)');
	for (var i=0; i<1000; i++) {
		if (on) {
			tio.writeHSGPIO32Digital16({ id: 'GPIO32-1', 
				values: [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0] });
		} else {
			tio.writeHSGPIO32Digital16({ id: 'GPIO32-1', 
				values: [0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1] });
		}
		on = !on;
		sleep(20);
	}
	console.timeEnd('1000x W GPIO32 out (array 10)');

	setTimeout(function() {
		debug('DI08= ' + tio.ds.get('TIO.DI08'));
		tio.end();
		debug('All pins unexported');
		process.exit(0);
	}, 100);
} else {
	debug('TIO not initialized');
}
