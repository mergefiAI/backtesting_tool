# 数据库设计文档

## 1. 数据库概述

本项目使用SQLite数据库，采用SQLModel作为ORM框架，实现了AI交易策略回测系统的数据存储和管理功能。数据库设计遵循数据完整性、性能优化和可扩展性原则，支持股票和加密货币市场的虚拟交易回测。

数据库文件位于项目根目录下的`backtesting_dev.db`文件。系统启动时会自动检查数据库文件是否存在，如果不存在则自动创建所有表结构。SQLModel框架负责将Python模型类映射为SQLite表结构，确保代码与数据库模式的一致性。

## 2. 技术栈

本项目数据库层采用以下技术组件构建。SQLite作为嵌入式数据库，无需独立的数据库服务进程，非常适合本地开发和回测场景。SQLModel作为ORM框架，它结合了Pydantic的数据验证能力和SQLAlchemy的ORM功能，提供了类型安全的数据访问接口。SQLModel支持自动表创建、关系映射、事务管理等高级功能，大大简化了数据库操作代码的编写。

系统通过依赖注入方式管理数据库会话，每个API请求都会获得独立的数据库会话，确保并发访问时的数据隔离性。数据库连接配置通过`cfg.config`模块统一管理，支持自定义数据库路径和其他连接参数。

## 3. 表结构说明

### 3.1 虚拟账户表（virtual_accounts）

虚拟账户表用于管理用户的虚拟交易账户，是回测系统的核心数据表之一。该表记录了账户的基本信息、余额状态、持仓情况以及交易费用配置，支持股票和加密货币两种市场的交易模拟。

| 字段名 | 数据类型 | 约束 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| market_type | VARCHAR | INDEX | - | 市场类型，例如US或COIN |
| account_id | VARCHAR | PRIMARY KEY | - | 账户唯一标识符 |
| initial_balance | NUMERIC(38,8) | NOT NULL | - | 账户初始余额 |
| current_balance | NUMERIC(38,8) | NOT NULL | - | 当前可用余额 |
| stock_symbol | VARCHAR | INDEX | - | 交易的标的代码 |
| stock_price | NUMERIC(38,8) | NOT NULL | - | 当前标的价格 |
| stock_quantity | NUMERIC(38,8) | NOT NULL | 0 | 持仓数量，正数为多头，负数为空头 |
| stock_market_value | NUMERIC(38,8) | NOT NULL | - | 当前持仓市值 |
| total_value | NUMERIC(38,8) | NOT NULL | 0 | 账户总资产价值 |
| created_at | TIMESTAMP | NOT NULL | 自动生成 | 账户创建时间 |
| updated_at | TIMESTAMP | NOT NULL | 自动生成 | 最后更新时间 |
| position_side | VARCHAR | - | LONG | 持仓方向，LONG为多头，SHORT为空头 |
| margin_used | NUMERIC(38,8) | - | 0 | 当前占用的保证金金额 |
| short_avg_price | NUMERIC(38,8) | - | 0 | 空头持仓的平均价格 |
| short_total_cost | NUMERIC(38,8) | - | 0 | 空头持仓的总成本 |
| short_positions | JSON | - | [] | 空头持仓明细列表 |
| long_positions | JSON | - | [] | 多头持仓明细列表 |
| available_balance | NUMERIC(38,8) | - | 0 | 当前可用余额 |
| commission_rate_buy | NUMERIC(10,6) | - | 0.001 | 买入交易佣金率 |
| commission_rate_sell | NUMERIC(10,6) | - | 0.001 | 卖出交易佣金率 |
| tax_rate | NUMERIC(10,6) | - | 0.001 | 卖出时印花税率 |
| min_commission | NUMERIC(10,2) | - | 5.00 | 每笔最低佣金 |
| total_fees | NUMERIC(38,8) | - | 0 | 累计支付的交易费用 |

该表使用Decimal类型存储金额和数量字段，确保金融计算的高精度要求。所有金额字段统一保留8位小数，持仓数量字段也保留8位小数以满足加密货币的最小单位需求。系统通过Pydantic的field_validator自动对输入值进行精度校验和四舍五入处理。

### 3.2 账户快照表（account_snapshots）

账户快照表用于记录账户在特定时间点的完整状态信息，是回测分析的重要数据来源。每次生成快照时，系统会捕获账户的余额、持仓、市值、盈亏等关键指标，形成账户历史变化的完整记录。

