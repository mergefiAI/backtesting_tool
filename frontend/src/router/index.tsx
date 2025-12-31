import React, {Suspense} from 'react'
import {Navigate, Route, Routes} from 'react-router-dom'
import {AreaChartOutlined, FundOutlined, ProfileOutlined, SettingOutlined, UploadOutlined,} from '@ant-design/icons'

const LocalDecisionList = React.lazy(() => import('../pages/LocalDecisionList'))
const DecisionRelatedData = React.lazy(() => import('../pages/DecisionRelatedData'))
const TradeHistory = React.lazy(() => import('../pages/TradeHistory'))
const AccountOverview = React.lazy(() => import('../pages/AccountOverview'))
const SnapshotList = React.lazy(() => import('../pages/SnapshotList'))

const KlineEcharts = React.lazy(() => import('../pages/KlineEcharts'))
const PromptTemplateList = React.lazy(() => import('../pages/PromptTemplateList'))
const MarketDataManager = React.lazy(() => import('../pages/MarketDataManager'))
const TaskManager = React.lazy(() => import('../pages/TaskManager'))
const NotFound = React.lazy(() => import('../pages/NotFound'))
const AdminLayout = React.lazy(() => import('../layout/AdminLayout'))
const CSVImport = React.lazy(() => import('../pages/CSVImport'))
const AIConfigList = React.lazy(() => import('../pages/AIConfigList'))
const TrendImport = React.lazy(() => import('../pages/TrendImport'))

/**
 * 路由注册组件：定义各功能页面路由
 */
export const routeConfig = [
  { path: '/prompt-templates', title: '创建策略', meta: { title: '创建策略' }, icon: <ProfileOutlined /> },
  { path: '/dashboard/kline', title: '回测列表', meta: { title: '回测列表' }, icon: <AreaChartOutlined /> },
  { path: '/tasks', title: '策略回测', meta: { title: '策略回测' }, icon: <ProfileOutlined /> },
  { path: '/market', title: '数据仓库', meta: { title: '数据仓库' }, icon: <AreaChartOutlined />, children: [
    { path: '/data-import', title: '数据导入', meta: { title: '数据导入' }, icon: <UploadOutlined /> },
    { path: '/trend-import', title: '趋势导入', meta: { title: '趋势导入' }, icon: <UploadOutlined /> },
    { path: '/market/data-manager', title: '市场数据管理', meta: { title: '市场数据管理' }, icon: <AreaChartOutlined /> },
  ]},
  { path: '/ai-configs', title: 'AI配置', meta: { title: 'AI配置' }, icon: <SettingOutlined /> },
  { path: '/dashboard', title: '其他', meta: { title: '其他' }, icon: <ProfileOutlined />, children: [
    { path: '/accounts/list', title: '账户列表', meta: { title: '账户列表' } },
    { path: '/snapshots', title: '快照列表', meta: { title: '快照列表' }, icon: <ProfileOutlined /> },
    { path: '/local-decision/list', title: '本地决策', meta: { title: '本地决策' }, icon: <FundOutlined /> },
    { path: '/decision/related-data', title: '决策关联数据', meta: { title: '决策关联数据' }, icon: <FundOutlined /> },
    { path: '/trades', title: '交易列表', meta: { title: '交易列表' }, icon: <FundOutlined /> },
  ]},
]

/**
 * AppRouter：嵌套路由承载 AdminLayout
 */
export function AppRouter() {
  return (
    <Routes>
      {/* 主系统路由：嵌套在AdminLayout中 */}
      <Route path="/" element={<Suspense fallback={<div style={{ padding: 24 }}>加载中...</div>}><AdminLayout /></Suspense>}>
        <Route index element={<Navigate to="/prompt-templates" replace />} />
        <Route path="/dashboard" element={<Navigate to="/dashboard/kline" replace />} />
        <Route path="/dashboard/kline" element={<Suspense fallback={<div style={{ padding: 24 }}>加载中...</div>}><KlineEcharts /></Suspense>} />

        <Route path="/local-decision/list" element={<Suspense fallback={<div style={{ padding: 24 }}>加载中...</div>}><LocalDecisionList /></Suspense>} />
        <Route path="/decision/related-data" element={<Suspense fallback={<div style={{ padding: 24 }}>加载中...</div>}><DecisionRelatedData /></Suspense>} />
        <Route path="/trades" element={<Suspense fallback={<div style={{ padding: 24 }}>加载中...</div>}><TradeHistory /></Suspense>} />
        <Route path="/accounts/list" element={<Suspense fallback={<div style={{ padding: 24 }}>加载中...</div>}><AccountOverview /></Suspense>} />
        <Route path="/snapshots" element={<Suspense fallback={<div style={{ padding: 24 }}>加载中...</div>}><SnapshotList /></Suspense>} />
        <Route path="/prompt-templates" element={<Suspense fallback={<div style={{ padding: 24 }}>加载中...</div>}><PromptTemplateList /></Suspense>} />
        <Route path="/market/data-manager" element={<Suspense fallback={<div style={{ padding: 24 }}>加载中...</div>}><MarketDataManager /></Suspense>} />
        <Route path="/tasks" element={<Suspense fallback={<div style={{ padding: 24 }}>加载中...</div>}><TaskManager /></Suspense>} />
        <Route path="/data-import" element={<Suspense fallback={<div style={{ padding: 24 }}>加载中...</div>}><CSVImport /></Suspense>} />
        <Route path="/trend-import" element={<Suspense fallback={<div style={{ padding: 24 }}>加载中...</div>}><TrendImport /></Suspense>} />
        <Route path="/ai-configs" element={<Suspense fallback={<div style={{ padding: 24 }}>加载中...</div>}><AIConfigList /></Suspense>} />
        <Route path="*" element={<Suspense fallback={<div style={{ padding: 24 }}>加载中...</div>}><NotFound /></Suspense>} />
      </Route>
    </Routes>
  )
}