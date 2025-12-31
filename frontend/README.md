# 前端开发指南

## 1. 项目概述

基于React 18和Ant Design 5构建的AI交易策略系统前端应用，提供交易创建策略、账户监控、交易历史查看等功能。

### 1.1 核心功能

- 🔍 **虚拟账户管理**: 查看和管理虚拟交易账户
- 📊 **账户监控**: 实时监控账户资产变化
- 📈 **交易历史**: 查看完整的交易记录
- ⚡ **策略执行**: 手动触发策略执行
- 📋 **账户快照**: 查看账户历史快照
- 🤖 **AI决策**: 查看本地AI决策记录
- ⚙️ **AI配置**: 管理本地AI模型配置
- 📝 **创建策略**: 管理AI决策使用的策略
- 📥 **数据导入**: 导入市场数据和趋势数据
- 📊 **K线图表**: 查看BTC等加密货币的K线图表（支持多时间粒度）

## 2. 技术栈

- **框架**: React 18
- **UI组件库**: Ant Design 5
- **开发语言**: TypeScript
- **构建工具**: Vite
- **路由**: React Router DOM
- **HTTP客户端**: Axios
- **图表库**: ECharts

## 3. 项目结构

```
frontend/
├── src/
│   ├── api/              # API客户端和端点定义
│   │   ├── client.ts         # Axios客户端配置
│   │   ├── endpoints.ts      # API端点定义
│   │   ├── localDecisionTest.ts # 本地决策测试API
│   │   └── promptTemplates.ts # 策略API
│   ├── components/       # 通用组件
│   │   ├── DetailDrawer/     # 详情抽屉组件
│   │   │   ├── DetailDrawer.tsx
│   │   │   ├── DrawerContext.tsx
│   │   │   ├── TaskCreateContent.tsx
│   │   │   └── index.tsx
│   │   ├── AccountDetail.tsx       # 账户详情组件
│   │   ├── Breadcrumbs.tsx         # 面包屑组件
│   │   ├── DataTable.tsx           # 数据表格组件
│   │   ├── DetailContainer.tsx     # 详情容器组件
│   │   ├── DetailItem.tsx          # 详情项组件
│   │   ├── SearchForm.tsx          # 搜索表单组件
│   │   ├── SidebarMenu.tsx         # 侧边栏菜单组件
│   │   └── TradeHistoryByDecision.tsx # 按决策查询交易历史组件
│   ├── layout/           # 页面布局组件
│   │   └── AdminLayout.tsx  # 管理后台布局
│   ├── pages/            # 页面组件
│   │   ├── AccountOverview.tsx        # 账户列表页
│   │   ├── AIConfigList.tsx           # AI配置列表页
│   │   ├── CSVImport.tsx              # CSV数据导入页
│   │   ├── DecisionRelatedData.tsx    # 决策关联数据页
│   │   ├── KlineEcharts.tsx           # K线图表页
│   │   ├── KlineRelatedDetail.tsx     # K线相关详情页
│   │   ├── LocalDecisionDetail.tsx    # 本地决策详情页
│   │   ├── LocalDecisionList.tsx      # 本地决策列表页
│   │   ├── MarketDataManager.tsx      # 市场数据管理页
│   │   ├── NotFound.tsx               # 404页
│   │   ├── PromptTemplateDetail.tsx   # 策略详情页
│   │   ├── PromptTemplateList.tsx     # 策略列表页
│   │   ├── SnapshotDetail.tsx         # 快照详情页
│   │   ├── SnapshotList.tsx           # 快照列表页
│   │   ├── TaskManager.tsx            # 策略回测管理页
│   │   ├── TradeDetail.tsx            # 交易详情页
│   │   ├── TradeHistory.tsx           # 交易历史页
│   │   └── TrendImport.tsx            # 趋势数据导入页
│   ├── router/           # 路由配置
│   │   └── index.tsx     # 路由定义
│   ├── styles/           # 全局样式
│   │   └── layout.css    # 布局样式
│   ├── types/            # TypeScript类型定义
│   │   └── api.ts        # API相关类型定义
│   ├── utils/            # 工具函数
│   │   └── timezone.ts   # 时区处理工具
│   ├── App.tsx           # 应用入口组件
│   ├── main.tsx          # 应用入口文件
│   └── vite-env.d.ts     # Vite环境类型定义
├── index.html            # HTML模板
├── package.json          # 项目配置和依赖
├── pnpm-lock.yaml        # pnpm依赖锁文件
├── tsconfig.json         # TypeScript配置
├── vite.config.ts        # Vite配置
└── README.md             # 前端开发指南
```

## 4. 开发环境搭建

### 4.1 环境要求

- Node.js 18+
- pnpm 8+

### 4.2 安装依赖

```bash
# 进入frontend目录
cd frontend

# 安装依赖
pnpm install
```

### 4.3 启动开发服务器

```bash
# 启动开发服务器
pnpm dev
```

开发服务器将在 http://localhost:5173 启动。