| 字段名 | 数据类型 | 约束 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| snapshot_id | VARCHAR | PRIMARY KEY | - | 快照唯一标识符 |
| task_id | VARCHAR | INDEX | NULL | 关联的回测任务ID |
| account_id | VARCHAR | INDEX | - | 关联的账户ID |
| balance | NUMERIC(38,8) | NOT NULL | - | 快照时的账户余额 |
| stock_quantity | NUMERIC(38,8) | NOT NULL | - | 快照时的持仓数量 |
| stock_price | NUMERIC(38,8) | NOT NULL | - | 快照时的标的收盘价 |
| stock_market_value | NUMERIC(38,8) | NOT NULL | - | 快照时的持仓市值 |
| total_value | NUMERIC(38,8) | NOT NULL | - | 快照时的总资产价值 |
| profit_loss | NUMERIC(38,8) | NOT NULL | - | 累计盈亏金额 |
| profit_loss_percent | NUMERIC(15,6) | NOT NULL | - | 累计盈亏百分比 |
| timestamp | TIMESTAMP | INDEX | 自动生成 | 快照生成时间 |
| margin_used | NUMERIC(38,8) | - | 0 | 快照时的保证金占用 |
| market_type | VARCHAR | - | - | 市场类型 |
| initial_balance | NUMERIC(38,8) | NOT NULL | - | 账户初始余额 |
| stock_symbol | VARCHAR | - | - | 关联的标的代码 |
| current_balance | NUMERIC(38,8) | NOT NULL | - | 当前余额 |
| position_side | VARCHAR | - | LONG | 持仓方向 |
| short_avg_price | NUMERIC(38,8) | - | 0 | 空头持仓均价 |
| short_total_cost | NUMERIC(38,8) | - | 0 | 空头持仓总成本 |
| short_positions | JSON | - | [] | 空头持仓明细 |
| long_positions | JSON | - | [] | 多头持仓明细 |
| available_balance | NUMERIC(38,8) | - | 0 | 可用余额 |
| total_fees | NUMERIC(38,8) | - | 0 | 累计交易费用 |

快照表通过task_id字段与回测任务关联，支持按回测任务查询历史表现。timestamp字段建立了时间索引，支持按时间范围查询账户历史状态。盈亏百分比字段保留6位小数，避免过度精确导致的显示问题。

### 3.3 本地决策记录表（local_decisions）

本地决策记录表用于存储AI决策引擎生成的每次决策详情，是回测系统的决策日志。该表记录了决策的基本信息、置信度评分、决策理由以及相关的市场数据，为策略分析和优化提供详细的数据支撑。

| 字段名 | 数据类型 | 约束 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| decision_id | VARCHAR | PRIMARY KEY | - | 决策唯一标识符 |
| task_id | VARCHAR | INDEX | NULL | 关联的回测任务ID |
| account_id | VARCHAR | INDEX | - | 关联的账户ID |
| stock_symbol | VARCHAR | INDEX | - | 交易的标的代码 |
| decision_result | VARCHAR | NOT NULL | - | 决策结果，如买入、卖出、持有 |
| confidence_score | NUMERIC(10,6) | NOT NULL | - | AI决策的置信度评分 |
| reasoning | VARCHAR | NOT NULL | - | AI决策的详细理由 |
| market_data | JSON | NULL | NULL | 决策时使用的市场数据 |
| start_time | TIMESTAMP | INDEX | 自动生成 | 决策开始时间 |
| end_time | TIMESTAMP | INDEX | NULL | 决策结束时间 |
| execution_time_ms | INTEGER | NULL | NULL | 决策执行耗时（毫秒） |
| analysis_date | TIMESTAMP | NULL | NULL | 分析日期 |

market_data字段采用JSON类型存储，可以灵活保存决策时使用的各类技术指标、形态特征等数据。系统内置了JSON字符串兼容性处理逻辑，确保从数据库读取时能正确解析存储格式。

### 3.4 任务表（tasks）

任务表是回测任务的核心管理表，记录了每个回测任务的完整生命周期信息。从任务创建开始，到执行、暂停、恢复、完成，每个状态变化都会更新相应的时间戳字段，形成完整的任务执行轨迹。

