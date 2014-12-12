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
if (tio) {
	debug('TIO stack initialized [mode = ' + process.env.DEBUG + ']');


	var frameSendTime = [];
	console.time('1000x Write COM1');
	for (var i = 0; i < 1000; i++) {
		tio.writeCom({ name: 'COM1', data: buf });
		frameSendTime.push(Date.now());
		sleep(10);
	}
	console.timeEnd('1000x Write COM1');

	for (var i = 1; i < 1000; i++) {
		if (frameSendTime[i] - frameSendTime[i-1] > 15) {
			debug('frame delayed', i, frameSendTime[i] - frameSendTime[i-1]);
		}
	}

	frameSendTime = [];
	console.time('1000x Write COM2');
	for (var i = 0; i < 1000; i++) {
		tio.writeCom({ name: 'COM2', data: buf });
		sleep(10);
	}
	console.timeEnd('1000x Write COM2');

	for (var i = 1; i < 1000; i++) {
		if (frameSendTime[i] - frameSendTime[i-1] > 15) {
			debug('frame delayed', i, frameSendTime[i] - frameSendTime[i-1]);
		}
	}

	sleep(1000);
	tio.enableComTX({ name: 'COM1', enable: 0 });
	tio.enableComTX({ name: 'COM2', enable: 0 });
	sleep(10);

	debug('delay approx.: ', (Date.now() - tio.clockResetTime)/1.024);
	console.time('Write COM2 - delayed');
	tio.writeCom({ name: 'COM2', data: buf, when: Date.now() + 1500 });
	console.timeEnd('Write COM2 - delayed');


	setTimeout(function() {
		tio.end();
		debug('All pins unexported');
		process.exit(0);
	}, 5000);
} else {
	debug('TIO not initialized');
}
