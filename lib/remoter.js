/*
 * @file remoter.js
 * @author Victor Andritoiu
 * @copyright opentekhnia 2014
 */
var debug = require('debug')('remoter'),
	util = require('util'),
	EventEmitter = require('events').EventEmitter;

/*
 * Creates new TacticalIO adapter
 * @class TIORemoter
 * 
 * @param {object} mqtt - configuration
 */
var TIORemoter = function(args) {
	var self = this;

	debug('TIORemoter init started');

	var ds = require('./data').data(args.mqtt);	
	self.ds = ds;

	var remoteServices = [
		'configCPUPins',
		'reset',
		'cs',
		'spiTransfer',
		'typeId',
		'leds',
		'writeHSGPIO32Digital16',
		'readHSGPIO32Digital16',
		'setupHSGPIO32Output6',
		'writeGPIO64Digital',
		'writeGPIO64Digital32',
		'readGPIO64Digital32',
		'writeDigital',
		'readDigital',
		'writeAnalog',
		'readAIO12Analog8',
		'readAnalog',
		'enableComTX',
		'writeCom',
		'readCom',
		'initCom',
		'writeFSK',
		'stopFSK',
		'initFSK',
		'setDigitalPattern',
		'setDigitalFreq',
		'setDigitalFreq2ch',
		'hwReset',
		'hwSyncReset',
		'getClock',
		'resetClock',
		'end'
	]

	for (var i = 0; i < remoteServices.length; i++) {
		self[remoteServices[i]] = function(i) {
			return function(args) {
				ds.rpc(remoteServices[i], args, function(result) {
					debug(remoteServices[i] + ' > ', result);
				});
			}
		}
	}
	return self;
}

util.inherits(TIORemoter, EventEmitter);

exports.TIORemoter = TIORemoter;