| 字段名 | 数据类型 | 约束 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| task_id | VARCHAR | PRIMARY_KEY | - | 回测任务唯一标识符 |
| account_id | VARCHAR | INDEX | - | 关联的虚拟账户ID |
| stock_symbol | VARCHAR | INDEX | - | 交易的标的代码 |
| market_type | VARCHAR | NULL | NULL | 市场类型，如US或COIN |
| user_prompt_id | VARCHAR | NULL | NULL | 使用的策略模板ID |
| ai_config_id | VARCHAR | INDEX | NULL | 关联的AI配置ID |
| start_date | TIMESTAMP | INDEX | - | 回测开始日期 |
| end_date | TIMESTAMP | INDEX | - | 回测结束日期 |
| status | VARCHAR | INDEX | PENDING | 任务状态 |
| created_at | TIMESTAMP | INDEX | 自动生成 | 任务创建时间 |
| started_at | TIMESTAMP | NULL | NULL | 任务启动时间 |
| paused_at | TIMESTAMP | NULL | NULL | 任务暂停时间 |
| resumed_at | TIMESTAMP | NULL | NULL | 任务恢复时间 |
| completed_at | TIMESTAMP | NULL | NULL | 任务完成时间 |
| error_message | TEXT | NULL | NULL | 任务执行错误信息 |
| total_items | INTEGER | NULL | NULL | 计划处理的数据总量 |
| processed_items | INTEGER | - | 0 | 已处理的数据数量 |
| time_granularity | VARCHAR | INDEX | daily | 时间粒度，daily、hourly或minute |
| decision_interval | INTEGER | - | 1 | 决策间隔单位数 |
| stats | JSON | NULL | NULL | 回测统计结果数据 |

任务状态枚举值包括：PENDING（待执行）、RUNNING（运行中）、PAUSED（已暂停）、COMPLETED（已完成）、COMPLETED_WITH_ERRORS（部分完成但有错误）、FAILED（执行失败）、CANCELLED（已取消）。stats字段使用JSON类型存储回测的汇总统计信息，包括总交易次数、收益率、夏普比率、最大回撤等关键指标。

### 3.5 交易记录表（trade_records）

交易记录表用于记录所有模拟交易操作的详细信息，是回测绩效分析的核心数据。每笔交易都会记录交易动作、价格、数量、费用以及交易前后的账户状态变化。

| 字段名 | 数据类型 | 约束 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| trade_id | VARCHAR | PRIMARY_KEY | - | 交易唯一标识符 |
| task_id | VARCHAR | INDEX | NULL | 关联的回测任务ID |
| account_id | VARCHAR | INDEX | - | 关联的账户ID |
| stock_symbol | VARCHAR | INDEX | - | 交易的标的代码 |
| trade_action | VARCHAR | INDEX | - | 交易动作，如买入、卖出 |
| quantity | NUMERIC(38,8) | NOT NULL | - | 交易数量 |
| price | NUMERIC(38,8) | NOT NULL | - | 成交价格 |
| total_amount | NUMERIC(38,8) | NOT NULL | - | 交易总额 |
| status | VARCHAR | - | PENDING | 交易状态 |
| trade_time | TIMESTAMP | INDEX | 自动生成 | 交易发生时间 |
| decision_id | VARCHAR | NULL | NULL | 关联的决策ID |
| commission | NUMERIC(38,8) | - | 0 | 交易佣金 |
| tax | NUMERIC(38,8) | - | 0 | 交易税费 |
| total_fees | NUMERIC(38,8) | - | 0 | 总交易费用 |
| position_side | VARCHAR | - | LONG | 持仓方向 |
| open_id | VARCHAR | NULL | NULL | 开仓交易ID，用于平仓关联 |
| stock_market_value_after | NUMERIC(38,8) | - | 0 | 交易后的持仓市值 |
| total_value_after | NUMERIC(38,8) | - | 0 | 交易后的账户总资产 |
| margin_used_after | NUMERIC(38,8) | - | 0 | 交易后的保证金占用 |
| remaining_quantity_after | NUMERIC(38,8) | - | 0 | 交易后的剩余持仓数量 |
| avg_price_after | NUMERIC(38,8) - | 0 | 交易后的持仓均价 |

交易数量和金额字段同样采用8位小数精度，确保与虚拟账户表的精度一致。系统会在每笔交易记录生成时自动计算交易后的账户状态快照，便于后续的盈亏分析和绩效评估。

### 3.6 策略模板表（prompt_templates）

策略模板表用于管理AI决策引擎使用的提示词模板。每个模板包含提示词内容、描述、状态和标签，支持策略的分类管理和状态控制。

