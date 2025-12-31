import React from 'react';
import {useQuery} from '@tanstack/react-query';
import {Alert, Button, Card, Descriptions, Space, Spin, Tag, Typography} from 'antd';
import {EyeOutlined} from '@ant-design/icons';
import {fetchAccountDetail} from '../api/endpoints';

const { Text } = Typography;

interface AccountDetailProps {
  accountId: string;
  onClose: () => void;
}

export const AccountDetail: React.FC<AccountDetailProps> = ({ accountId, onClose }) => {
  const { data, isLoading, isError, error, refetch } = useQuery<Record<string, any>, Error, Record<string, any>, [string, string]>({
    queryKey: ['accountDetail', accountId],
    queryFn: () => {
      if (!accountId) throw new Error('账户ID未提供');
      return fetchAccountDetail(accountId);
    },
    enabled: !!accountId,
  });

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
  };

  const getMarketTypeText = (marketType?: string) => {
    switch (marketType) {
      case 'US':
        return '美股';
      case 'COIN':
        return '加密货币';
      default:
        return marketType || '-';
    }
  };

  const getMarketTypeColor = (marketType?: string) => {
    switch (marketType) {
      case 'US':
        return 'blue';
      case 'COIN':
        return 'orange';
      default:
        return 'default';
    }
  };

  if (isLoading) {
    return (
      <div style={{ 
        padding: '32px', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '500px' 
      }}>
        <Spin size="large">
          <div style={{ marginTop: 8 }}>正在加载账户详情...</div>
        </Spin>
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ padding: '32px' }}>
        <Alert
          message="加载失败"
          description={`无法加载账户详情: ${(error as Error).message}`}
          type="error"
          showIcon
          action={
            <Button size="small" onClick={() => refetch()}>
              重试
            </Button>
          }
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: '32px' }}>
        <Alert
          message="未找到数据"
          description="账户不存在或已被删除"
          type="warning"
          showIcon
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>账户详情 - {data.account_id || '-'}</h2>
        <Space>
          <Button icon={<EyeOutlined />} onClick={onClose}>
            关闭
          </Button>
        </Space>
      </div>

      <Card>
        <Descriptions bordered column={2} size="middle">
          <Descriptions.Item label="账户ID">
            <Text copyable>{data.account_id || '-'}</Text>
          </Descriptions.Item>

          <Descriptions.Item label="市场类型">
            <Tag color={getMarketTypeColor(data.market_type)}>{getMarketTypeText(data.market_type)}</Tag>
          </Descriptions.Item>

          <Descriptions.Item label="股票代码">
            {data.stock_symbol || '-'}
          </Descriptions.Item>

          <Descriptions.Item label="创建时间">
            {formatDate(data.created_at)}
          </Descriptions.Item>

          <Descriptions.Item label="更新时间">
            {formatDate(data.updated_at)}
          </Descriptions.Item>

          <Descriptions.Item label="初始余额">
            <Text strong>{Number(data.initial_balance || 0).toFixed(8)}</Text>
          </Descriptions.Item>

          <Descriptions.Item label="当前余额">
            <Text type="success">{Number(data.current_balance || 0).toFixed(8)}</Text>
          </Descriptions.Item>

          <Descriptions.Item label="当前股价">
            <Text>{Number(data.stock_price || 0).toFixed(8)}</Text>
          </Descriptions.Item>

          <Descriptions.Item label="持仓数量">
            <Text type="warning">{Number(data.stock_quantity || 0).toFixed(8)}</Text>
          </Descriptions.Item>

          <Descriptions.Item label="持股价值">
            <Text style={{ color: '#1677ff' }}>{Number(data.stock_market_value || 0).toFixed(8)}</Text>
          </Descriptions.Item>

          <Descriptions.Item label="总价值">
            <Text type="success" strong>{Number(data.total_value || 0).toFixed(8)}</Text>
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
};

export default AccountDetail;