#!/usr/local/bin/node

var fs = require('fs'),
	spawn = require('child_process').spawn,
	debug = require('debug')('TIO-test'),
	TIO = require('../index').TIO;

//spawn('ionice', ['-c3', '-p', process.pid]);

var config = JSON.parse(fs.readFileSync('./data/config.json'));
var tio = TIO(config);

function load(milliseconds) {
  var start = Date.now();
  for (var i = 0; i < 1e7; i++) {
    if ((Date.now() - start) > milliseconds){
      break;
    }
  }
}

var bufFSK = new Buffer([0x8D, 0xEF, 0xF2, 0x38, 0x2D, 0x07, 0x0B, 0xA4, 0x43, 0xE8, 0x46, 0x32, 0x08, 0x62,
	0xB3, 0x29, 0x31, 0x62, 0xB7, 0x75, 0x75, 0x9C, 0x8C, 0xA1, 0x91, 0xFE, 0x66, 0xEE, 0x3A, 0xDA, 0xEA,
	0x1E, 0xAC, 0xBE, 0x02, 0x30, 0x31, 0x0A, 0xB0, 0xB4, 0x9B, 0x62, 0xA9, 0xEF, 0xF6, 0xC7, 0x9D, 0x7A, 
	0x7B, 0xBF, 0x2D, 0x85, 0x7A, 0x71, 0x97, 0xC3, 0x5E, 0x59, 0xE8, 0x07, 0x11, 0xE1, 0x3C, 0x43, 0xC4, 
	0x2F, 0xE6, 0x1E, 0x4D, 0x63, 0x04, 0x66, 0x32, 0xEA, 0xE6, 0x8C, 0x42, 0xB6, 0x15, 0xAB, 0x5E, 0xB9, 
	0x1C, 0xD7, 0x14, 0x12, 0xAB, 0x6B, 0x1C, 0x4A, 0xC2, 0xC4, 0x2A, 0x58, 0x8A, 0x95, 0x9B, 0x54, 0x15, 
	0xDA, 0x13, 0x34, 0xC6, 0xE2, 0x4B, 0x58, 0x10, 0xA6, 0x0C, 0x65, 0x8A, 0xEA, 0x59, 0xF2, 0x10, 0x12, 
	0xA5, 0x7B, 0x97, 0xAA, 0x1C, 0x3F, 0x6A, 0x3D, 0x00, 0xAC, 0x39, 0xF0]);

var bufCOM = new Buffer([ 0x12, 0x13, 0x13, 0x12, 0x11, 0x10, 0x09, 0x08, 0x07, 0x06, 0x05, 0x04, 0x03 ]);

var duration = 180000,
	fskPeriod = 20, 
	sdmuPeriod = 10, 
	tccPeriod = 500, 
	readPeriod = 100,
	fskCounter = 0,
	sdmuCounter = 0,
	tccCounter = 0,
	tolerance = 8,
	delayed = [],
	tolerated = {
		SDMU: [],
		TCC: [],
		STARTFSK: [],
		FSKSTOP: []
	},
	fskport = 'FSK1';

var record = function(who, period, timestamp, d, counter) {
	if (timestamp && (d > period + tolerance)) {
		delayed.push({ w: who, d: d - period, c: counter });
	} else {
		if (timestamp) tolerated[who].push(d - period);
	}
}

var sdmu = function() {
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
	} else if (freq1 <= 0) {   // What if freq1 < 0 in the FPGA 
		incr = 1;	
	}
	freq1 += incr*20;
	freq2 += incr*10;
	t =+ 0.01;
	var y = 5*Math.sin(t*2*Math.PI);
	
	tio.writeAnalog({ name: 'AO03', value: 3 });
	tio.writeCom({ name: 'COM2', data: bufCOM });

	var nt = Date.now();
	var d = nt - sdmuTimestamp;
	record('SDMU', sdmuPeriod, sdmuTimestamp, d, sdmuCounter);
	sdmuTimestamp = nt;
	sdmuCounter++;
}

var tcc = function() {
	tio.writeCom({ name: 'COM1', data: bufCOM });
	var nt = Date.now();
	d = Date.now() - tccTimestamp;
	record('TCC', tccPeriod, tccTimestamp, d, tccCounter);
	tccTimestamp = nt;
	tccCounter++;
}

var fsk = function() {
	setTimeout(process.nextTick, 2, function() {
		tio.writeFSK({ name: fskport, 
			voltage: tio.FSK_MAX_AMPLITUDE, 
			data: bufFSK, 
			continuous: true  
		});		
		var nt = Date.now();
		d = Date.now() - fskTimestamp_start;
		record('STARTFSK', fskPeriod, fskTimestamp_start, d, fskCounter);
		fskTimestamp_start = nt;
	});
	setTimeout(process.nextTick, 15, function() {
		tio.stopFSK({ id: 'FSKCOM-1' });	
		var nt = Date.now();
		d = Date.now() - fskTimestamp_stop;
		record('FSKSTOP', fskPeriod, fskTimestamp_stop, d, fskCounter);
		fskTimestamp_stop = nt;
	});
	fskCounter++;
}

