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
		debug(err.stack)
		return null;
	}
}

exports.TIO = TIO;