## 5. 主要页面功能

### 5.1 创建策略页 (PromptTemplateList)

- 管理AI决策使用的策略
- 创建、编辑、删除策略
- 支持按状态、关键词搜索

### 5.2 回测列表页 (KlineEcharts)

- 查看BTC等加密货币的K线图表
- 支持多种时间周期
- 显示技术指标
- 查看回测曲线和策略历史

### 5.3 策略回测管理页 (TaskManager)

- 创建和管理回测任务
- 支持关联AI配置和策略
- 实时监控回测进度（SSE实时推送）
- 支持任务的启动、暂停、恢复和停止
- 查看任务统计数据和错误信息

### 5.4 数据导入页 (CSVImport)

- 支持CSV格式市场数据导入
- 预览上传的CSV文件内容
- 自动验证数据格式
- 执行数据导入到数据库

### 5.5 趋势导入页 (TrendImport)

- 支持趋势数据导入与预览
- 自动验证数据格式
- 执行趋势数据导入

### 5.6 市场数据管理页 (MarketDataManager)

- 查看和管理市场K线数据
- 按时间范围查询数据
- 查看数据统计信息

### 5.7 AI配置页 (AIConfigList)

- 管理本地AI模型配置
- 创建、编辑、删除AI配置
- 配置AI服务URL、API密钥和模型名称

### 5.8 账户列表页 (AccountOverview)

- 显示所有虚拟账户列表
- 实时监控账户资产变化
- 查看账户详情（抽屉形式）
- 支持按标的筛选

### 5.9 快照列表页 (SnapshotList)

- 显示账户历史快照
- 支持按账户、时间范围查询
- 查看账户在特定时间点的状态

### 5.10 本地决策列表页 (LocalDecisionList)

- 显示本地AI决策记录
- 查看决策详情，包括决策结果、置信度、理由等
- 支持按账户、时间过滤
- 查看决策对应的市场数据

### 5.11 决策关联数据页 (DecisionRelatedData)

- 查看决策关联的市场数据和交易记录
- 分析决策与交易的关系

### 5.12 交易历史页 (TradeHistory)

- 显示所有交易记录
- 支持按账户、时间、交易类型过滤
- 查看交易详情（抽屉形式）

## 6. API对接

### 6.1 API客户端配置

API客户端使用Axios配置，支持请求拦截、响应拦截和错误处理：

```typescript
// api/client.ts
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    // 可以在这里添加认证信息
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
apiClient.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    // 统一错误处理
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export default apiClient;
```

### 6.2 API端点定义

所有API端点集中定义在`src/api/endpoints.ts`中，包括：

- 账户相关API
- 交易相关API
- 决策相关API
- 任务相关API
- 市场数据相关API
- 策略相关API
- 系统管理API

### 6.3 在组件中使用API

```typescript
// 示例：在组件中使用API获取账户列表
import { useEffect, useState } from 'react';
import { accountApi } from '../api/endpoints';
import { VirtualAccount } from '../types/api';

const AccountList = () => {
  const [accounts, setAccounts] = useState<VirtualAccount[]>([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    const fetchAccounts = async () => {
      setLoading(true);
      try {
        const data = await accountApi.getVirtualAccounts();
        setAccounts(data);
      } catch (error) {
        console.error('Failed to fetch accounts:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAccounts();
  }, []);
  
  return (
    // 渲染账户列表
  );
};

export default AccountList;
```

## 7. 组件开发

### 7.1 组件分类

- **页面组件**: 放在`src/pages/`目录下，对应路由页面
- **通用组件**: 放在`src/components/`目录下，可复用的组件
- **布局组件**: 放在`src/layout/`目录下，页面布局相关组件

### 7.2 组件开发规范

- 使用TypeScript编写组件
- 组件命名采用PascalCase
- 文件命名与组件名保持一致
- 组件应该是可复用的，尽量减少耦合
- 使用Ant Design组件库提供的组件，保持UI一致性
- 组件应该有清晰的Props类型定义
- 使用React Hooks管理组件状态和生命周期

### 7.3 示例组件

```typescript
// components/SidebarMenu.tsx
import { Menu } from 'antd';
import { Link, useLocation } from 'react-router-dom';

const SidebarMenu = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  const menuItems = [
    {
      key: '/account-overview',
      label: <Link to="/account-overview">账户概览</Link>,
      icon: <UserOutlined />,
    },
    {
      key: '/trade-history',
      label: <Link to="/trade-history">交易历史</Link>,
      icon: <TransactionOutlined />,
    },
    // 更多菜单项...
  ];

  return (
    <Menu
      mode="inline"
      selectedKeys={[currentPath]}
      items={menuItems}
      style={{ height: '100%', borderRight: 0 }}
    />
  );
};

export default SidebarMenu;
```

## 8. 路由配置

### 8.1 路由定义

路由配置在`src/router/index.tsx`中，使用React Router DOM定义：

