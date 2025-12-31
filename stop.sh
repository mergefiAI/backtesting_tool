#!/bin/bash

# 停止服务
if [ -f service.pid ]; then
    PID=$(cat service.pid)
    if ps -p $PID > /dev/null 2>&1; then
        echo "Stopping service with PID: $PID"
        kill $PID
        rm service.pid
        echo "Service stopped successfully"
    else
        echo "Service is not running (PID: $PID)"
        rm service.pid
    fi
else
    echo "No service.pid file found. Service may not be running."
fi