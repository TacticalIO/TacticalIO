/*
 * @file tio.js
 * @author Victor Andritoiu
 * @copyright opentekhnia 2014
 */
var SPI = require('pi-spi'),
	Gpio = require('onoff').Gpio,
	async = require('async'),
	debug = require('debug')('adapter');

/*
 * Extracts a set of bits from a custom binary representation (str or array of boolean)
 * and returns the corresponding int value
 * @param {int} bitArray - binary representation (string or array)
 * @param {int} start - position of first bit to be extracted
 * @param {boolean} length - number of bits to be extracted
 * @param {int} size - size of the original binary representation 
 * @return {int} - decoded value
 * @api private
 */
function b(bitArray, start, length, size) {
	if (typeof bitArray == 'string') {
		return parseInt(bitArray.substr(start, length), 2);
	} else if (typeof bitArray == 'int' || typeof bitArray == 'number') {
		var padded = Array(size).join('0');
		bitArray = (padded + bitArray.toString(2)).slice(-size).substr(start, length);
		return parseInt(bitArray, 2);
	} else {
		bitArray = bitArray.slice(start, start+length).join('');
		return parseInt(bitArray, 2);
	}
}

/*
 * Returns a string of bits from int value
 * @param {int} val - value to be converted
 * @param {int} size - size of the returned string in bits == string length
 * @return {string} - converted string
 * @api private
 */
function bitString(val, size) {
	var empty = Array(size).join('0');
	return (empty + val.toString(2)).slice(-size);
}

/*
 * If bitValue defined, sets bit located at offset inside a given byte
 * else returns bit value at offset
 * @param {int} val - byte value before bit set. Must be a byte value.
 * @param {int} offset - position of the bit to be set
 * @param {boolean=} bitValue - value of the bit to be set 1 or 0
 * @api private
 */
function bit(val, offset, bitValue) {
	var vstr = String('00000000' + val.toString(2)).slice(-8);
	var a = vstr.split('');
	if (bitValue != undefined) {
		a[7-offset] = bitValue ? '1' : '0';
		return parseInt(a.join(''), 2);
	} else {
		return parseInt(a[7-offset]);
	}
}

/*
 * GPIO 64 constants for SPI communnication
 */
const GPIO64_WRITE_CTRL_BYTE	= b('01000000');
const GPIO64_READ_CTRL_BYTE		= b('01000001');
const GPIO64_CS 						  = [ b('11110001'), b('11111001'), b('11110101'), b('11110011') ];

const GPIO64_IODIRA 					= 0x00;
const GPIO64_IODIRB 					= 0x01;
const GPIO64_IOCON						= 0x0A;
const GPIO64_GPPUA 						= 0x0C;
const GPIO64_GPPUB  					= 0x0D;
const GPIO64_GPIOA_IN					= 0x12;
const GPIO64_GPIOB_OUT				= 0x13;

var PINS = {
  // 1: 3.3v
  // 2: 5v
  '3':  2,
  // 4: 5v
  '5':  3,
  // 6: ground
  '7':  4,
  '8':  14,
  // 9: ground
  '10': 15,
  '11': 17,
  '12': 18,
  '13': 27,
  // 14: ground
  '15': 22,
  '16': 23,
  // 17: 3.3v
  '18': 24,
  '19': 10,
  // 20: ground
  '21': 9,
  '22': 25,
  '23': 11,
  '24': 8,
  // 25: ground
  '26': 7,

  // Model B+ pins
  // 27: ID_SD
  // 28: ID_SC
  '29': 5,
  // 30: ground
  '31': 6,
  '32': 12,
  '33': 13,
  // 34: ground
  '35': 19,
  '36': 16,
  '37': 26,
  '38': 20,
  // 39: ground
  '40': 21
};

/*
 * Creates new TacticalIO adapter
 * @class TIOAdapter
 * 
 * @param {JSON} io - configuration data
 * @param {function=} cb - callback on initialization done 
 */
