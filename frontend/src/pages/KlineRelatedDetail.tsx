import React, {useState} from 'react';
import {Button, Card, Collapse, Empty, Tabs} from 'antd';
import {useQuery} from '@tanstack/react-query';
import {fetchKlineRelatedData} from '../api/endpoints';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import 'github-markdown-css';
import {FullscreenExitOutlined, FullscreenOutlined} from '@ant-design/icons';

dayjs.extend(utc);

const { Panel } = Collapse;

const { TabPane } = Tabs;

interface KlineRelatedDetailProps {
  id: string; // 点击的日期
  data?: any;
  onClose: () => void;
}

/**
 * K线 + 净值关联数据详情组件
 * 显示关联决策、关联交易2个tab
 */
export default function KlineRelatedDetail({ id, data, onClose }: KlineRelatedDetailProps) {
  const clickedDate = id;
  // 从data中提取symbol、accountId和taskId
  const symbol = data?.symbol;
  const accountId = data?.accountId;
  const taskId = data?.taskId;
  const range = data?.range;
  const [activeTab, setActiveTab] = useState<string>('local-decision');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // 格式化日期，用于API请求，使用UTC时间确保与后端一致
  const formattedDate = dayjs.utc(clickedDate).format('YYYY-MM-DD');
  const analysisDate = dayjs.utc(clickedDate).toISOString();

  // 添加调试信息
  React.useEffect(() => {
    console.log('KlineRelatedDetail props:', { id, data });
    console.log('Formatted dates:', { formattedDate, analysisDate });
    console.log('KlineRelatedDetail state:', { symbol, accountId, taskId });
  }, [id, data, formattedDate, analysisDate, symbol, accountId, taskId]);

  // 获取关联数据 - 使用新的API端点
  const { data: relatedData, isLoading: isRelatedDataLoading } = useQuery({
    queryKey: ['kline-related-data', taskId, accountId, id],
    queryFn: async ({ signal }) => {
      // 使用点击的原始UTC时间直接作为analysis_date，确保格式正确
      const analysisDateToUse = id;
      console.log('fetchKlineRelatedData called with params:', {
        task_id: taskId,
        account_id: accountId,
        analysis_date: analysisDateToUse,
        originalId: id
      });
      const result = await fetchKlineRelatedData({
        task_id: taskId,
        account_id: accountId,
        analysis_date: analysisDateToUse
      }, signal);
      console.log('fetchKlineRelatedData result:', result);
      return result;
    },
    enabled: !!taskId && !!accountId && !!id
  });

  // 从relatedData中提取数据
  const decision = relatedData?.decision;
  const trades = relatedData?.trades || [];
  const snapshot = relatedData?.snapshot || null;

  // 全屏切换函数
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const DetailContent = () => (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>日期: {dayjs.utc(clickedDate).format('YYYY-MM-DD HH:mm')}</h2>
        <Button 
          type="text" 
          icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />} 
          onClick={toggleFullscreen}
          title={isFullscreen ? '退出全屏' : '全屏显示'}
        />
      </div>
      
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        {/* 关联决策tab */}
        <TabPane tab="关联决策" key="local-decision">
          <Card title="本地决策" loading={isRelatedDataLoading}>
            {decision ? (
              <div style={{ marginBottom: 16 }}>
                <div style={{ marginBottom: 16, padding: 12, border: '1px solid #f0f0f0', borderRadius: 4 }}>
                  <h3>决策ID: {decision.decision_id}</h3>
                  <p>决策结果: {decision.decision_result}</p>
                  <p>置信度: {decision.confidence_score}</p>
                  <p>股票代码: {decision.stock_symbol}</p>
                  <p>分析日期: {dayjs.utc(decision.analysis_date).format('YYYY-MM-DD HH:mm')}</p>
                  <p>开始时间: {dayjs.utc(decision.start_time).format('YYYY-MM-DD HH:mm')}</p>
                  {decision.end_time && (
                    <p>结束时间: {dayjs.utc(decision.end_time).format('YYYY-MM-DD HH:mm')}</p>
                  )}
                  <p>执行时间: {decision.execution_time_ms} ms</p>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <Collapse defaultActiveKey={['reasoning', 'agent-output', 'agent-input', 'market-data']}>
                    <Panel header="决策推理" key="reasoning">
                      <div className="github-markdown" style={{ padding: 16, border: '1px solid #f0f0f0', borderRadius: 4, backgroundColor: '#ffffff' }}>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h1: ({ children }) => <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>{children}</h1>,
                            h2: ({ children }) => <h2 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>{children}</h2>,
                            h3: ({ children }) => <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>{children}</h3>,
                            p: ({ children }) => <p style={{ marginBottom: '0.75rem' }}>{children}</p>,
                            ul: ({ children }) => <ul style={{ marginBottom: '0.75rem', paddingLeft: '1.5rem' }}>{children}</ul>,
                            ol: ({ children }) => <ol style={{ marginBottom: '0.75rem', paddingLeft: '1.5rem' }}>{children}</ol>,
                            li: ({ children }) => <li style={{ marginBottom: '0.25rem' }}>{children}</li>,
                            code: ({ children }) => <code style={{ backgroundColor: '#f6f8fa', padding: '0.2rem 0.4rem', borderRadius: '3px', fontSize: '0.9rem' }}>{children}</code>,
                            pre: ({ children }) => <pre style={{ backgroundColor: '#f6f8fa', padding: '1rem', borderRadius: '6px', overflow: 'auto', marginBottom: '0.75rem' }}>{children}</pre>,
                            blockquote: ({ children }) => <blockquote style={{ borderLeft: '4px solid #dfe2e5', marginLeft: 0, paddingLeft: '1rem', color: '#6a737d', marginBottom: '0.75rem' }}>{children}</blockquote>,
                            table: ({ children }) => <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '0.75rem' }}>{children}</table>,
                            th: ({ children }) => <th style={{ border: '1px solid #dfe2e5', padding: '0.5rem', backgroundColor: '#f6f8fa' }}>{children}</th>,
                            td: ({ children }) => <td style={{ border: '1px solid #dfe2e5', padding: '0.5rem' }}>{children}</td>,
                          }}
                        >
                          {(() => {
                            const reasoningContent = decision.reasoning || '暂无决策推理数据';
                            return typeof reasoningContent === 'string' ? reasoningContent : JSON.stringify(reasoningContent, null, 2);
                          })()}
                        </ReactMarkdown>
                      </div>
                    </Panel>
                    <Panel header="Agent 输出" key="agent-output">
                      <div className="github-markdown" style={{ padding: 16, border: '1px solid #f0f0f0', borderRadius: 4, backgroundColor: '#ffffff' }}>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h1: ({ children }) => <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>{children}</h1>,
                            h2: ({ children }) => <h2 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>{children}</h2>,
                            h3: ({ children }) => <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>{children}</h3>,
                            p: ({ children }) => <p style={{ marginBottom: '0.75rem' }}>{children}</p>,
                            ul: ({ children }) => <ul style={{ marginBottom: '0.75rem', paddingLeft: '1.5rem' }}>{children}</ul>,
                            ol: ({ children }) => <ol style={{ marginBottom: '0.75rem', paddingLeft: '1.5rem' }}>{children}</ol>,
                            li: ({ children }) => <li style={{ marginBottom: '0.25rem' }}>{children}</li>,
                            code: ({ children }) => <code style={{ backgroundColor: '#f6f8fa', padding: '0.2rem 0.4rem', borderRadius: '3px', fontSize: '0.9rem' }}>{children}</code>,
                            pre: ({ children }) => <pre style={{ backgroundColor: '#f6f8fa', padding: '1rem', borderRadius: '6px', overflow: 'auto', marginBottom: '0.75rem' }}>{children}</pre>,
                            blockquote: ({ children }) => <blockquote style={{ borderLeft: '4px solid #dfe2e5', marginLeft: 0, paddingLeft: '1rem', color: '#6a737d', marginBottom: '0.75rem' }}>{children}</blockquote>,
                            table: ({ children }) => <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '0.75rem' }}>{children}</table>,
                            th: ({ children }) => <th style={{ border: '1px solid #dfe2e5', padding: '0.5rem', backgroundColor: '#f6f8fa' }}>{children}</th>,
                            td: ({ children }) => <td style={{ border: '1px solid #dfe2e5', padding: '0.5rem' }}>{children}</td>,
                          }}
                        >
                          {(() => {
                            const outputContent = decision.market_data?.agent_response?.output || '暂无Agent输出数据';
                            return typeof outputContent === 'string' ? outputContent : JSON.stringify(outputContent, null, 2);
                          })()}
                        </ReactMarkdown>
                      </div>
                    </Panel>
                    <Panel header="Agent 输入" key="agent-input">
                      <div className="github-markdown" style={{ padding: 16, border: '1px solid #f0f0f0', borderRadius: 4, backgroundColor: '#ffffff' }}>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h1: ({ children }) => <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>{children}</h1>,
                            h2: ({ children }) => <h2 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>{children}</h2>,
                            h3: ({ children }) => <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>{children}</h3>,
                            p: ({ children }) => <p style={{ marginBottom: '0.75rem' }}>{children}</p>,
                            ul: ({ children }) => <ul style={{ marginBottom: '0.75rem', paddingLeft: '1.5rem' }}>{children}</ul>,
                            ol: ({ children }) => <ol style={{ marginBottom: '0.75rem', paddingLeft: '1.5rem' }}>{children}</ol>,
                            li: ({ children }) => <li style={{ marginBottom: '0.25rem' }}>{children}</li>,
                            code: ({ children }) => <code style={{ backgroundColor: '#f6f8fa', padding: '0.2rem 0.4rem', borderRadius: '3px', fontSize: '0.9rem' }}>{children}</code>,
                            pre: ({ children }) => <pre style={{ backgroundColor: '#f6f8fa', padding: '1rem', borderRadius: '6px', overflow: 'auto', marginBottom: '0.75rem' }}>{children}</pre>,
                            blockquote: ({ children }) => <blockquote style={{ borderLeft: '4px solid #dfe2e5', marginLeft: 0, paddingLeft: '1rem', color: '#6a737d', marginBottom: '0.75rem' }}>{children}</blockquote>,
                            table: ({ children }) => <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '0.75rem' }}>{children}</table>,
                            th: ({ children }) => <th style={{ border: '1px solid #dfe2e5', padding: '0.5rem', backgroundColor: '#f6f8fa' }}>{children}</th>,
                            td: ({ children }) => <td style={{ border: '1px solid #dfe2e5', padding: '0.5rem' }}>{children}</td>,
                          }}
                        >
                          {(() => {
                            const inputContent = decision.market_data?.agent_response?.input || '暂无Agent输入数据';
                            return typeof inputContent === 'string' ? inputContent : JSON.stringify(inputContent, null, 2);
                          })()}
                        </ReactMarkdown>
                      </div>
                    </Panel>
                    <Panel header="决策市场数据" key="market-data">
                      <div style={{ padding: 16, border: '1px solid #f0f0f0', borderRadius: 4, backgroundColor: '#f6f8fa', marginBottom: 16 }}>
                        <div style={{ marginBottom: 16 }}>
                          <h4>基本市场数据</h4>
                          <pre style={{ fontSize: '0.9rem', overflow: 'auto' }}>
                            {JSON.stringify({
                              ...decision.market_data,
                              agent_response: undefined
                            }, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </Panel>
                  </Collapse>
                </div>
              </div>
            ) : (
              <Empty description="暂无关联决策数据" />
            )}
          </Card>
        </TabPane>

        {/* 关联交易tab */}
        <TabPane tab="关联交易" key="trade">
          <Card title="交易记录" loading={isRelatedDataLoading}>
            {trades.length > 0 ? (
              <div>
                {trades.map((trade: any) => (
                  <div key={trade.trade_id} style={{ marginBottom: 16, padding: 12, border: '1px solid #f0f0f0', borderRadius: 4 }}>
                    <h3>交易ID: {trade.trade_id}</h3>
                    <p>交易动作: {trade.trade_action}</p>
                    <p>数量: {trade.trade_quantity || 'N/A'}</p>
                    <p>价格: {trade.trade_price || 'N/A'}</p>
                    <p>费用: {trade.trade_fees || 'N/A'}</p>
                    <p>总金额: {trade.trade_amount || 'N/A'}</p>
                    <p>状态: {trade.status}</p>
                    <p>交易时间: {trade.trade_time ? dayjs.utc(trade.trade_time).format('YYYY-MM-DD HH:mm') : 'N/A'}</p>
                    {trade.decision_id && (
                      <p>关联决策ID: {trade.decision_id}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <Empty description="暂无关联交易数据" />
            )}
          </Card>
        </TabPane>

        {/* 快照详情tab */}
        <TabPane tab="快照详情" key="snapshot">
          <Card title="账户快照" loading={isRelatedDataLoading}>
            {snapshot ? (
              <div style={{ marginBottom: 16, padding: 12, border: '1px solid #f0f0f0', borderRadius: 4 }}>
                <h3>快照ID: {snapshot.snapshot_id}</h3>
                <p>账户ID: {snapshot.account_id}</p>
                <p>市场类型: {snapshot.market_type}</p>
                <p>标的: {snapshot.stock_symbol}</p>
                <p>初始余额: {snapshot.initial_balance}</p>
                <p>余额: {snapshot.balance}</p>
                <p>可用余额: {snapshot.available_balance}</p>
                <p>持仓数量: {snapshot.stock_quantity}</p>
                <p>快照价格: {snapshot.stock_price}</p>
                <p>持股价值: {snapshot.stock_market_value}</p>
                <p>总价值: {snapshot.total_value}</p>
                <p>保证金占用: {snapshot.margin_used}</p>
                <p>累计交易费用: {snapshot.total_fees}</p>
                <p>持仓方向: {snapshot.position_side}</p>
                <p>空头持仓均价: {snapshot.short_avg_price}</p>
                <p>空头持仓总成本: {snapshot.short_total_cost}</p>
                <p>盈亏金额: {snapshot.profit_loss}</p>
                <p>盈亏百分比: {snapshot.profit_loss_percent}</p>
                <p>时间: {snapshot.timestamp ? dayjs.utc(snapshot.timestamp).format('YYYY-MM-DD HH:mm') : 'N/A'}</p>
              </div>
            ) : (
              <Empty description="无关联账户快照" />
            )}
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );

  // 全屏模式布局
  if (isFullscreen) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        backgroundColor: '#fff',
        padding: '16px',
        overflow: 'auto'
      }}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>日期: {dayjs.utc(clickedDate).format('YYYY-MM-DD HH:mm')}</h2>
          <Button 
            type="text" 
            icon={<FullscreenExitOutlined />} 
            onClick={toggleFullscreen}
            title="退出全屏"
          />
        </div>
        <div style={{ height: 'calc(100vh - 80px)' }}>
          <DetailContent />
        </div>
      </div>
    );
  }

  // 正常模式布局
  return (
    <DetailContent />
  );
}