# API 接口文档

## 概述

本文档描述了AI交易策略回测系统的后端API接口。所有接口均采用RESTful风格，返回数据采用JSON格式。

**基础URL**: `http://localhost:8000`

**认证方式**: 当前版本无需认证，后续版本将引入JWT认证机制。

---

## 通用响应格式

### 成功响应 (ApiResponse)

```json
{
  "code": 200,
  "msg": "success",
  "data": { ... }
}
```

### 分页响应 (PaginatedResponse)

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "items": [...],
    "page": 1,
    "page_size": 100,
    "total": 50,
    "total_pages": 1
  }
}
```

### 错误响应

```json
{
  "code": 404,
  "msg": "资源不存在",
  "data": null
}
```

---

## 账户管理

### 查询账户快照

**接口**: `GET /account/snapshot`

**描述**: 获取账户快照列表，支持分页查询。

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | integer | 否 | 页码，默认1 |
| page_size | integer | 否 | 每页数量，默认100 |

**响应示例**:

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "items": [
      {
        "snapshot_id": "uuid-xxx",
        "account_id": "acc-001",
        "total_assets": 100000.00,
        "cash": 50000.00,
        "positions": 50000.00,
        "created_at": "2025-01-01T00:00:00Z"
      }
    ],
    "page": 1,
    "page_size": 100,
    "total": 1,
    "total_pages": 1
  }
}
```

---

### 获取/删除快照详情

**接口**: `GET /account/snapshot/{snapshot_id}` | `DELETE /account/snapshot/{snapshot_id}`

**描述**: 获取或删除指定账户快照详情。

**路径参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| snapshot_id | string | 是 | 快照ID |

---

### 虚拟账户管理

**接口**: `GET /account/virtual` | `POST /account/virtual` | `PUT /account/virtual/{account_id}` | `DELETE /account/virtual/{account_id}`

**描述**: 虚拟账户的查询、创建、更新和删除操作。

**创建请求示例**:

```json
{
  "name": "测试账户",
  "initial_capital": 100000,
  "description": "用于回测的虚拟账户"
}
```

---

### 获取账户总额序列

**接口**: `GET /account/total-series`

**描述**: 获取账户总资产变化序列，用于绘制资产曲线图。

**响应示例**:

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "series": [
      {"date": "2025-01-01", "total": 100000},
      {"date": "2025-01-02", "total": 102000}
    ]
  }
}
```

---

## 交易记录

### 查询交易历史

**接口**: `GET /trade/history`

**描述**: 查询交易历史记录，支持多条件过滤和分页。

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | integer | 否 | 页码，默认1 |
| page_size | integer | 否 | 每页数量，默认100 |
| start_date | string | 否 | 开始日期，格式YYYY-MM-DD |
| end_date | string | 否 | 结束日期，格式YYYY-MM-DD |
| symbol | string | 否 | 交易标的，如BTC |
| direction | string | 否 | 交易方向，buy/sell |
| status | string | 否 | 订单状态 |

**响应示例**:

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "items": [
      {
        "trade_id": "uuid-xxx",
        "symbol": "BTC",
        "direction": "buy",
        "price": 45000.00,
        "quantity": 1.5,
        "total_amount": 67500.00,
        "commission": 10.00,
        "created_at": "2025-01-01T12:00:00Z"
      }
    ],
    "page": 1,
    "page_size": 100,
    "total": 10,
    "total_pages": 1
  }
}
```

---

### 获取交易详情

**接口**: `GET /trade/history/{trade_id}`

**描述**: 获取单个交易的详细信息。

**路径参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| trade_id | string | 是 | 交易ID |

---

## 决策记录

### 获取决策详情

**接口**: `GET /decision/local-detail/{decision_id}`

**描述**: 获取本地决策的详细信息，包括决策原因和关联K线数据。

**响应示例**:

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "decision_id": "uuid-xxx",
    "symbol": "BTC",
    "decision": "buy",
    "confidence": 0.85,
    "reason": "技术指标显示上升趋势...",
    "kline_data": [...],
    "created_at": "2025-01-01T12:00:00Z"
  }
}
```

---

### 查询本地决策记录

**接口**: `GET /decision/local`

**描述**: 查询本地决策记录列表，支持按是否成交筛选。

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| has_trades | boolean | 否 | 是否有关联交易 |
| is_trade | boolean | 否 | 是否已执行交易 |
| page | integer | 否 | 页码 |
| page_size | integer | 否 | 每页数量 |

---

### 获取K线关联数据

**接口**: `GET /kline/related-data`

**描述**: 获取K线关联数据，用于决策分析展示。

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| symbol | string | 是 | 交易标的 |
| time_granularity | string | 否 | 时间粒度，daily/hourly/minute |
| start_date | string | 否 | 开始日期 |
| end_date | string | 否 | 结束日期 |

---

### 获取回测统计

**接口**: `GET /task/stats`

**描述**: 获取回测统计信息，包括收益率、夏普比率等指标。

**响应示例**:

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "total_return": 0.25,
    "sharpe_ratio": 1.5,
    "max_drawdown": 0.1,
    "win_rate": 0.6,
    "profit_loss_ratio": 2.0,
    "total_trades": 50,
    "profitable_trades": 30,
    "losing_trades": 20
  }
}
```

