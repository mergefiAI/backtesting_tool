import React, {useEffect, useState} from 'react';
import {
    Alert,
    Button,
    Card,
    message as antdMessage,
    Progress,
    Space,
    Steps,
    Table,
    Tag,
    Tooltip,
    Typography,
    Upload
} from 'antd';
import {
    CheckCircleOutlined,
    CloseCircleOutlined,
    CloudUploadOutlined,
    DeleteOutlined,
    DownOutlined,
    FileTextOutlined,
    QuestionCircleOutlined,
    RightOutlined,
    SyncOutlined
} from '@ant-design/icons';
import {api} from '../../api/client';
import type {UploadProps} from 'antd/es/upload/interface';
import {RcFile} from 'antd/es/upload';
import type {ColumnsType} from 'antd/es/table';

const { Dragger } = Upload;
const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;

// ------------------------------------------------------------------
// 类型定义
// ------------------------------------------------------------------

export type ImportStep = 'upload' | 'select_table' | 'mapping' | 'preview' | 'result';
export type StepStatus = 'pending' | 'processing' | 'completed' | 'error';

export interface StepInfo {
  step: ImportStep;
  status: StepStatus;
  message: string;
}

export interface ExtendedFile {
  uid: string;
  file: File;
  name: string;
  size: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  currentStep: ImportStep;
  steps: StepInfo[];
  errorMessage?: string;
  response?: any;
}

interface FileUploadProps {
  onFileUploaded: (data: any) => void;
  onFileCountChange?: (count: number) => void;
  onFileRemoved?: (fileName: string) => void;
}

// 常量定义
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

/**
 * 初始化导入步骤状态
 */
const initializeSteps = (): StepInfo[] => [
  { step: 'upload', status: 'pending', message: '等待上传' },
  { step: 'select_table', status: 'pending', message: '等待选择表' },
  { step: 'mapping', status: 'pending', message: '等待列映射' },
  { step: 'preview', status: 'pending', message: '等待数据预览' },
  { step: 'result', status: 'pending', message: '等待导入结果' }
]

/**
 * CSV文件上传组件
 * 仅负责文件上传和CSV数据解析，上传完成后传递数据给父组件
 */
