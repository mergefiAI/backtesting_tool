import React, {useState} from 'react';
import {Alert, Button, Col, Row, Space, Spin, Tag, Typography} from 'antd';
import {useQuery} from '@tanstack/react-query';
import {fetchLocalDecisionDetail} from '../api/endpoints';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import 'github-markdown-css';
import {FullscreenExitOutlined, FullscreenOutlined} from '@ant-design/icons';
import DetailItem from '../components/DetailItem';

const { Title } = Typography;

interface LocalDecisionDetailProps {
  id: string;
  onClose?: () => void;
}

const LocalDecisionDetail: React.FC<LocalDecisionDetailProps> = ({ id }) => {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const MarkdownView: any = ReactMarkdown;

  console.log('LocalDecisionDetail组件渲染，决策ID:', id); // 调试日志

  const { data, isLoading, isError, error } = useQuery<Record<string, any>, Error, Record<string, any>, [string, string]>({
    queryKey: ['localDecisionDetail', id],
    queryFn: () => {
      console.log('开始获取决策详情，ID:', id); // 调试日志
      if (!id) {
        throw new Error('决策ID未提供');
      }
      return fetchLocalDecisionDetail(id);
    },
    enabled: !!id,
  });

  console.log('LocalDecisionDetail状态:', { isLoading, isError, hasData: !!data }); // 调试日志

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

  const formatExecutionTime = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getDecisionResultTag = (result?: string) => {
    const resultMap: Record<string, { color: string; text: string }> = {
      'BUY': { color: 'green', text: '买入' },
      'SELL': { color: 'red', text: '卖出' },
      'SHORT_SELL': { color: 'orange', text: '短卖' },
      'COVER_SHORT': { color: 'orange', text: 'COVER_SHORT' },
      'HOLD': { color: 'blue', text: '持有' },
      'WAIT': { color: 'orange', text: '等待' },
    };
    
    const resultInfo = resultMap[result || ''] || { color: 'default', text: result || '-' };
    return <Tag color={resultInfo.color}>{resultInfo.text}</Tag>;
  };

  const formatConfidenceScore = (score?: any) => {
    if (!score) return '-';
    const numScore = Number(score);
    return `${(numScore * 100).toFixed(2)}%`;
  };

  // 全屏切换函数
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const DetailContent = () => (
    <div style={{ padding: '24px', maxHeight: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4}>决策详情</Title>
        <Space>
          <Button 
            type="text" 
            icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />} 
            onClick={toggleFullscreen}
            title={isFullscreen ? '退出全屏' : '全屏显示'}
          />
        </Space>
      </div>
      
      {data && (
        <div>
          {/* 基本信息 */}
          <div style={{ marginBottom: '32px' }}>
            <Title level={4}>基本信息</Title>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <DetailItem label="决策ID" value={data.decision_id || '-'} />
              </Col>
              <Col span={12}>
                <DetailItem label="账户ID" value={data.account_id || '-'} />
              </Col>
              <Col span={12}>
                <DetailItem label="股票代码" value={data.stock_symbol || '-'} />
              </Col>
              <Col span={12}>
                <DetailItem label="决策结果" value={getDecisionResultTag(data.decision_result)} />
              </Col>
              <Col span={12}>
                <DetailItem label="置信度分数" value={formatConfidenceScore(data.confidence_score)} />
              </Col>
              <Col span={12}>
                <DetailItem label="执行时间" value={formatExecutionTime(data.execution_time_ms)} />
              </Col>
            </Row>
            
            <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
              <Col span={12}>
                <DetailItem label="开始时间" value={formatDate(data.start_time)} />
              </Col>
              <Col span={12}>
                <DetailItem label="结束时间" value={formatDate(data.end_time)} />
              </Col>
            </Row>
            
          </div>
          
          {/* 决策理由 */}
          {data.reasoning && (
            <div style={{ marginBottom: '32px' }}>
              <Title level={4}>决策理由</Title>
              <div style={{ backgroundColor: '#fafafa', padding: '16px', borderRadius: '8px' }} className="markdown-body">
                <MarkdownView 
                  children={data.reasoning} 
                  remarkPlugins={[remarkGfm]} 
                  components={{
                    h1: (props: any) => <h1 style={{ fontSize: '24px' }} {...props} />,
                    h2: (props: any) => <h2 style={{ fontSize: '20px' }} {...props} />,
                    h3: (props: any) => <h3 style={{ fontSize: '18px' }} {...props} />,
                  }}
                />
              </div>
            </div>
          )}
          
          {/* 市场数据 */}
          {data.market_data && (
            <div style={{ marginBottom: '32px' }}>
              <Title level={4}>市场数据</Title>
              <div style={{ backgroundColor: '#f5f5f5', padding: '12px', borderRadius: '4px', overflowX: 'auto' }}>
                <pre style={{ margin: 0, fontSize: '12px' }}>
                  {JSON.stringify(data.market_data, null, 2)}
                </pre>
              </div>
            </div>
          )}
          
        </div>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div style={{ 
        padding: '24px', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '400px' 
      }}>
        <Spin size="large">
          <div style={{ marginTop: 8 }}>加载中...</div>
        </Spin>
      </div>
    );
  }

  if (isError) {
    console.error('LocalDecisionDetail加载错误:', error); // 调试日志
    return (
      <div style={{ padding: '24px' }}>
        <Alert
          message="加载失败"
          description={`无法获取决策详情: ${(error as Error).message}`}
          type="error"
          showIcon
        />
      </div>
    );
  }

  if (!data) {
    console.log('LocalDecisionDetail无数据:', data); // 调试日志
    return (
      <div style={{ padding: '24px' }}>
        <Alert
          message="暂无数据"
          description="未找到相关决策数据"
          type="warning"
          showIcon
        />
      </div>
    );
  }

  console.log('LocalDecisionDetail渲染数据:', data); // 调试日志

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
          <h2>决策详情 - {data.decision_id || '-'}</h2>
          <Button 
            type="text" 
            icon={<FullscreenExitOutlined />}
            onClick={toggleFullscreen}
          >
            退出全屏
          </Button>
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
};

export default LocalDecisionDetail;