---

## 任务管理

### 创建任务

**接口**: `POST /task/create`

**描述**: 创建一个新的回测任务。

**请求示例**:

```json
{
  "task_name": "BTC日线回测",
  "symbol": "BTC",
  "time_granularity": "daily",
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "initial_capital": 100000,
  "strategy_config": {
    "prompt_id": "uuid-xxx",
    "ai_config_id": "uuid-xxx"
  }
}
```

**响应示例**:

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "task_id": "uuid-xxx",
    "status": "pending",
    "created_at": "2025-01-01T00:00:00Z"
  }
}
```

---

### 查询任务列表

**接口**: `GET /task/list`

**描述**: 获取任务列表，支持分页查询。

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | integer | 否 | 页码，默认1 |
| page_size | integer | 否 | 每页数量，默认100 |
| status | string | 否 | 任务状态筛选 |

**响应示例**:

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "items": [
      {
        "task_id": "uuid-xxx",
        "task_name": "BTC日线回测",
        "symbol": "BTC",
        "status": "running",
        "progress": 0.75,
        "created_at": "2025-01-01T00:00:00Z",
        "started_at": "2025-01-01T00:01:00Z"
      }
    ],
    "page": 1,
    "page_size": 100,
    "total": 5,
    "total_pages": 1
  }
}
```

---

### 启动任务

**接口**: `POST /task/start`

**描述**: 启动一个处于暂停或就绪状态的任务。

**请求示例**:

```json
{
  "task_id": "uuid-xxx"
}
```

---

### 停止任务

**接口**: `POST /task/stop`

**描述**: 停止正在运行的任务。

**请求示例**:

```json
{
  "task_id": "uuid-xxx"
}
```

---

### 暂停任务

**接口**: `POST /task/pause`

**描述**: 暂停正在运行的任务。

**请求示例**:

```json
{
  "task_id": "uuid-xxx"
}
```

---

### 恢复任务

**接口**: `POST /task/resume`

**描述**: 恢复被暂停的任务。

**请求示例**:

```json
{
  "task_id": "uuid-xxx"
}
```

---

### 删除任务

**接口**: `DELETE /task/delete/{task_id}`

**描述**: 删除指定任务。

**路径参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| task_id | string | 是 | 任务ID |

---

### 任务监控流 (SSE)

**接口**: `GET /task/monitor`

**描述**: 使用Server-Sent Events实时推送任务状态更新。

**响应类型**: `text/event-stream`

**事件类型**:

- `task_update`: 任务状态更新
- `trade_executed`: 交易执行通知
- `decision_made`: 决策生成通知
- `progress`: 任务进度更新
- `completed`: 任务完成通知
- `error`: 错误通知

---

### 任务进度流 (SSE)

**接口**: `GET /task/progress/{task_id}`

**描述**: 使用Server-Sent Events实时推送指定任务的进度。

**路径参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| task_id | string | 是 | 任务ID |

---

## 市场数据

### 获取日线数据

**接口**: `GET /market/btc/daily`

**描述**: 获取指定标的的日线K线数据。

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| symbol | string | 否 | 标的，默认BTC |
| task_id | string | 否 | 回测ID |
| start_date | datetime | 否 | 开始日期 |
| end_date | datetime | 否 | 结束日期 |
| page | integer | 否 | 页码，默认1 |
| page_size | integer | 否 | 每页数量，默认100 |

