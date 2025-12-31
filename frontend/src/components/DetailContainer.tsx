import type {ReactNode} from 'react';
import React from 'react';
import {Button, Col, Empty, Result, Row, Space, Spin, Typography} from 'antd';
import {ArrowLeftOutlined} from '@ant-design/icons';
import {useNavigate} from 'react-router-dom';

interface DetailContainerProps {
  /** 页面标题 */
  title: string;
  /** 页面内容 */
  children: ReactNode;
  /** 是否正在加载 */
  loading?: boolean;
  /** 是否显示错误 */
  error?: Error | null;
  /** 错误标题 */
  errorTitle?: string;
  /** 错误描述 */
  errorDescription?: string;
  /** 返回按钮文本 */
  backButtonText?: string;
  /** 返回路由 */
  backRoute?: string;
  /** 页面是否有数据 */
  hasData?: boolean;
  /** 空数据提示 */
  emptyText?: string;
  /** 额外的操作按钮 */
  extraActions?: ReactNode;
  /** 页面头部副标题 */
  subTitle?: string;
  /** 内容区域的样式 */
  contentStyle?: React.CSSProperties;
}

/**
 * 详情页面的通用容器组件
 * 提供统一的页面头部、加载状态、错误处理和布局
 */
const DetailContainer: React.FC<DetailContainerProps> = ({
  title,
  children,
  loading = false,
  error = null,
  errorTitle = '加载失败',
  errorDescription = '无法获取数据，请稍后重试',
  backButtonText = '返回',
  backRoute,
  hasData = true,
  emptyText = '未找到相关数据',
  extraActions,
  subTitle,
  contentStyle,
}) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (backRoute) {
      navigate(backRoute);
    } else {
      navigate(-1);
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <Spin size="large">
            <div style={{ marginTop: 8 }}>正在加载...</div>
          </Spin>
        </div>
      );
    }

    if (error) {
      return (
        <Row justify="center" style={{ padding: '48px 0' }}>
          <Col xs={24} sm={20} md={16} lg={12}>
            <Result
              status="error"
              title={errorTitle}
              subTitle={errorDescription}
              extra={
                <Button type="primary" onClick={() => window.location.reload()}>
                  重试
                </Button>
              }
            />
          </Col>
        </Row>
      );
    }

    if (!hasData) {
      return (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <Empty description={emptyText} />
        </div>
      );
    }

    return children;
  };

  return (
    <div>
      <div style={{ background: '#fff', padding: '12px 16px', borderRadius: 8 }}>
        <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={handleBack}>
              {backButtonText}
            </Button>
            <div>
              <Typography.Title level={4} style={{ margin: 0 }}>{title}</Typography.Title>
              {subTitle && <Typography.Text type="secondary">{subTitle}</Typography.Text>}
            </div>
          </Space>
          <div>{extraActions}</div>
        </Space>
      </div>
      <div 
        style={{
          backgroundColor: '#fff',
          padding: '24px',
          borderRadius: '8px',
          margin: '24px 0',
          minHeight: 'calc(100vh - 200px)',
          ...contentStyle,
        }}
      >
        {renderContent()}
      </div>
    </div>
  );
};

export default DetailContainer;
