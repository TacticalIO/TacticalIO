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


/*
 * Damned
 */
function sleep(milliseconds) {
  var start = Date.now();
  for (var i = 0; i < 1e7; i++) {
    if ((Date.now() - start) > milliseconds){
      break;
    }
  }
}

/* 
 * Encode FSK frequency to buffer
 */
function encodeFreq(buf, freq) {
	var ftw = parseInt((freq *  Math.pow(2, 48)) / 120000000);
	var byte0 = ftw%255;
	ftw = parseInt(ftw/256);
	var byte1 = ftw%255;
	ftw = parseInt(ftw/256);
	var byte2 = ftw%255;
	ftw = parseInt(ftw/256);
	var byte3 = ftw%255;
	ftw = parseInt(ftw/256);
	var byte4 = ftw%255;
	ftw = parseInt(ftw/256);
	var byte5 = ftw%255;
	buf.writeUInt8(byte5, 2);
	buf.writeUInt8(byte4, 3);
	buf.writeUInt8(byte3, 4);
	buf.writeUInt8(byte2, 5);
	buf.writeUInt8(byte1, 6);
	buf.writeUInt8(byte0, 7);
} 

/*
 * For unit testing purposes
 */
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
const GPIO64_WRITE_CTRL_BYTE	= b('01000000');
const GPIO64_READ_CTRL_BYTE		= b('01000001');
const GPIO64_CS 						  = [ 
	b('00000110'), /* 24-31 */
	b('00000010'), /* 16-23 */
	b('00000100'), /* 08-15 */
	b('00000000')  /* 00-07 */
];

const GPIO64_IODIRA 					= 0x00;
const GPIO64_IODIRB 					= 0x01;
const GPIO64_IPOLA						= 0x02;
const GPIO64_IPOLB						= 0x03;

const GPIO64_IOCON						= 0x0A;

const GPIO64_GPIOA_IN					= 0x12;
const GPIO64_GPIOB_OUT				= 0x13;

const FSK_MAX_AMPLITUDE = 725;
exports.FSK_MAX_AMPLITUDE = FSK_MAX_AMPLITUDE;

