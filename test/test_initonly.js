#!/usr/local/bin/node

var fs = require('fs'),
	async = require('async'),
	debug = require('debug')('TIO-test'),
	TIO = require('../index').TIO;

debug('TIO init test started (switch DEBUG env variable to "*" in order to see logs)');
var config = JSON.parse(fs.readFileSync('./data/config.json'));
debug('Configuration loaded');
var tio = new TIO(config, initialized);

function initialized(err) {
	var self = this;
	if (!err) {
		debug('TIO stack initialized [DEBUG = ' + process.env.DEBUG + ']');
		setTimeout(self.end, 3000, function() {
			debug('All pins unexported');
			process.exit(0);
		});
	} else {
		debug(err);
		process.exit(0);
	}
}


// stop on ctrl-C
process.on('SIGINT', function() {
  debug(' [TIO] killed by the user');
  setTimeout(process.exit, 100, 1);
});
