#!/usr/local/bin/node

var fs = require('fs'),
	debug = require('debug')('TIO-test'),
	TIO = require('../index').TIO;

var config = JSON.parse(fs.readFileSync('./data/config.json'));
var tio = TIO(config);

function sleep(milliseconds) {
  var start = Date.now();
  for (var i = 0; i < 1e7; i++) {
    if ((Date.now() - start) > milliseconds){
      break;
    }
  }
}

if (tio) {
	debug('TIO stack initialized [mode = ' + process.env.DEBUG + ']');
	debug('DI32= ' + tio.readDigital( { name: 'DI32' }));
	debug('DI33= ' + tio.readDigital( { name: 'DI33' }));
	debug('DI34= ' + tio.readDigital( { name: 'DI34' }));
	debug('DI35= ' + tio.readDigital( { name: 'DI35' }));

	tio.writeDigital( { name: 'DO32', value: 1 });
	sleep(1000);
	tio.writeDigital( { name: 'DO33', value: 1 });
	sleep(1000);
	tio.writeDigital( { name: 'DO32', value: 0 });
	sleep(1000);
	tio.writeDigital( { name: 'DO33', value: 0 });


	setTimeout(function() {
		tio.end();
		debug('All pins unexported');
		process.exit(0);
	}, 1000);

	tio.end();
	debug('All pins unexported');
} else {
	debug('TIO not initialized');
}
process.exit(0);
