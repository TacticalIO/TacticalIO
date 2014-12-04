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
"32io") 
    echo "GPIO32 test"
    ./test_gpio32.js
    ;;
"64io") 
    echo "GPIO64 test"
    ./test_gpio64.js
    ;;
*) echo "Normal test"
   ./test.js
   ;;
esac