| 字段名 | 数据类型 | 约束 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| prompt_id | VARCHAR | PRIMARY_KEY | - | 策略模板唯一标识符 |
| content | TEXT | NOT NULL | - | 提示词完整内容 |
| description | VARCHAR | NULL | NULL | 策略描述信息 |
| status | VARCHAR | - | AVAILABLE | 模板状态 |
| tags | VARCHAR | NULL | NULL | 标签列表，逗号分隔 |
| created_at | TIMESTAMP | NOT NULL | 自动生成 | 创建时间 |
| updated_at | TIMESTAMP | NOT NULL | 自动生成 | 更新时间 |

状态枚举值包括：AVAILABLE（可用）、UNAVAILABLE（不可用）、DELETED（已删除）。这种状态设计支持软删除机制，保留历史数据的同时实现逻辑删除。

### 3.7 AI配置表（ai_configs）

AI配置表用于管理本地AI服务的连接配置信息。系统支持配置多个AI服务终端，便于在不同环境下切换使用。

| 字段名 | 数据类型 | 约束 | 默认值 | 描述 |
|--------|----------|------|--------|------|
| config_id | VARCHAR | PRIMARY_KEY | - | 配置唯一标识符 |
| name | VARCHAR | NOT NULL | - | 配置名称 |
| local_ai_base_url | VARCHAR | NOT NULL | - | AI服务基础URL |
| local_ai_api_key | VARCHAR | NOT NULL | - | AI服务API密钥 |
| local_ai_model_name | VARCHAR | NOT NULL | - | 使用的模型名称 |
| created_at | TIMESTAMP | NOT NULL | 自动生成 | 创建时间 |
| updated_at | TIMESTAMP | NOT NULL | 自动生成 | 更新时间 |

该表通过task表中的ai_config_id外键与任务关联，支持为不同的回测任务配置不同的AI服务。

## 4. 数据模型关系

### 4.1 实体关系图

```
┌─────────────────────┐       ┌─────────────────────┐
│   virtual_accounts  │       │  account_snapshots  │
├─────────────────────┤       ├─────────────────────┤
│ account_id (PK)     │<──────│ account_id (FK)     │
│ stock_symbol (INDEX)│       │ snapshot_id (PK)    │
└──────────┬──────────┘       │ task_id (FK)        │
           │                  └──────────┬──────────┘
           │                             │
           │                  ┌──────────▼──────────┐
           │                  │    local_decisions  │
           │                  ├─────────────────────┤
           │                  │ decision_id (PK)    │
           │                  │ account_id (FK)     │
           │                  │ task_id (FK)        │
           │                  └──────────┬──────────┘
           │                             │
           │                  ┌──────────▼──────────┐
           │                  │    trade_records    │
           │                  ├─────────────────────┤
           │                  │ trade_id (PK)       │
           │                  │ account_id (FK)     │
           │                  │ task_id (FK)        │
           │                  │ decision_id (FK)    │
           │                  └──────────┬──────────┘
           │                             │
           │                  ┌──────────▼──────────┐
           │                  │       tasks         │
           │                  ├─────────────────────┤
           │                  │ task_id (PK)        │
           │                  │ account_id (FK)     │
           │                  │ user_prompt_id (FK) │
           │                  │ ai_config_id (FK)   │
           │                  └──────────┬──────────┘
           │                             │
┌──────────▼──────────┐                  │
│  prompt_templates   │                  │
├─────────────────────┤                  │
│ prompt_id (PK)      │<─────────────────┘
│ content             │
│ description         │
│ status              │
└─────────────────────┘


┌─────────────────────┐
│     ai_configs      │
├─────────────────────┤
│ config_id (PK)      │
│ name                │
│ local_ai_base_url   │
│ local_ai_api_key    │
│ local_ai_model_name │
└─────────────────────┘
```

### 4.2 关系说明

虚拟账户表与账户快照表之间是一对多关系，每个虚拟账户可以生成多个历史快照。快照通过account_id字段关联到对应账户，同时通过task_id字段记录生成该快照的回测任务。

虚拟账户表与本地决策表、交易记录表之间同样是一对多关系。决策记录和交易记录都通过account_id关联到账户，支持按账户查询历史决策和交易。

任务表是回测系统的核心关联表，它通过外键关联到虚拟账户表（account_id）、策略模板表（user_prompt_id）和AI配置表（ai_config_id）。每个任务对应一次完整的回测执行，产生多个决策记录和交易记录。

策略模板表和AI配置表是系统的基础配置表，被任务表引用但不被其他业务表直接关联。这种设计支持策略和配置的独立管理，可以随时创建新的策略模板或AI配置供回测任务使用。

