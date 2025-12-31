import React, {useState} from 'react'
import {Alert, Button, Card, Form, message, Select, Space, Table, Tag, Tooltip, Upload} from 'antd'
import {CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined, UploadOutlined} from '@ant-design/icons'
import {importTrendData} from '../api/endpoints'
import type {ColumnsType} from 'antd/es/table'
import { SYMBOLS } from '@/constants/symbols'

// 导入步骤枚举
type ImportStep = 'upload' | 'preview' | 'result'

// 导入结果类型
interface ImportResult {
  success: boolean
  message: string
  parsed_count: number
  skipped_count: number
  csv_saved: boolean
  csv_path?: string
}

// 预览数据类型
interface PreviewData {
  id: number
  date: string
  trend: string
  valid: boolean
  error?: string
}

// 表格列定义
const previewColumns: ColumnsType<PreviewData> = [
  {
    title: '序号',
    dataIndex: 'id',
    key: 'id',
    width: 60,
    align: 'center',
  },
  {
    title: '日期',
    dataIndex: 'date',
    key: 'date',
    width: 120,
    align: 'center',
    render: (text: string) => (
      <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{text}</span>
    )
  },
  {
    title: '趋势类型',
    dataIndex: 'trend',
    key: 'trend',
    width: 120,
    align: 'center',
    render: (trend: string) => {
      const trendConfig: { [key: string]: { color: string; label: string } } = {
        '上升': { color: 'green', label: '上升' },
        '下降': { color: 'red', label: '下降' },
        '横盘': { color: 'blue', label: '横盘' },
        '上涨': { color: 'green', label: '上涨' },
        '下跌': { color: 'red', label: '下跌' },
        '震荡': { color: 'orange', label: '震荡' }
      }
      const config = trendConfig[trend] || { color: 'default', label: trend }
      return (
        <Tag color={config.color}>
          {config.label}
        </Tag>
      )
    }
  },
  {
    title: '验证状态',
    key: 'validation',
    width: 100,
    align: 'center',
    render: (_, record: PreviewData) => (
      record.valid ? (
        <Tag icon={<CheckCircleOutlined />} color="success">
          有效
        </Tag>
      ) : (
        <Tooltip title={record.error}>
          <Tag icon={<CloseCircleOutlined />} color="error">
            无效
          </Tag>
        </Tooltip>
      )
    )
  }
]

