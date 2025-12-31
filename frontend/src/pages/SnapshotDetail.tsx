import React from 'react';
import {useQuery} from '@tanstack/react-query';
import {Empty, Space, Spin, Tag, Typography} from 'antd';
import {ArrowRightOutlined} from '@ant-design/icons';
import {fetchSnapshotDetail} from '../api/endpoints';
import DetailItem from '../components/DetailItem';

interface SnapshotDetailProps {
  id: string;
  onClose: () => void;
}

const SnapshotDetail: React.FC<SnapshotDetailProps> = ({ id, onClose }) => {
  const { data, isLoading, isError, error } = useQuery<Record<string, any>, Error, Record<string, any>, [string, string]>({
    queryKey: ['snapshotDetail', id],
    queryFn: () => {
      if (!id) throw new Error('快照ID未提供');
      return fetchSnapshotDetail(id);
    },
    enabled: !!id,
  });

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // 持仓数据表格列定义
  const positionColumns = [
    {
      title: '标的',
      dataIndex: 'symbol',
      key: 'symbol',
      render: (symbol: string, record: any) => (
        <Space>
          <span>{symbol}</span>
          {record.name && <Tag color="blue">{record.name}</Tag>}
        </Space>
      ),
    },
    {
      title: '持仓数量',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (quantity: number) => quantity || 0,
    },
    {
      title: '持仓均价',
      dataIndex: 'avg_price',
      key: 'avg_price',
      render: (price: number) => price || 0,
    },
    {
      title: '当前价格',
      dataIndex: 'current_price',
      key: 'current_price',
      render: (price: number) => price || 0,
    },
    {
      title: '持仓市值',
      dataIndex: 'market_value',
      key: 'market_value',
      render: (value: number) => value || 0,
    },
    {
      title: '盈亏',
      dataIndex: 'profit',
      key: 'profit',
      render: (profit: number) => (
        <span style={{ color: (profit || 0) >= 0 ? '#52c41a' : '#ff4d4f' }}>
          {profit || 0}
        </span>
      ),
    },
    {
      title: '收益率',
      dataIndex: 'profit_rate',
      key: 'profit_rate',
      render: (rate: number) => (
        <span style={{ color: (rate || 0) >= 0 ? '#52c41a' : '#ff4d4f' }}>
          {(rate || 0) * 100}%
        </span>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <Spin>
          <div style={{ marginTop: 8 }}>加载中...</div>
        </Spin>
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ padding: '20px' }}>
        <Empty description="无法加载快照详情" />
        <Typography.Text type="danger" style={{ display: 'block', marginTop: '10px' }}>
          {error instanceof Error ? error.message : '未知错误'}
        </Typography.Text>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: '20px' }}>
        <Empty description="无法加载快照详情" />
      </div>
    );
  }

  return (
    <div style={{ padding: '10px' }}>
      <DetailItem label="快照ID" value={data.snapshot_id || '-'} />
      <DetailItem 
        label="账户信息"
        value={
          <Tag color="blue" icon={<ArrowRightOutlined />}>账户ID: {data.account_id}</Tag>
        }
      />
      <DetailItem label="回测ID" value={data.task_id || '-'} />
      <DetailItem label="快照时间" value={formatDate(data.timestamp)} />
      <DetailItem label="市场类型" value={data.market_type || '-'} />
      <DetailItem label="标的" value={data.stock_symbol || '-'} />
      <DetailItem label="初始余额" value={data.initial_balance || 0} />
      <DetailItem label="当前余额" value={data.balance || 0} />
      <DetailItem label="可用余额" value={data.available_balance || 0} />
      <DetailItem label="持仓方向" value={data.position_side || '-'} />
      <DetailItem label="持仓数值" value={data.stock_quantity || 0} />
      <DetailItem label="价格" value={data.stock_price || 0} />
      <DetailItem label="持仓市值" value={data.stock_market_value || 0} />
      <DetailItem label="累计费用" value={data.total_fees || 0} />
      <DetailItem label="总资产" value={data.total_value || 0} />
      <DetailItem label="保证金占用" value={data.margin_used || 0} />
      <DetailItem label="空头持仓均价" value={data.short_avg_price || 0} />
      <DetailItem label="空头持仓总成本" value={data.short_total_cost || 0} />
      <DetailItem label="盈亏" value={
        <span style={{ color: (data.profit_loss || 0) >= 0 ? '#52c41a' : '#ff4d4f' }}>
          {data.profit_loss || 0}
        </span>
      } />
      <DetailItem label="收益率" value={
        <span style={{ color: (data.profit_loss_percent || 0) >= 0 ? '#52c41a' : '#ff4d4f' }}>
          {(data.profit_loss_percent || 0)}%
        </span>
      } />
    </div>
  );
};

export default SnapshotDetail;