## 5. 索引设计

合理的索引设计是保证查询性能的关键。以下是各表的索引配置说明。

| 表名 | 索引字段 | 索引类型 | 说明 |
|------|----------|----------|------|
| virtual_accounts | market_type | INDEX | 按市场类型筛选账户 |
| virtual_accounts | account_id | PRIMARY KEY | 主键索引 |
| virtual_accounts | stock_symbol | INDEX | 按标的代码查询账户 |
| account_snapshots | snapshot_id | PRIMARY KEY | 主键索引 |
| account_snapshots | task_id | INDEX | 按任务查询快照 |
| account_snapshots | account_id | INDEX | 按账户查询快照 |
| account_snapshots | timestamp | INDEX | 按时间范围查询快照 |
| local_decisions | decision_id | PRIMARY KEY | 主键索引 |
| local_decisions | task_id | INDEX | 按任务查询决策 |
| local_decisions | account_id | INDEX | 按账户查询决策 |
| local_decisions | stock_symbol | INDEX | 按标的查询决策 |
| local_decisions | start_time | INDEX | 按时间查询决策 |
| local_decisions | end_time | INDEX | 按结束时间查询 |
| tasks | task_id | PRIMARY KEY | 主键索引 |
| tasks | account_id | INDEX | 按账户查询任务 |
| tasks | stock_symbol | INDEX | 按标的查询任务 |
| tasks | status | INDEX | 按状态筛选任务 |
| tasks | ai_config_id | INDEX | 按AI配置筛选任务 |
| tasks | time_granularity | INDEX | 按时间粒度筛选任务 |
| tasks | created_at | INDEX | 按创建时间排序 |
| tasks | start_date | INDEX | 按回测开始日期筛选 |
| tasks | end_date | INDEX | 按回测结束日期筛选 |
| trade_records | trade_id | PRIMARY KEY | 主键索引 |
| trade_records | task_id | INDEX | 按任务查询交易 |
| trade_records | account_id | INDEX | 按账户查询交易 |
| trade_records | stock_symbol | INDEX | 按标的查询交易 |
| trade_records | trade_action | INDEX | 按交易动作筛选 |
| trade_records | trade_time | INDEX | 按时间范围查询交易 |
| prompt_templates | prompt_id | PRIMARY KEY | 主键索引 |
| ai_configs | config_id | PRIMARY KEY | 主键索引 |

索引的设计遵循高频查询优先的原则。对于账户快照和交易记录等数据量可能较大的表，复合索引的使用需要根据实际查询模式进行优化。建议定期使用EXPLAIN QUERY PLAN分析慢查询，针对性地添加或调整索引。

## 6. 字段精度与校验

### 6.1 金额字段精度

所有涉及金额的字段统一采用NUMERIC(38,8)数据类型，即总共38位数字，其中8位为小数部分。这种精度设计能够满足绝大多数金融计算场景的需求，包括大额资金和微小价格变动的精确表示。

金额字段在模型层通过Pydantic的field_validator进行校验和自动四舍五入。当输入值的小数位超过8位时，系统会自动截断到8位，确保数据库存储的一致性。校验失败时系统会记录错误日志并将字段值设为0。

### 6.2 持仓数量精度

持仓数量字段同样采用NUMERIC(38,8)精度，以支持加密货币的小数位需求（如比特币的最小单位为8位小数）。持仓数量字段的校验逻辑与金额字段相同，确保数量数据的精确性。

### 6.3 百分比字段精度

盈亏百分比字段采用NUMERIC(15,6)精度，保留6位小数。这个精度对于展示收益率等百分比指标已经足够，同时避免了因过度精确导致的显示混乱问题。

## 7. 数据库初始化

### 7.1 自动初始化

系统启动时会自动检查数据库文件是否存在。如果数据库文件不存在，SQLModel会自动创建所有定义的表结构。应用层代码无需显式调用建表语句。

初始化过程中，系统会按照模型定义的顺序创建表，确保外键约束的正确性。如果数据库版本升级需要修改表结构，建议使用数据库迁移工具（如Alembic）来管理变更。

### 7.2 手动初始化

如需手动初始化数据库，可以在项目根目录执行以下命令：

```bash
python -c "from app.database import engine; from app.models import *; SQLModel.metadata.create_all(engine)"
```

该命令会调用SQLModel的元数据创建功能，在数据库文件中创建所有表结构。如果表已存在，则不会重复创建。