const TrendImport: React.FC = () => {
  const [form] = Form.useForm()
  const [step, setStep] = useState<ImportStep>('upload')
  const [fileList, setFileList] = useState<any[]>([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [previewData, setPreviewData] = useState<any[]>([])

  // 重置导入状态
  const handleReset = () => {
    setStep('upload')
    setFileList([])
    setImporting(false)
    setImportResult(null)
    setPreviewData([])
    form.resetFields()
  }

  // 处理文件上传前的验证
  const beforeUpload = (file: File) => {
    const isExcelOrCsv = file.type.includes('excel') || file.type.includes('csv') || 
                        file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')
    if (!isExcelOrCsv) {
      message.error('只支持Excel和CSV文件格式（.xlsx, .xls, .csv）')
      return Upload.LIST_IGNORE
    }
    const isLt10M = file.size / 1024 / 1024 < 10
    if (!isLt10M) {
      message.error('文件大小不能超过10MB')
      return Upload.LIST_IGNORE
    }
    return false // 手动上传
  }

  // 处理文件列表变化
  const handleFileChange = ({ fileList }: any) => {
    setFileList(fileList)
  }

  // 预览趋势数据
  const handlePreview = async () => {
    try {
      setImporting(true)
      message.info('正在预览数据...')
      
      console.log('DEBUG: 开始预览过程...')
      console.log('DEBUG: 当前form实例:', form)
      console.log('DEBUG: 当前fileList:', fileList)
      
      // 直接从表单获取symbol值
      const formValues = await form.validateFields()
      console.log('DEBUG: 预览-表单验证后的所有值:', formValues)
      console.log('DEBUG: 预览-formValues类型:', typeof formValues)
      console.log('DEBUG: 预览-formValues键:', Object.keys(formValues))
      
      const symbol = formValues.symbol
      console.log('DEBUG: 预览-从formValues获取的symbol:', symbol)
      console.log('DEBUG: 预览-symbol类型:', typeof symbol)
      console.log('DEBUG: 预览-symbol是否为undefined:', symbol === undefined)
      console.log('DEBUG: 预览-symbol是否为null:', symbol === null)
      
      // 如果symbol为空，尝试从其他方式获取
      let finalSymbol = symbol
      if (!finalSymbol || finalSymbol === undefined || finalSymbol === null) {
        console.log('DEBUG: 预览-symbol为空，尝试其他方式获取...')
        finalSymbol = form.getFieldValue('symbol')
        console.log('DEBUG: 预览-使用getFieldValue获取的symbol:', finalSymbol)
        
        if (!finalSymbol || finalSymbol === undefined || finalSymbol === null) {
          console.log('DEBUG: 预览-尝试从Select组件直接获取值...')
          // 尝试通过DOM查找
          const selectElement = document.querySelector('.ant-select-selector input') as HTMLInputElement
          if (selectElement) {
            console.log('DEBUG: 预览-找到select元素:', selectElement.value)
            finalSymbol = selectElement.value
          }
        }
      }
      
      console.log('DEBUG: 预览-最终symbol值:', finalSymbol)
      
      if (!finalSymbol || finalSymbol === 'undefined') {
        throw new Error('无法获取有效的symbol参数，请确保已选择交易标的')
      }
      
      const formData = new FormData()
      formData.append('file', fileList[0].originFileObj)
      formData.append('symbol', finalSymbol)
      
      console.log('DEBUG: 预览-FormData创建完成，symbol:', finalSymbol)
      console.log('DEBUG: 预览-FormData entries:')
      for (let [key, value] of formData.entries()) {
        console.log(`  预览-${key}:`, value)
      }
      
      // 调用预览API
      const response = await fetch('/api/data-import/preview-trend-data', {
        method: 'POST',
        body: formData,
      })
      
      if (!response.ok) {
        throw new Error('预览失败')
      }
      
      const result = await response.json()
      setPreviewData(result.preview_data || [])
      setStep('preview')
      setImporting(false)
      message.success('数据预览完成')
    } catch (error: any) {
      console.error('DEBUG: 预览过程中的错误:', error)
      setImporting(false)
      message.error(`数据预览失败: ${error.message}`)
    }
  }

  // 执行趋势数据导入
  const handleImport = async () => {
    try {
      setImporting(true)
      message.info('正在导入趋势数据...')
      
      console.log('DEBUG: 开始导入过程...')
      console.log('DEBUG: 当前form实例:', form)
      console.log('DEBUG: 当前fileList:', fileList)
      
      // 直接从表单获取symbol值，确保参数正确传递
      const formValues = await form.validateFields()
      console.log('DEBUG: 表单验证后的所有值:', formValues)
      console.log('DEBUG: formValues类型:', typeof formValues)
      console.log('DEBUG: formValues键:', Object.keys(formValues))
      
      const symbol = formValues.symbol
      console.log('DEBUG: 从formValues获取的symbol:', symbol)
      console.log('DEBUG: symbol类型:', typeof symbol)
      console.log('DEBUG: symbol是否为undefined:', symbol === undefined)
      console.log('DEBUG: symbol是否为null:', symbol === null)
      
      // 如果symbol为空，尝试从其他方式获取
      let finalSymbol = symbol
      if (!finalSymbol || finalSymbol === undefined || finalSymbol === null) {
        console.log('DEBUG: symbol为空，尝试其他方式获取...')
        finalSymbol = form.getFieldValue('symbol')
        console.log('DEBUG: 使用getFieldValue获取的symbol:', finalSymbol)
        
        if (!finalSymbol || finalSymbol === undefined || finalSymbol === null) {
          console.log('DEBUG: 尝试从Select组件直接获取值...')
          // 尝试通过DOM查找
          const selectElement = document.querySelector('.ant-select-selector input') as HTMLInputElement
          if (selectElement) {
            console.log('DEBUG: 找到select元素:', selectElement.value)
            finalSymbol = selectElement.value
          }
        }
      }
      
      console.log('DEBUG: 最终symbol值:', finalSymbol)
      
      if (!finalSymbol || finalSymbol === 'undefined') {
        throw new Error('无法获取有效的symbol参数，请确保已选择交易标的')
      }
      
      const formData = new FormData()
      formData.append('file', fileList[0].originFileObj)
      formData.append('symbol', finalSymbol)
      
      console.log('DEBUG: FormData创建完成，symbol:', finalSymbol)
      console.log('DEBUG: FormData entries:')
      for (let [key, value] of formData.entries()) {
        console.log(`  ${key}:`, value)
      }
      
      const result = await importTrendData(formData)
      
      console.log('DEBUG: 导入结果:', result)
      
      setImportResult(result)
      setStep('result')
      setImporting(false)
      
      if (result.success) {
        message.success('趋势数据导入成功')
      } else {
        message.error('趋势数据导入失败')
      }
    } catch (error: any) {
      console.error('DEBUG: 导入过程中的错误:', error)
      setImporting(false)
      message.error(`导入失败: ${error.message || '未知错误'}`)
    }
  }

  return (
    <div className="trend-import-page">
      <Card title="趋势文件导入" className="import-card">
        {/* 上传文件步骤 */}
        {step === 'upload' && (
          <div className="upload-step">
            <Form
              form={form}
              layout="vertical"
              onFinish={handlePreview}
            >
              <Form.Item
                name="symbol"
                label="交易标的"
                rules={[{ required: true, message: '请选择交易标的' }]}
              >
                <Select placeholder="选择交易标的">
                  {SYMBOLS.map((symbol) => (
                    <Select.Option key={symbol} value={symbol}>
                      {symbol}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item name="file" label="趋势文件">
                <Upload
                  name="file"
                  fileList={fileList}
                  beforeUpload={beforeUpload}
                  onChange={handleFileChange}
                  multiple={false}
                  showUploadList={{ showRemoveIcon: true }}
                  customRequest={() => {}}
                >
                  <Button icon={<UploadOutlined />} disabled={importing}>
                    选择文件
                  </Button>
                  <span style={{ marginLeft: 8 }}>支持 .xlsx, .xls, .csv 格式，最大10MB</span>
                </Upload>
              </Form.Item>

              <Form.Item className="form-actions">
                <Space>
                  <Button type="primary" htmlType="submit" loading={importing}>
                    {importing ? (
                      <><LoadingOutlined /> 处理中...</>
                    ) : (
                      '下一步'
                    )}
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </div>
        )}

        {/* 预览数据步骤 */}
        {step === 'preview' && (
          <div className="preview-step">
            <div className="preview-info">
              <h3>数据预览</h3>
              <p>文件：{fileList[0]?.name || ''}</p>
              <p>交易标的：{form.getFieldValue('symbol') || ''}</p>
            </div>

            <div className="preview-data">
              <Alert
                message="提示"
                description="趋势数据将按照日期匹配，更新对应的K线记录。导入前请确保文件格式正确，每行格式为'YYYY年MM月DD日 趋势类型'。"
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
              
              <div className="preview-stats">
                <Space>
                  <div className="stat-item">
                    <div className="stat-label">总记录数</div>
                    <div className="stat-value">{previewData.length}</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label">有效记录</div>
                    <div className="stat-value valid">{previewData.filter(item => item.valid).length}</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-label">无效记录</div>
                    <div className="stat-value invalid">{previewData.filter(item => !item.valid).length}</div>
                  </div>
                </Space>
              </div>
              
              <div className="preview-table">
                <Table<PreviewData>
                  columns={previewColumns}
                  dataSource={previewData.slice(0, 10)}
                  rowKey="id"
                  pagination={false}
                  size="small"
                />
              </div>
            </div>

            <div className="preview-actions">
              <Space>
                <Button onClick={() => setStep('upload')}>
                  上一步
                </Button>
                <Button 
                  type="primary" 
                  onClick={handleImport} 
                  loading={importing}
                >
                  {importing ? (
                    <><LoadingOutlined /> 导入中...</>
                  ) : (
                    '开始导入'
                  )}
                </Button>
              </Space>
            </div>
          </div>
        )}

        {/* 导入结果步骤 */}
        {step === 'result' && importResult && (
          <div className="result-step">
            <div className="result-header">
              {importResult.success ? (
                <Alert
                  message="导入成功"
                  description={importResult.message}
                  type="success"
                  showIcon
                />
              ) : (
                <Alert
                  message="导入失败"
                  description={importResult.message}
                  type="error"
                  showIcon
                />
              )}
            </div>

            <div className="result-stats">
              <div className="stat-item">
                <div className="stat-label">有效数据</div>
                <div className="stat-value">{importResult.parsed_count} 条</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">跳过数据</div>
                <div className="stat-value">{importResult.skipped_count} 条</div>
              </div>
              <div className="stat-item total">
                <div className="stat-label">CSV保存状态</div>
                <div className="stat-value">{importResult.csv_saved ? '成功' : '失败'}</div>
              </div>
            </div>
            
            {importResult.csv_path && (
              <div className="csv-path-info">
                <Alert
                  message="CSV文件信息"
                  description={`趋势数据已保存至: ${importResult.csv_path}`}
                  type="info"
                  showIcon
                />
              </div>
            )}

            <div className="result-actions">
              <Space>
                <Button type="primary" onClick={handleReset}>
                  重新导入
                </Button>
              </Space>
            </div>
          </div>
        )}
      </Card>

      <style>{`
        .trend-import-page {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }
        
        .import-card {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }
        
        .form-actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 24px;
        }
        
        .upload-step {
          padding: 20px 0;
        }
        
        .preview-step {
          padding: 20px 0;
        }
        
        .preview-info {
          margin-bottom: 24px;
        }
        
        .preview-info h3 {
          margin: 0 0 16px 0;
          font-size: 18px;
          font-weight: 600;
        }
        
        .preview-info p {
          margin: 8px 0;
          color: #8c8c8c;
        }
        
        .preview-data {
          margin-bottom: 24px;
        }
        
        .preview-actions {
          display: flex;
          justify-content: flex-end;
        }
        
        .result-step {
          padding: 20px 0;
        }
        
        .result-header {
          margin-bottom: 24px;
        }
        
        .result-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-bottom: 24px;
        }
        
        .stat-item {
          background: #fafafa;
          padding: 20px;
          border-radius: 8px;
          text-align: center;
        }
        
        .stat-item.total {
          background: #e6f7ff;
          border: 1px solid #91d5ff;
        }
        
        .stat-label {
          font-size: 14px;
          color: #8c8c8c;
          margin-bottom: 8px;
        }
        
        .stat-value {
          font-size: 24px;
          font-weight: 600;
          color: #262626;
        }
        
        .result-actions {
          display: flex;
          justify-content: flex-end;
        }
        
        .preview-stats {
          margin-bottom: 16px;
        }
        
        .preview-stats .stat-item {
          background: #fafafa;
          padding: 12px 16px;
          border-radius: 6px;
          text-align: center;
          min-width: 80px;
        }
        
        .preview-stats .stat-label {
          font-size: 12px;
          color: #8c8c8c;
          margin-bottom: 4px;
        }
        
        .preview-stats .stat-value {
          font-size: 16px;
          font-weight: 600;
          color: #262626;
        }
        
        .preview-stats .stat-value.valid {
          color: #52c41a;
        }
        
        .preview-stats .stat-value.invalid {
          color: #ff4d4f;
        }
        
        .preview-table {
          border: 1px solid #f0f0f0;
          border-radius: 6px;
          overflow: hidden;
        }
        
        .csv-path-info {
          margin-top: 24px;
          margin-bottom: 24px;
        }
      `}</style>
    </div>
  )
}

export default TrendImport