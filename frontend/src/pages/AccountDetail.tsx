import React from 'react';
import {useQuery} from '@tanstack/react-query';
import {Button, Tag, Typography} from 'antd';
import {ArrowLeftOutlined} from '@ant-design/icons';
import {fetchAccountDetail, fetchSnapshots} from '../api/endpoints';
import type {Paginated} from '../types/api';
import DetailItem from '../components/DetailItem';

const { Text, Title } = Typography;

interface AccountDetailProps {
  id: string;
  onClose: () => void;
}

const AccountDetail: React.FC<AccountDetailProps> = ({ id, onClose }) => {
  const { data: accountData, isLoading: isAccountLoading, isError: isAccountError, error: accountError } = useQuery<Record<string, any> | null, Error, Record<string, any> | null, [string, string]>({
    queryKey: ['accountDetail', id],
    queryFn: () => {
      if (!id) throw new Error('账户ID未提供');
      return fetchAccountDetail(id);
    },
    enabled: !!id,
  });

  const { data: snapshotList } = useQuery<Paginated<any> | null, Error, Paginated<any> | null, [string, string]>({
    queryKey: ['latestAccountSnapshot', id],
    queryFn: () => {
      if (!id) throw new Error('账户ID未提供');
      return fetchSnapshots({ account_id: id, page: 1, page_size: 1, sort_order: 'desc' });
    },
    enabled: !!id,
  });
  const snapshotData = snapshotList?.items?.[0] || null;

  if (isAccountLoading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <Text type="secondary">加载中...</Text>
      </div>
    );
  }

  if (isAccountError || !accountData) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <Text type="danger">
          {accountError instanceof Error ? accountError.message : '无法加载账户详情'}
        </Text>
      </div>
    );
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatNumber = (value: any) => {
    if (value === null || value === undefined) return '-';
    const num = Number(value);
    if (isNaN(num)) return value;
    if (Math.abs(num) < 0.00000001) return '0';
    return num.toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8
    });
  };

  const getMarketTypeTag = (type?: string) => {
    const typeMap: Record<string, { color: string; text: string }> = {
      'COIN': { color: 'gold', text: '加密货币' },
      'STOCK': { color: 'blue', text: '美股' },
    };
    
    const typeInfo = typeMap[type || ''] || { color: 'default', text: type || '-' };
    return <Tag color={typeInfo.color}>{typeInfo.text}</Tag>;
  };

  const getPositionSideTag = (side?: string) => {
    const sideMap: Record<string, { color: string; text: string }> = {
      'LONG': { color: 'green', text: '多' },
      'SHORT': { color: 'red', text: '空' },
      'BOTH': { color: 'blue', text: '双向' },
    };
    
    const sideInfo = sideMap[side || ''] || { color: 'default', text: side || '-' };
    return <Tag color={sideInfo.color}>{sideInfo.text}</Tag>;
  };

  const profitLoss = snapshotData?.profit_loss !== undefined ? Number(snapshotData.profit_loss) : null;
  const profitLossPercent = snapshotData?.profit_loss_percent !== undefined ? Number(snapshotData.profit_loss_percent) : null;

  return (
    <div style={{ padding: '10px' }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Title level={5} style={{ margin: 0 }}>账户详情</Title>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={onClose}>关闭</Button>
      </div>
      
      <DetailItem label="账户ID" value={accountData.account_id || '-'} />
      <DetailItem label="市场类型" value={getMarketTypeTag(accountData.market_type)} />
      <DetailItem label="标的" value={accountData.stock_symbol || '-'} />
      <DetailItem label="持仓方向" value={getPositionSideTag(accountData.position_side)} />
      <DetailItem label="创建时间" value={formatDate(accountData.created_at)} />
      <DetailItem label="更新时间" value={formatDate(accountData.updated_at)} />
      <DetailItem label="初始资金" value={formatNumber(accountData.initial_balance)} />
      <DetailItem label="当前余额" value={formatNumber(accountData.current_balance)} />
      <DetailItem label="可用余额" value={formatNumber(accountData.available_balance)} />
      <DetailItem label="持仓数量" value={formatNumber(accountData.stock_quantity)} />
      <DetailItem label="持仓价格" value={formatNumber(accountData.stock_price)} />
      <DetailItem label="持仓市值" value={formatNumber(accountData.stock_market_value)} />
      <DetailItem label="总价值" value={formatNumber(accountData.total_value)} />
      <DetailItem label="保证金占用" value={formatNumber(accountData.margin_used)} />
      <DetailItem label="总手续费" value={formatNumber(accountData.total_fees)} />
      {profitLoss !== null && (
        <DetailItem 
          label="盈亏" 
          value={
            <Text style={{ color: profitLoss >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 'bold' }}>
              {formatNumber(profitLoss)}
            </Text>
          } 
        />
      )}
      {profitLossPercent !== null && (
        <DetailItem 
          label="盈亏比例" 
          value={
            <Text style={{ color: profitLossPercent >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 'bold' }}>
              {formatNumber(profitLossPercent)}%
            </Text>
          } 
        />
      )}
    </div>
  );
};

export default AccountDetail;
