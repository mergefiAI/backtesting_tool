import React, {lazy, Suspense} from 'react';
import {Drawer, Empty, Spin} from 'antd';
import type {DetailType} from './DrawerContext';

// 使用懒加载导入各详情内容组件
const LocalDecisionDetail = lazy(() => import('@/pages/LocalDecisionDetail'));
const TradeDetailContent = lazy(() => import('@/pages/TradeDetail'));
const TradeHistoryByDecision = lazy(() => import('@/components/TradeHistoryByDecision'));
const AccountDetailContent = lazy(() => import('@/pages/AccountDetail'));
const SnapshotDetailContent = lazy(() => import('@/pages/SnapshotDetail'));
const PromptTemplateDetailContent = lazy(() => import('@/pages/PromptTemplateDetail'));
const TaskCreateContent = lazy(() => import('./TaskCreateContent'));
const KlineRelatedDetailContent = lazy(() => import('@/pages/KlineRelatedDetail'));

// 详情类型对应的标题映射
const detailTypeTitles: Record<DetailType, string> = {
  'local-decision': '本地决策详情',
  'trade': '交易详情',
  'account': '账户详情',
  'snapshot': '账户快照详情',
  'prompt-template': '策略详情',
  'task-create': '创建策略回测',
  'kline-related': 'K线关联数据详情',
};

// 详情抽屉组件Props
interface DetailDrawerProps {
  visible: boolean;
  type: DetailType | null;
  id: string | null;
  data?: any;
  onClose: () => void;
}

/**
 * 共享的详情抽屉容器组件
 * 用于展示各类数据的详情信息
 */
const DetailDrawer: React.FC<DetailDrawerProps> = ({ visible, type, id, data, onClose }) => {
  // 根据类型渲染对应的详情内容组件
  const renderContent = () => {
    // 特殊处理：task-create类型不需要id
    if (type === 'task-create') {
      return <TaskCreateContent onClose={onClose} onSuccess={data?.onSuccess || onClose} />;
    }

    if (!type || !id) {
      return <Empty description="暂无详情数据" />;
    }

    const commonProps = {
      id,
      onClose,
    };

    switch (type) {
      case 'local-decision':
        return <LocalDecisionDetail {...commonProps} />;
      case 'trade':
        // 特殊处理：trade类型实际上是显示决策相关的交易历史，而不是单个交易详情
        return <TradeHistoryByDecision {...commonProps} decisionId={id} />;
      case 'account':
        return <AccountDetailContent {...commonProps} />;
      case 'snapshot':
        return <SnapshotDetailContent {...commonProps} />;
      case 'prompt-template':
        return <PromptTemplateDetailContent {...commonProps} />;
      case 'kline-related':
        return <KlineRelatedDetailContent {...commonProps} data={data} />;
      default:
        return <Empty description="未知详情类型" />;
    }
  };

  return (
    <Drawer
      title={type ? detailTypeTitles[type] : ''}
      placement="right"
      onClose={onClose}
      open={visible}
      width={680}
      size="large"
      destroyOnHidden
      getContainer="body"
      className="detail-drawer"
    >
      <Suspense
        fallback={
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <Spin>
          <div style={{ marginTop: 8 }}>加载详情中...</div>
        </Spin>
      </div>
        }
      >
        {renderContent()}
      </Suspense>
    </Drawer>
  );
};

export default DetailDrawer;

