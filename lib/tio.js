var TIOAdapter = require('./adapter').TIOAdapter,
	TIORemoter = require('./remoter').TIORemoter,
	debug = require('debug')('tio'),
	fs = require('fs');

var TIO = function(options) {
	options = options || {};
	var adapter;
	try {
		if (options.remoteIO) {
			adapter = new TIORemoter({ mqtt: options.mqtt });
		} else {
			var cfg = JSON.parse(fs.readFileSync(options.ioCfgFile));
			adapter = new TIOAdapter({ io: cfg, mqtt: options.mqtt });
			if (options.mqtt.remotified) adapter.remotify();
		}
		return adapter;
	} catch(err) {
		debug('Init error: ' + err, options);
		if (process.arch != 'arm') {
			var stub = {
				writeCom: function() { debug('writeCom'); },
				readCom: function() { debug('readCom'); },
				initCom: function() { debug('initCom'); },
				writeFSK: function() { debug('writeFSK'); },
				initFSK: function() { debug('initFSK'); },
				readAIO12Analog8: function() { debug('readAIO12Analog8'); },
				writeDigital: function() { debug('writeDigital'); },
				readDigital: function() { debug('readDigital'); },
				writeAnalog: function() { debug('writeAnalog'); }, 
				writeHSGPIO32Digital16: function() { debug('writeHSGPIO32Digital16'); }, 
				readGPIO64Digital32: function() { debug('readGPIO64Digital32'); }, 
				writeGPIO64Digital32: function() { debug('writeGPIO64Digital32'); }, 
				setDigitalFreq2ch: function() { debug('setDigitalFreq2ch'); }, 
				stopFSK: function() { debug('stopFSK'); },  
				enableComTX: function() { debug('enableComTX'); },
				readAnalog: function() { debug('readAnalog'); }, 
				setDigitalPattern: function() { debug('setDigitalPattern'); },
				setDigitalFreq: function() { debug('setDigitalFreq'); },
				setDigitalSlave: function() { debug('setDigitalSlave'); },
				hwReset: function() { debug('hwReset'); },
				hwSyncReset: function() { debug('hwSyncReset'); },
				resetClock: function() { debug('resetClock'); },
				getClock: function() { debug('getClock'); },
				typeId: function() { debug('typeId'); },
				end: function() { debug('end'); }
			}
			if (options.remoteIO) {
				var ds = require('tio').data(options.mqtt);
				ds.registerServicesProvider(stub);
				debug('Services registered for stub');

			}
			return stub;
		} else {
			return null;
		}
	}
}

exports.TIO = TIO;