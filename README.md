# AI交易策略系统

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![Version](https://img.shields.io/badge/Version-cn--0.1.0-green.svg)](./VERSION)

基于FastAPI和SQLModel构建的智能交易策略执行系统，集成本地AI决策和远程策略服务，支持多市场、多策略的虚拟交易。

## 核心概念

- **虚拟账户**: 模拟真实交易账户，用于测试交易策略，跟踪资产变化

- **本地AI决策**: 系统内置的AI引擎，基于市场数据和策略规则生成交易决策

- **远程策略**: 外部API提供的专业交易策略建议

- **策略执行器**: 负责执行交易决策，管理交易流程

- **任务调度器**: 定时执行策略，支持手动触发

- **账户快照**: 记录特定时间点的账户状态，用于历史分析

## 功能特性

- 🤖 **AI智能决策**: 集成本地AI决策引擎，支持多种交易策略

- 📊 **虚拟账户管理**: 支持多个虚拟交易账户，实时跟踪资产变化

- 🔄 **自动化执行**: 定时执行交易策略，支持手动触发

- 🌐 **远程策略集成**: 对接远程策略API，获取专业交易建议

- 📈 **实时监控**: 提供完整的交易历史和账户快照

- 🛡️ **风险控制**: 内置风险评估和资金管理机制

- 📱 **现代化UI**: 基于React 18和Ant Design构建的响应式前端界面

## 项目结构

```
backtesting_tool/
├── app/                    # 应用核心代码
│   ├── api/                # API路由和端点
│   ├── executor/           # 策略执行器
│   ├── models/             # 数据模型
│   ├── services/           # 业务服务
│   ├── utils/              # 工具函数
│   ├── __init__.py         # 应用初始化
│   ├── database.py         # 数据库连接
│   └── main.py             # 应用入口
├── cfg/                    # 配置文件目录
│   ├── .env.sqlite         # SQLite环境配置模板
│   ├── __init__.py         # 配置初始化
│   ├── config.py           # 配置管理
│   └── logging.conf        # 日志配置
├── data/                   # 数据文件目录 (挂载到容器)
├── db/                     # 数据库目录 (挂载到容器)
│   └── backtesting_dev.db  # SQLite数据库文件
├── docs/                   # 文档目录
│   ├── api_documentation.md         # API文档
│   ├── database_design.md           # 数据库设计文档
│   ├── AI交易策略系统部署与开发指南.md # 部署指南
│   ├── user_manual.md               # 用户使用手册
│   └── 提示词示例.md                 # 提示词示例
├── frontend/               # 前端代码
│   ├── src/                # 前端源码
│   └── README.md           # 前端开发指南
├── tests/                  # 测试代码
├── .gitignore              # Git忽略配置
├── Dockerfile              # Docker构建文件
├── docker-compose.yml      # Docker Compose配置
├── main.py                 # 应用入口
├── README.md               # 项目说明
├── requirements.txt        # 依赖包
├── restart.sh              # 重启脚本
├── start.sh                # Linux/Mac启动脚本
├── status.sh               # 状态检查脚本
└── stop.sh                 # 停止脚本
```

## 项目文档说明

- [数据库设计文档](docs/database_design.md)

- [部署指南](docs/AI交易策略系统部署与开发指南.md)

- [用户使用手册](docs/user_manual.md)

- [API文档](docs/api_documentation.md)

- [前端开发指南](frontend/README.md)

   ## 🤝 如何贡献
   
   我们欢迎所有形式的贡献！请阅读我们的[贡献指南](CONTRIBUTING.md)开始。

## 技术栈

### 后端

- **FastAPI**: Python Web框架

- **SQLModel**: ORM框架 (SQLAlchemy + Pydantic)

- **SQLite**: 嵌入式数据库

- **Pandas**: 数据分析

- **APScheduler**: 任务调度

### 前端

- **React 18**: UI库

- **TypeScript**: 静态类型

- **Ant Design 5**: 组件库

- **Vite**: 构建工具

- **Zustand**: 状态管理

- **ECharts**: 图表展示

## 许可证

Apache-2.0 license