const FileUpload: React.FC<FileUploadProps> = ({ onFileUploaded, onFileCountChange, onFileRemoved }) => {
  // 状态管理
  const [fileList, setFileList] = useState<ExtendedFile[]>([]);

  // 辅助函数
  const updateFile = (uid: string, updates: Partial<ExtendedFile>) => {
    setFileList(prev => prev.map(item => 
      item.uid === uid ? { ...item, ...updates } : item
    ));
  };

  // 处理文件上传
  const processFile = async (fileItem: ExtendedFile) => {
    const { uid, file } = fileItem;

    try {
      // 1. 开始上传
      updateFile(uid, { 
        status: 'uploading', 
        progress: 0, 
        errorMessage: undefined,
        currentStep: 'upload',
        steps: [
          { step: 'upload', status: 'processing', message: '正在上传...' },
          { step: 'select_table', status: 'pending', message: '等待选择表' },
          { step: 'mapping', status: 'pending', message: '等待列映射' },
          { step: 'preview', status: 'pending', message: '等待数据预览' },
          { step: 'result', status: 'pending', message: '等待导入结果' }
        ]
      });

      const formData = new FormData();
      formData.append('file', file);

      // 2. 调用API上传文件
      const response = await api.post('/api/data-import/upload-csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            updateFile(uid, { progress: percent });
          }
        },
        timeout: 60000, // 60秒超时
      });

      // 3. 上传完成，返回数据给父组件
      const csvData = {
        ...response.data,
        headers: response.data.headers || [],
        sampleData: response.data.sample_data || [],
        totalRows: response.data.total_rows || 0
      };

      updateFile(uid, { 
        status: 'success', 
        progress: 100,
        currentStep: 'select_table',
        steps: [
          { step: 'upload', status: 'completed', message: '上传成功' },
          { step: 'select_table', status: 'processing', message: '准备选择表' },
          { step: 'mapping', status: 'pending', message: '等待列映射' },
          { step: 'preview', status: 'pending', message: '等待数据预览' },
          { step: 'result', status: 'pending', message: '等待导入结果' }
        ],
        response: csvData 
      });
      
      // 调用回调函数，传递CSV数据给父组件
      onFileUploaded({ file, ...csvData });
      antdMessage.success(`${fileItem.name}: 上传成功，共 ${csvData.totalRows || 0} 行数据`);

    } catch (error: any) {
      console.error('File processing failed:', error);
      
      // 详细的错误信息处理
      let errorMsg = '上传失败';
      if (error.code === 'ECONNABORTED') {
        errorMsg = '上传超时，请检查网络连接或文件大小';
      } else if (error.response?.data?.detail) {
        errorMsg = error.response.data.detail;
      } else if (error.response?.data?.msg) {
        errorMsg = error.response.data.msg;
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      // 更新文件状态为错误
      updateFile(uid, { 
        status: 'error', 
        errorMessage: errorMsg,
        currentStep: 'upload',
        steps: [
          { step: 'upload', status: 'error', message: errorMsg },
          { step: 'select_table', status: 'pending', message: '等待选择表' },
          { step: 'mapping', status: 'pending', message: '等待列映射' },
          { step: 'preview', status: 'pending', message: '等待数据预览' },
          { step: 'result', status: 'pending', message: '等待导入结果' }
        ]
      });
      
      // 显示错误信息
      antdMessage.error(`${fileItem.name}: ${errorMsg}`);
    }
  };



  // 上传前验证
  const beforeUpload = (file: RcFile) => {
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      antdMessage.error(`${file.name} 不是 CSV 文件`);
      return Upload.LIST_IGNORE;
    }

    if (file.size > MAX_FILE_SIZE) {
      antdMessage.error(`${file.name} 超过大小限制 (100MB)`);
      return Upload.LIST_IGNORE;
    }

    const newFile: ExtendedFile = {
      uid: file.uid,
      file: file,
      name: file.name,
      size: file.size,
      status: 'pending',
      progress: 0,
      currentStep: 'upload',
      steps: [
        { step: 'upload', status: 'pending', message: '等待上传' },
        { step: 'select_table', status: 'pending', message: '等待选择表' },
        { step: 'mapping', status: 'pending', message: '等待列映射' },
        { step: 'preview', status: 'pending', message: '等待数据预览' },
        { step: 'result', status: 'pending', message: '等待导入结果' }
      ]
    };

    setFileList(prev => {
      const newCount = prev.length + 1;
      onFileCountChange?.(newCount);
      return [...prev, newFile];
    });
    
    return false;
  };

  // 移除文件
  const removeFile = (uid: string) => {
    setFileList(prev => {
      const fileToRemove = prev.find(f => f.uid === uid);
      const newList = prev.filter(f => f.uid !== uid);
      onFileCountChange?.(newList.length);
      
      // 通知父组件文件已被删除
      if (fileToRemove) {
        onFileRemoved?.(fileToRemove.name);
      }
      
      return newList;
    });
  };

  // 上传配置
  const uploadProps: UploadProps = {
    name: 'file',
    multiple: true,
    showUploadList: false,
    beforeUpload: beforeUpload,
    accept: '.csv'
  };

  // 表格列定义
  const columns: ColumnsType<ExtendedFile> = [
    {
      title: '文件名',
      dataIndex: 'name',
      key: 'name',
      render: (text) => (
        <Space>
          <FileTextOutlined style={{ color: '#1890ff' }} />
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      render: (size) => (size / 1024 / 1024).toFixed(2) + ' MB',
      width: '100px',
    },
    {
      title: '状态',
      key: 'status',
      render: (_, record) => {
        if (record.status === 'pending') return <Tag>等待中</Tag>;
        if (record.status === 'uploading') return <Tag color="processing" icon={<SyncOutlined spin />}>处理中</Tag>;
        if (record.status === 'success') return <Tag color="success" icon={<CheckCircleOutlined />}>上传成功</Tag>;
        if (record.status === 'error') return (
          <Tooltip title={record.errorMessage}>
            <Tag color="error" icon={<CloseCircleOutlined />}>失败</Tag>
          </Tooltip>
        );
        return null;
      },
      width: '120px',
    },
    {
      title: '进度',
      key: 'progress',
      render: (_, record) => {
        if (record.status === 'pending') return <Progress percent={0} size="small" />;
        
        // 成功状态显示结果
        if (record.status === 'success') {
           return <Text type="success">上传成功，准备选择表</Text>;
        }

        return (
          <Space direction="vertical" style={{ width: '100%' }} size={0}>
             <Progress 
               percent={record.progress} 
               status={record.status === 'error' ? 'exception' : 'active'}
               size="small"
             />
             <Text type="secondary" style={{ fontSize: 12 }}>
               {record.steps.find(s => s.step === record.currentStep)?.message || '准备就绪'}
             </Text>
          </Space>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          {/* 开始导入按钮 */}
          {(record.status === 'pending' || record.status === 'error') && (
            <Tooltip title="开始上传">
              <Button 
                type="primary" 
                size="small"
                icon={<CloudUploadOutlined />} 
                onClick={() => processFile(record)}
              >
                开始上传
              </Button>
            </Tooltip>
          )}
          
          {/* 移除按钮 */}
          <Tooltip title="移除">
            <Button 
              type="text" 
              danger 
              icon={<DeleteOutlined />} 
              onClick={() => removeFile(record.uid)}
              disabled={record.status === 'uploading'}
            />
          </Tooltip>
        </Space>
      ),
      width: '150px',
    },
  ];

  return (
    <div style={{ padding: 20 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 上传按钮区 */}
        <Card>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div>
              <Text strong style={{ fontSize: 16 }}>CSV数据导入 - 第一步：文件上传</Text>
              <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                支持批量选择 .csv 文件，单个文件最大 100MB
              </Text>
            </div>
            
            <Upload {...uploadProps}>
              <Button type="primary" icon={<CloudUploadOutlined />} size="large" style={{ width: '100%' }}>
                选择 CSV 文件上传
              </Button>
            </Upload>
          </Space>
        </Card>

        {/* 文件列表区 */}
        {fileList.length > 0 && (
          <Card 
            title={
              <Text strong>文件列表 ({fileList.length})</Text>
            }
          >
            <Table 
              columns={columns} 
              dataSource={fileList} 
              rowKey="uid" 
              pagination={false}
              size="middle"
            />
          </Card>
        )}
      </Space>
    </div>
  );
};

export default FileUpload;