var MAX_VOLTAGE = parseInt(FSK_MAX_AMPLITUDE * (Math.pow(2, 12)-1) / FSK_MAX_AMPLITUDE);

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
		buf.writeUInt8(b('00101000'), 2);
		self.spiTransfer({ id: id, data : buf });
		debug('IOCON ', buf);

		for (var i = 0; i < 4; i++) {
			buf.writeUInt8(GPIO64_WRITE_CTRL_BYTE | GPIO64_CS[i], 0);
			buf.writeUInt8(GPIO64_IODIRB, 1);
			buf.writeUInt8(0x00, 2);
			self.spiTransfer({ id: id, data : buf });
			debug(id + ' CS[' + GPIO64_CS[i].toString(2) + '] ', buf);
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
  	/* init DDS */
  	var buf = new Buffer([0x04,0x07,0x10,0x04,0x03,0x21]);
  	self.spiTransfer({ id: id, data: buf });

  	self.initFSK({ id: id });
  	self.initCom({ name: 'COM1' });
  	self.initCom({ name: 'COM2' });
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
		var result;
		if (args.mux) {
			result = rpio.spiTransfer(args.data, args.data.length, 
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
		} else if (args.id !== undefined) {
			result = rpio.spiTransfer(args.data, args.data.length, 
				rpio.getPin(IO[csMap[args.id]].channel));
		} else {
			result = rpio.spiTransfer(args.data, args.data.length);
		}
		
		if (args.id !== undefined && io[args.id].type != 'GPIO64') {
			/* check constant ID bit in the status register */
			if(result[0] & 0x0F != 0x0A) {
				debug('SPI comm error (Invalid constant ID byte) : ' + args.id);
			}
			/* check the reset status bit */
			if ((result[0] & 0x10) == 0) {
				debug('Board error (Board has not been reset since power-up) : ' + args.id);
			}
			/* check the last command invalid status bit */
			if(result[0] & 0x40) {
				debug('SPI comm error (Last command invalid) on board ' + args.id);
			}
			/* check the last command incomplete status bit */
			if(result[0] & 0x80) {
				debug('SPI comm error (Last command incomplete) on board ' + args.id);
			}
		}

		return result;
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
			for (var pos = 0; pos < 16; pos++) {
				var paddedCounter = String('00' + outCounter).slice(-2);
				values[pos] = ds.get('TIO.DO' + paddedCounter) ? 1 : 0;
				outCounter--;	
			}
			debug('W: ', values);
			buf.writeUInt16BE(b(values, 0, 16, 16), 1); 			
		}

		var response = self.spiTransfer({ id: args.id, data : buf });	
		var values = response.readUInt16BE(1);
		debug('WR: ', values.toString(2));
		for (var pos = 15; pos >= 0; pos--) {
			var paddedCounter = String('00' + inCounter).slice(-2);
			var old = IO['DI' + paddedCounter].value;
			IO['DI' + paddedCounter].value = (values & ( 1 << pos )) ? 1 : 0;
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
		debug('R: ', values.toString(2));
		for (var pos = 15; pos >= 0; pos--) {
			var paddedCounter = String('00' + counter).slice(-2);
			var old = IO['DI' + paddedCounter].value;
			IO['DI' + paddedCounter].value = (values & ( 1 << pos )) ? 1 : 0;
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
		buf.writeUInt8((args.setup[5] << 2) + args.setup[4], 1);
		buf.writeUInt8((args.setup[3] << 6) + (args.setup[2] << 4) +(args.setup[1] << 2) + args.setup[0], 2);

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
		data.writeUInt8(GPIO64_WRITE_CTRL_BYTE | GPIO64_CS[mcp], 0);
  	data.writeUInt8(GPIO64_GPIOB_OUT, 1);
  	data.writeUInt8(b(values, 0, 8, 8), 2);

  	self.spiTransfer({ id: IO[args.name].id, data : data });

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
			buf.writeUInt8(GPIO64_WRITE_CTRL_BYTE | GPIO64_CS[3], 0);
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
	  	data.writeUInt8(GPIO64_READ_CTRL_BYTE | GPIO64_CS[i], 0);
	  	data.writeUInt8(GPIO64_GPIOA_IN, 1);
			response = self.spiTransfer({ id: args.id, data : data });
			debug('R64 [MCP ' + i + ']: ', response);
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
				var when = parseInt((args.when - self.clockResetTime)/1.024);
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

		var buf = new Buffer(5);
		if (args.when !== undefined && args.when != 0) {
			try {
				buf.writeUInt8(0x05, 0);
				var when = parseInt((args.when - self.clockResetTime)/1.024);
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
				var old = IO['AI' + paddedCounter].value !== undefined ? IO['AI' + paddedCounter].value : -13;
				IO['AI' + paddedCounter].value = result.readInt16BE(pos)*10/32767;
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
				var old = IO['AI' + paddedCounter].value !== undefined ? IO['AI' + paddedCounter].value : -13;
					IO['AI' + paddedCounter].value = result.readInt16BE(pos)*10/32767;
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
	 * Enables TX for immediate flush
	 * @param {string} name - output name as per configuration data
	 * @param {boolean} enable - enable/disable TX
	 * @api public
	 */	
	self.enableComTX = function(args) {
		var buf = new Buffer([0x06, 0x09, 0x00]);
		var readBuf = self.spiTransfer( { id: IO[args.name].id, data: buf } );
		var register = readBuf.readUInt8(2);
		var addr;
		if (IO[args.name].channel == 0) {
			addr = 0x05;
		} else {
			addr = 0x06;
		}

		if (args.enable) {
			register &= 0xFD; // Clear the TX disable bitin register
		} else {
			register |= 0x02; // Set the TX disable bitin register
		}
		
		buf = new Buffer([0x06, 0x89, register]);
		self.spiTransfer( { id: IO[args.name].id, data: buf } );
	}

	/* 
	 * Writes serial message on any available COM port on the Tio stack
	 * @param {string} name - output name as per configuration data
	 * @param {buffer} data - data to send packaged as Buffer
	 * @param {number} when - timestamp for delayed execution (absolute UTC value)
	 * @api public
	 */	
	self.writeCom = function(args) {		
		var addr;
		if (IO[args.name].channel == 0) {
			addr = 0x05;
		} else {
			addr = 0x06;
		}
		
		var buf = new Buffer(2 + args.data.length);
		buf.writeUInt8(addr, 0);
		buf.writeUInt8(0x80, 1);
		args.data.copy(buf, 2);
		self.spiTransfer( { id: IO[args.name].id, data: buf } );
		if (args.when !== undefined && args.when != 0) {
			buf = new Buffer(6);
			buf.writeUInt8(addr, 0);
			try {
				var when = parseInt((args.when - self.clockResetTime)/1.024);
				buf.writeInt32BE(when, 1);
			} catch(e) {
				debug('certainly value out of bounds: ' + when);
				buf.writeUInt32BE(0, 1);
			}
			buf.writeUInt8(IO[args.name].protocol.link == 'RS232' ? 0  : 1, 5);
			self.spiTransfer( { id: IO[args.name].id, data: buf } );
		}
	}

	/* 
	 * Reads serial message on any available COM port on the Tio stack
	 * @param {string} name - output name as per configuration data
	 * @param {number} when - timestamp for delayed execution (absolute UTC value)
	 * @return {buffer} - read buffer
	 * @api public
	 */
	self.readCom = function(args) {
		debug('Not implemented');
	}

	/* 
	 * Configures any available COM port on the Tio stack
	 * @param {string} name - output name as per configuration data
	 * @param {string=} link - serial link type (RS232/RS485)
	 * @param {int=} speed - serial link speed
	 * @param {int=} parity - serial link parity
	 * @param {int=} start - serial link bit start
	 * @param {int=} stop - serial link bit stop
	 * @param {int=} len - serial link bit length
	 * @api public
	 */
	self.initCom = function(args) {
		if (args.speed === undefined) {
			args.speed = IO[args.name].protocol.speed;
		}
		/*  0=none, 1=even, 2=odd */
		if (args.parity === undefined) {
			args.parity = IO[args.name].protocol.parity;
		}
		if (args.start === undefined) {
			args.start = IO[args.name].protocol.start;
		}
		/* 1bit, 2bits */
		if (args.stop === undefined) {
			args.stop = IO[args.name].protocol.stop;
		}
		 /* 5,6,7,8 */
		if (args.len === undefined) {
			args.len = IO[args.name].protocol.len;
		}
		if (args.link === undefined) {
			args.link = IO[args.name].protocol.link;
		}

		var addr;
		if (IO[args.name].channel == 0) {
			addr = 0x05;
		} else {
			addr = 0x06;
		}

		function initUARTGPIO(outlevel) {
			var ubuf = new Buffer(3);
			// Setup UART  GPIO dir
			ubuf.writeUInt8(addr, 0);
			ubuf.writeUInt8(0x98, 1);
			ubuf.writeUInt8(0x0f, 2);
			self.spiTransfer( { id: IO[args.name].id, data: ubuf } );
			// Setup UART GPIO Level
			ubuf.writeUInt8(0x99, 1);
			ubuf.writeUInt8(outlevel, 2);
			self.spiTransfer( { id: IO[args.name].id, data: ubuf } );
		}

		var buf = new Buffer(3);
		buf.writeUInt8(addr, 0);
		buf.writeUInt8(0x09, 1);
		buf.writeUInt8(0x00, 2);
		var readBuf = self.spiTransfer( { id: IO[args.name].id, data: buf } );
		var rr = readBuf.readUInt8(2);

		if (args.link == "RS232") {
			initUARTGPIO(0x08);
			// Clear the RS485 bits in register
			rr &= 0xEF;
		} else {
			initUARTGPIO(0x0B);
			// Set the RS485 bits in register
			rr |= 0x10;
		}
		buf.writeUInt8(0x89, 1);
		buf.writeUInt8(rr, 2);
		self.spiTransfer( { id: IO[args.name].id, data: buf } );

		// parity, etc
		buf.writeUInt8(0x8b, 1);

		var register = 0; 
		if (args.parity == 1) {
			register += 0x18;
		} else if (args.parity == 2) {
			register += 0x08;
		}

		if (args.stop == 2) {
			register += 0x04;
		}

		if(args.len >= 5 && args.len <= 8) {
			register += (args.len - 5);
		}

		buf.writeUInt8(register, 2);
		self.spiTransfer( { id: IO[args.name].id, data: buf } );

		var div_mode = 1;
		var config_reg = 0;
		var baud_div_float = 0.0;

		baud_div_float = 3689000/(16*args.speed);

		// If baud rate is higher than the current divider value, try with 2x mode
		if(baud_div_float < 1) {
			div_mode = 2;
			baud_div_float = 3689000/(8*args.speed);
		}
	
		// If baud rate is higher than the current divider value, try with 4x mode
		if(baud_div_float < 1) {
			div_mode = 4;
			baud_div_float = 3689000/(4*baud);
		}
		
		// Setup the X mode
		if (div_mode == 2) { 
			config_reg += 0x10;
		} else if (div_mode == 4) {
			config_reg += 0x20;
		}

		// Setup the fractional portion of the baud
		var div = parseInt(baud_div_float);
		var fract = Math.round(16 * (baud_div_float - div));
		if(fract > 15) fract = 15;
		
		// compute the real baud rate
		var br_actual = 3689000/((16/div_mode)*(div + fract/16));
		var error = (args.speed - br_actual)/args.speed;

		// warn for debug if error is to high
		if(error > 2 || error < -2) {
			debug('UART <Baudrate reg> Mult:' + div_mode + ' Div:' + baud_div_float 
				+ ' Baud req:' + baud + ' Real Baud: ' + br_actual + ' Error: ' + error);
		}

		// Add the fractional portion
		config_reg += fract;
		
		buf.writeUInt8(addr, 0);
		buf.writeUInt8(0x9b, 1);
		buf.writeUInt8(config_reg, 2);
		self.spiTransfer( { id: IO[args.name].id, data: buf } );

		buf = new Buffer(5);
		buf.writeUInt8(addr, 0);
		buf.writeUInt8(0x9c, 1);
		buf.writeUInt16LE(div, 2);
		self.spiTransfer( { id: IO[args.name].id, data: buf } );
	}

	/* 
	 * Writes FSK message on any available FSK port on the Tio stack
	 * @param {string} name - output name as per configuration data
	 * @param {buffer} data - data to send packaged as Buffer
	 * @param {buffer} voltage - signal amplitude
	 * @param {number} when - timestamp for delayed execution (absolute UTC value)
	 * @api public
	 */	
	self.writeFSK = function(args) {
		var channel = IO[args.name].channel;
		var buf = new Buffer(7 + args.data.length);
		buf.writeUInt8(0x07, 0);

		var voltage = parseInt(args.voltage ? (args.voltage > FSK_MAX_AMPLITUDE ? FSK_MAX_AMPLITUDE : args.voltage) : FSK_MAX_AMPLITUDE);
		var gain = parseInt(voltage * (Math.pow(2, 12)-1) / FSK_MAX_AMPLITUDE);
		if (channel == 1) gain |= 0x8000; // mark the voltage for channel 1

		buf.writeUInt16BE(gain, 1);

		if (args.when !== undefined && args.when != 0) {
			try {
				var when = parseInt((args.when - self.clockResetTime)/1.024);
				buf.writeUInt32BE(when, 3);
			} catch(e) {
				debug('certainly value out of bounds: ' + when);
				buf.writeUInt32BE(0, 3);
			}
		} else {
			buf.writeUInt32BE(0, 3);
		}
		args.data.copy(buf, 7);
		self.spiTransfer( { id: IO[args.name].id, data: buf } );
	}

	/* 
	 * Configures any available FSK port on the Tio stack
	 * @param {string} id - CS id
	 * @param {int=} f1 - high frequency
	 * @param {int=} f0 - low frequency
	 * @param {int=} bitrate - bitrate
	 * @api public
	 */
	self.initFSK = function(args) {
		/* set FSK0 / I to off */
		var buf = new Buffer(4);
		buf.writeUInt8(0x04, 0);
		buf.writeUInt8(0x08, 1);
		buf.writeUInt16BE(0, 2);
		self.spiTransfer( { id: args.id, data: buf } );

		/* set FSK1 / Q to off */
		buf.writeUInt8(0x09, 1);
		self.spiTransfer( { id: args.id, data: buf } );

		if (args.f0 === undefined) {
			args.f0 = io[args.id].FSK.f0;
		}
		if (args.f1 === undefined) {
			args.f1 = io[args.id].FSK.f1;
		}

		buf = new Buffer(8);
		buf.fill(0);
		buf.writeUInt8(0x04, 0);
		buf.writeUInt8(0x02, 1);

		/* freq 1: low */
		encodeFreq(buf, args.f0);
		self.spiTransfer( { id: args.id, data: buf } );

		/* freq 2: high */
		buf.writeUInt8(0x03, 1);
		encodeFreq(buf, args.f1);
		self.spiTransfer( { id: args.id, data: buf } );

		/* bitrate */
		if (args.bitrate === undefined) {
			args.bitrate = io[args.id].FSK.bitrate;
		}

		var brfreq = parseInt(args.bitrate*Math.pow(2, 32)/100000000);

		buf = new Buffer(5);
		buf.writeUInt8(0x08, 0);
		buf.writeUInt32BE(brfreq, 1);
		self.spiTransfer( { id: args.id, data: buf } );
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
		self.spiTransfer( { id: IO[args.name].id, data: buf });
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
				var when = parseInt((args.when - self.clockResetTime)/1.024);
				buf.writeInt32BE(when, 2);
			} catch(e) {
				debug('certainly value out of bounds: ' + when);
				buf.writeUInt32BE(0, 2);
			}
		} else {
			buf.writeUInt32BE(0, 2);
		}
		/* Maximum frequency is set to 256kHz in the FPGA (hardware limit) 
		   any value higher than that will be set back to 256kHz */
		var freq = (args.freq * Math.pow(2, 32)) / 100000000;
		buf.writeUInt32BE(parseInt(freq), 6);
		var offset = (args.offset * Math.pow(2, 32)) / 360;
		buf.writeUInt32BE(parseInt(offset), 10);
		self.spiTransfer( { id: IO[args.name].id, data: buf });
	}

	/* 
	 * Hardware TIO stack reset
	 * @api public
	 */
	self.hwReset = function() {
		self.resetPin.writeSync(1);
		sleep(20);	
		self.resetPin.writeSync(0);
	}

	/* 
	 * Hardware TIO stack sync clock reset
	 * @api public
	 */
	self.hwSyncReset = function() {
		self.syncResetPin.writeSync(1); 	
		sleep(20);
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
							parseInt(Math.floor((doCounter - io[i].outStartIndex)/2));
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
				IO['COM'+(comCounter+1)] = {
					type: 'COM',
					id: i,
					boardType: io[i].type,
					channel: j,
					protocol: io[i].COM.channels[j]
				}
				comCounter++;
			}
		}
		if (io[i].FSK) {
			for (var j = 0; j < io[i].FSK.channels; j++) {
				IO['FSK'+(fskCounter+1)] = {
					type: 'FSK',
					id: i,
					boardType: io[i].type,
					channel: j
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
	self.hwReset();
	sleep(20);
	self.hwSyncReset();
	sleep(20);
	self.resetClock();
	sleep(20);

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
