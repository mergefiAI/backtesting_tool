import React from 'react'
import {Button, DatePicker, Form, Input, Select, Space} from 'antd'
import {ReloadOutlined, SearchOutlined} from '@ant-design/icons'
import {formatNoTimezoneISO} from '../utils/timezone'

type Props = {
  initial?: Record<string, any>
  onSubmit: (values: Record<string, any>) => void
  onRefresh?: () => void
  accounts?: Array<{ account_id: string; stock_symbol: string }>
  onAccountChange?: (account: any) => void
  simplified?: boolean // 是否为简化模式（只显示账户选择）
  autoSearch?: boolean // 是否开启自动搜索（改动即搜）
}

/**
 * 通用搜索表单组件：读取初始值并在提交时返回标准化参数
 */
export default function SearchForm({ 
  initial, 
  onSubmit, 
  onRefresh, 
  accounts, 
  onAccountChange, 
  simplified = false, 
  autoSearch = false 
}: Props) {
  const [form] = Form.useForm()

  React.useEffect(() => {
    if (initial) form.setFieldsValue(initial)
  }, [initial])

  // 自动搜索逻辑：当autoSearch为true时，表单值变化时自动搜索
  const handleValuesChange = (changedValues: any, allValues: any) => {
    if (!autoSearch) return
    
    // 过滤掉空值和undefined值
    const payload: Record<string, any> = Object.entries(allValues)
      .filter(([_, value]) => value !== undefined && value !== null && value !== '' && value !== 'undefined')
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {})
    
    if (payload.start_date) payload.start_date = formatNoTimezoneISO(payload.start_date)
    if (payload.end_date) payload.end_date = formatNoTimezoneISO(payload.end_date)
    
    onSubmit(payload)
  }

  const handleManualSearch = () => {
    const vals = form.getFieldsValue()
    // 过滤掉空值和undefined值
    const payload: Record<string, any> = Object.entries(vals)
      .filter(([_, value]) => value !== undefined && value !== null && value !== '' && value !== 'undefined')
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {})
    
    if (payload.start_date) payload.start_date = formatNoTimezoneISO(payload.start_date)
    if (payload.end_date) payload.end_date = formatNoTimezoneISO(payload.end_date)
    onSubmit(payload)
  }

  const handleAccountChange = (accountId: string | null) => {
    // 查找选中的账户信息
    if (accountId) {
      const selectedAccount = accounts?.find(acc => acc.account_id === accountId)
      if (selectedAccount && onAccountChange) {
        onAccountChange(selectedAccount)
      }
    } else {
      // 当清除选择时，调用onAccountChange并传递null，触发列表更新
      if (onAccountChange) {
        onAccountChange(null)
      }
    }
  }

  // 如果是简化模式，只显示账户选择框
  if (simplified) {
    return (
      <Form form={form} layout="inline" onValuesChange={autoSearch ? handleValuesChange : undefined}>
        <Form.Item name="account_id">
          <Select 
            placeholder="选择账户" 
            allowClear 
            showSearch
            style={{ width: 300 }}
            filterOption={(input, option) =>
              (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
            }
            onChange={handleAccountChange}
          >
            {accounts?.map(account => (
              <Select.Option key={account.account_id} value={account.account_id}>
                {account.account_id}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item>
          <Space>
            {onRefresh && (
              <Button 
                type="default" 
                icon={<ReloadOutlined />} 
                onClick={onRefresh}
                title="刷新数据"
              >
                刷新
              </Button>
            )}
            {!autoSearch && (
              <Button 
                type="primary" 
                icon={<SearchOutlined />} 
                onClick={handleManualSearch}
                title="手动搜索"
              >
                搜索
              </Button>
            )}
          </Space>
        </Form.Item>
      </Form>
    )
  }

  // 完整模式显示所有搜索条件
  return (
    <Form form={form} layout="inline" onValuesChange={autoSearch ? handleValuesChange : undefined}>
      <Form.Item name="account_id">
        <Select 
          placeholder="选择账户" 
          allowClear 
          showSearch
          style={{ width: 220 }}
          filterOption={(input, option) =>
            (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
          }
          onChange={handleAccountChange}
        >
          {accounts?.map(account => (
            <Select.Option key={account.account_id} value={account.account_id}>
              {account.account_id}
            </Select.Option>
          ))}
        </Select>
      </Form.Item>
      <Form.Item name="stock_symbol"><Input placeholder="标的" allowClear style={{ width: 120 }} /></Form.Item>
      <Form.Item name="decision_id"><Input placeholder="决策ID" allowClear style={{ width: 160 }} /></Form.Item>
      <Form.Item name="start_date"><DatePicker placeholder="开始时间" /></Form.Item>
      <Form.Item name="end_date"><DatePicker placeholder="结束时间" /></Form.Item>
      <Form.Item>
        <Space>
          {onRefresh && (
            <Button 
              type="default" 
              icon={<ReloadOutlined />} 
              onClick={onRefresh}
              title="刷新数据"
            >
              刷新
            </Button>
          )}
          {!autoSearch && (
            <Button 
              type="primary" 
              icon={<SearchOutlined />} 
              onClick={handleManualSearch}
              title="手动搜索"
            >
              搜索
            </Button>
          )}
        </Space>
      </Form.Item>
    </Form>
  )
}
