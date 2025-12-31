#!/bin/bash

echo 'Ready to stop the process:' `cat service.pid`
kill `cat service.pid`
echo 'done.'

sleep 1
ps -u -p `cat service.pid`

nohup ./venv/bin/python main.py > start.log 2>&1 & echo $! > service.pid
echo 'Service run with pid:' `cat service.pid`
echo ''

sleep 1
ps -u -p `cat service.pid`