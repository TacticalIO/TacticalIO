var dgram = require('dgram'),
	now = require('performance-now'),
	clc = require('cli-color');

var logLevels = {
	'test': { value: 17, fct: clc.xterm(39) },
	'debug': { value: 13, fct: clc.white },
	'info': { value: 11, fct: clc.green },
	'warn': { value: 5, fct: clc.xterm(208) },
	'error': { value: 0, fct: clc.red }
}

var Logger = function(options, name) {
	option = options || {};

	this.uuid = Math.random().toString(36).slice(2);
	this.name = options.name || name || 'TioLogger';
	this.level = options.level || 'info';
	this.activated = options.activated;
	this.destination = options.destination || 'console';
	this.ip = options.ip;
	this.port = options.port;
	this._logger = dgram.createSocket("udp4");
}

Logger.prototype.setDestination = function(dest, ip, port) {
	this.destination = dest;
	this.ip = ip;
	this.port = port;
}

var logFctAsPerLevel = function(l) {
	return function() {
	  if (this.activated && logLevels[l].value <= logLevels[this.level].value) {
	    var args = Array.prototype.slice.call(arguments, 0);
	    var when = String("............." + now().toFixed(3)).slice(-13);
	    args = [ logLevels[l].fct('[' + l.slice(0,4) + ']'), 
	    	clc.xterm(213)('[' + when +']'), '[' + this.name + ']'].concat(args);
	    if (this.destination == 'udp') {
	    	var msg = new Buffer(JSON.stringify(args));
	    	this._logger.send(msg, 0, msg.length, this.port, this.ip);	
	    } else if (this.destination == 'console') {
	    	console.log.apply(console, args);
	    }
	  }
	}
}	

for (var ll in logLevels) {
	Logger.prototype[ll] = logFctAsPerLevel(ll);
}

exports.Logger = Logger;

var LogApp = function(options) {
  var logger = new Logger(options.log);
  var logServer = dgram.createSocket('udp4');

	options.mqtt.onsubscribe = function(message) {
  	logger.info('New data subscriber: ' + message.id);
	}

	options.mqtt.observer = true; // only observer
  var ds = require('./data').data(options.mqtt);

  logServer.on('message', function (msg, rinfo) {
    var message = JSON.parse(msg);
    console.log.apply(console, message);
  });

  logServer.on('listening', function () {
    var a = this.address();
    logger.info('Server listening ' + a.address + ':' + a.port);
  });

  logServer.bind(options.log.port, options.log.ip);

  ds.observe('_ALL_', function(name, val, old, t) {
    if (options.mqtt.datalog == 'yes') {
      logger.info('At ' + t + ': ' + name + ' = ' + val);
    }
  });
}

exports.LogApp = LogApp;