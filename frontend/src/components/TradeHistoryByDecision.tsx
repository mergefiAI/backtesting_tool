import React from 'react';
import {useQuery} from '@tanstack/react-query';
import {Card, Col, Divider, Empty, Row, Space, Spin, Tag, Typography} from 'antd';
import {fetchTrades} from '../api/endpoints';
import {formatUTC} from '../utils/timezone';

const { Text } = Typography;

interface TradeHistoryByDecisionProps {
  decisionId: string; // 决策ID
  onClose: () => void;
}

/**
 * 交易历史组件：显示与某个决策相关的所有交易记录
 * 用于本地决策列表的"查看关联交易"功能
 */
const TradeHistoryByDecision: React.FC<TradeHistoryByDecisionProps> = ({ decisionId, onClose }) => {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['trades-by-decision', decisionId],
    queryFn: () => fetchTrades({ 
      decision_id: decisionId, // 按决策ID筛选交易记录
      page: 1, 
      page_size: 50 
    }),
    enabled: !!decisionId,
  });

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return formatUTC(dateString);
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
          <div style={{ marginTop: 8 }}>加载交易历史中...</div>
        </Spin>
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ padding: '20px' }}>
        <Empty description="无法加载交易历史" />
        <Text type="danger" style={{ display: 'block', marginTop: '10px' }}>
          {error instanceof Error ? error.message : '未知错误'}
        </Text>
      </div>
    );
  }

  const trades = data?.items || [];
  const totalTrades = data?.total || 0;

  // 渲染单个交易记录的块状组件
  const renderTradeItem = (trade: any) => {
    // 确保数量和成交额是数字类型
    const numQuantity = typeof trade.quantity === 'number' ? trade.quantity : parseFloat(trade.quantity);
    const amount = typeof trade.total_amount === 'string' ? parseFloat(trade.total_amount) : trade.total_amount;
    
    return (
      <Card 
        key={trade.trade_id} 
        className="trade-item-card"
        style={{ 
          marginBottom: '16px',
          borderLeft: `4px solid ${trade.trade_action === 'BUY' ? '#52c41a' : '#ff4d4f'}`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div>
            <Text code style={{ fontSize: '12px', marginRight: '12px' }}>交易ID: {trade.trade_id}</Text>
            {getTradeTypeTag(trade.trade_action)}
            <Space>
              {getStatusTag(trade.status)}
            </Space>
          </div>
          <Text type="secondary" style={{ fontSize: '12px' }}>{formatDate(trade.trade_time)}</Text>
        </div>
        
        <Divider style={{ margin: '8px 0' }} />
        
        <Row gutter={[16, 8]}>
          <Col xs={24} sm={12} md={8}>
            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>标的</Text>
              <Text strong style={{ marginLeft: '8px' }}>{trade.symbol || trade.stock_symbol || '-'}</Text>
            </div>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>价格</Text>
              <Text strong style={{ marginLeft: '8px', color: '#1677ff' }}>
                {trade.price ? `$${trade.price.toLocaleString()}` : '-'}
              </Text>
            </div>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>数量</Text>
              <Text strong style={{ marginLeft: '8px', color: '#52c41a' }}>
                {!isNaN(numQuantity) ? numQuantity.toFixed(8) : '-'}
              </Text>
            </div>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>成交额</Text>
              <Text strong style={{ marginLeft: '8px', color: '#faad14' }}>
                {!isNaN(amount) && amount ? `$${amount.toLocaleString()}` : '-'}
              </Text>
            </div>
          </Col>
        </Row>
      </Card>
    );
  };

  return (
    <div style={{ padding: '10px' }}>
      {/* 决策信息 */}
      <Card size="small" style={{ marginBottom: '16px' }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text strong>决策ID: </Text>
            <Text code>{decisionId}</Text>
          </div>
          <div>
            <Text strong>关联交易数量: </Text>
            <Tag color="blue">{totalTrades}</Tag>
          </div>
        </Space>
      </Card>

      <Divider orientation="left" orientationMargin="0">
        <Text strong>交易记录</Text>
      </Divider>

      {trades.length === 0 ? (
        <Empty 
          description="该决策暂无关联的交易记录" 
          style={{ margin: '40px 0' }}
        />
      ) : (
        <div className="trade-items-container">
          {trades.map(renderTradeItem)}
        </div>
      )}

      {trades.length > 0 && (
        <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text type="secondary">交易统计信息</Text>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <Text strong>总成交额: </Text>
                <Text>
                  ${trades.reduce((sum: number, trade: any) => sum + (parseFloat(trade.total_amount) || 0), 0).toLocaleString()}
                </Text>
              </div>
              <div>
                <Text strong>买入交易: </Text>
                <Text>{trades.filter((t: any) => t.trade_action === 'BUY').length} 笔</Text>
              </div>
              <div>
                <Text strong>卖出交易: </Text>
                <Text>{trades.filter((t: any) => t.trade_action === 'SELL').length} 笔</Text>
              </div>
              <div>
                <Text strong>短卖交易: </Text>
                <Text>{trades.filter((t: any) => t.trade_action === 'SHORT_SELL').length} 笔</Text>
              </div>
              <div>
                <Text strong>COVER_SHORT交易: </Text>
                <Text>{trades.filter((t: any) => t.trade_action === 'COVER_SHORT').length} 笔</Text>
              </div>
            </div>
          </Space>
        </div>
      )}
    </div>
  );
};

export default TradeHistoryByDecision;