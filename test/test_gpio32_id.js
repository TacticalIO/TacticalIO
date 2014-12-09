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

	console.time('1000x W get id');
	for (var i=0; i<1000; i++) {
		tio.typeId({ id: 'GPIO32-1' });
	}
	console.timeEnd('1000x W get id');

	setTimeout(function() {
		tio.end();
		debug('All pins unexported');
		process.exit(0);
	}, 100);
} else {
	debug('TIO not initialized');
}