var read = function() {
	tio.readAIO12Analog8({ id : 'AIO12-1' }); // 3ms
	tio.writeHSGPIO32Digital16({ id : 'GPIO32-1' }); // 2ms
	tio.writeHSGPIO32Digital16({ id : 'GPIO32-1' }); // 2ms
	tio.readDigital( { name: 'DI32' });
	tio.readDigital( { name: 'DI33' });
	tio.readDigital( { name: 'DI34' });
	tio.readDigital( { name: 'DI35' });
}

if (tio) {
	debug('TIO stack initialized [mode = ' + process.env.DEBUG + ']');

	var freq1 = 0, 
		freq2 = 0, 
		incr = 1, 
		t = 0, 
		sdmuTimestamp,
		tccTimestamp,
		fskTimestamp_start,
		fskTimestamp_stop;

	// JIT trigger
	sdmu();
	tcc();
	fsk();
	read();
	load(100);
	// end of JIT trigger

	// use this for single measure, uless comment it
	/*
	console.time('SDMU');
	sdmu();
	console.timeEnd('SDMU');

	console.time('TCC');
	tcc();
	console.timeEnd('TCC');

	console.time('FSK');
	fsk();
	console.timeEnd('FSK');

	console.time('READ');
	read();
	console.timeEnd('READ');

	console.time('WRITE ANALOG');
	tio.writeAnalog({ name: 'AO03', value: 300 });
	console.timeEnd('WRITE ANALOG');	
	
	console.time('WRITE COM2');
	tio.writeCom({ name: 'COM2', data: bufCOM });
	console.timeEnd('WRITE COM2');	

	console.time('WRITE GPIO16');
	tio.writeHSGPIO32Digital16({ id : 'GPIO32-1' });
	console.timeEnd('WRITE GPIO16');	

	console.time('WRITE WS');
	tio.setDigitalFreq2ch([{
		name: 'DO00',
		freq: freq1,
		offset: 90
	}, {
		name: 'DO02',
		freq: freq2,
		offset: 90
	}]);	
	console.timeEnd('WRITE WS');

	process.exit(); 
	*/
	// end of single measure section

	setTimeout(function() {
		debug('Test duration: ' + duration + 'ms');
		debug('Current tolerance: ' + tolerance + 'ms = ' + (tolerance/1000*55.5).toFixed(3) + 'm');
		var total = delayed.length + tolerated.SDMU.length + tolerated.TCC.length 
			+ tolerated.STARTFSK.length + tolerated.FSKSTOP.length;

		var maxDeviation = 0, hazardousDeviationCounter = 0;

		for (var i = 0; i < delayed.length; i++) {
			if (delayed[i].d  > maxDeviation) maxDeviation = delayed[i].d;
			if (delayed[i].d > 20) {
				hazardousDeviationCounter++;
				//console.log('!=======>;' + delayed[i].w + ';' + delayed[i].d + ';' + delayed[i].c);
			} /*else {
				console.log(delayed[i].w + ';' + delayed[i].d + ';' + delayed[i].c);
			}*/
		}	
		debug('Total delayed: ' + delayed.length + '  == ' + delayed.length/total*100 + '%');
		debug('Max deviation: ' + maxDeviation);
		debug('Hazardous deviation counter (nb of occurrences > 20ms): ' + hazardousDeviationCounter);

		for (var p in tolerated) {			
			var memo = 0;
			for (var i = 0; i < tolerated[p].length; i++) {
				memo += tolerated[p][i];
			}	
			debug(p + ': avg when tolerated = ' + memo/tolerated[p].length);
		}
		debug('Counters', sdmuCounter, tccCounter, fskCounter);
		tio.end();
  	setTimeout(process.exit, 100);
	}, duration);

	setInterval(function() {
		if (fskport == 'FSK1') {
			fskport = 'FSK2';
		} else {
			fskport = 'FSK1';
		}
	}, 20000);

	setInterval(load, 10, 3);
	setInterval(read, readPeriod);
	setInterval(process.nextTick, sdmuPeriod, sdmu);
	setInterval(process.nextTick, tccPeriod, tcc);
	setInterval(process.nextTick, fskPeriod, fsk);
	/*setInterval(sdmu, sdmuPeriod);
	setInterval(tcc, tccPeriod);
	setInterval(fsk, fskPeriod);*/

} else {
	debug('TIO not initialized');
}

// stop on ctrl-C
process.on('SIGINT', function() {
	tio.end();
  debug('killed by the user');
  setTimeout(process.exit, 100);
});
