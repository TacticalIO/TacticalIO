#!/usr/local/bin/node

var TIOAdapter = require('../index').TIOAdapter,
	fs = require('fs'),
	debug = require('debug')('tioadapter'),
	async = require('async');

var ioConfig = JSON.parse(fs.readFileSync('./io.json')),
	tio = new TIOAdapter({
		io: ioConfig, 
		oninit: initialized
	});

function initialized(err) {
	var self = this;
	if (!err) {
		debug('TIO stack initialized [mode = ' + process.env.DEBUG + ']');
		async.series([
			function(callback) {
				self.spiTransfer({
					data: Buffer("Hello, World!")
				}, function(err, data) {
						if (!err) {
							debug('Result => ' + data);
						}
						callback(err);
				});
			},
			function(callback) {
				self.cs({
					spi_address: 1, 
					enable: true
				}, function(err) {
					if (!err) debug('CS 1 enabled (low level)');
					callback(err);
				});
			},
			function(callback) {
				self.writeDigital({
					name: 'DO49', 
					value: true
				}, function(err) {
					if (err) {
						debug('DO49 write failed: ' + err);
					}
					callback(err);
				});
			},
			function(callback) {
				self.readDigital({
					name: 'DI49' 
				}, function(err, value) {
					if (!err) {
						debug('DI49 = ' + value, ' Test ' + (value ? 'ok' : 'ko'));
					}
					debug('DO49 read failed: ' + err);
					callback(err);
				});
			},
			function(callback) {
				self.writeDigital({
					name: 'DO13', 
					value: true
				}, function(err) {
					if (err) {
						debug('DO13 write failed: ' + err);
					}
					callback(err);
				});
			},
			function(callback) {
				self.writeGPIO64Digital32({
					spi_address: 4,
					values: '10101010101010101010101010101010'
				}, function(err) {
					if (err) {
						debug('Block write failed: ' + err);
					}
					callback(err);
				});
			},
			function(callback) {
				self.writeGPIO64Digital32({
					spi_address: 4,
					values: [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0]
				}, function(err) {
					if (err) {
						debug('Block write failed: ' + err);
					}
					callback(err);
				});
			},
			function(callback) {
				self.writeGPIO64Digital32({
					spi_address: 4,
					values: 2863311530
				}, function(err) {
					if (err) {
						debug('Block write failed: ' + err);
					}
					callback(err);
				});
			},
			function(callback) {
				self.end(callback);
			}
		], function() {
			debug('All pins unexported');
			return process.exit(0);
		});
	} else {
		debug(err);
		process.exit(0);
	}
}
