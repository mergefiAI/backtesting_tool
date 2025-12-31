import React from 'react';
import {useQuery} from '@tanstack/react-query';
import {Empty, Space, Spin, Tag, Typography} from 'antd';
import {ArrowRightOutlined} from '@ant-design/icons';
import {fetchTradeDetail} from '../api/endpoints';
import DetailItem from '../components/DetailItem';

const { Text } = Typography;

interface TradeDetailProps {
  id: string;
  onClose: () => void;
}

const TradeDetail: React.FC<TradeDetailProps> = ({ id, onClose }) => {
  const { data, isLoading, isError, error } = useQuery<Record<string, any>, Error, Record<string, any>, [string, string]>({
    queryKey: ['tradeDetail', id],
    queryFn: () => {
      if (!id) throw new Error('交易ID未提供');
      return fetchTradeDetail(id);
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

  const getTradeTypeTag = (type?: string) => {
    const typeMap: Record<string, { color: string; text: string }> = {
      'BUY': { color: 'green', text: '买入' },
      'SELL': { color: 'red', text: '卖出' },
      'SHORT_SELL': { color: 'orange', text: '短卖' },
      'COVER_SHORT': { color: 'orange', text: 'COVER_SHORT' },
    };
    
    const typeInfo = typeMap[type || ''] || { color: 'default', text: type || '-' };
    return <Tag color={typeInfo.color}>{typeInfo.text}</Tag>;
  };

  const getStatusTag = (status?: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      'COMPLETED': { color: 'green', text: '已完成' },
      'PENDING': { color: 'blue', text: '处理中' },
      'FAILED': { color: 'red', text: '失败' },
      'CANCELLED': { color: 'gray', text: '已取消' },
    };
    
    const statusInfo = statusMap[status || ''] || { color: 'default', text: status || '-' };
    return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
  };

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
        <Empty description="无法加载交易详情" />
        <Text type="danger" style={{ display: 'block', marginTop: '10px' }}>
          {error instanceof Error ? error.message : '未知错误'}
        </Text>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: '20px' }}>
        <Empty description="无法加载交易详情" />
      </div>
    );
  }

  return (
    <div style={{ padding: '10px' }}>
      <DetailItem label="交易ID" value={data.trade_id || '-' } />
      <DetailItem label="账户ID" value={data.account_id || '-' } />
      <DetailItem label="标的" value={data.symbol || '-' } />
      <DetailItem label="交易类型" value={getTradeTypeTag(data.trade_type)} />
      <DetailItem label="交易时间" value={formatDate(data.created_at)} />
      <DetailItem label="完成时间" value={formatDate(data.completed_at)} />
      <DetailItem label="状态" value={getStatusTag(data.status)} />
      <DetailItem label="价格" value={data.price || '-' } />
      <DetailItem label="数量" value={data.quantity || '-' } />
      <DetailItem label="成交额" value={data.amount || '-' } />
      <DetailItem label="费用" value={data.total_fees || '-' } />
      
      {data.decision_id && (
        <DetailItem 
          label="关联决策"
          value={
            <Space>
              <span>{data.decision_id}</span>
              <Tag color="blue" icon={<ArrowRightOutlined />}>决策ID</Tag>
            </Space>
          }
        />
      )}
      
      {data.order_id && (
        <DetailItem label="订单ID" value={data.order_id} />
      )}
      
      {data.exchange_order_id && (
        <DetailItem label="交易所订单ID" value={data.exchange_order_id} />
      )}
      
      {data.execution_details && (
        <div style={{ marginTop: '16px' }}>
          <Typography.Title level={5} style={{ marginBottom: '16px' }}>执行详情</Typography.Title>
          <pre style={{ backgroundColor: '#f5f5f5', padding: '12px', borderRadius: '4px', overflowX: 'auto', fontSize: '13px' }}>
            {JSON.stringify(data.execution_details, null, 2)}
          </pre>
        </div>
      )}
      
      {data.error_message && (
        <DetailItem 
          label="错误信息" 
          value={
            <div style={{ color: '#ff4d4f' }}>
              {data.error_message}
            </div>
          }
        />
      )}
      
      {data.metadata && (
        <div style={{ marginTop: '16px' }}>
          <Typography.Title level={5} style={{ marginBottom: '16px' }}>元数据</Typography.Title>
          <pre style={{ backgroundColor: '#f5f5f5', padding: '12px', borderRadius: '4px', overflowX: 'auto', fontSize: '13px' }}>
            {JSON.stringify(data.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default TradeDetail;
