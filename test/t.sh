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
"aio5-5") 
    echo "AIO test (+5V/-5V pattern)"
    ./test_aio_5-5.js
    ;;
"32io") 
    echo "GPIO32 test"
    ./test_gpio32.js
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
    ./test_gpio64_1_1.js
    ;;
"64io-r") 
    echo "GPIO64 test (reset out)"
    ./test_gpio64_resetout.js
    ;;
*) echo "Normal test"
   ./test.js
   ;;
esac
