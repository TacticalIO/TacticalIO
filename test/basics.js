#!/usr/local/bin/node

var b = require('../lib/adapter').b,
	assert = require('assert'),
	debug = require('debug')('basics');

var do32 = [1, 0, 1, 0, 1, 1, 1, 1, /* 7-0: 175 */
						1, 0, 1, 1, 1, 1, 0, 0, /* 15-8: 188*/
						1, 0, 1, 0, 0, 0, 1, 0, /* 23-16: 162 */
						1, 0, 0, 1, 1, 0, 1, 1]; /* 31-24: 155 */

/* 
DO07 -- DO00 DO15 -- DO08 DO23 -- DO16 DO31 -- DO24
*/
debug('do32 from 24 to 31 = 155');
assert.equal(b(do32, 24, 8, 32), 155);
debug('do32 from 16 to 23 = 162');
assert.equal(b(do32, 16, 8, 32), 162);
debug('do32 from 8 to 15 = 188');
assert.equal(b(do32, 8, 8, 32), 188);
debug('do32 from 0 to 7 = 175');
assert.equal(b(do32, 0, 8, 32), 175);

debug('do32 from 24 to 31 = 0');
assert.equal(b(0, 24, 8, 32), 0);
debug('do32 from 16 to 23 = 0');
assert.equal(b(0, 16, 8, 32), 0);
debug('do32 from 8 to 15 = 0');
assert.equal(b(0, 8, 8, 32), 0);
debug('do32 from 0 to 7 = 0');
assert.equal(b(0, 0, 8, 32), 0);

debug('00001000 = 8');
assert.equal(b('00001000'), 8);

const GPIO64_WRITE_CTRL_BYTE	= b('01001110');
const GPIO64_READ_CTRL_BYTE		= b('01000001');
const GPIO64_CS 						  = [ 
	b('11110111'), /* 24-31 */
	b('11110011'), /* 16-23 */
	b('11110101'), /* 08-15 */
	b('11110001')  /* 00-07 */
];

debug('GPIO64_WRITE_CTRL_BYTE & GPIO64_CS[0] = ', (GPIO64_CS[0]&GPIO64_WRITE_CTRL_BYTE).toString(2));
debug('GPIO64_WRITE_CTRL_BYTE & GPIO64_CS[1] = ', (GPIO64_CS[1]&GPIO64_WRITE_CTRL_BYTE).toString(2));
debug('GPIO64_WRITE_CTRL_BYTE & GPIO64_CS[2] = ', (GPIO64_CS[2]&GPIO64_WRITE_CTRL_BYTE).toString(2));
debug('GPIO64_WRITE_CTRL_BYTE & GPIO64_CS[3] = ', (GPIO64_CS[3]&GPIO64_WRITE_CTRL_BYTE).toString(2));

debug('255= b(255, 0, 16, 16)', b(255, 0, 16, 16));
assert.equal(b(255, 0, 16, 16), 255);
debug('43690= 1010101010101010', b('1010101010101010', 0, 16, 16));
assert.equal(43690, b('1010101010101010', 0, 16, 16));

// crazy programming made in Canada
var time_buf = new ArrayBuffer(4);
var time_32bits = new Uint32Array(time_buf);
var time_8bits = new Uint8Array(time_buf);

time_32bits[0] = 143434300;

var crazyBuf = new Buffer(4);
crazyBuf.writeUInt8(time_8bits[3], 0);
crazyBuf.writeUInt8(time_8bits[2], 1);
crazyBuf.writeUInt8(time_8bits[1], 2);
crazyBuf.writeUInt8(time_8bits[0], 3);

var nonCrazyBuf = new Buffer(4);
nonCrazyBuf.writeUInt32BE(143434300, 0);
debug('crazy vs non crazy', crazyBuf, nonCrazyBuf);