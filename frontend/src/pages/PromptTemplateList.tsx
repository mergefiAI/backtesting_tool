import React, {useEffect, useRef, useState} from 'react';
import {Button, Card, Collapse, Form, Input, message, Modal, Popconfirm, Select, Space, Table, Tag, Typography} from 'antd';
import {DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined} from '@ant-design/icons';
import type {ColumnsType} from 'antd/es/table';
import {PageContainer} from '@ant-design/pro-components';
import MDEditor from '@uiw/react-md-editor';
import {createPromptTemplate, deletePromptTemplate, getPromptTemplates, updatePromptTemplate} from '../api/endpoints';
import {useDrawer} from '../components/DetailDrawer';

const { TextArea } = Input;
const { Option } = Select;
const { Panel } = Collapse;
const { Text } = Typography;

interface PromptTemplate {
  prompt_id: string;
  content: string;
  description?: string;
  status: 'AVAILABLE' | 'UNAVAILABLE' | 'DELETED';
  tags?: string;
  created_at: string;
  updated_at: string;
}

interface PromptTemplateForm {
  content: string;
  description?: string;
  tags?: string;
  status: 'AVAILABLE' | 'UNAVAILABLE' | 'DELETED';
}

const PromptTemplateList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PromptTemplate[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const { actions } = useDrawer();
  const [searchParams, setSearchParams] = useState({
    status: undefined as 'AVAILABLE' | 'UNAVAILABLE' | undefined,
    keyword: ''
  });

  const [modalVisible, setModalVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [form] = Form.useForm();
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [tableScrollY, setTableScrollY] = useState<number>(500);
  const [shouldShowScrollY, setShouldShowScrollY] = useState<boolean>(false);

  const fetchData = async () => {
    setLoading(true);
    
    try {
      console.log('开始API调用, 参数:', { page: currentPage, page_size: pageSize, ...searchParams });
      
      const response = await getPromptTemplates({
        page: currentPage,
        page_size: pageSize,
        ...searchParams
      }) as any;
      
      console.log('API返回数据:', response);
      
      // 现在API已经提取了数据，response直接是PaginatedResponse格式
      if (response?.items) {
        const items = response.items as PromptTemplate[];
        const totalCount = response.total as number;
        
        console.log('解析到的数据:', { items, totalCount });
        setData(items);
        setTotal(totalCount);
      } else {
        console.warn('API响应格式不符合预期:', response);
        setData([]);
        setTotal(0);
      }
    } catch (error) {
      console.error('获取策略列表失败:', error);
      message.error('获取策略列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentPage, pageSize, searchParams]);

  useEffect(() => {
    if (!tableContainerRef.current) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        const { height } = entry.contentRect;
        setTableScrollY(Math.max(200, height - 100));
      }
    });

    resizeObserver.observe(tableContainerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // 简单逻辑：如果数据行数少于等于8行，不显示Y轴滚动条
  useEffect(() => {
    const needsScrollY = data.length > 8;
    setShouldShowScrollY(needsScrollY);
  }, [data]);

  const handleSearch = (values: any) => {
    setSearchParams(values);
    setCurrentPage(1);
  };

  const handleReset = () => {
    setSearchParams({
      status: undefined,
      keyword: ''
    });
    setCurrentPage(1);
  };

  const handleRefresh = () => {
    fetchData();
  };

  const handleFieldChange = (field: string, value: any) => {
    const newSearchParams = { ...searchParams, [field]: value };
    setSearchParams(newSearchParams);
    setCurrentPage(1);
  };

  const handleCreate = () => {
    setEditingTemplate(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: PromptTemplate) => {
    setEditingTemplate(record);
    form.setFieldsValue({
      content: record.content,
      description: record.description,
      tags: record.tags,
      status: record.status
    });
    setModalVisible(true);
  };

  const handleViewContent = (content: string) => {
    Modal.info({
      title: '提示词内容预览',
      content: (
        <div style={{ maxHeight: 400, overflow: 'auto' }}>
          <MDEditor.Markdown source={content} />
        </div>
      ),
      width: 800,
      okText: '关闭'
    });
  };

  const handleDelete = async (promptId: string) => {
    try {
      await deletePromptTemplate(promptId);
      message.success('删除成功');
      fetchData();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleModalOk = async () => {
    try {
      const values: PromptTemplateForm = await form.validateFields();
      
      if (editingTemplate) {
        await updatePromptTemplate(editingTemplate.prompt_id, values);
        message.success('更新成功');
      } else {
        await createPromptTemplate(values);
        message.success('创建成功');
      }
      
      setModalVisible(false);
      fetchData();
    } catch (error) {
      message.error(editingTemplate ? '更新失败' : '创建失败');
    }
  };

  const handleModalCancel = () => {
    setModalVisible(false);
    form.resetFields();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return 'green';
      case 'UNAVAILABLE':
        return 'orange';
      case 'DELETED':
        return 'red';
      default:
        return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return '可用';
      case 'UNAVAILABLE':
        return '不可用';
      case 'DELETED':
        return '已删除';
      default:
        return status;
    }
  };

  const getTypeText = (type: string) => {
    switch (type) {
      case 'SYSTEM':
        return '系统';
      case 'USER':
        return '用户';
      default:
        return type;
    }
  };

  const columns: ColumnsType<PromptTemplate> = [
    {
      title: 'ID',
      dataIndex: 'prompt_id',
      key: 'prompt_id',
      width: 120,
      ellipsis: true,
      hidden: true,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 250,
      fixed: 'left' as const,
      ellipsis: true
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      fixed: 'left' as const,
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{getStatusText(status)}</Tag>
      )
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      width: 200,
      render: (tags?: string) => {
        if (!tags) return '-';
        const tagList = tags.split(',').filter(tag => tag.trim());
        return (
          <>
            {tagList.map((tag, index) => (
              <Tag key={index} style={{ marginBottom: 4 }}>{tag.trim()}</Tag>
            ))}
          </>
        );
      }
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (date: string) => new Date(date).toLocaleString()
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 160,
      render: (date: string) => new Date(date).toLocaleString()
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            type="primary"
            onClick={() => actions.openDrawer('prompt-template', record.prompt_id)}
          >
            查看详情
          </Button>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个策略吗？"
            onConfirm={() => handleDelete(record.prompt_id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ 
      height: '100%', 
      width: '100%',
      display: 'flex', 
      flexDirection: 'column', 
      gap: '8px',
      overflow: 'hidden'
    }}>
      <Card 
        style={{ 
          width: '100%', 
          borderRadius: '6px', 
          boxShadow: '0 1px 4px rgba(0, 0, 0, 0.06)', 
          overflow: 'hidden',
          marginBottom: '12px'
        }}
        bodyStyle={{ 
          padding: '12px 16px', 
          backgroundColor: '#fff' 
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <Select 
              style={{ width: 120 }} 
              placeholder="状态" 
              allowClear
              value={searchParams.status} 
              onChange={(value) => handleFieldChange('status', value)}
            >
              <Option value="AVAILABLE">可用</Option>
              <Option value="UNAVAILABLE">不可用</Option>
            </Select>
            <Input 
              placeholder="搜索内容或描述" 
              style={{ width: 200 }}
              value={searchParams.keyword}
              onChange={(e) => handleFieldChange('keyword', e.target.value)}
            />
            <Button icon={<ReloadOutlined />} onClick={handleRefresh}>刷新</Button>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建策略
          </Button>
        </div>
      </Card>

      <Card 
        style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          width: '100%', 
          borderRadius: '8px', 
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)', 
          overflow: 'hidden' 
        }}
        bodyStyle={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          overflow: 'hidden', 
          padding: '16px', 
          backgroundColor: '#fff' 
        }}
      >
        <div 
          ref={tableContainerRef}
          style={{ 
            flex: 1, 
            overflow: 'hidden',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
            border: '1px solid #e8e8e8',
            backgroundColor: '#fff',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <Table
            loading={loading}
            dataSource={data}
            columns={columns}
            rowKey="prompt_id"
            pagination={{
              current: currentPage,
              pageSize: pageSize,
              total: total,
              onChange: (page, size) => {
                setCurrentPage(page);
                setPageSize(size);
              },
              showSizeChanger: true,
              showTotal: (t) => `共 ${t} 条`,
              style: {
                padding: '12px 16px',
                borderTop: '1px solid #e8e8e8',
                margin: 0
              }
            }}
            scroll={shouldShowScrollY ? { x: 1400, y: tableScrollY } : { x: 1400 }}
            size="middle"
            style={{
              borderRadius: '8px',
              overflow: 'hidden',
              height: '100%'
            }}
            rowClassName={(record, index) => index % 2 === 0 ? 'table-row-even' : 'table-row-odd'}
          />
        </div>
      </Card>

      <Modal
        title={editingTemplate ? '编辑策略' : '新建策略'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        width="calc(100vw - 20px)"
        style={{ 
          top: 10, 
          left: 10, 
          right: 10, 
          bottom: 10, 
          width: "calc(100vw - 20px)", 
          height: "calc(100vh - 20px)",
          maxWidth: "calc(100vw - 20px)",
          maxHeight: "calc(100vh - 20px)",
          padding: 0,
          position: 'fixed'
        }}
        styles={{ 
          body: {
            height: "calc(100vh - 20px - 110px)", 
            overflow: "auto", 
            padding: "24px" 
          }
        }}
        footer={[
          <Button key="cancel" onClick={handleModalCancel}>
            取消
          </Button>,
          <Button key="submit" type="primary" onClick={handleModalOk}>
            确定
          </Button>
        ]}
        okText="确定"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ status: 'AVAILABLE' }}
        >
          <Form.Item
            name="content"
            label="策略内容"
            rules={[{ required: true, message: '请输入策略内容' }]}
          >
            <MDEditor
              height="calc(70vh - 80px)"
              visibleDragbar={true}
              hideToolbar={false}
              preview="edit"
              textareaProps={{
                placeholder: '请输入策略内容，支持Markdown格式',
                maxLength: 50000,
              }}
            />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <TextArea
              rows={2}
              placeholder="请输入描述（可选）"
              maxLength={500}
              showCount
            />
          </Form.Item>

          <Form.Item
            name="tags"
            label="标签"
          >
            <Input placeholder="请输入标签，用逗号分隔（可选）" />
          </Form.Item>

          <Form.Item
            name="status"
            label="状态"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select placeholder="请选择状态">
              <Option value="AVAILABLE">可用</Option>
              <Option value="UNAVAILABLE">不可用</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PromptTemplateList;
