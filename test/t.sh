#!/bin/sh
export DEBUG=*

case "$1" in
"init") 
		echo "Init only test"
    ./test_initonly.js
    ;;
"cs") 
		echo "CS freq test"
    ./test_csfreq.js
    ;;
"spi") 
		echo "SPI perf test"
    ./test_spi.js
    ;;
"aio") 
    echo "AIO test"
    ./test_aio.js
    ;;
"aio-s") 
    echo "AIO test sin"
    ./test_aio_sin.js
    ;;
"aio-r") 
    echo "AIO test reset"
    ./test_aio_reset.js
    ;;
"aio5-5") 
    echo "AIO test (+5V/-5V pattern)"
    ./test_aio_5-5.js
    ;;
"aio-wat") 
    echo "AIO test write at ..."
    ./test_aio_wat.js $2
    ;;
"32io") 
    echo "GPIO32 test"
    ./test_gpio32.js
    ;;
"32io-b") 
    echo "GPIO32 test static pattern"
    ./test_gpio32_1_0.js
    ;;
"32io-p") 
    echo "GPIO32 test dynamic pattern"
    ./test_gpio32_pattern.js
    ;;
"32io-h") 
    echo "GPIO32 test high"
    ./test_gpio32_high.js
    ;;
"32io-r") 
    echo "GPIO32 test reset"
    ./test_gpio32_reset.js
    ;;
"32io-rw") 
    echo "GPIO32 test read/write"
    ./test_gpio32_rw.js
    ;;
"32io-wat") 
    echo "GPIO32 test write at ..."
    ./test_gpio32_wat.js $2
    ;;
"com") 
    echo "FSKCOM test COM"
    ./test_fsk_com.js
    ;;
"fsk") 
    echo "FSKCOM test FSK"
    ./test_fsk_fsk.js
    ;;
"fsk-r") 
    echo "FSKCOM test reset"
    ./test_fsk_reset.js
    ;;
"64io") 
    echo "GPIO64 test"
    ./test_gpio64.js
    ;;
"64io-s") 
    echo "GPIO64 test (single board)"
    ./test_gpio64_0_7_13_31_30.js
    ;;
"64io-b") 
    echo "GPIO64 test (10 pattern)"
    ./test_gpio64_1_0.js
    ;;
"64io-h") 
    echo "GPIO64 test (all high)"
    ./test_gpio64_high.js
    ;;
"64io-r") 
    echo "GPIO64 test (reset out)"
    ./test_gpio64_resetout.js
    ;;
"64io-rd") 
    echo "GPIO64 test read"
    ./test_gpio64_read.js
    ;;
*) echo "No test"
   ;;
esac
