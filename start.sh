#!/bin/bash

# 检查venv目录下的Python解释器路径
if [ -f "./venv/bin/python" ]; then
    PYTHON_PATH="./venv/bin/python"
elif [ -f "./venv/Scripts/python.exe" ]; then
    PYTHON_PATH="./venv/Scripts/python.exe"
else
    echo "Error: Python interpreter not found in venv directory"
    exit 1
fi

# 启动服务并将输出重定向到日志文件
nohup $PYTHON_PATH main.py > start.log 2>&1 & echo $! > service.pid

# 等待一段时间确保服务启动
sleep 2

# 检查服务是否仍在运行
if ps -p $(cat service.pid) > /dev/null 2>&1; then
    echo "Service started successfully with PID: $(cat service.pid)"
    echo "Logs are being written to start.log and logs/info.log"
    echo "You can view logs with: tail -f start.log"
    echo "Service is running in background and will continue running after this script exits"
else
    echo "Failed to start service. Check start.log for details."
    exit 1
fi