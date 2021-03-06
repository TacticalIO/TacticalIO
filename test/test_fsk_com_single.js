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
var buf1 = new Buffer([ 0xDD, 0xDD, 0xDD, 0xDD, 0xDD, 0xDD, 0xDD, 0xDD, 0xDD, 0xDD, 0xDD, 0xDD, 0xDD ]);
var buf2 = new Buffer([ 0x0A, 0x0A, 0x0A, 0x0A, 0x0A, 0x0A, 0x0A, 0x0A, 0x0A, 0x0A, 0x0A, 0x0A, 0x0A ]);
var buf3 = new Buffer([ 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF ]);
var buf4 = new Buffer([ 0xFF, 0xDD, 0x0A, 0x13, 0x13, 0x0A, 0xDD, 0xFF, 0xFF, 0xDD, 0x13, 0x0A, 0xFF ]);
var buf5 = new Buffer([ 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01 ]);

if (tio) {
	debug('TIO stack initialized [mode = ' + process.env.DEBUG + ']');

	console.time('FSKCOM write leds');
	tio.leds({ id: 'FSKCOM-1', led1: 1, led2: 1, led3: 1 });
	console.timeEnd('FSKCOM write leds');

	tio.enableComTX({ name: 'COM1', enable: 1 });
	tio.enableComTX({ name: 'COM2', enable: 1 });
	sleep(10);

	console.time('Write COM2');
	tio.writeCom({ name: 'COM2', data: buf3 });
	console.timeEnd('Write COM2');
	sleep(10); 

	console.time('Write COM1');
	tio.writeCom({ name: 'COM1', data: buf });
	console.timeEnd('Write COM1');
	console.time('Write COM2');
	tio.writeCom({ name: 'COM2', data: buf1 });
	console.timeEnd('Write COM2');
	sleep(10); 
 
	console.time('Write COM2');
	tio.writeCom({ name: 'COM2', data: buf2 });
	console.timeEnd('Write COM2');
	sleep(10);  
 
	console.time('Write COM2');
	tio.writeCom({ name: 'COM2', data: buf4 });
	console.timeEnd('Write COM2');
	sleep(10); 
 
	console.time('Write COM2');
	tio.writeCom({ name: 'COM2', data: buf5 });
	console.timeEnd('Write COM2');
	sleep(1000);

	tio.enableComTX({ name: 'COM2', enable: 0 });
	debug('delay approx.: ', (Date.now() - tio.clockResetTime)/1.024);
	console.time('Write COM2 - delayed');
	tio.writeCom({ name: 'COM2', data: buf, when: Date.now() + 1500 });
	console.timeEnd('Write COM2 - delayed');

	setTimeout(function() {
		tio.end();
		debug('All pins unexported');
		process.exit(0);
	}, 2000);
} else {
	debug('TIO not initialized');
}