var TIOAdapter = function(args, cb) {
	var self = this,
		io = args ? args.io : null,
		spi;

	/*
	 * clock correspondance between UTC time and Tio stack clock:
	 * this indicates T0 for the Tio stack clock reset +/- 1ms
	 */
	self.clockResetTime = 0; 

	if (!io) {
		if (cb) {
			cb('Error: missing configuration data');
		}
		return undefined;
	}

	if (process.arch == 'x64') {
		spi = SPI.initialize('/dev/spidev0.0', 'stub');
	} else {
		spi = SPI.initialize('/dev/spidev0.0')
	}

	var csMap = {},
		muxMap = {},
		IO= {};

	/**
	 * CPU pins handles
	 */
	var csmux = [],
		cs = []; 

	/*
   * Initialiaze HS-GPIO32
   * @param spi_address {int} - address corresponding to the board 
	 * @param {function=} cb - callback on done or error
   * @api private
   */
  var initHSGPIO32 = function(spi_address, cb) {
  	debug('Board init: ' + spi_address);
  	cb();
  }

	/*
   * Initialiaze GPIO64
   * @param spi_address {int} - address corresponding to the board 
	 * @param {function=} cb - callback on done or error
   * @api private
   */
  var initGPIO64 = function(spi_address, cb) {
  	debug('Board init: ' + spi_address);
  	async.series([
  		function(callback) {
  			self.cs({ 
  				spi_address: spi_address, 
  				enable: true
  			}, callback);
  		},
  		function(callback) {
  			var data = new Buffer(3);
  			data.writeUInt8(GPIO64_WRITE_CTRL_BYTE & GPIO64_CS[0], 0);
  			data.writeUInt8(GPIO64_IOCON, 1);
  			data.writeUInt8(b('00001000'), 2);

  			self.spiTransfer({ data : data }, callback);
  		},
  		function(callback) {
  			self.cs({ 
  				spi_address: spi_address, 
  				enable: false
  			}, callback);
  		},
  		function(callback) {
  			self.cs({ 
  				spi_address: spi_address, 
  				enable: true
  			}, callback);
  		},
  		function(callback) {
  			var data = new Buffer(3);
  			data.writeUInt8(GPIO64_WRITE_CTRL_BYTE & GPIO64_CS[0], 0);
  			data.writeUInt8(GPIO64_IODIRB, 1);
  			data.writeUInt8(0x00, 2);

  			self.spiTransfer({ data : data }, callback);
  		},
  		function(callback) {
  			var data = new Buffer(3);
  			data.writeUInt8(GPIO64_WRITE_CTRL_BYTE & GPIO64_CS[1], 0);
  			data.writeUInt8(GPIO64_IODIRB, 1);
  			data.writeUInt8(0x00, 2);

  			self.spiTransfer({ data : data }, callback);
  		},
  		function(callback) {
  			var data = new Buffer(3);
  			data.writeUInt8(GPIO64_WRITE_CTRL_BYTE & GPIO64_CS[2], 0);
  			data.writeUInt8(GPIO64_IODIRB, 1);
  			data.writeUInt8(0x00, 2);

  			self.spiTransfer({ data : data }, callback);
  		},
  		function(callback) {
  			var data = new Buffer(3);
  			data.writeUInt8(GPIO64_WRITE_CTRL_BYTE & GPIO64_CS[3], 0);
  			data.writeUInt8(GPIO64_IODIRB, 1);
  			data.writeUInt8(0x00, 2);

  			self.spiTransfer({ data : data }, callback);
  		},
  		function(callback) {
  			self.cs({ 
  				spi_address: spi_address, 
  				enable: false
  			}, callback);
  		}], cb);
  }

	/*
   * Initialiaze HS-AIO12
   * @param spi_address {int} - address corresponding to the board 
	 * @param {function=} cb - callback on done or error
   * @api private
   */
  var initHSAIO12 = function(spi_address, cb) {
  	debug('Board init: ' + spi_address);
  	cb();
  }	

  /*
   * Initialiaze HS-FSKCOM
   * @param spi_address {int} - address corresponding to the board 
	 * @param {function=} cb - callback on done or error
   * @api private
   */
  var initHSFSKCOM = function(spi_address, cb) {
  	debug('Board init: ' + spi_address);
  	cb();
  }

	/* 
	 * Configures CPU GPIO pins as outputs or inputs as per the configuration data
	 * @param {function=} cb - callback on done or error
	 * @api public
	 */
	self.configCPUPins = function(cb) {
		var setupArray = [];
		var csmuxPins = [29, 31, 32];
		for (var i = 0; i < 3; i++) {
			var csmuxCb = function(pin) {
				return function(callback) {
					try {
						csmux.push(new Gpio(PINS[pin], 'out'));
						callback();
					} catch(err) {
						callback(err);
					}
				}
			}(csmuxPins[i]);
			setupArray.push(csmuxCb);
		}
		for (var cs in csMap) {
			var csCb = function(pin) {
				return function(callback) {
					try {
						cs.push(new Gpio(PINS[pin], 'out'));
						callback();
					} catch(err) {
						callback(err);
					}
				}
			}(csMap[cs]);
			setupArray.push(csCb);
		}
		for (var name in IO) {
			if (IO[name].boardType == 'CPU-RPI') {
				var csCb = function(io) {
					return function(callback) {
						try {
							if (io.type == 'DI') {
								io.handle = new Gpio(PINS[io.channel], 'in');
							} else if (io.type == 'DO') {
								io.handle = new Gpio(PINS[io.channel], 'out');
							}
							callback();
						} catch(err) {
							callback(err);
						}
					}
				}(IO[name]);
				setupArray.push(csCb);
			}
		}
		async.series(setupArray, function(err) {
    	debug('CS pins configured');
    	if (cb) cb(err);
		});
	}	

	/*
	 * Resets I/O status (for instance CS pin states to high level)
	 * @param {function=} cb - callback on done or error
	 * @api public
	 */
	self.reset = function(cb) {
		var setupArray = [];
		for (var cs in csMap) {
			var csCb = function(spi_address) {
				return function(callback) {
					self.cs({
						spi_address: spi_address, 
						enable: false
					}, callback);
				}
			}(cs);
			setupArray.push(csCb);
		}
		async.parallel(setupArray, function(err, results) {
			if (!err) debug('CPU pins reset');
    	if (cb) cb(err);
		});
	}

	/* 
	 * Sets a CS pin 
	 * @param {string} spi_address - CS id
	 * @param {boolean} enable - CS enabled/disabled (true => low level)
	 * @param {function=} cb - callback on done or error
	 * @api public
	 */
	self.cs = function(args, cb) { 
		async.series([
			function(callback) {
				self.writeCPUDigital({
					pin: 29, 
					value: muxMap[args.spi_address][0]
				}, callback);
			},
			function(callback) {
				self.writeCPUDigital({
					pin: 31, 
					value: muxMap[args.spi_address][1]
				}, callback);
			},
			function(callback) {
				self.writeCPUDigital({
					pin: 32, 
					value: muxMap[args.spi_address][2]
				}, callback);
			},
			function(callback) {
				self.writeCPUDigital({
					pin: csMap[args.spi_address], 
					value: !args.enable
				}, callback);
			}], cb);
	}

	/*
	 * Writes RPi ouputs
	 * @param {string} name - output name as per configuration data
	 * @param {boolean} value - 0 | 1, true | false 
	 * @param {function=} cb - callback on done or error
	 * @api public
	 */
	self.writeCPUDigital = function(args, cb) {
		cb = cb || function() {}
		try {
			IO[args.name].handle.writeSync(args.value);
			cb();
		} catch(err) {
			cb(err);
		}
	}

	/*
	 * Reads RPi inputs
	 * @param {string} name - input name as per configuration data
	 * @param {function=} cb - callback on done or error. Takes obtained value as parameter.
	 * @api public
	 */
	self.readCPUDigital = function(args, cb) {
		cb = cb || function() {}
		try {
			cb(null, IO[args.name].handle.readSync());
		} catch(err) {
			cb(err);
		}
	}

	/*
	 * Low level spi transfer with response
	 * @param {buffer} data - data to transfer
	 * @param {function=} cb - callback on done or error
	 * @api public
	 */ 
	self.spiTransfer = function(args, cb) {
		spi.transfer(args.data, args.data.length, cb);		
	}

	/* 
	 * Writes GPIO output for HS-GPIO32 board
	 * @param {string} spi_address - CS id
	 * @param {int} channel - physical channel related to the board
	 * @param {boolean} value - 0 | 1, true | false
	 * @param {number} when - timestamp for delayed execution (absolute UTC value)
	 * @param {function=} cb - callback on done or error
	 * @api public
	 */
	self.writeHSGPIO32Digital = function(args, cb) {
		var err;

		// use SPI to send data
		if (cb) cb(err);
	}

	/*
	 * Reads GPIO input for HS-GPIO32 board
	 * @param {string} spi_address - CS id
	 * @param {int} channel - physical channel related to the board
	 * @param {number} when - timestamp for delayed execution (absolute UTC value)
	 * @param {function=} cb - callback on done or error. Takes obtained value as parameter.
	 * @api public
	 */
	self.readHSGPIO32Digital = function(args, cb) {
		var err, value;

		// use SPI to send data
		if (cb) cb(err, value);
	}

	/* 
	 * Writes GPIO 16 outputs block for HS-GPIO32 board
	 * @param {string} spi_address - CS id
	 * @param {array} values - Boolean array of size 16
	 * @param {number} when - timestamp for delayed execution (absolute UTC value)
	 * @param {function=} cb - callback on done or error
	 * @api public
	 */ 
	self.writeHSGPIO32Digital16 = function(args, cb) {
		var err;

		// use SPI to send data
		if (cb) cb(err);
	}

	/* 
	 * Reads GPIO 16 inputs block for HS-GPIO32 board
	 * @param {string} spi_address - CS id
	 * @param {number} when - timestamp for delayed execution (absolute UTC value)
	 * @param {function=} cb - callback on done or error. Takes 16 bytes boolean array as
	 * parameter as per data obtained back after read.
	 * @api public
	 */ 
	self.readHSGPIO32Digital16 = function(args, cb) {
		var err, values;

		// use SPI to send data
		if (cb) cb(err, values);
	}

	/* 
	 * Writes GPIO output for GPIO64 board
	 * @param {string} spi_address - CS id
	 * @param {int} channel - physical channel related to the board
	 * @param {boolean} value - 0 | 1, true | false
	 * @param {function=} cb - callback on done or error
	 * @api public
	 */
	self.writeGPIO64Digital = function(args, cb) {
		var mcp, value;

		if (args.channel >= 0 && args.channel < 8) {
			mcp = 0;
		} else if (args.channel >= 8 && args.channel < 16) {
			mcp = 2;
		} else if (args.channel >= 16 && args.channel < 24) {
			mcp = 1;
		} else if (args.channel >= 24 && args.channel < 32) {
			mcp = 0;
		} else {
			cb('Wrong channel number: ' + args.channel);
		}
		
		async.series([
  		function(callback) {
  			self.cs({ 
  				spi_address: args.spi_address, 
  				enable: true
  			}, callback);
  		},
  		function(callback) {
  			var data = new Buffer(3);
  			data.writeUInt8(GPIO64_WRITE_CTRL_BYTE & GPIO64_CS[mcp], 0);
  			data.writeUInt8(GPIO64_GPIOA_IN, 1);

  			self.spiTransfer({ data : data }, function(err, data) {
  				value = data.readUInt8(1);
  				callback(err);
  			});
  		},
  		function(callback) {
  			self.cs({ 
  				spi_address: args.spi_address, 
  				enable: false
  			}, callback);
  		},
  		function(callback) {
  			self.cs({ 
  				spi_address: args.spi_address, 
  				enable: true
  			}, callback);
  		},
  		function(callback) {
  			var data = new Buffer(3);
  			data.writeUInt8(GPIO64_WRITE_CTRL_BYTE & GPIO64_CS[mcp], 0);
  			data.writeUInt8(GPIO64_GPIOB_OUT, 1);
  			value = bit(value, (7 - args.channel%7), args.value);
  			data.writeUInt8(value, 2);

  			self.spiTransfer({ data : data }, callback);
  		},
  		function(callback) {
  			self.cs({ 
  				spi_address: args.spi_address, 
  				enable: false
  			}, callback);
  		}], cb);
	}

	/*
	 * Reads GPIO input for GPIO64 board
	 * @param {string} spi_address - CS id
	 * @param {int} channel - physical channel related to the board
	 * @param {function=} cb - callback on done or error. Takes obtained value as parameter.
	 * @api public
	 */
	self.readGPIO64Digital = function(args, cb) {
		var mcp;

		if (args.channel >= 0 && args.channel < 8) {
			mcp = 0;
		} else if (args.channel >= 8 && args.channel < 16) {
			mcp = 2;
		} else if (args.channel >= 16 && args.channel < 24) {
			mcp = 1;
		} else if (args.channel >= 24 && args.channel < 32) {
			mcp = 0;
		} else {
			cb('Wrong channel number: ' + args.channel);
		}
		// use SPI to send data
		if (cb) cb(err, value);
	}

	/* 
	 * Writes GPIO 32 outputs block for GPIO64 board
	 * @param {string} spi_address - CS id
	 * @param {array} values - 0|1 array of size 32 or int or 0/1 string
	 * @param {function=} cb - callback on done or error
	 * @api public
	 */
	self.writeGPIO64Digital32 = function(args, cb) {
		async.series([
  		function(callback) {
  			self.cs({ 
  				spi_address: args.spi_address, 
  				enable: true
  			}, callback);
  		},
  		function(callback) {
  			var data = new Buffer(3);
  			var value = b(args.values, 24, 8, 32);
  			data.writeUInt8(GPIO64_WRITE_CTRL_BYTE & GPIO64_CS[3], 0);
  			data.writeUInt8(GPIO64_GPIOB_OUT, 1);
  			data.writeUInt8(value, 2);

  			self.spiTransfer({ data : data }, callback);
  		},
  		function(callback) {
  			var data = new Buffer(3);
  			var value = b(args.values, 16, 8, 32);
  			data.writeUInt8(GPIO64_WRITE_CTRL_BYTE & GPIO64_CS[1], 0);
  			data.writeUInt8(GPIO64_GPIOB_OUT, 1);
  			data.writeUInt8(value, 2);

  			self.spiTransfer({ data : data }, callback);
  		},
  		function(callback) {
  			var data = new Buffer(3);
  			var value = b(args.values, 8, 8, 32);
  			data.writeUInt8(GPIO64_WRITE_CTRL_BYTE & GPIO64_CS[2], 0);
  			data.writeUInt8(GPIO64_GPIOB_OUT, 1);
  			data.writeUInt8(value, 2);

  			self.spiTransfer({ data : data }, callback);
  		},
  		function(callback) {
  			var data = new Buffer(3);
  			var value = b(args.values, 0, 8, 32);
  			data.writeUInt8(GPIO64_WRITE_CTRL_BYTE & GPIO64_CS[0], 0);
  			data.writeUInt8(GPIO64_GPIOB_OUT, 1);
  			data.writeUInt8(value, 2);

  			self.spiTransfer({ data : data }, callback);
  		},
  		function(callback) {
  			self.cs({ 
  				spi_address: args.spi_address, 
  				enable: false
  			}, callback);
  		}], cb);
	}

	/* 
	 * Reads GPIO 32 inputs block for GPIO64 board
	 * @param {string} spi_address - CS id
	 * @param {function=} cb - callback on done or error. Takes 32 bytes boolean array as
	 * parameter as per data obtained back after read.
	 * @api public
	 */
	self.readGPIO64Digital32 = function(args, cb) {
		async.series([
  		function(callback) {
  			self.cs({ 
  				spi_address: args.spi_address, 
  				enable: true
  			}, callback);
  		},
  		function(callback) {
  			var data = new Buffer(3);
  			data.writeUInt8(GPIO64_WRITE_CTRL_BYTE & GPIO64_CS[3], 0);
  			data.writeUInt8(GPIO64_GPIOA_IN, 1);

  			self.spiTransfer({ data : data }, callback);
  		},
  		function(callback) {
  			var data = new Buffer(3);
  			data.writeUInt8(GPIO64_WRITE_CTRL_BYTE & GPIO64_CS[1], 0);
  			data.writeUInt8(GPIO64_GPIOA_IN, 1);

  			self.spiTransfer({ data : data }, callback);
  		},
  		function(callback) {
  			var data = new Buffer(3);
  			data.writeUInt8(GPIO64_WRITE_CTRL_BYTE & GPIO64_CS[2], 0);
  			data.writeUInt8(GPIO64_GPIOA_IN, 1);

  			self.spiTransfer({ data : data }, callback);
  		},
  		function(callback) {
  			var data = new Buffer(3);
  			data.writeUInt8(GPIO64_WRITE_CTRL_BYTE & GPIO64_CS[0], 0);
  			data.writeUInt8(GPIO64_GPIOA_IN, 1);

  			self.spiTransfer({ data : data }, callback);
  		},
  		function(callback) {
  			self.cs({ 
  				spi_address: args.spi_address, 
  				enable: false
  			}, callback);
  		}], function(err, results) {
  			var value = '', result = [];
  			for (var i = 3; i >= 0; i--) {
  				value += bitString(results[i]);
  			}
  			var a = value.split('');
  			for (var j = 0; j < a.length; j++) {
  				result.push(a[j] == '1' ? 1 : 0);
  			} 
  			cb(err, result);
  		});
	}

	/* 
	 * Writes any digital output available on the Tio stack
	 * @param {string} name - output name as per configuration data
	 * @param {boolean} value - 0 | 1, true | false
	 * @param {number} when - timestamp for delayed execution (absolute UTC value)
	 * @param {function=} cb - callback on done or error
	 * @api public
	 */
	self.writeDigital = function(args, cb) {
		if (IO[args.name].type != 'DO') {
			if (cb) cb('Error: Not a digital output');
			return;
		} 
		if (IO[args.name].boardType == 'HS-GPIO32') {
			self.writeHSGPIO32Digital({
				spi_address: IO[args.name].spi_address, 
				channel: IO[args.name].channel, 
				value: args.value, 
				when: args.when
			}, cb);
		} else if (IO[args.name].boardType == 'GPIO64') {
			self.writeGPIO64Digital({
				spi_address: IO[args.name].spi_address, 
				channel: IO[args.name].channel, 
				value: args.value
			}, cb);
		} else if (IO[args.name].boardType == 'CPU-RPI') {
			self.writeCPUDigital({
				name: args.name, 
				value: args.value
			}, cb);
		}
	} 

	/* 
	 * Reads any digital input available on the Tio stack
	 * @param {string} name - output name as per configuration data
	 * @param {number} when - timestamp for delayed execution (absolute UTC value)
	 * @param {function=} cb - callback on done or error. Takes obtained value as parameter.
	 * @api public
	 */	
	self.readDigital = function(args, cb) {		
		if (IO[args.name].type != 'DI') {
			if (cb) cb('Error: Not a digital input');
			return;
		} 
		if (IO[args.name].boardType == 'HS-GPIO32') {
			self.readHSGPIO32Digital({
				spi_address: IO[args.name].spi_address, 
				channel: IO[args.name].channel,
				when: args.when
			}, cb);
		} else if (IO[args.name].boardType == 'GPIO64') {
			self.readGPIO64Digital({
				spi_address: IO[args.name].spi_address,
				channel: IO[args.name].channel
			}, cb);
		} else if (IO[args.name].boardType == 'CPU-RPI') {
			self.readCPUDigital({
				name: args.name
			}, cb);
		}
	}

	/* 
	 * Writes any analog output available on the Tio stack
	 * @param {string} name - output name as per configuration data
	 * @param {number} value - voltage value 
	 * @param {number} when - timestamp for delayed execution (absolute UTC value)
	 * @param {function=} cb - callback on done or error
	 * @api public
	 */	
	self.writeAnalog = function(args, cb) {
		var err;

		// use SPI to set data
		if (cb) cb(err); 
	}

	/* 
	 * Reads any analog input available on the Tio stack
	 * @param {string} name - output name as per configuration data
	 * @param {number} when - timestamp for delayed execution (absolute UTC value)
	 * @param {function=} cb - callback on done or error. Takes obtained value as parameter.
	 * @api public
	 */	
	self.readAnalog = function(args, cb) {
		var err, value;

		// use SPI to get data
		if (cb) cb(err, value); 
	}

	/* 
	 * Writes serial message on any available COM port on the Tio stack
	 * @param {string} name - output name as per configuration data
	 * @param {buffer} data - data to send packaged as Buffer
	 * @param {number} when - timestamp for delayed execution (absolute UTC value)
	 * @param {function=} cb - callback on done or error
	 * @api public
	 */	
	self.writeCom = function(args, cb) {
		var err;

		// use SPI to send data
		if (cb) cb(err);
	}

	/* 
	 * Reads serial message on any available COM port on the Tio stack
	 * @param {string} name - output name as per configuration data
	 * @param {function=} cb - callback on done or error. Takes obtained data buffer as parameter.
	 * @param {number} when - timestamp for delayed execution (absolute UTC value)
	 * @api public
	 */
	self.readCom = function(args) {
		var err, data;

		// use SPI to get data
		if (cb) cb(err, data);
	}

	/* 
	 * Configures any available COM port on the Tio stack
	 * @param {string} name - output name as per configuration data
	 * @param {int} speed - serial link speed
	 * @param {int} parity - serial link parity
	 * @param {int} bitStop - serial link bit stop
	 * @param {function=} cb - callback on done or error.
	 * @api public
	 */
	self.COMsetup = function(args, cb) {
		var err;
		IO[args.name].speed = args.speed;
		IO[args.name].parity = args.parity;
		IO[args.name].bitStop = args.bitStop;

		// reconfigure FPGA/COM chip through SPI
		if (cb) cb(err);
	}

	/* 
	 * Writes FSK message on any available FSK port on the Tio stack
	 * @param {string} name - output name as per configuration data
	 * @param {buffer} data - data to send packaged as Buffer
	 * @param {number} when - timestamp for delayed execution (absolute UTC value)
	 * @param {function=} cb - callback on done or error
	 * @api public
	 */	
	self.writeFSK = function(args, cb) {
		var err;

		// use SPI to send data
		if (cb) cb(err);
	}

	/* 
	 * Configures any available FSK port on the Tio stack
	 * @param {string} name - output name as per configuration data
	 * @param {int=} f - carriage frequency
	 * @param {int=} f0 - low frequency
	 * @param {int=} name - FSK channel name 
	 * @param {boolean=} on - on/off selected channel
	 * @param {function=} cb - callback on done or error.
	 * @api public
	 */
	self.FSKsetup = function(args, cb) {
		var err;
		if (IO[args.name].f0) IO[args.name].f0 = args.f0;
		if (IO[args.name].f) IO[args.name].f = args.f;
		if (args.hasOwnProperty('on')) IO[args.name].on = args.on;

		// reconfigure FPGA through SPI
		if (cb) cb(err);
	}

	/* 
	 * High level DO command: sets any availble high speed FPGA driven Tio digital
	 * output for a given pattern and frequency. If frequency == 0, then the signal
	 * is standby (not generated) 
	 * @param {string} name - output name as per configuration data
	 * @param {string} binaryPattern - binary pattern to apply written as a binary strinified value
	 * @param {number} freq - pattern frequency
	 * @param {number} when - timestamp for delayed execution (absolute UTC value)
	 * @param {function=} cb - callback on done or error
	 * @api public
	 */
	self.setDigitalPattern = function(args, cb) {
		var err;

		if(cb) cb(err);
	}

	/*
	 * High level DO command: sets any availble high speed FPGA driven Tio digital
	 * output for a master follow up (slave signal copies maste signal with a given 
	 * phase shift)
	 * @param {string} name - output name as per configuration data
	 * @param {string} master - master signal's name
	 * @param {number} phaseShift - phase shift between master and slave 
	 * @param {number} when - timestamp for delayed execution (absolute UTC value)
	 * @param {function=} cb - callback on done or error
	 * @api public
	 */
	self.setDigitalSlave = function(args, cb) {
		var err;

		if(cb) cb(err);
	}

	/*
	 * High level DO command: sets any availble high speed FPGA driven Tio digital
	 * output for a given frequency. If frequency == 0, then the signal
	 * is standby (not generated) 
	 * @param {string} name - output name as per configuration data
	 * @param {number} freq - pattern frequency
	 * @param {number} when - timestamp for delayed execution (absolute UTC value)
	 * @param {function=} cb - callback on done or error
	 * @api public
	 */
	self.setDigitalFreq = function(args, cb) {
		var err;

		if(cb) cb(err);
	}

	/*
	 * Resets Tio stack clock
	 * @param {function=} cb - callback on done or error
	 * @api public
	 */
	self.resetClock = function(cb) {
		self.clockResetTime = new Date().getTime();
		cb();
	}

	/* 
	 * Destroys any Tio configuration, reseting boards for initial state
	 * @param {function=} cb - callback on done or error
	 * @api public
	 */ 
	self.end = function(cb) {
		try {
			for (var i = 0; i < cs.length; i++) {
				cs[i].unexport();
			}
			for (var i = 0; i < csmux.length; i++) {
				csmux[i].unexport();
			}
			for (var name in IO) {
				if (IO[name].handle) {
					IO[name].handle.unexport();
				}
			}
	  	cb();
		} catch(err) {
			cb(err);
		}
	}

	// init zone
	// sets CS pins mapping (spi_address <-> CS)
	for (var i = 0; i < io.length; i++) {
		if (!io[i].spi_master) {
			csMap[io[i].spi_address] = io[i].pin_number;
			muxMap[io[i].spi_address] = io[i].mux;
    }
	}

	var doCounter = 0, 
		diCounter = 0, 
		aoCounter = 0, 
		aiCounter = 0,
		comCounter = 0,
		fskCounter = 0,
		initArray = [],
		initCb;

	// configuration parse for each I/O board
	for (var i = 0; i < io.length; i++) {
		switch (io[i].type) {
			case 'HS-GPIO32':
				initCb = function(spi_address) {
					return function(callback) {
						initHSGPIO32(spi_address, callback);
					}
				}(io[i].spi_address);
				break;
			case 'GPIO64':				
				initCb = function(spi_address) {
					return function(callback) {
						initGPIO64(spi_address, callback);
					}
				}(io[i].spi_address);
				break;
			case 'HS-AIO12':				
				initCb = function(spi_address) {
					return function(callback) {
						initHSAIO12(spi_address, callback);
					}
				}(io[i].spi_address);
				break;
			case 'HS-FSKCOM':				
				initCb = function(spi_address) {
					return function(callback) {
						initHSFSKCOM(spi_address, callback);
					}
				}(io[i].spi_address);
				break;
			default:
				initCb = null;
		}
		
		if (initCb) initArray.push(initCb);

		if (io[i].DO) {
			if (io[i].DO.channels.length) {
				for (var j = 0; j < io[i].DO.channels.length; j++) {
					var paddedCounter = String('00' + doCounter).slice(-2);
					IO['DO' + paddedCounter] = {
						type: 'DO',
						spi_address: io[i].spi_address,
						boardType: io[i].type,
						channel: io[i].DO.channels[j].pin
					}
					doCounter++;
				}
			} else {
				for (var j = 0; j < io[i].DO.channels; j++) {
					var paddedCounter = String('00' + doCounter).slice(-2);
					IO['DO' + paddedCounter] = {
						type: 'DO',
						spi_address: io[i].spi_address,
						boardType: io[i].type,
						channel: j
					}
					doCounter++;
				}
			}
		}
		if (io[i].DI) {
			if (io[i].DI.channels.length) {
				for (var j = 0; j < io[i].DI.channels.length; j++) {
					var paddedCounter = String('00' + diCounter).slice(-2);
					IO['DI' + paddedCounter] = {
						type: 'DI',
						spi_address: io[i].spi_address,
						boardType: io[i].type,
						channel: io[i].DI.channels[j].pin
					}
					diCounter++;
				}
			} else {
				for (var j = 0; j < io[i].DI.channels; j++) {
					var paddedCounter = String('00' + diCounter).slice(-2);
					IO['DI' + paddedCounter] = {
						type: 'DI',
						spi_address: io[i].spi_address,
						boardType: io[i].type,
						channel: j
					}
					diCounter++;
				}
			}
		}		
		if (io[i].AO) {
			for (var j = 0; j < io[i].AO.channels; j++) {
				var paddedCounter = String('00' + aoCounter).slice(-2);
				IO['AO' + paddedCounter] = {
					type: 'AO',
					spi_address: io[i].spi_address,
					boardType: io[i].type,
					channel: j
				}
				aoCounter++;
			}
		}
		if (io[i].AI) {
			for (var j = 0; j < io[i].AI.channels; j++) {
				var paddedCounter = String('00' + aiCounter).slice(-2);
				IO['AI' + paddedCounter] = {
					type: 'AI',
					spi_address: io[i].spi_address,
					boardType: io[i].type,
					channel: j
				}
				aiCounter++;
			}
		}
		if (io[i].COM) {
			for (var j = 0; j < io[i].COM.channels.length; j++) {
				IO['COM'+comCounter] = {
					type: 'COM',
					spi_address: io[i].spi_address,
					boardType: io[i].type,
					channel: j,
					protocol: io[i].COM.channels[j].protocol
				}
			}
			comCounter++;
		}
		if (io[i].FSK) {
			for (var j = 0; j < io[i].FSK.channels.length; j++) {
				IO['FSK'+fskCounter] = {
					type: 'FSK',
					spi_address: io[i].spi_address,
					boardType: io[i].type,
					channel: j,
					f0: io[i].FSK.channels[j].f0,
					f: io[i].FSK.channels[j].f
				}
			}
			fskCounter++;
		}
	}

	// configures CPU pins  for future use and call reset function for setting up
	// the pins status as per their initial value
	initArray.splice(0, 0, self.configCPUPins);
	initArray.splice(1, 0, self.reset);

	async.series(initArray, function(err, result) {
		cb.call(self, err);
	});
}

exports.TIOAdapter = TIOAdapter;
