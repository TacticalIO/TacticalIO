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

var period = 10;
var voltage = 4000;
var config = JSON.parse(fs.readFileSync('./data/config.json'));
//config.ioCfgFile = './data/fskcom_io.json';
var tio = TIO(config);
var buf = new Buffer([0x8D, 0xEF, 0xF2, 0x38, 0x2D, 0x07, 0x0B, 0xA4, 0x43, 0xE8, 0x46, 0x32, 0x08, 0x62,
	0xB3, 0x29, 0x31, 0x62, 0xB7, 0x75, 0x75, 0x9C, 0x8C, 0xA1, 0x91, 0xFE, 0x66, 0xEE, 0x3A, 0xDA, 0xEA,
	0x1E, 0xAC, 0xBE, 0x02, 0x30, 0x31, 0x0A, 0xB0, 0xB4, 0x9B, 0x62, 0xA9, 0xEF, 0xF6, 0xC7, 0x9D, 0x7A, 
	0x7B, 0xBF, 0x2D, 0x85, 0x7A, 0x71, 0x97, 0xC3, 0x5E, 0x59, 0xE8, 0x07, 0x11, 0xE1, 0x3C, 0x43, 0xC4, 
	0x2F, 0xE6, 0x1E, 0x4D, 0x63, 0x04, 0x66, 0x32, 0xEA, 0xE6, 0x8C, 0x42, 0xB6, 0x15, 0xAB, 0x5E, 0xB9, 
	0x1C, 0xD7, 0x14, 0x12, 0xAB, 0x6B, 0x1C, 0x4A, 0xC2, 0xC4, 0x2A, 0x58, 0x8A, 0x95, 0x9B, 0x54, 0x15, 
	0xDA, 0x13, 0x34, 0xC6, 0xE2, 0x4B, 0x58, 0x10, 0xA6, 0x0C, 0x65, 0x8A, 0xEA, 0x59, 0xF2, 0x10, 0x12, 
	0xA5, 0x7B, 0x97, 0xAA, 0x1C, 0x3F, 0x6A, 0x3D, 0x00, 0xAC, 0x39, 0xF0]);

var buf2 = new Buffer([0x8D, 0xEF, 0xF2, 0x38, 0x2D, 0x07, 0x0B, 0xA4, 0x43, 0xE8, 0x46, 0x32, 0x08, 0x62,
	0xB3, 0x29, 0x31, 0x62, 0xB7, 0x75, 0x75, 0x9C, 0x8C, 0xA1, 0x91, 0xFE, 0x66, 0xEE, 0x3A, 0xDA, 0xEA,
	0x1E, 0xAC, 0xBE, 0x02, 0x30, 0x31, 0x0A, 0xB0, 0xB4, 0x9B, 0x62, 0xA9, 0xEF, 0xF6, 0xC7, 0x9D, 0x7A, 
	0x7B, 0xBF, 0x2D, 0x85, 0x7A, 0x71, 0x97, 0xC3, 0x5E, 0x59, 0xE8, 0x07, 0x11, 0xE1, 0x3C, 0x43, 0xC4, 
	0x2F, 0xE6, 0x1E, 0x4D, 0x63, 0x04, 0x66, 0x32, 0xEA, 0xE6, 0x8C, 0x42, 0xB6, 0x15, 0xAB, 0x5E, 0xB9, 
	0x1C, 0xD7, 0x14, 0x12, 0xAB, 0x6B, 0x1C, 0x4A, 0xC2, 0xC4, 0x2A, 0x58, 0x8A, 0x95, 0x9B, 0x54, 0x15, 
	0xDA, 0x13, 0x34, 0xC6, 0xE2, 0x4B, 0x58, 0x10, 0xA6, 0x0C ]);


if (tio) {
	debug('TIO stack initialized [mode = ' + process.env.DEBUG + ']');

	console.time('FSKCOM write leds');
	tio.leds({ id: 'FSKCOM-1', led1: 1, led2: 1, led3: 0 });
	console.timeEnd('FSKCOM write leds');

	console.time('Write FSK1');
	tio.writeFSK({ name: 'FSK1', voltage: voltage, data: buf, continuous: true });
	console.timeEnd('Write FSK1');
	sleep(5000);
	tio.stopFSK({ id: 'FSKCOM-1' });

	console.time('Write FSK2');
	tio.writeFSK({ name: 'FSK2', voltage: voltage, data: buf, continuous: true  });
	console.timeEnd('Write FSK2');
	sleep(5000);
	tio.stopFSK({ id: 'FSKCOM-1' });

	console.time('Write FSK1');
	tio.writeFSK({ name: 'FSK1', voltage: voltage, data: buf2, continuous: true });
	console.timeEnd('Write FSK1');
	sleep(5000);
	tio.stopFSK({ id: 'FSKCOM-1' });

	setTimeout(function() {
		tio.end();
		debug('All pins unexported');
		process.exit(0);
	}, 1000);
} else {
	debug('TIO not initialized');
}
