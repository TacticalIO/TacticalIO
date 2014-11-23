var TIOAdapter = require('./adapter').TIOAdapter,
	debug = require('debug')('tio'),
	fs = require('fs');

var TIO = function(options) {
	options = options || {};
	var adapter;

	try {
		var cfg = JSON.parse(fs.readFileSync(options.ioCfgFile));
		if (cfg) {
			adapter = new TIOAdapter({ io: cfg });
			if (options.remote) {
				var ds = require('./data').data(options.mqtt);	
				ds.registerServicesProvider(adapter);
			}
			return adapter;
		} else {
			debug('Configuration file error');
			return null;
		}
	} catch(err) {
		debug('Init error: ' + err);
		debug(err.stack);
		if (process.arch != 'arm') {
			return {
				writeCom: function() { debug('writeCom'); },
				readCom: function() { debug('readCom'); },
				initCom: function() { debug('initCom'); },
				writeFSK: function() { debug('writeFSK'); },
				initFSK: function() { debug('initFSK'); },
				writeDigital: function() { debug('writeDigital'); },
				readDigital: function() { debug('readDigital'); },
				writeAnalog: function() { debug('writeAnalog'); }, 
				readAnalog: function() { debug('readAnalog'); }, 
				setDigitalPattern: function() { debug('setDigitalPattern'); },
				setDigitalFreq: function() { debug('setDigitalFreq'); },
				setDigitalSlave: function() { debug('setDigitalSlave'); },
				hwReset: function() { debug('hwReset'); },
				hwSyncReset: function() { debug('hwSyncReset'); },
				resetClock: function() { debug('resetClock'); },
				getClock: function() { debug('getClock'); },
				iid: function() { debug('iid'); },
				end: function() { debug('end'); }
			}
		} else {
			return null;
		}
	}
}

exports.TIO = TIO;