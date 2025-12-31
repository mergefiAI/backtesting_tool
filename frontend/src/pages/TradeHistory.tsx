import React, {useEffect, useState} from 'react'
import {Button, Card, Checkbox, DatePicker, Form, message, Popover, Select} from 'antd'
import {ColumnWidthOutlined, ReloadOutlined} from '@ant-design/icons'
import DataTable from '../components/DataTable'
import {formatNoTimezoneISO, formatUTC} from '../utils/timezone'
import dayjs from 'dayjs'
import {fetchTasks, fetchTrades} from '../api/endpoints'
import {useQuery} from '@tanstack/react-query'
import {useSearchParams} from 'react-router-dom'
import {useDrawer} from '../components/DetailDrawer'

/**
 * 交易列表组件：支持账户/标的/方向/状态/时间范围搜索
 * 支持作为独立页面或子组件使用
 */
export default function TradeHistory({ taskId: externalTaskId, accountId: externalAccountId }: { taskId?: string; accountId?: string }) {
  const [params, setParams] = useSearchParams()
  const urlQuery = Object.fromEntries(params.entries())
  // 优先使用外部传入的参数，否则使用URL参数
  const { actions } = useDrawer()
  const [form] = Form.useForm()
  
  // 格式化数值，避免显示0E-8
  const formatNumber = (value: any) => {
    if (value === null || value === undefined) return '-';
    const num = Number(value);
    if (isNaN(num)) return '-';
    // 如果数值非常小（接近0），显示为0
    if (Math.abs(num) < 0.0000001) return '0';
    // 否则显示为普通数字格式
    return num.toString();
  };

  // 定义所有可显示的列配置
  const allColumns = [
    { key: 'trade_id', title: '交易ID', dataIndex: 'trade_id', visible: false },
    { key: 'task_id', title: '回测ID', dataIndex: 'task_id', visible: false, render: (value: string) => value || '-' },
    { key: 'account_id', title: '账户', dataIndex: 'account_id', visible: false },
    { key: 'stock_symbol', title: '标的', dataIndex: 'stock_symbol', visible: false },
    { key: 'trade_time', title: '时间', dataIndex: 'trade_time', visible: true, render: (v: string) => formatUTC(v) },
    { key: 'trade_action', title: '方向', dataIndex: 'trade_action', visible: true, render: (val: string) => <span style={{ color: val === 'BUY' ? 'green' : val === 'SHORT_SELL' ? 'red' : val === 'COVER_SHORT' ? 'blue' : 'red' }}>{val}</span> },
    { key: 'position_side', title: '持仓方向', dataIndex: 'position_side', visible: false },
    { key: 'quantity', title: '数量', dataIndex: 'quantity', visible: true },
    { key: 'price', title: '价格', dataIndex: 'price', visible: true },
    { key: 'total_fees', title: '费用', dataIndex: 'total_fees', visible: true },
    { key: 'total_amount', title: '总额', dataIndex: 'total_amount', visible: true },
    { key: 'margin_used_after', title: '保证金占用', dataIndex: 'margin_used_after', visible: false, render: formatNumber },
    { key: 'total_value_after', title: '总价值', dataIndex: 'total_value_after', visible: false, render: formatNumber },
    { key: 'remaining_quantity_after', title: '剩余持仓', dataIndex: 'remaining_quantity_after', visible: false, render: formatNumber },
    { key: 'avg_price_after', title: '持仓均价', dataIndex: 'avg_price_after', visible: false, render: formatNumber },
    { key: 'decision_id', title: '决策ID', dataIndex: 'decision_id', visible: false, render: (val: string) => <span style={{ fontSize: '12px', color: '#999' }}>{val || '-'}</span> }
  ]
  
  // 保存当前显示的列
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    allColumns.filter(col => col.visible).map(col => col.key)
  )
  
  // 排序状态管理
  const [sortField, setSortField] = useState<string>('trade_time')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  
  // 日期范围状态管理
  const [dateRange, setDateRange] = useState<{ start_date?: string; end_date?: string }>({
    start_date: (urlQuery as any).start_date,
    end_date: (urlQuery as any).end_date
  })
  
  // 处理排序变化
  const handleSortChange = (field: string, order: 'ascend' | 'descend' | null) => {
    if (!order) return
    
    setSortField(field)
    setSortOrder(order === 'ascend' ? 'asc' : 'desc')
  }
  
  // 合并外部参数和URL参数，外部参数优先
  const mergedQuery = {
    ...urlQuery,
    task_id: externalTaskId || (urlQuery as any).task_id,
    account_id: externalAccountId || (urlQuery as any).account_id,
    // 使用dateRange状态获取日期参数
    start_date: dateRange.start_date,
    end_date: dateRange.end_date,
    // 确保page和page_size是有效的数字
    page: parseInt((urlQuery as any).page || '1'),
    page_size: parseInt((urlQuery as any).page_size || '50'),
    // 添加排序参数
    sort_by: sortField,
    sort_order: sortOrder
  } as any
  
  console.log('TradeHistory组件渲染，合并参数:', mergedQuery); // 调试日志

  // 获取任务列表（不再按账户过滤）
  const { data: tasksData } = useQuery({
    queryKey: ['tasks'],
    queryFn: ({ signal }) => fetchTasks({ page: 1, page_size: 100 }, signal),
    enabled: true
  })

  // 确保page和page_size是有效的数字
  const safePage = parseInt((mergedQuery as any).page || '1') || 1
  const safePageSize = parseInt((mergedQuery as any).page_size || '50') || 50
  
  // 构建安全的API请求参数，移除undefined或无效的值
  const getSafeApiParams = () => {
    const params: any = {
      ...mergedQuery,
      page: safePage,
      page_size: safePageSize
    }
    
    // 移除undefined或无效的值
    if (params.account_id === undefined || params.account_id === 'undefined') {
      delete params.account_id
    }
    if (!params.start_date) {
      delete params.start_date
    }
    if (!params.end_date) {
      delete params.end_date
    }
    
    return params
  }
  
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['trades', mergedQuery, dateRange],
    queryFn: ({ signal }: { signal?: AbortSignal }) => {
      const safeApiParams = getSafeApiParams()
      return fetchTrades(safeApiParams, signal)
    },
    enabled: !!mergedQuery.task_id
  })

  // 初始化参数至表单
  useEffect(() => {
    form.setFieldsValue({
      task_id: mergedQuery.task_id || undefined,
      start_date: mergedQuery.start_date ? dayjs(mergedQuery.start_date) : undefined,
      end_date: mergedQuery.end_date ? dayjs(mergedQuery.end_date) : undefined,
    })
  }, [mergedQuery, form])

  // 处理表单值变化，自动搜索
  const handleValuesChange = (_changedValues: any, allValues: any) => {
    // 总是更新日期参数，无论是否是子组件
    const newDateRange = {
      start_date: allValues.start_date ? formatNoTimezoneISO(allValues.start_date) : undefined,
      end_date: allValues.end_date ? formatNoTimezoneISO(allValues.end_date) : undefined
    }
    
    // 更新日期范围状态
    setDateRange(newDateRange)
    
    // 如果是独立页面，更新URL参数
    if (!externalTaskId) {
      const nextQuery: Record<string, string> = {
        ...urlQuery,
        task_id: allValues.task_id || '',
        page: '1'
      }
      
      if (newDateRange.start_date) {
        nextQuery.start_date = newDateRange.start_date
      }
      if (newDateRange.end_date) {
        nextQuery.end_date = newDateRange.end_date
      }
      
      const next = new URLSearchParams(nextQuery)
      setParams(next, { replace: true })
    }
    
    // 刷新数据
    refetch()
  }

  const handleRefresh = () => {
    // 刷新数据
    refetch()
  }

  const handlePaginationChange = (page: number, pageSize: number) => {
    // 构建包含最新日期的查询参数
    const nextQuery = {
      ...mergedQuery,
      page: String(page),
      page_size: String(pageSize)
    }
    
    // 如果是独立页面，更新URL参数
    if (!externalTaskId) {
      const next = new URLSearchParams(nextQuery)
      setParams(next, { replace: true })
    }
    
    // 刷新数据
    refetch()
  }

  // 移除账户选择逻辑

  // 处理任务选择变化
  const handleTaskChange = (taskId: string) => {
    // 如果是外部传入了taskId，不允许通过表单修改
    if (externalTaskId) return
    
    const task = tasksData?.items?.find((t: any) => t.task_id === taskId)
    if (taskId && task) {
      form.setFieldsValue({ task_id: taskId })
    } else {
      form.setFieldsValue({ task_id: undefined })
    }
  }

  // 处理列选择变化
  const handleColumnsChange = (checkedValues: string[]) => {
    setVisibleColumns(checkedValues)
  }

  // 处理查看关联决策点击
  const handleViewDecision = (trade: any) => {
    console.log('🎯 [TradeHistory] 点击查看关联决策:', {
      tradeId: trade.trade_id,
      hasDecisionId: !!trade.decision_id,
      decisionId: trade.decision_id
    });
    
    if (!trade.decision_id) {
      console.warn('⚠️ [TradeHistory] 交易记录无决策ID:', trade);
      message.warning('该交易没有关联的决策记录')
      return
    }

    console.log('📖 [TradeHistory] 准备打开抽屉:', {
      type: 'local-decision',
      id: trade.decision_id
    });
    
    actions.openDrawer('local-decision', trade.decision_id)
    
    console.log('✅ [TradeHistory] 抽屉打开指令已发送');
  }

  // Initialize form values
  const initialValues = {
    ...mergedQuery,
    start_date: mergedQuery.start_date ? dayjs(mergedQuery.start_date) : undefined,
    end_date: mergedQuery.end_date ? dayjs(mergedQuery.end_date) : undefined,
  };

  // 动态生成columns，根据visibleColumns过滤
  const columns = [
    // 先添加所有可见的数据列
    ...allColumns
      .filter(col => visibleColumns.includes(col.key))
      .map(col => ({
        title: col.title,
        dataIndex: col.dataIndex,
        key: col.key,
        render: col.render,
        // 添加排序配置
        sorter: true,
        sortOrder: sortField === col.dataIndex ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null,
        // 处理排序点击事件
        onHeaderCell: (column: any) => ({
          onClick: (e: any) => {
            // 切换排序方向
            const currentOrder = sortField === column.dataIndex ? sortOrder : 'asc'
            const newOrder = currentOrder === 'asc' ? 'desc' : 'asc'
            setSortField(column.dataIndex)
            setSortOrder(newOrder)
          },
          style: {
            cursor: 'pointer'
          }
        })
      })),
    // 固定添加操作列
    { 
      title: '操作', 
      key: 'action',
      render: (_: any, row: any) => (
        <Button 
          type="link" 
          onClick={() => handleViewDecision(row)}
          disabled={!row.decision_id}
        >
          查看关联决策
        </Button>
      ) 
    }  
  ]

  // 列选择器的内容
  const columnSelectorContent = (
    <Checkbox.Group
      options={allColumns.map(col => ({
        label: col.title,
        value: col.key
      }))}
      value={visibleColumns}
      onChange={handleColumnsChange}
    />
  )

  console.log('TradeHistory数据状态:', { 
    isLoading, 
    hasData: !!data?.items?.length,
    itemCount: data?.items?.length 
  }); // 调试日志

  return (
    <Card 
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>交易列表</span>
          <Popover content={columnSelectorContent} title="选择显示列" trigger="click">
            <Button icon={<ColumnWidthOutlined />} type="text" size="small">
              自定义列
            </Button>
          </Popover>
        </div>
      }
    >
      {/* 简化的搜索表单：仅保留回测ID与起止时间 */}
      <Form 
        form={form} 
        layout="inline" 
        initialValues={initialValues}
        onValuesChange={handleValuesChange}
        style={{ marginBottom: 16 }}
      >
        <Form.Item name="task_id" label="回测ID">
          <Select
            placeholder="选择回测"
            allowClear
            showSearch
            style={{ width: 350 }}
            filterOption={(input, option) =>
              (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
            }
            onChange={handleTaskChange}
          >
             {tasksData?.items?.map((task: any) => (
              <Select.Option key={task.task_id} value={task.task_id}>
                              {task.task_id} - {task.stock_symbol || '未知股票'} - {dayjs(task.start_date).format('YYYY-MM-DD HH:mm')} - {dayjs(task.end_date).format('YYYY-MM-DD HH:mm')}
                             </Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item name="start_date" label="开始时间">
          <DatePicker 
            placeholder="开始时间" 
            style={{ width: 150 }}
          />
        </Form.Item>
        <Form.Item name="end_date" label="结束时间">
          <DatePicker 
            placeholder="结束时间" 
            style={{ width: 150 }}
          />
        </Form.Item>
        <Form.Item>
          <Button 
            type="default" 
            icon={<ReloadOutlined />} 
            onClick={handleRefresh}
            title="刷新数据"
          >
            刷新
          </Button>
        </Form.Item>
      </Form>
      <DataTable 
        columns={columns} 
        data={data?.items} 
        loading={isLoading} 
        rowKey="trade_id"
        pagination={{
          current: data?.page || parseInt((mergedQuery as any).page || '1'),
          pageSize: data?.page_size || parseInt((mergedQuery as any).page_size || '50'),
          total: data?.total || 0,
          showQuickJumper: true,
          showSizeChanger: true,
          onChange: handlePaginationChange,
          onShowSizeChange: handlePaginationChange,
          pageSizeOptions: ['20', '50', '100', '200']
        }}
      />
    </Card>
  )
}
