#!/usr/local/bin/node

var fs = require('fs'),
	spawn = require('child_process').spawn,
	debug = require('debug')('TIO-test'),
	TIO = require('../index').TIO;

//spawn('ionice', ['-c3', '-p', process.pid]);

var config = JSON.parse(fs.readFileSync('./data/config.json'));
var tio = TIO(config);

var bufFSK = new Buffer([0x8D, 0xEF, 0xF2, 0x38, 0x2D, 0x07, 0x0B, 0xA4, 0x43, 0xE8, 0x46, 0x32, 0x08, 0x62,
	0xB3, 0x29, 0x31, 0x62, 0xB7, 0x75, 0x75, 0x9C, 0x8C, 0xA1, 0x91, 0xFE, 0x66, 0xEE, 0x3A, 0xDA, 0xEA,
	0x1E, 0xAC, 0xBE, 0x02, 0x30, 0x31, 0x0A, 0xB0, 0xB4, 0x9B, 0x62, 0xA9, 0xEF, 0xF6, 0xC7, 0x9D, 0x7A, 
	0x7B, 0xBF, 0x2D, 0x85, 0x7A, 0x71, 0x97, 0xC3, 0x5E, 0x59, 0xE8, 0x07, 0x11, 0xE1, 0x3C, 0x43, 0xC4, 
	0x2F, 0xE6, 0x1E, 0x4D, 0x63, 0x04, 0x66, 0x32, 0xEA, 0xE6, 0x8C, 0x42, 0xB6, 0x15, 0xAB, 0x5E, 0xB9, 
	0x1C, 0xD7, 0x14, 0x12, 0xAB, 0x6B, 0x1C, 0x4A, 0xC2, 0xC4, 0x2A, 0x58, 0x8A, 0x95, 0x9B, 0x54, 0x15, 
	0xDA, 0x13, 0x34, 0xC6, 0xE2, 0x4B, 0x58, 0x10, 0xA6, 0x0C, 0x65, 0x8A, 0xEA, 0x59, 0xF2, 0x10, 0x12, 
	0xA5, 0x7B, 0x97, 0xAA, 0x1C, 0x3F, 0x6A, 0x3D, 0x00, 0xAC, 0x39, 0xF0]);

var bufCOM = new Buffer([ 0x12, 0x13, 0x13, 0x12, 0x11, 0x10, 0x09, 0x08, 0x07, 0x06, 0x05, 0x04, 0x03 ]);

if (tio) {
	debug('TIO stack initialized [mode = ' + process.env.DEBUG + ']');

	setInterval(function() {
		tio.readAIO12Analog8({ id : 'AIO12-1' });
		tio.readHSGPIO32Digital16({ id : 'GPIO32-1' });
		tio.readHSGPIO32Digital16({ id : 'GPIO32-1' });
		tio.readDigital( { name: 'DI32' });
		tio.readDigital( { name: 'DI33' });
		tio.readDigital( { name: 'DI34' });
		tio.readDigital( { name: 'DI35' });
	}, 100);

	var freq1 = 0, freq2 = 0, incr = 1, t = 0;
	setInterval(function() {
		tio.setDigitalFreq2ch([{
			name: 'DO00',
			freq: freq1,
			offset: 90
		}, {
			name: 'DO02',
			freq: freq2,
			offset: 90
		}]);
		
		if (freq1 >= 20000) {
			incr = -1;
		} else if (freq1 <= 0) {   /* What if freq1 < 0 in the FPGA */
			incr = 1;	
		}
		freq1 += incr*20;
		freq2 += incr*10;
		t =+ 0.01;
		tio.writeAnalog({ name: 'AO03', value: 5*Math.sin(t*2*Math.PI) });
		tio.writeCom({ name: 'COM2', data: bufCOM });
	}, 10);

	setInterval(function() {
		tio.writeCom({ name: 'COM1', data: bufCOM });
	}, 500);

	var fsk = 'FSK1';
	setInterval(function() {
		if (fsk == 'FSK1') {
			fsk = 'FSK2';
		} else {
			fsk = 'FSK1';
		}
	}, 20000);

	setInterval(function() {
		setTimeout(function() {
			tio.writeFSK({ name: fsk, voltage: tio.FSK_MAX_AMPLITUDE, data: bufFSK, continuous: true  });
		}, 2);
		setTimeout(function() {
			tio.stopFSK({ id: 'FSKCOM-1' });
		}, 15);
	}, 20);
} else {
	debug('TIO not initialized');
}

// stop on ctrl-C
process.on('SIGINT', function() {
	tio.end();
  debug('killed by the user');
  /* => now separate when production */
  if (process.arch == 'x64') {
  	server.kill('SIGKILL');
  }
  setTimeout(process.exit, 100);
});
