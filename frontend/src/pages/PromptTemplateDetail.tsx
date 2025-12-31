import React, {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Alert, Button, Card, Form, Input, Space, Spin, Tag, Tooltip, Typography} from 'antd';
import {CopyOutlined, FileTextOutlined, FullscreenExitOutlined, FullscreenOutlined} from '@ant-design/icons';
import {fetchPromptTemplateDetail} from '../api/endpoints';
import MDEditor from '@uiw/react-md-editor';

const { Text } = Typography;
const { Search } = Input;

interface PromptTemplateDetailProps {
  id: string;
  onClose: () => void;
}

export const PromptTemplateDetail: React.FC<PromptTemplateDetailProps> = ({ id, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery<Record<string, any>, Error, Record<string, any>, [string, string]>({
    queryKey: ['promptTemplateDetail', id],
    queryFn: () => {
      if (!id) throw new Error('策略ID未提供');
      return fetchPromptTemplateDetail(id);
    },
    enabled: !!id,
  });



  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
  };

  const getTypeText = (type?: string) => {
    switch (type) {
      case 'SYSTEM':
        return '系统';
      case 'USER':
        return '用户';
      default:
        return type || '-';
    }
  };

  const getStatusText = (status?: string) => {
    switch (status) {
      case 'AVAILABLE':
        return '可用';
      case 'UNAVAILABLE':
        return '不可用';
      case 'DELETED':
        return '已删除';
      default:
        return status || '-';
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'AVAILABLE':
        return 'success';
      case 'UNAVAILABLE':
        return 'warning';
      case 'DELETED':
        return 'error';
      default:
        return 'default';
    }
  };

  const renderTags = (tags?: any) => {
    if (!tags) return <Text type="secondary">暂无标签</Text>;
    
    let tagList: string[] = [];
    
    // 处理不同格式的tags数据
    if (typeof tags === 'string') {
      // 字符串格式，按逗号分隔
      tagList = tags.split(',').filter(tag => tag.trim());
    } else if (Array.isArray(tags)) {
      // 数组格式，直接使用
      tagList = tags.filter(tag => tag && typeof tag === 'string' && tag.trim());
    } else if (typeof tags === 'object') {
      // 对象格式，尝试转换为数组
      try {
        tagList = Object.values(tags).filter((tag: any) => 
          typeof tag === 'string' && tag.trim()
        ) as string[];
      } catch (e) {
        console.error('Failed to parse tags object:', e);
      }
    }
    
    return tagList.length > 0 ? (
      <Space wrap>
        {tagList.map((tag, index) => (
          <Tag key={index}>{tag.trim()}</Tag>
        ))}
      </Space>
    ) : <Text type="secondary">暂无标签</Text>;
  };

  const handleCopyContent = async () => {
    if (data?.content) {
      try {
        await navigator.clipboard.writeText(data.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('复制失败:', err);
      }
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // 移除搜索功能，直接使用原始内容

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
          <div style={{ marginTop: 8 }}>正在加载策略详情...</div>
        </Spin>
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ padding: '32px' }}>
        <Alert
          message="加载失败"
          description={`无法加载策略详情: ${(error as Error).message}`}
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
          description="策略不存在或已被删除"
          type="warning"
          showIcon
        />
      </div>
    );
  }

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
          <h2>策略详情 - {data.prompt_id || '-'}</h2>
          <Space>
            {data.content && (
              <Tooltip title={copied ? '已复制' : '复制内容'}>
                <Button 
                  type="primary" 
                  icon={<CopyOutlined />}
                  onClick={handleCopyContent}
                >
                  {copied ? '已复制' : '复制内容'}
                </Button>
              </Tooltip>
            )}
            <Button 
              icon={<FullscreenExitOutlined />}
              onClick={toggleFullscreen}
            >
              退出全屏
            </Button>
          </Space>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', height: 'calc(100vh - 80px)' }}>
          {/* 左侧信息面板 */}
          <Card title="模板信息" style={{ height: '100%' }}>
            <Form layout="vertical">
              <Form.Item label="模板ID">
                <Text copyable>{data.prompt_id || '-'}</Text>
              </Form.Item>

              <Form.Item label="描述">
                {data.description ? (
                  <div style={{ 
                    padding: 12,
                    backgroundColor: '#fafafa',
                    borderRadius: 6,
                    border: '1px solid #f0f0f0',
                    minHeight: 60
                  }}>
                    {data.description}
                  </div>
                ) : (
                  <Text type="secondary">-</Text>
                )}
              </Form.Item>

              <Form.Item label="标签">
                {renderTags(data.tags)}
              </Form.Item>

              <Form.Item label="状态">
                <Tag color={getStatusColor(data.status)}>{getStatusText(data.status)}</Tag>
              </Form.Item>

              <Form.Item label="创建时间">
                <Text>{formatDate(data.created_at)}</Text>
              </Form.Item>

              <Form.Item label="更新时间">
                <Text>{formatDate(data.updated_at)}</Text>
              </Form.Item>
            </Form>
          </Card>

          {/* 右侧内容面板 */}
          <Card title="提示词内容" style={{ height: '100%' }}>
            {data.content ? (
              <div style={{ 
                border: '1px solid #e8e8e8',
                borderRadius: 6,
                padding: 16,
                backgroundColor: '#fff',
                height: 'calc(100% - 40px)',
                overflow: 'auto'
              }}>
                <MDEditor.Markdown source={data.content} />
              </div>
            ) : (
              <div style={{ 
                textAlign: 'center', 
                padding: '48px',
                color: '#8c8c8c',
                border: '1px dashed #e8e8e8',
                borderRadius: 6
              }}>
                <FileTextOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
                <div>暂无提示词内容</div>
              </div>
            )}
          </Card>
        </div>
      </div>
    );
  }

  // 正常模式布局
  return (
    <>
      {data.content && (
        <div style={{ marginBottom: 16, textAlign: 'right', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Tooltip title={copied ? '已复制' : '复制内容'}>
            <Button 
              type="primary" 
              icon={<CopyOutlined />}
              onClick={handleCopyContent}
            >
              {copied ? '已复制' : '复制内容'}
            </Button>
          </Tooltip>
          <Tooltip title="全屏查看">
            <Button 
              icon={<FullscreenOutlined />}
              onClick={toggleFullscreen}
            >
              全屏
            </Button>
          </Tooltip>
        </div>
      )}
      <Card style={{ marginBottom: 16 }}>
        <Form layout="vertical">
          <Form.Item label="模板ID">
            <Text copyable>{data.prompt_id || '-'}</Text>
          </Form.Item>

          <Form.Item label="提示词内容">
            {data.content ? (
              <div style={{ 
                border: '1px solid #e8e8e8',
                borderRadius: 6,
                padding: 16,
                backgroundColor: '#fff',
                maxHeight: 400,
                overflow: 'auto'
              }}>
                <MDEditor.Markdown source={data.content} />
              </div>
            ) : (
              <div style={{ 
                textAlign: 'center', 
                padding: '48px',
                color: '#8c8c8c',
                border: '1px dashed #e8e8e8',
                borderRadius: 6
              }}>
                <FileTextOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
                <div>暂无提示词内容</div>
              </div>
            )}
          </Form.Item>

          <Form.Item label="描述">
            {data.description ? (
              <div style={{ 
                padding: 12,
                backgroundColor: '#fafafa',
                borderRadius: 6,
                border: '1px solid #f0f0f0',
                minHeight: 60
              }}>
                {data.description}
              </div>
            ) : (
              <Text type="secondary">-</Text>
            )}
          </Form.Item>

          <Form.Item label="标签">
            {renderTags(data.tags)}
          </Form.Item>

          <Form.Item label="状态">
            <Tag color={getStatusColor(data.status)}>{getStatusText(data.status)}</Tag>
          </Form.Item>

          <Form.Item label="创建时间">
            <Text>{formatDate(data.created_at)}</Text>
          </Form.Item>

          <Form.Item label="更新时间">
            <Text>{formatDate(data.updated_at)}</Text>
          </Form.Item>
        </Form>
      </Card>
    </>
  );
};

export default PromptTemplateDetail;