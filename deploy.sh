#!/bin/sh
#cat .ssh/id_rsa.pub | ssh pi@192.168.0.17 'cat >> .ssh/authorized_keys'
REMOTE=$1
ssh ${REMOTE} mkdir -p /opt/TacticalIO
scp -r ./test ./lib ./index.js ./package.json ${REMOTE}:/opt/TacticalIO


case "$2" in
"b") 
	echo "Rebuild dependencies"
  ssh ${REMOTE} "cd /opt/TacticalIO; npm rebuild"
  ;;
"m") 
	echo "Install modules as well"
  ssh ${REMOTE} "cd /opt/TacticalIO; npm install"
  ;;
*) 
	echo "Copy only"
  ;;
esac
