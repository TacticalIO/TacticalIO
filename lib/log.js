var dgram = require('dgram'),
	now = require('performance-now'),
	clc = require('cli-color'),
	MongoClient = require('mongodb').MongoClient;

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
	    var t = now().toFixed(3);
	    if (this.destination == 'udp') {
	    	args = [l, t, this.name].concat(args);
	    	var msg = new Buffer(JSON.stringify(args));
	    	this._logger.send(msg, 0, msg.length, this.port, this.ip);	
	    } else if (this.destination == 'console') {
	    	var when = String("............." + t).slice(-13);
	    	args = [ logLevels[l].fct('[' + l.slice(0,4) + ']'), 
	    	clc.xterm(213)('[' + when +']'), '[' + this.name + ']'].concat(args);
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
  var mongodb;

  if (options.log.destination == 'db') {
		MongoClient.connect(options.log.mongo, function(err, db) {
  		if (!err) {
  			console.log('[' + options.log.name + '] last message before switch to db: db connected');
  		} else {
  			console.error('[' + options.log.name + '] db connection error: ' + err);
  		}
  		mongodb = db;
		});
  }

	options.mqtt.onsubscribe = function(message) {
  	logger.info('New data subscriber: ' + message.id);
	}

	options.mqtt.observer = true; // only observer, no refresh
  var ds = require('./data').data(options.mqtt);

  logServer.on('message', function (msg, rinfo) {
    var message = JSON.parse(msg);
    if (options.log.destination == 'console') {
    	var when = String("............." + message[1]).slice(-13);
	    var args = [ logLevels[message[0]].fct('[' + message[0].slice(0,4) + ']'), 
	    	clc.xterm(213)('[' + when +']'), '[' + message[2] + ']'].concat(message.slice(3));
	    console.log.apply(console, args);
  	} else if (options.log.destination == 'db' && mongodb) {
		  mongodb.collection('logs').insert({
		  	level: message[0],
		  	t: message[1],
		  	module: message[2],
		  	message: message[3]
		  }, function(err, result) {
		  	if (err) {
		  		console.error('[' + options.log.name + '] db log error');
		  	}
		  });
  	}
  });

  logServer.on('listening', function () {
    var a = this.address();
    if (options.log.destination == 'console') {
    	logger.info('Server listening ' + a.address + ':' + a.port);
    } else if (options.log.destination == 'db' && mongodb) {
		  mongodb.collection('logs').insert({
		  	level: 'info',
		  	message: 'Server listening ' + a.address + ':' + a.port
		  }, function(err, result) {
		  	if (err) {
		  		console.error('[' + options.log.name + '] db log error');
		  	}
		  });
    }
  });

  logServer.bind(options.log.port, options.log.ip);

  ds.observe('_ALL_', function(name, val, old, t) {
    if (options.mqtt.datalog == 'yes') {
    	if (options.log.destination == 'console') {
      	logger.info('At ' + t + ': ' + name + ' = ' + val);
    	} else if (options.log.destination == 'db' && mongodb) {
			  mongodb.collection('data').insert({
			  	t: t,
			  	name: name,
			  	value: val
			  }, function(err, result) {
			  	if (err) {
			  		console.error('[' + options.log.name + '] db log error');
			  	}
			  });
    	}
    }
  });

  this.end = function() {
		if (mongodb) mongodb.close();
  }
}

exports.LogApp = LogApp;