**响应示例**:

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "items": [
      {
        "date": "2025-01-01",
        "open": 45000.00,
        "high": 45500.00,
        "low": 44800.00,
        "close": 45200.00,
        "volume": 1000000
      }
    ],
    "page": 1,
    "page_size": 100,
    "total": 365,
    "total_pages": 4
  }
}
```

---

### 获取小时线数据

**接口**: `GET /market/btc/hourly`

**描述**: 获取指定标的的小时线K线数据。

**请求参数**: 同日线接口

---

### 获取分钟线数据

**接口**: `GET /market/btc/minute`

**描述**: 获取指定标的的分钟线K线数据。

**请求参数**: 同日线接口

---

### 导入市场数据

**接口**: `POST /market/btc/{time_granularity}/import`

**描述**: 导入CSV格式的市场数据。

**路径参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| time_granularity | string | 是 | 时间粒度，daily/hourly/minute |

**表单参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | File | 是 | CSV文件 |
| symbol | string | 否 | 标的，默认BTC |

**CSV格式要求**:

```csv
date,open,high,low,close,volume
2025-01-01,45000,45500,44800,45200,1000000
```

---

### 清空市场数据

**接口**: `DELETE /market/btc/{time_granularity}`

**描述**: 清空指定时间粒度的市场数据。

**路径参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| time_granularity | string | 是 | 时间粒度，daily/hourly/minute |

**查询参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| symbol | string | 否 | 标的，不提供则清空所有 |

---

### 获取所有标的数据统计

**接口**: `GET /market/symbols-data-count`

**描述**: 获取所有已导入数据的标的统计信息。

**响应示例**:

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "BTC": {
      "daily": {"count": 365, "start_date": "2024-01-01", "end_date": "2024-12-31"},
      "hourly": {"count": 8760, "start_date": "2024-01-01", "end_date": "2024-12-31"},
      "minute": {"count": 525600, "start_date": "2024-01-01", "end_date": "2024-12-31"}
    }
  }
}
```

---

### 获取趋势数据

**接口**: `GET /trend-data/{symbol}`

**描述**: 获取指定标的的趋势数据。

**路径参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| symbol | string | 是 | 标的 |

**查询参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| start_date | string | 否 | 开始日期，格式YYYY-MM-DD |
| end_date | string | 否 | 结束日期，格式YYYY-MM-DD |

**响应示例**:

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "trend_data": [
      {"date": "2025-01-01", "trend": "上升"},
      {"date": "2025-01-02", "trend": "下降"}
    ]
  }
}
```

---

### 获取时区配置

**接口**: `GET /config/timezone`

**描述**: 获取前端显示与市场时区配置。

**响应示例**:

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "display_timezone": "Asia/Shanghai",
    "market_timezone": "UTC"
  }
}
```

---

## 提示词模板

### 查询提示词模板列表

**接口**: `GET /prompt-templates`

**描述**: 获取提示词模板列表，支持关键词搜索和状态筛选。

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | integer | 否 | 页码，默认1 |
| page_size | integer | 否 | 每页数量，默认10 |
| keyword | string | 否 | 关键词搜索 |
| status | string | 否 | 状态筛选 |

**响应示例**:

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "items": [
      {
        "prompt_id": "uuid-xxx",
        "content": "你是一个专业的交易员...",
        "description": "日线趋势判断策略",
        "status": "active",
        "tags": ["趋势", "日线"],
        "created_at": "2025-01-01T00:00:00Z",
        "updated_at": "2025-01-01T00:00:00Z"
      }
    ],
    "page": 1,
    "page_size": 10,
    "total": 5,
    "total_pages": 1
  }
}
```

---

### 创建提示词模板

**接口**: `POST /prompt-templates`

**描述**: 创建新的提示词模板。

**请求示例**:

```json
{
  "content": "你是一个专业的交易员，分析当前K线形态...",
  "description": "K线形态分析策略",
  "tags": ["形态分析", "日线"],
  "status": "active"
}
```

---

### 获取提示词模板详情

**接口**: `GET /prompt-templates/{prompt_id}`

**描述**: 获取单个提示词模板的详细信息。

---

### 更新提示词模板

**接口**: `PUT /prompt-templates/{prompt_id}`

**描述**: 更新提示词模板内容。

**请求示例**:

```json
{
  "content": "更新后的提示词内容...",
  "description": "更新后的描述",
  "tags": ["新标签"],
  "status": "active"
}
```

---

### 删除提示词模板

**接口**: `DELETE /prompt-templates/{prompt_id}`

**描述**: 删除指定提示词模板。

---

## AI配置

### 查询AI配置列表

**接口**: `GET /ai-configs`

**描述**: 获取AI模型配置列表。

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | integer | 否 | 页码，默认1 |
| page_size | integer | 否 | 每页数量，默认10 |
| keyword | string | 否 | 关键词搜索 |

**响应示例**:

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "items": [
      {
        "config_id": "uuid-xxx",
        "name": "本地Ollama配置",
        "local_ai_base_url": "http://localhost:11434",
        "local_ai_api_key": "ollama-key",
        "local_ai_model_name": "llama3",
        "created_at": "2025-01-01T00:00:00Z",
        "updated_at": "2025-01-01T00:00:00Z"
      }
    ],
    "page": 1,
    "page_size": 10,
    "total": 2,
    "total_pages": 1
  }
}
```

---

### 创建AI配置

**接口**: `POST /ai-configs`

**描述**: 创建新的AI模型配置。

**请求示例**:

```json
{
  "name": "OpenAI配置",
  "local_ai_base_url": "https://api.openai.com/v1",
  "local_ai_api_key": "sk-xxx",
  "local_ai_model_name": "gpt-4"
}
```

---

### 获取AI配置详情

**接口**: `GET /ai-configs/{config_id}`

**描述**: 获取单个AI配置的详细信息。

---

### 更新AI配置

**接口**: `PUT /ai-configs/{config_id}`

**描述**: 更新AI配置信息。

**请求示例**:

```json
{
  "name": "更新的配置名称",
  "local_ai_base_url": "http://localhost:11435",
  "local_ai_model_name": "qwen2"
}
```

---

### 删除AI配置

**接口**: `DELETE /ai-configs/{config_id}`

**描述**: 删除指定AI配置。

---

## 数据导入

### 上传CSV文件

**接口**: `POST /api/data-import/upload-csv`

**描述**: 上传CSV文件并解析，返回列名和数据预览。

**表单参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | File | 是 | CSV文件 |

**响应示例**:

```json
{
  "success": true,
  "message": "CSV文件解析成功",
  "columns": ["date", "open", "high", "low", "close", "volume"],
  "preview": [...],
  "total_rows": 1000
}
```

---

### 生成映射建议

**接口**: `POST /api/data-import/suggest-mapping`

**描述**: 根据CSV列名自动生成列映射建议。

**请求示例**:

```json
{
  "csv_columns": ["日期", "开盘", "最高", "最低", "收盘", "成交量"]
}
```

**响应示例**:

```json
{
  "success": true,
  "mapping": {
    "日期": "date",
    "开盘": "open",
    "最高": "high",
    "最低": "low",
    "收盘": "close",
    "成交量": "volume"
  }
}
```

---

### 验证映射关系

**接口**: `POST /api/data-import/validate-mapping`

**描述**: 验证用户自定义的列映射关系是否有效。

**请求示例**:

```json
{
  "csv_columns": ["date", "open", "high", "low", "close", "volume"],
  "mapping": {
    "date": "date",
    "open": "open"
  }
}
```

**响应示例**:

```json
{
  "success": true,
  "valid": true,
  "errors": []
}
```

---

### 执行数据导入

**接口**: `POST /api/data-import/execute-import`

**描述**: 执行CSV数据导入，将数据导入到系统数据库。

**表单参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | File | 是 | CSV文件 |
| time_granularity | string | 是 | 时间粒度 |
| mapping | string | 是 | 映射关系，JSON格式 |
| symbol | string | 否 | 标的，默认BTC |

**响应示例**:

```json
{
  "success": true,
  "message": "数据导入成功",
  "rows_imported": 365
}
```

---

### 预览趋势数据

**接口**: `POST /api/data-import/preview-trend-data`

**描述**: 预览Excel或CSV格式的趋势数据。

**表单参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | File | 是 | Excel或CSV文件 |
| symbol | string | 否 | 标的，默认BTC |

**响应示例**:

```json
{
  "success": true,
  "message": "数据预览生成成功",
  "preview_data": [
    {"id": 1, "date": "2025-01-01", "trend": "上升", "valid": true}
  ],
  "total_records": 365,
  "valid_records": 365,
  "invalid_records": 0
}
```

---

### 导入趋势数据

**接口**: `POST /api/data-import/import-trend-data`

**描述**: 导入趋势数据并转换为CSV格式。

**表单参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | File | 是 | Excel或CSV文件 |
| symbol | string | 否 | 标的，默认BTC |

**响应示例**:

```json
{
  "success": true,
  "message": "趋势数据转换成功",
  "parsed_count": 365,
  "skipped_count": 0,
  "csv_saved": true,
  "csv_path": "data/BTC_trend_data.csv"
}
```

---

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

---

## 分页参数说明

所有列表接口均支持分页，参数说明：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| page | integer | 1 | 当前页码，从1开始 |
| page_size | integer | 10/100 | 每页数量，不同接口默认值不同 |

**计算公式**:

- `total_pages = (total + page_size - 1) // page_size`
- `offset = (page - 1) * page_size`

---

## 数据类型说明

### 时间粒度 (time_granularity)

| 值 | 说明 |
|----|------|
| daily | 日线数据 |
| hourly | 小时线数据 |
| minute | 分钟线数据 |

### 趋势类型

| 值 | 说明 |
|----|------|
| 上升 | 上涨趋势 |
| 下降 | 下跌趋势 |
| 横盘 | 震荡趋势 |
| 震荡 | 震荡趋势 |

### 任务状态

| 值 | 说明 |
|----|------|
| pending | 待执行 |
| running | 运行中 |
| paused | 已暂停 |
| completed | 已完成 |
| failed | 失败 |
| stopped | 已停止 |