### 7.3 数据库重置

在开发测试过程中，有时需要重置数据库到初始状态。操作步骤如下：

首先停止运行中的后端服务，然后删除现有的数据库文件，最后重新启动后端服务。系统启动时会自动创建新的空数据库。

```bash
# 停止后端服务后执行
rm backtesting_dev.db

# 重新启动后端服务
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

注意：重置数据库会清除所有历史数据，包括账户信息、回测记录、交易历史等。请确保在执行前已做好必要的数据备份。

## 8. 最佳实践

### 8.1 查询优化

在进行数据库查询时，应尽量利用已有的索引，避免全表扫描。对于复杂的查询条件，优先使用索引字段进行筛选，必要时可以通过增加复合索引来优化多条件查询的性能。

对于需要分页查询的列表接口，建议使用OFFSET和LIMIT的组合方式，并确保ORDER BY子句使用的字段上有索引支撑。当数据量较大时，深分页（如OFFSET值很大）可能会导致性能问题，此时可以考虑使用游标分页的方式进行优化。

### 8.2 事务管理

涉及多表数据一致性的操作应使用事务包装，确保要么全部成功，要么全部回滚。SQLModel通过Session对象提供事务支持，API路由中通过依赖注入获得的db参数已配置好自动提交和回滚逻辑。

对于需要手动控制事务的场景，可以使用db.begin()上下文管理器显式控制事务边界。

### 8.3 数据备份

SQLite数据库的备份非常简单，直接复制数据库文件即可。建议在重要操作前（如批量数据修改、数据库结构调整前）进行手动备份。

对于生产环境，可以考虑定期自动备份数据库文件，并将备份文件存储到安全的位置。备份策略应根据数据变化频率和业务重要性来制定。

### 8.4 监控与维护

应定期监控数据库文件的增长情况和查询性能。SQLite提供了一些系统表（如sqlite_master、sqlite_stat1）可以用于分析数据库结构。对于长时间运行的系统，定期重建索引可以优化查询性能。

磁盘空间是另一个需要关注的指标，特别是对于会产生大量历史数据的回测系统。建议设置磁盘空间监控告警，及时发现和处理存储空间不足的问题。

## 9. 常见问题

### 9.1 如何处理大量历史数据

随着回测任务的执行，账户快照、交易记录等表的数据量会不断增长。当数据量达到一定规模时，查询性能可能会下降。处理策略包括：

定期清理过期的历史数据是管理数据量的有效方式。可以根据业务需要设定数据保留策略，如只保留最近一年的历史数据。对于需要长期保存的数据，可以考虑导出到归档数据库。

另一种方法是采用分区表设计，按时间对大表进行分区。但SQLite的分区表支持有限，可能需要考虑迁移到PostgreSQL等更强大的数据库系统。

### 9.2 如何确保数据安全

数据安全涉及多个层面。首先是文件级别的安全，确保数据库文件的访问权限只授予应用程序进程用户，避免未授权访问。

其次是敏感数据的保护。API密钥、配置信息等敏感数据应考虑加密存储。对于AI配置表中存储的API密钥，可以在应用层进行加密处理后再存入数据库。

最后是数据备份安全。备份文件同样需要妥善保管，避免备份数据泄露导致的安全风险。

### 9.3 如何处理并发访问

SQLite采用文件级锁机制处理并发访问，对于本地的开发和测试场景已经足够。但在高并发写入场景下，可能会出现锁等待的情况。

如果并发需求较高，建议考虑迁移到PostgreSQL等支持更细粒度并发控制的数据库系统。SQLModel对数据库类型是透明的，只需修改数据库连接配置即可切换数据库。

### 9.4 数据库文件损坏怎么办

SQLite数据库文件可能因系统崩溃、磁盘故障等原因损坏。轻微的损坏可以使用SQLite的命令行工具尝试修复：

```bash
sqlite3 backtesting_dev.db ".recover"
```

如果修复失败且没有有效备份，可能需要重新初始化数据库。这强调了定期备份的重要性。

## 10. 参考资料

本数据库设计参考了以下资源和最佳实践：

SQLite官方文档提供了数据库引擎的详细技术说明，包括数据类型、索引机制、事务处理等核心概念。SQLModel官方文档详细介绍了ORM框架的使用方法，包括模型定义、关系映射、会话管理等。FastAPI官方文档包含数据库集成的最佳实践示例。

对于数据库设计的理论基础，可以参考数据库系统概论相关的经典教材和在线课程。
