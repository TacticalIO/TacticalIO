#!/usr/local/bin/node

var fs = require('fs'),
	debug = require('debug')('TIO-test'),
	TIO = require('../index').TIO;

var config = JSON.parse(fs.readFileSync('./data/config.json'));
var tio = TIO(config);

if (tio) {
	debug('TIO stack initialized [mode = ' + process.env.DEBUG + ']');
	for (var i=0; i<1000; i++) {
		tio.cs( { name: "GPIO64-1", enable: true });
		tio.cs( { name: "GPIO64-1", enable: false });
	}
	tio.end();
	debug('All pins unexported');
} else {
	debug('TIO not initialized');
}
process.exit(0);
