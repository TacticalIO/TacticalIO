#!/usr/local/bin/node

var fs = require('fs'),
	debug = require('debug')('TIO-test'),
	TIO = require('../index').TIO;

var config = JSON.parse(fs.readFileSync('./data/config.json'));
var tio = TIO(config);

if (tio) {
	debug('TIO stack initialized [mode = ' + process.env.DEBUG + ']');
	debug('Result => ' + tio.spiTransfer({ data: Buffer("Hello, World!") }));
	tio.cs({ id: 'FSKCOM-1', enable: true });
	tio.cs({ id: 'FSKCOM-1', enable: false });
	console.time('CS measure');
	tio.cs({ id: 'FSKCOM-1', enable: true });
	tio.cs({ id: 'FSKCOM-1', enable: false });
	console.timeEnd('CS measure');
	tio.writeDigital({ name: 'DO49', value: true });
	var ret = tio.readDigital({ name: 'DI49' });
	debug('DI49 = ' + ret, ' Test ' + (ret ? 'ok' : 'ko'));
	tio.writeDigital({ name: 'DO13', value: true });
	debug('DO13 write attempt (GPIO64-1), should have used SPI');
	elf.writeGPIO64Digital32({
		id: 'GPIO64-1',
		values: '10101010101010101010101010101010'
	});
	debug('32 block write attempt (GPIO64-1), should have used SPI');
	tio.writeGPIO64Digital32({
		id: 'GPIO64-1',
		values: [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0]
	});
	debug('32 block write attempt (GPIO64-1), should have used SPI');
	tio.writeGPIO64Digital32({ id: 'GPIO64-1', values: 2863311530 });
	debug('32 block write attempt (GPIO64-1), should have used SPI');
	tio.end(callback);
	debug('All pins unexported');
} else {
	debug('TIO not initialized');
}
process.exit(0);