```typescript
// router/index.tsx
import React, { Suspense, lazy } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';

const AdminLayout = lazy(() => import('../layout/AdminLayout'));
const KlineEcharts = lazy(() => import('../pages/KlineEcharts'));
const LocalDecisionList = lazy(() => import('../pages/LocalDecisionList'));
const DecisionRelatedData = lazy(() => import('../pages/DecisionRelatedData'));
const TradeHistory = lazy(() => import('../pages/TradeHistory'));
const AccountOverview = lazy(() => import('../pages/AccountOverview'));
const SnapshotList = lazy(() => import('../pages/SnapshotList'));
const PromptTemplateList = lazy(() => import('../pages/PromptTemplateList'));
const MarketDataManager = lazy(() => import('../pages/MarketDataManager'));
const TaskManager = lazy(() => import('../pages/TaskManager'));
const NotFound = lazy(() => import('../pages/NotFound'));
const CSVImport = lazy(() => import('../pages/CSVImport'));
const AIConfigList = lazy(() => import('../pages/AIConfigList'));
const TrendImport = lazy(() => import('../pages/TrendImport'));

export function AppRouter() {
  return (
    <Suspense fallback={<div>加载中...</div>}>
      <Routes>
        <Route path="/" element={<AdminLayout />}>
          <Route index element={<Navigate to="/prompt-templates" replace />} />
          <Route path="/dashboard" element={<Navigate to="/dashboard/kline" replace />} />
          <Route path="dashboard/kline" element={<KlineEcharts />} />
          <Route path="local-decision/list" element={<LocalDecisionList />} />
          <Route path="decision/related-data" element={<DecisionRelatedData />} />
          <Route path="trades" element={<TradeHistory />} />
          <Route path="accounts/list" element={<AccountOverview />} />
          <Route path="snapshots" element={<SnapshotList />} />
          <Route path="prompt-templates" element={<PromptTemplateList />} />
          <Route path="market/data-manager" element={<MarketDataManager />} />
          <Route path="tasks" element={<TaskManager />} />
          <Route path="data-import" element={<CSVImport />} />
          <Route path="trend-import" element={<TrendImport />} />
          <Route path="ai-configs" element={<AIConfigList />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
```

### 8.2 在应用中使用

```typescript
// main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './router';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  </React.StrictMode>
);
```

## 9. 开发流程

### 9.1 代码规范

- 使用TypeScript编写所有代码
- 遵循ESLint和Prettier配置
- 组件命名采用PascalCase
- 文件命名采用PascalCase，与组件名保持一致
- 使用4个空格缩进
- 行长度不超过120个字符

### 9.2 提交规范

- 提交信息格式：`type(scope): description`
- 类型包括：feat, fix, docs, style, refactor, test, chore
- 示例：`feat(account): add account overview page`

### 9.3 开发流程

1. 从main分支创建特性分支
2. 开发功能，编写代码
3. 运行TypeScript检查：`pnpm tsc`
4. 运行构建：`pnpm build`
5. 提交代码，创建PR
6. 代码 review 通过后合并到main分支

## 10. 构建和部署

### 10.1 构建生产版本

```bash
# 构建生产版本
pnpm build
```

构建结果将输出到`dist/`目录。

### 10.2 预览构建结果

```bash
# 预览构建结果
pnpm preview
```

### 10.3 部署

1. 构建生产版本：`pnpm build`
2. 将`dist/`目录下的文件部署到Web服务器
3. 配置Nginx或其他Web服务器
4. 设置正确的API_BASE_URL环境变量

#### 10.3.1 Nginx配置示例

```nginx
server {
    listen 80;
    server_name example.com;
    root /path/to/dist;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 11. 常用命令

| 命令 | 描述 |
|------|------|
| `pnpm dev` | 启动开发服务器 |
| `pnpm build` | 构建生产版本 |
| `pnpm preview` | 预览构建结果 |
| `pnpm tsc` | 运行TypeScript类型检查 |
| `pnpm lint` | 运行ESLint检查 |
| `pnpm format` | 运行Prettier格式化代码 |

## 12. 开发注意事项

1. **环境变量**: 使用Vite的环境变量机制，配置文件为`.env.*`
2. **样式**: 优先使用Ant Design的样式系统，避免直接操作DOM
3. **性能**: 注意组件的性能优化，避免不必要的重渲染
4. **错误处理**: 实现全局错误处理机制，提供友好的错误提示
5. **可访问性**: 遵循WCAG标准，确保应用的可访问性
6. **响应式设计**: 确保应用在不同设备上都能正常显示

## 13. 相关文档

- [React 18 文档](https://react.dev/)
- [Ant Design 5 文档](https://ant.design/)
- [TypeScript 文档](https://www.typescriptlang.org/)
- [Vite 文档](https://vitejs.dev/)
- [React Router DOM 文档](https://reactrouter.com/)
- [Axios 文档](https://axios-http.com/)
- [ECharts 文档](https://echarts.apache.org/zh/index.html)