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
//config.ioCfgFile = './data/fskcom_io.json';
var tio = TIO(config);
var buf = new Buffer([ 0x12, 0x13, 0x13, 0x12, 0x11, 0x10, 0x09, 0x08, 0x07, 0x06, 0x05, 0x04, 0x03 ]);
var buf1 = new Buffer([ 0x0A, 0x00, 0x0A, 0x00, 0x0A, 0x00, 0x0A, 0x00, 0x0A, 0x00, 0x0A, 0x00, 0x0A ]);
var buf2 = new Buffer([ 0x0A, 0x0A, 0x0A, 0x0A, 0x0A, 0x0A, 0x0A, 0x0A, 0x0A, 0x0A, 0x0A, 0x0A, 0x0A ]);

if (tio) {
	debug('TIO stack initialized [mode = ' + process.env.DEBUG + ']');

	tio.enableComTX({ name: 'COM1', enable: 0 });
	tio.enableComTX({ name: 'COM2', enable: 0 });
	sleep(10);

	debug('delay approx.: ', (Date.now() + 1500 - tio.clockResetTime)/1.024);
	console.time('Write COM2 - delayed');
	tio.writeCom({ name: 'COM2', data: buf1, when: Date.now() + 1500 });
	console.timeEnd('Write COM2 - delayed');

	setTimeout(function() {
		tio.end();
		debug('All pins unexported');
		process.exit(0);
	}, 2000);
} else {
	debug('TIO not initialized');
}
