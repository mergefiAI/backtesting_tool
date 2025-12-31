import React, {useEffect, useState} from 'react';
import {Button, Form, Input, message, Modal, Popconfirm, Space, Table, Typography} from 'antd';
import {DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined} from '@ant-design/icons';
import type {ColumnsType} from 'antd/es/table';
import {PageContainer} from '@ant-design/pro-components';
import {createAIConfig, deleteAIConfig, fetchAIConfigs, updateAIConfig} from '../api/endpoints';
import type {AIConfig} from '../types/api';

const { TextArea } = Input;
const { Title } = Typography;

interface AIConfigForm {
  name: string;
  local_ai_base_url: string;
  local_ai_api_key: string;
  local_ai_model_name: string;
}

const AIConfigList: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AIConfig[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchParams, setSearchParams] = useState({
    keyword: ''
  });

  const [modalVisible, setModalVisible] = useState(false);
  const [editingConfig, setEditingConfig] = useState<AIConfig | null>(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    
    try {
      const response = await fetchAIConfigs({
        page: currentPage,
        page_size: pageSize,
        ...searchParams
      });
      
      if (response?.items) {
        setData(response.items);
        setTotal(response.total);
      } else {
        setData([]);
        setTotal(0);
      }
    } catch (error) {
      console.error('获取AI配置列表失败:', error);
      message.error('获取AI配置列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentPage, pageSize, searchParams]);

  const handleFieldChange = (field: string, value: any) => {
    const newSearchParams = { ...searchParams, [field]: value };
    setSearchParams(newSearchParams);
    setCurrentPage(1);
  };

  const handleCreate = () => {
    setEditingConfig(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: AIConfig) => {
    setEditingConfig(record);
    form.setFieldsValue({
      name: record.name,
      local_ai_base_url: record.local_ai_base_url,
      local_ai_api_key: record.local_ai_api_key,
      local_ai_model_name: record.local_ai_model_name
    });
    setModalVisible(true);
  };

  const handleDelete = async (configId: string) => {
    try {
      await deleteAIConfig(configId);
      message.success('删除成功');
      fetchData();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleModalOk = async () => {
    try {
      const values: AIConfigForm = await form.validateFields();
      
      if (editingConfig) {
        await updateAIConfig(editingConfig.config_id, values);
        message.success('更新成功');
      } else {
        await createAIConfig(values);
        message.success('创建成功');
      }
      
      setModalVisible(false);
      fetchData();
    } catch (error) {
      message.error(editingConfig ? '更新失败' : '创建失败');
    }
  };

  const handleModalCancel = () => {
    setModalVisible(false);
    form.resetFields();
  };

  const columns: ColumnsType<AIConfig> = [
    {
      title: 'ID',
      dataIndex: 'config_id',
      key: 'config_id',
      width: 120,
      ellipsis: true
    },
    {
      title: '配置名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      ellipsis: true
    },
    {
      title: 'AI服务基础URL',
      dataIndex: 'local_ai_base_url',
      key: 'local_ai_base_url',
      width: 300,
      ellipsis: true
    },
    {
      title: 'AI服务API密钥',
      dataIndex: 'local_ai_api_key',
      key: 'local_ai_api_key',
      width: 200,
      ellipsis: true,
      render: (apiKey: string) => {
        // 脱敏显示API密钥
        if (apiKey.length > 8) {
          return `${apiKey.substring(0, 4)}****${apiKey.substring(apiKey.length - 4)}`;
        }
        return apiKey;
      }
    },
    {
      title: 'AI模型名称',
      dataIndex: 'local_ai_model_name',
      key: 'local_ai_model_name',
      width: 200,
      ellipsis: true
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
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个AI配置吗？"
            onConfirm={() => handleDelete(record.config_id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="text"
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
    <PageContainer
      title="AI配置管理"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          新建AI配置
        </Button>
      }
    >
      <div style={{ marginBottom: 16 }}>
        <Form layout="inline" initialValues={searchParams}>
          <Form.Item name="keyword" label="关键词">
            <Input 
              placeholder="搜索配置名称" 
              style={{ width: 200 }}
              onChange={(e) => handleFieldChange('keyword', e.target.value)}
            />
          </Form.Item>
          <Form.Item>
            <Button icon={<ReloadOutlined />} onClick={fetchData}>
              刷新
            </Button>
          </Form.Item>
        </Form>
      </div>

      <Table
        loading={loading}
        dataSource={data}
        columns={columns}
        rowKey="config_id"
        pagination={{
          current: currentPage,
          pageSize: pageSize,
          total: total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条/共 ${total} 条`,
          onChange: (page, size) => {
            setCurrentPage(page);
            setPageSize(size);
          }
        }}
        scroll={{ x: 1400 }}
      />

      <Modal
        title={editingConfig ? '编辑AI配置' : '新建AI配置'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        width={600}
        okText="确定"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="name"
            label="配置名称"
            rules={[{ required: true, message: '请输入配置名称' }]}
          >
            <Input
              placeholder="请输入配置名称"
              maxLength={100}
            />
          </Form.Item>

          <Form.Item
            name="local_ai_base_url"
            label="AI服务基础URL"
            rules={[{ required: true, message: '请输入AI服务基础URL' }]}
          >
            <Input
              placeholder="请输入AI服务基础URL，例如：http://localhost:11434"
              maxLength={200}
            />
          </Form.Item>

          <Form.Item
            name="local_ai_api_key"
            label="AI服务API密钥"
            rules={[{ required: true, message: '请输入AI服务API密钥' }]}
          >
            <Input.Password
              placeholder="请输入AI服务API密钥"
              maxLength={100}
            />
          </Form.Item>

          <Form.Item
            name="local_ai_model_name"
            label="AI模型名称"
            rules={[{ required: true, message: '请输入AI模型名称' }]}
          >
            <Input
              placeholder="请输入AI模型名称，例如：llama3"
              maxLength={100}
            />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default AIConfigList;
