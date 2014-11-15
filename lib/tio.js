var TIOAdapter = require('./tioadapter').TIOAdapter,
	fs = require('fs');

var TIO = function(options, cb) {
	options = options || {};
	var adapter;

	try {
		fs.readFile(options.ioCfgFile, function(err, data) {
			if (!err) {
				adapter = new TIOAdapter({
					io: JSON.parse(data)
				}, function(err) {
					if (options.remote) {
						var ds = require('./data').data(options.mqtt);	
						ds.registerServicesProvider(adapter);
						cb();
					} else {
						cb.call(this);
					}
				});
			} else {
				if (cb) cb(err);
			}
		})
	} catch(err) {
		if (cb) cb(err);
	}
}

exports.TIO = TIO;