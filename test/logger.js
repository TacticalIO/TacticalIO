#!/usr/local/bin/node

var myIP = require('my-ip'),
	dgram = require('dgram'),
  LogApp = require('../lib/log').LogApp,
  fs = require('fs');

var config = JSON.parse(fs.readFileSync('./data/config.json'));

config.log.destination = 'console';
config.log.activated = true;
config.log.ip = myIP();
config.log.name = 'LOGGER';

var logapp = new LogApp(config);

// stop on ctrl-C
process.on('SIGINT', function() {
  console.log(' [LOGGER] killed by the user');
  process.exit();
});
