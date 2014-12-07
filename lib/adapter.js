/*
 * @file tio.js
 * @author Victor Andritoiu
 * @copyright opentekhnia 2014
 */
var i2c = require('i2c'),
	Gpio = require('onoff').Gpio,
	debug = require('debug')('adapter'),
	util = require('util'),
	EventEmitter = require('events').EventEmitter;

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

exports.b = b;

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
const GPIO64_WRITE_CTRL_BYTE	= b('01001110');
const GPIO64_READ_CTRL_BYTE		= b('01001111');
const GPIO64_CS 						  = [ 
	b('11110111'), /* 24-31 */
	b('11110011'), /* 16-23 */
	b('11110101'), /* 08-15 */
	b('11110001')  /* 00-07 */
];

const GPIO64_IODIRA 					= 0x00;
const GPIO64_IODIRB 					= 0x01;
const GPIO64_IOCON						= 0x0A;
const GPIO64_GPIOA_IN					= 0x12;
const GPIO64_GPIOB_OUT				= 0x13;

/**
 * RaspPi pins matching
 */
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
 */
var TIOAdapter = function(args) {
	var self = this,
		io = args ? args.io : null,
		spi;

	debug('TIOAdapter init started');

	var ds = require('./data').data(args.mqtt);	
	self.ds = ds;

	var BUF_AIO12_READ_GET = new Buffer(18);
	BUF_AIO12_READ_GET.fill(0);
	BUF_AIO12_READ_GET.writeUInt8(0x06, 0);

	var BUF_AIO12_READ_NOW_GET = new Buffer(33);
	BUF_AIO12_READ_NOW_GET.fill(0);
	BUF_AIO12_READ_NOW_GET.writeUInt8(0x07, 0);

	/* Stack hard reset pin */
	self.resetPin = new Gpio(8, 'out'); 	
	/* Sync clock hard reset pin */
	self.syncResetPin = new Gpio(11, 'out'); 

	/*
	 * clock correspondance between UTC time and Tio stack clock:
	 * this indicates T0 for the Tio stack clock reset +/- 1ms
	 */
	self.clockResetTime = 0; 

	if (!io) {
		throw Error('Missing configuration data');
	}

	var rpio;
	if (process.arch == 'arm') {
		rpio = require('rpio');
		rpio.spiClockSpeedDivider(32);
		debug('SPI initialized');
	}

	var csMap = {}, /* CS pin mapping */
		muxMap = {}, /* CSMUX pin mapping */
		IO= {}, /* IOs table */
		csmux = [], /* CSMUX handles */
		cs = []; /* CS handles */

	/*
	 * Push adapter object to be remotely available thanks to Data Synchronizer
	 */
	var remotify = function() {
		ds.registerServicesProvider(self);
	}

	/*
   * Initialiaze HS-GPIO32
   * @param id {int} - unique id corresponding to the board 
   * @api private
   */
  var initHSGPIO32 = function(id) {
  	var buf = new Buffer(2);
  	buf.writeUInt8(0x01, 0);
  	if (io[id].pulseGenerationEnabled) {
  		buf.writeUInt8(0x01, 1);
  	} else {
  		buf.writeUInt8(0x00, 1);
  	}
  	
  	self.spiTransfer({ id: id , data: buf });

  	var pgSetup = new Array(6);
  	if (io[id].pulseGenerationEnabled) {
  		for (var i = 0; i < 6; i++) {
  			if (io[id].pulseGenerationEnabled.indexOf(i) >= 0) {
  				pgSetup[i] = 1;
  			} else {
  				pgSetup[i] = 0;
  			}
  		}
  		self.setupHSGPIO32Output6({
  			id: id,
  			setup: pgSetup
  		});
  	}
  	debug('Board init: ' + id);
  }

	/*
   * Initialiaze GPIO64
   * @param id {int} - unique id corresponding to the board 
   * @api private
   */
  var initGPIO64 = function(id) {
  	var buf = new Buffer(3);

		buf.writeUInt8(GPIO64_WRITE_CTRL_BYTE, 0);
		buf.writeUInt8(GPIO64_IOCON, 1);
		buf.writeUInt8(b('00001000'), 2);
		debug('IOCON ', self.spiTransfer({ id: id, data : buf }));

		for (var i = 0; i < 4; i++) {
			buf.writeUInt8(GPIO64_WRITE_CTRL_BYTE & GPIO64_CS[i], 0);
			buf.writeUInt8(GPIO64_IODIRB, 1);
			buf.writeUInt8(0x00, 2);
			debug(id + ' CS[' + GPIO64_CS[i].toString(2) + '] ', self.spiTransfer({ id: id, data : buf }));
			debug(buf);
		}

  	debug('Board init: ' + id);
  }

	/*
   * Initialiaze HS-AIO12
   * @param id {int} - unique id corresponding to the board 
   * @api private
   */
  var initHSAIO12 = function(id) {
  	debug('Board init: ' + id);
  }	

  /*
   * Initialiaze HS-FSKCOM
   * @param id {int} - unique id corresponding to the board 
   * @api private
   */
  var initHSFSKCOM = function(id) {
  	debug('Board init: ' + id);
  }

	/* 
	 * Configures CPU GPIO pins as outputs or inputs as per the configuration data
	 * @api public
	 */
	self.configCPUPins = function() {
		for (var name in IO) {
			var io = IO[name];
			if (io.boardType == 'CPU-RPI') {
				try {
					if (io.type == 'DI') {
						io.handle = new Gpio(io.channel, 'in');
					} else if (io.type == 'DO' || io.type == 'CSMUX' || io.type == 'CS') {
						io.handle = new Gpio(io.channel, 'out');
					}
				} catch(err) {
					debug('error when configuring CPU IO pin %d: %s', io.channel, err);
				}
			}
		}
		debug('CPU pins configured');
	}	

	/*
	 * Resets I/O status (for instance CS pin states to high level)
	 * @api public
	 */
	self.reset = function() {
		var setupArray = [];
		for (var id in csMap) {
			self.cs({ id: id, enable: false });
		}
		debug('CPU pins reset');
	}

	/* 
	 * Sets a CS pin 
	 * @param {string} id - unique id corresponding to the board
	 * @param {boolean} enable - CS enabled/disabled (true => low level)
	 * @api public
	 */
	self.cs = function(args) { 
		if (muxMap[args.id][0] || muxMap[args.id][1] || muxMap[args.id][2]) {
			IO['CSMUX0'].handle.writeSync(muxMap[args.id][0]);
			IO['CSMUX1'].handle.writeSync(muxMap[args.id][1]);
			IO['CSMUX2'].handle.writeSync(muxMap[args.id][2]);
		}
		IO[csMap[args.id]].handle.writeSync(args.enable ? 0 : 1);
	}

	/*
	 * Low level spi transfer with response
	 * @param {buffer} data - data to transfer
	 * @param {string=} id - unique id corresponding to the board
	 * @param {boolean=} mux - warn for using CSMUx pins info
	 * @return {buffer} - income buffer
	 * @api public
	 */ 
	self.spiTransfer = function(args) {
		if (args.mux) {
			return rpio.spiTransfer(args.data, args.data.length, 
				rpio.getPin(IO[csMap[args.id]].channel), 
				[{
					'pin': rpio.getPin(IO['CSMUX0'].channel),
					'value': muxMap[args.id][0]
				},{
					'pin': rpio.getPin(IO['CSMUX1'].channel),
					'value': muxMap[args.id][1]
				},{
					'pin': rpio.getPin(IO['CSMUX2'].channel),
					'value': muxMap[args.id][2]
				}]);
		} else if (args.id) {
			return rpio.spiTransfer(args.data, args.data.length, 
				rpio.getPin(IO[csMap[args.id]].channel));
		} else {
			return rpio.spiTransfer(args.data, args.data.length);
		}
	}

	/* 
	 * Returns board's internal id if FPGA board (corresponds to board type)
	 * @param {string} id - CS id
	 * @return {int} - Internal ID
	 * @api public
	 */
	self.typeId = function(args) {
		var buf = new Buffer(4);
		buf.fill(0);		
		var res = self.spiTransfer({ id: args.id, data: buf });
		return res.readUInt8(1);
	}

	/*
	 * Led control
	 */
	self.leds = function(args) {
		// Apply limits and gain on the inputs
		args.led1 = args.led1 >= 1 ? 0x01 : 0x00;
		args.led2 = args.led2 >= 1 ? 0x02 : 0x00;
		args.led3 = args.led3 >= 1 ? 0x04 : 0x00;

		// Prepare the data byte
		var buf = new Buffer(2);
		buf.writeUInt8(0x02, 0);
		buf.writeUInt8(args.led1 + args.led2 + args.led3, 1);

		self.spiTransfer({ id: args.id, data: buf });
	}

	/* 
	 * Writes GPIO 16 outputs block for HS-GPIO32 board. During the same SPI commmand cycle
	 * it updates the input variables
	 * @param {string} id - CS id
	 * @param {array=} values - Boolean array of size 16
	 * @param {number} when - timestamp for delayed execution (absolute UTC value)
	 * @api public
	 */ 
	self.writeHSGPIO32Digital16 = function(args) {
		var buf = new Buffer(3),
  		inCounter = io[args.id].inStartIndex + 15,
  		outCounter = io[args.id].outStartIndex + 15;

		buf.writeUInt8(0x04, 0);
		if (args.values !== undefined) {
  		buf.writeUInt16BE(b(args.values, 0, 16, 16), 1);
		} else {
			var values = new Array(16);
			for (var pos = 15; pos >= 0; pos--) {
				var paddedCounter = String('00' + outCounter).slice(-2);
				values[pos] = ds.get('TIO.DO' + paddedCounter);
				outCounter--;	
			}
			buf.writeUInt16BE(b(values, 0, 16, 16), 1); 			
		}

		var response = self.spiTransfer({ id: args.id, data : buf });	
		var values = response.readUInt16BE(1);
		for (var pos = 15; pos >= 0; pos--) {
			var paddedCounter = String('00' + inCounter).slice(-2);
			var old = IO['DI' + paddedCounter].value;
			IO['DI' + paddedCounter].value = values & ( 1 << pos );
			if (IO['DI' + paddedCounter].value != old ) {
				self.emit('DI' + paddedCounter, IO['DI' + paddedCounter].value);
				ds.set('TIO.DI' + paddedCounter, IO['DI' + paddedCounter].value);
			}
			inCounter--;	
		} 
	}

	/* 
	 * Reads GPIO 16 inputs block for HS-GPIO32 board and updates data structure with read
	 * values
	 * @param {string} id - CS id
	 * @param {number} when - timestamp for delayed execution (absolute UTC value)
	 * parameter as per data obtained back after read.
	 * @api public
	 */ 
	self.readHSGPIO32Digital16 = function(args) {
		var buf = new Buffer(3),
  		counter = io[args.id].inStartIndex + 15;

  	buf.writeUInt8(0x04, 0);
  	buf.writeUInt16BE(0x0000, 1);
  	var response = self.spiTransfer({ id: args.id,  data : buf });	
		var values = response.readUInt16BE(1);
		for (var pos = 15; pos >= 0; pos--) {
			var paddedCounter = String('00' + counter).slice(-2);
			var old = IO['DI' + paddedCounter].value;
			IO['DI' + paddedCounter].value = values & ( 1 << pos );
			if (IO['DI' + paddedCounter].value != old ) {
				self.emit('DI' + paddedCounter, IO['DI' + paddedCounter].value);
				ds.set('TIO.DI' + paddedCounter, IO['DI' + paddedCounter].value);
			}
			counter--;	
		} 
	}

	/* 
	 * Reads GPIO 16 inputs block for HS-GPIO32 board and updates data structure with read
	 * values
	 * @param {string} id - CS id
	 * @param {array} setup - array of 6 integers defining the type of 6 first outputs
	 * as per following:
	 * 		0 = Digital output
	 *		1 = Pattern generator (dedicated pins for each output)
   *		2 = Always low
	 *		3 = Always high
	 * @api public
	 */ 
	self.setupHSGPIO32Output6 = function(args) {
		debug('HSGPIO32 first 6 outputs setup: ', args.setup);
		var buf = new Buffer(3);
		buf.writeUInt8(0x08, 0);
		buf.writeUInt8((args.setup[6] << 2) + args.setup[5], 1);
		buf.writeUInt8((args.setup[4] << 6) + (args.setup[3] << 4) +(args.setup[2] << 2) + args.setup[1], 2);

		self.spiTransfer( { id: args.id, data: buf });
	}

	/* 
	 * Writes GPIO output for GPIO64 board
	 * @param {string} name - output name as per configuration data
	 * @param {boolean} value - 0 | 1, true | false
	 * @api public
	 */
	self.writeGPIO64Digital = function(args) {
		var mcp,
			bt, 
			value,
			data = new Buffer(3),
			channel,
  		outCounter = io[IO[args.name].id].outStartIndex;

		if (IO[args.name]) { 
			channel = IO[args.name].channel;
		}

		if (channel >= 0 && channel < 8) {
			mcp = 3;
			bt = 0;
		} else if (channel >= 8 && channel < 16) {
			mcp = 2;
			bt = 1;
		} else if (channel >= 16 && channel < 24) {
			mcp = 1;
			bt = 2;
		} else if (channel >= 24 && channel < 32) {
			mcp = 0;
			bt = 3;
		} else {
			throw Error('Wrong channel number: ' + channel + ' for ' + args.name);
		}

		var values = new Array(8);
		for (var pos = 7; pos >= 0; pos--) {
			var paddedCounter = String('00' + (outCounter + pos + bt*8)).slice(-2);
			values[pos] = ds.get('TIO.DO' + paddedCounter);
		}
		data.writeUInt8(GPIO64_WRITE_CTRL_BYTE & GPIO64_CS[mcp], 0);
  	data.writeUInt8(GPIO64_GPIOB_OUT, 1);
  	data.writeUInt8(b(values, 0, 8, 8), 2);

  	self.spiTransfer({ id: args.id, data : data });

	}

	/* 
	 * Writes GPIO 32 outputs block for GPIO64 board
	 * @param {string} id - CS id
	 * @param {array} values - 0|1 array of size 32 or int or 0/1 string
	 * @api public
	 */
	self.writeGPIO64Digital32 = function(args) {
		var buf = new Buffer(3),
  		outCounter = io[args.id].outStartIndex,
  		value;

		if (args.values === undefined) {
			args.values = new Array(16);
		}
		
		/* DO07 -- DO00 DO15 -- DO08 DO23 -- DO16 DO31 -- DO24 */

		var index = 0;
		for (var bt = 0; bt < 4; bt++) {
			for (var pos = 7; pos >= 0; pos--) {
				var paddedCounter = String('00' + (outCounter + bt*8 + pos)).slice(-2);
				args.values[index] = ds.get('TIO.DO' + paddedCounter);
				index++;
			}
		}

		for (var i = 0; i < 4; i++) {
			value = b(args.values, (3-i)*8, 8, 32);
			buf.writeUInt8(GPIO64_WRITE_CTRL_BYTE & GPIO64_CS[3], 0);
			buf.writeUInt8(GPIO64_GPIOB_OUT, 1);
			buf.writeUInt8(value, 2);
			self.spiTransfer({ id: args.id,  data : buf });	
		}
	}

	/* 
	 * Reads GPIO 32 inputs block for GPIO64 board and stores values into IO data array
	 * @param {string} id - CS id
	 * @api public
	 */
	self.readGPIO64Digital32 = function(args) {
  	var data = new Buffer(2),
  		values = 0,
  		response,
  		counter = io[args.id].inStartIndex + 31;

  	for (var i = 0; i < 4; i++) {
	  	data.writeUInt8(GPIO64_READ_CTRL_BYTE & GPIO64_CS[i], 0);
	  	data.writeUInt8(GPIO64_GPIOA_IN, 1);
			response = self.spiTransfer({ id: args.id, data : data });
			values = values | (response.readUInt8(1) << (i*8));
			for (var pos = 7; pos >= 0; pos--) {
				var paddedCounter = String('00' + counter).slice(-2);
				var old = IO['DI' + paddedCounter].value;
				IO['DI' + paddedCounter].value = values & ( 1 << pos );
				if (IO['DI' + paddedCounter].value != old ) {
					self.emit('DI' + paddedCounter, IO['DI' + paddedCounter].value);
					ds.set('TIO.DI' + paddedCounter, IO['DI' + paddedCounter].value);
				}
				counter--;	
			} 
  	}
	}

	/* 
	 * Writes any digital output available on the Tio stack
	 * @param {string} name - output name as per configuration data
	 * @param {boolean} value - 0 | 1, true | false
	 * @param {number} when - timestamp for delayed execution (absolute UTC value)
	 * @api public
	 */
	self.writeDigital = function(args) {
		if (IO[args.name].type != 'DO') {
			throw Error('Not a digital output');
			return;
		} 
		if (IO[args.name].boardType == 'HS-GPIO32') {
			IO[args.name].value = args.value;
			ds.set('TIO.'+args.name, args.value);
		} else if (IO[args.name].boardType == 'GPIO64') {
			self.writeGPIO64Digital({
				name: args.name, 
				value: args.value
			});
		} else if (IO[args.name].boardType == 'CPU-RPI') {
			IO[args.name].handle.writeSync(args.value ? 1: 0);
		}
	} 

	/* 
	 * Reads any digital input available on the Tio stack
	 * @param {string} name - output name as per configuration data
	 * @param {number} when - timestamp for delayed execution (absolute UTC value)
	 * @return {boolean} - read value
	 * @api public
	 */	
	self.readDigital = function(args) {		
		if (IO[args.name].type != 'DI') {
			throw Error('Not a digital input');
			return;
		} 
		if (IO[args.name].boardType == 'HS-GPIO32') {
			return self.readHSGPIO32Digital({
				id: IO[args.name].id, 
				channel: IO[args.name].channel,
				when: args.when
			});
		} else if (IO[args.name].boardType == 'GPIO64') {
			if (args.name.slice(0,2) == 'DI') {
				return IO[args.name].value;
			}
			throw new Error('Not digital input: ' + args.name);
		} else if (IO[args.name].boardType == 'CPU-RPI') {
			return IO[args.name].handle.readSync();
		}
	}

	/* 
	 * Writes any analog output available on the Tio stack
	 * @param {string} name - output name as per configuration data
	 * @param {number} value - voltage value 
	 * @param {number} when - timestamp for delayed execution (absolute UTC value)
	 * @api public
	 */	
	self.writeAnalog = function(args) {
		var channel = IO[args.name].channel;
		var buf = new Buffer(8);
		buf.writeUInt8(0x04, 0);

		// Apply limit to voltage input
		if (args.value > 10.0) args.value = 10.0;
		if (args.value < -10.0) args.value = -10.0;

		// Compute the dac value nedded (gain adjustment)
		var dac_value = parseInt(args.value * 32767.0 / 10.0); 

		if (args.when !== undefined && args.when != 0) {
			try {
				var when = parseInt((args.when - self.clockResetTime)*1.024);
				buf.writeInt32BE(when, 1);
			} catch(e) {
				debug('certainly value out of bounds: ' + when);
				buf.writeUInt32BE(0, 1);
			}
		} else {
			buf.writeUInt32BE(0, 1);
		}
		buf.writeUInt8(channel, 5); 
		buf.writeInt16BE(dac_value, 6);

		self.spiTransfer( { id: IO[args.name].id, data: buf });		
	}

	/* 
	 * Reads all analog inputs available on a given analog board on the Tio stack, then
	 * puts this values in the IO data structure for further use
	 * @param {string} id - CS id
	 * @param {number} when - timestamp for delayed execution (absolute UTC value)
	 * @api public
	 */	
	self.readAIO12Analog8 = function(args) {
		var now = Date.now(),
			counter = io[args.id].inStartIndex;

		if (args.when !== undefined && args.when != 0) {
			try {
				var buf = new Buffer(5);
				buf.writeUInt8(0x05, 0);
				var when = parseInt((args.when - self.clockResetTime)*1.024);
				buf.writeInt32BE(when, 1);
			} catch(e) {
				debug('certainly value out of bounds: ' + when);
				buf.writeUInt32BE(0, 1);
			}
			self.spiTransfer( { id: args.id, data: buf });
			setTimeout(resultCallback, when-now);
		} else {
			var result = self.spiTransfer( { id: args.id, data: BUF_AIO12_READ_NOW_GET } );
			for (var pos = 17; pos < 32; pos += 2) {
				var paddedCounter = String('00' + counter).slice(-2);
				var old = IO['AI' + paddedCounter].value;
				IO['AI' + paddedCounter].value = result.readInt16BE(pos);
				if (Math.abs(IO['AI' + paddedCounter].value - old) > io[args.id].triggerThreshold ) {
					self.emit('AI' + paddedCounter, IO['AI' + paddedCounter].value);
					ds.set('AI' + paddedCounter, IO['AI' + paddedCounter].value);
				}
				counter++;
			}
		}

		var resultCallback = function() {
			var result = self.spiTransfer( { id: args.id, data: BUF_AIO12_READ_GET } );
			if (result[1] & 0x01) {
				for (var pos = 2; pos < 16; pos += 2) {
					var paddedCounter = String('00' + counter).slice(-2);
					var old = IO['AI' + paddedCounter].value;
					IO['AI' + paddedCounter].value = result.readInt16BE(pos);
					if (IO['AI' + paddedCounter].value != old ) {
						self.emit('AI' + paddedCounter, IO['AI' + paddedCounter].value);
						ds.set('AI' + paddedCounter, IO['AI' + paddedCounter].value);
					}
					counter++;
				}
			}
		}
	}

	/* 
	 * Reads any analog input available on the Tio stack
	 * @param {string} name - output name as per configuration data
	 * @return {number} - read value
	 * @api public
	 */	
	self.readAnalog = function(args) {
		if (args.name.slice(0,2) == 'AI') {
			return IO[args.name].value;
		}
		throw new Error('Not analog input: ' + args.name);
	}

	/* 
	 * Writes serial message on any available COM port on the Tio stack
	 * @param {string} name - output name as per configuration data
	 * @param {buffer} data - data to send packaged as Buffer
	 * @param {number} when - timestamp for delayed execution (absolute UTC value)
	 * @api public
	 */	
	self.writeCom = function(args) {
		var err;

		// use SPI to send data
	}

	/* 
	 * Reads serial message on any available COM port on the Tio stack
	 * @param {string} name - output name as per configuration data
	 * @param {number} when - timestamp for delayed execution (absolute UTC value)
	 * @return {buffer} - read buffer
	 * @api public
	 */
	self.readCom = function(args) {
		var err, data;

		// use SPI to get data
		return data;
	}

	/* 
	 * Configures any available COM port on the Tio stack
	 * @param {string} name - output name as per configuration data
	 * @param {int} speed - serial link speed
	 * @param {int} parity - serial link parity
	 * @param {int} bitStop - serial link bit stop
	 * @api public
	 */
	self.initCom = function(args) {
		var err;
		IO[args.name].speed = args.speed;
		IO[args.name].parity = args.parity;
		IO[args.name].bitStop = args.bitStop;

		// reconfigure FPGA/COM chip through SPI
	}

	/* 
	 * Writes FSK message on any available FSK port on the Tio stack
	 * @param {string} name - output name as per configuration data
	 * @param {buffer} data - data to send packaged as Buffer
	 * @param {number} when - timestamp for delayed execution (absolute UTC value)
	 * @api public
	 */	
	self.writeFSK = function(args) {
		var err;

		// use SPI to send data
	}

	/* 
	 * Configures any available FSK port on the Tio stack
	 * @param {string} name - output name as per configuration data
	 * @param {int=} f - carriage frequency
	 * @param {int=} f0 - low frequency
	 * @param {int=} name - FSK channel name 
	 * @param {boolean=} on - on/off selected channel
	 * @api public
	 */
	self.initFSK = function(args) {
		var err;
		if (IO[args.name].f0) IO[args.name].f0 = args.f0;
		if (IO[args.name].f) IO[args.name].f = args.f;
		if (args.hasOwnProperty('on')) IO[args.name].on = args.on;

		// reconfigure FPGA through SPI
	}

	/* 
	 * High level DO command: sets any availble high speed FPGA driven Tio digital
	 * output for a given pattern and frequency. If frequency == 0, then the signal
	 * is standby (not generated) 
	 * @param {string} name - output name as per configuration data
	 * @param {int} pattern - binary pattern to apply (8bits pattern)
	 * @api public
	 */
	self.setDigitalPattern = function(args) {
		debug('Digital pattern: ', IO[args.name].patternId);
		var buf = new Buffer(3);
		buf.writeUInt8(0x06, 0);
		buf.writeUInt8(IO[args.name].patternId, 1);
		buf.writeUInt8(args.pattern, 2);
		self.spiTransfer( { id: args.id, data: buf });
	}

	/*
	 * High level DO command: sets up one of the pattern generation DO for high speed FPGA 
	 * Digital output is configured for a given frequency and offset. If frequency == 0, 
	 * then the signal is standby (not generated) 
	 * @param {string} name - output name as per configuration data
	 * @param {number} freq - pattern frequency
	 * @param {number} offset - signal offset between master and slave signals
	 * @api public
	 */
	self.setDigitalFreq = function(args) {
		debug('Digital (freq,offset) for pattern: ', IO[args.name].patternId);
		var buf = new Buffer(14);
		buf.writeUInt8(0x07, 0);
		buf.writeUInt8(IO[args.name].patternId, 1);
		if (args.when !== undefined && args.when != 0) {
			try {
				var when = parseInt((args.when - self.clockResetTime)*1.024);
				buf.writeInt32BE(when, 2);
			} catch(e) {
				debug('certainly value out of bounds: ' + when);
				buf.writeUInt32BE(0, 2);
			}
		} else {
			buf.writeUInt32BE(0, 2);
		}
		/* Convert frequency to phase accumulator byte
			 Maximum frequency is set to 256khz in the FPGA (hard limit) 
		   any value higher than that will be set back to 256kHz */
		var freq = (args.freq * Math.pow(2, 32)) / 100000000;
		/*  convert frequency in phase accumulator word */
		buf.writeUInt32BE(parseInt(freq), 6);
		var offset = (parseInt(args.offset) * Math.pow(2, 32)) / 360;
		buf.writeUInt32BE(parseInt(offset), 10);
		self.spiTransfer( { id: args.id, data: buf });
	}

	/* 
	 * Hardware TIO stack reset
	 * @api public
	 */
	self.hwReset = function() {
		self.resetPin.writeSync(1); 			
		self.resetPin.writeSync(1); 	
		self.resetPin.writeSync(0); 
		self.resetPin.writeSync(0);
	}

	/* 
	 * Hardware TIO stack sync clock reset
	 * @api public
	 */
	self.hwSyncReset = function() {
		self.syncResetPin.writeSync(1); 			
		self.syncResetPin.writeSync(1); 	
		self.syncResetPin.writeSync(0); 
		self.syncResetPin.writeSync(0);
	}

	/*
	 * Returns board's sync clock current value
	 * @param {string} id - CS id
	 * @return {number} - clock
	 * @api public
	 */
	self.getClock = function(args) {
		var buf = new Buffer(5);
		buf.fill(0);
		buf.writeUInt8(0x03, 0);
		var read_result = self.spiTransfer({ id: args.id, data: buf });
		return (read_result[1]<<24 | read_result[2]<<16 | read_result[3]<<8 | read_result[4]);
	}

	/*
	 * Resets Tio stack sync clock
	 * @api public
	 */
	self.resetClock = function() {
		self.clockResetTime = Date.now();
		try {
			var wire = new i2c(0x51, {device: '/dev/i2c-1', debug: false}); 

			// PCF2127AT Slave address : 0x51
			// Register CLKOUT_ctl : 0x0f :    TCR[1],TCR[0],0,0,0,COF[2], COF[1], COF[0]
			// Clock Out Frequency selection  : COF = 0x05  : Set at 1.024kHz
			// Temperature measurement period : TCR = 0x11 : Temperature compensation interval for oscillator set at 30sec

			wire.writeBytes(0x0f, [0xa5], function(err) {
				wire.close();
				debug('reset hard clock: ', err ? 'ok': 'ko');
			});
		} catch(e) {
			debug('resetClock: ', e);
		}
	}

	/* 
	 * Destroys any Tio configuration, reseting boards for initial state
	 * @api public
	 */ 
	self.end = function() {
		try {
			for (var name in IO) {
				if (IO[name].handle) {
					IO[name].handle.unexport();
				}
			}
		} catch(err) {
			debug('error when ending TIO adapter: %s', err);
		}
	}

	// init zone
	var doCounter = 0, 
		diCounter = 0, 
		aoCounter = 0, 
		aiCounter = 0,
		comCounter = 0,
		fskCounter = 0,
		csmuxCounter = 0,
		csCounter = 0;

	// sets CS pins mapping (id <-> CS)
	for (var uid in io) {
		if (!io[uid].spi_master) {
			csMap[uid] = 'CS' + (io[uid].cs + 1);
			muxMap[uid] = io[uid].mux;
    }
	}

	debug('CS/CSMUX mapping done');

	// configuration parse for each I/O board 
	for (var i in io) {
		if (io[i].DO) {
			io[i].outStartIndex = doCounter;
			if (io[i].DO.channels.length) {
				for (var j = 0; j < io[i].DO.channels.length; j++) {
					var paddedCounter = String('00' + doCounter).slice(-2);
					IO['DO' + paddedCounter] = {
						type: 'DO',
						id: i,
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
						id: i,
						boardType: io[i].type,
						channel: j
					}
					if (io[i].pulseGenerationEnabled && 
						io[i].pulseGenerationEnabled.indexOf(doCounter - io[i].outStartIndex) >= 0) {
						IO['DO' + paddedCounter].patternId = 
							parseInt(Math.floor((doCounter - io[i].outStartIndex)/2)+1);
						debug('warning: DO' + paddedCounter + ' has patternId ' + IO['DO' + paddedCounter].patternId);
					} 
					doCounter++;
				}
			}
		}
		if (io[i].DI) {
			io[i].inStartIndex = diCounter;
			if (io[i].DI.channels.length) {
				for (var j = 0; j < io[i].DI.channels.length; j++) {
					var paddedCounter = String('00' + diCounter).slice(-2);
					IO['DI' + paddedCounter] = {
						type: 'DI',
						id: i,
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
						id: i,
						boardType: io[i].type,
						channel: j
					}
					diCounter++;
				}
			}
		}		
		if (io[i].AO) {
			io[i].outStartIndex = aoCounter;
			for (var j = 0; j < io[i].AO.channels; j++) {
				var paddedCounter = String('00' + aoCounter).slice(-2);
				IO['AO' + paddedCounter] = {
					type: 'AO',
					id: i,
					boardType: io[i].type,
					channel: j
				}
				aoCounter++;
			}
		}
		if (io[i].AI) {
			io[i].inStartIndex = aiCounter;
			for (var j = 0; j < io[i].AI.channels; j++) {
				var paddedCounter = String('00' + aiCounter).slice(-2);
				IO['AI' + paddedCounter] = {
					type: 'AI',
					id: i,
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
					id: i,
					boardType: io[i].type,
					channel: j,
					protocol: io[i].COM.channels[j].protocol
				}
				comCounter++;
			}
		}
		if (io[i].FSK) {
			for (var j = 0; j < io[i].FSK.channels.length; j++) {
				IO['FSK'+fskCounter] = {
					type: 'FSK',
					id: i,
					boardType: io[i].type,
					channel: j,
					f0: io[i].FSK.channels[j].f0,
					f: io[i].FSK.channels[j].f
				}
				fskCounter++;
			}
		}
		if (io[i].CSMUX) {
			for (var j = 0; j < io[i].CSMUX.channels.length; j++) {
				IO['CSMUX'+csmuxCounter] = {
					type: 'CSMUX',
					boardType: io[i].type,
					channel: io[i].CSMUX.channels[j].pin
				}
				csmuxCounter++;
			}
		}
		if (io[i].CS) {
			for (var j = 0; j < io[i].CS.channels.length; j++) {
				IO['CS'+(csCounter+1)] = {
					type: 'CS',
					boardType: io[i].type,
					channel: io[i].CS.channels[j].pin
				}
				csCounter++;
			}
		}
	}

	debug('IO mapping done');

	// configures CPU pins  for future use and call reset function for setting up
	// the pins status as per their initial value
	self.configCPUPins();
	self.reset();

	// I/O boards init
	for (var uid in io) {
		switch (io[uid].type) {
			case 'HS-GPIO32':
				initHSGPIO32(uid);
				break;
			case 'GPIO64':				
				initGPIO64(uid);
				break;
			case 'HS-AIO12':				
				initHSAIO12(uid);
				break;
			case 'HS-FSKCOM':				
				initHSFSKCOM(uid);
				break;
			default:
		}
	}

	return self;
}

util.inherits(TIOAdapter, EventEmitter);

exports.TIOAdapter = TIOAdapter;
