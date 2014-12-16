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
"resetcs") 
    echo "CS reset"
    ./test_reset_cs.js
    ;;
"cs2") 
    echo "CS reset"
    ./test_reset_cs2.js
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
"32io-ds") 
    echo "GPIO32 test as per data"
    ./test_gpio32_ds.js
    ;;
"32io-b") 
    echo "GPIO32 test static pattern"
    ./test_gpio32_1_0.js
    ;;
"32io-p") 
    echo "GPIO32 test dynamic pattern"
    ./test_gpio32_pattern.js
    ;;
"32io-po") 
    echo "GPIO32 test dynamic pattern (single command)"
    ./test_gpio32_pattern_onecmd.js
    ;;
"32io-h") 
    echo "GPIO32 test high"
    ./test_gpio32_high.js
    ;;
"32io-h2") 
    echo "GPIO32 test high 2"
    ./test_gpio32_high-2.js
    ;;
"32io-2xh") 
    echo "GPIO32 test high 32 out (2x boards)"
    ./test_gpio32_high32out.js
    ;;
"32io-r") 
    echo "GPIO32 test reset"
    ./test_gpio32_reset.js
    ;;
"32io-s") 
    echo "GPIO32 test robustness"
    ./test_gpio32_robu.js
    ;;
"32io-rw") 
    echo "GPIO32 test read/write"
    ./test_gpio32_rw.js
    ;;
"32io-wat") 
    echo "GPIO32 test write at ..."
    ./test_gpio32_wat.js $2
    ;;
"32io-rid") 
    echo "GPIO32 test 1000 id"
    ./test_gpio32_id.js $2
    ;;
"com") 
    echo "FSKCOM test COM"
    ./test_fsk_com.js
    ;;
"com-s") 
    echo "FSKCOM test COM single send"
    ./test_fsk_com_single.js
    ;;
"com-d") 
    echo "FSKCOM test COM single send, delayed"
    ./test_fsk_com_singledelayed.js
    ;;
"fsk") 
    echo "FSKCOM test FSK"
    ./test_fsk_fsk.js
    ;;
"fsk-c") 
    echo "FSKCOM test FSK - continuous mode"
    ./test_fsk_fsk-continuous.js
    ;;
"fsk-r") 
    echo "FSKCOM test reset"
    ./test_fsk_reset.js
    ;;
"fsk-n") 
    echo "FSKCOM test no send"
    ./test_fsk_nofsk.js
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
"real")
    echo "Full real situation simulated"
    ./test.js
    ;;
"cpuio")
    echo "CPU IO"
    ./test_cpuio.js
    ;;
*) echo "No test"
   ;;
esac
