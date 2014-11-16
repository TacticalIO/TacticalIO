#!/bin/sh
export DEBUG=*

case "$1" in
"init") 
		echo "Init only test"
    ./test_initonly.js
    ;;
*) echo "Normal test"
   ./test.js
   ;;
esac
