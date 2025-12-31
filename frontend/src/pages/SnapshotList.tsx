import React, { useEffect } from 'react'
import {Button, Card, DatePicker, Form, message, Popconfirm, Select, Space} from 'antd'
import {ReloadOutlined} from '@ant-design/icons'
import dayjs from 'dayjs'
import {formatNoTimezoneISO, formatUTC} from '../utils/timezone'
import DataTable from '../components/DataTable'
import {fetchSnapshots, fetchTasks} from '../api/endpoints'
import {useQuery} from '@tanstack/react-query'
import {useSearchParams} from 'react-router-dom'
import {api} from '../api/client'
import {useDrawer} from '../components/DetailDrawer'

/**
 * 快照列表页：查询与删除快照记录
 */
export default function SnapshotList() {
  const [params, setParams] = useSearchParams()
  const query = Object.fromEntries(params.entries())
  const { actions } = useDrawer()
  const [form] = Form.useForm()

  // 任务列表（用于按task_id筛选）- 只显示决策任务
  const { data: tasksData } = useQuery({
    queryKey: ['tasks', 'snapshot-list'],
    queryFn: ({ signal }) => fetchTasks({ page: 1, page_size: 100, type: 'LocalDecision' }, signal),
    enabled: true
  })

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['snapshots', query],
    queryFn: ({ signal }) => fetchSnapshots({
      ...query,
      page: parseInt((query as any).page || '1'),
      page_size: parseInt((query as any).page_size || '50')
    }, signal),
    enabled: !!query.task_id
  })

  // 监听URL参数变化，自动触发重新查询
  useEffect(() => {
    if (query.task_id) {
      refetch()
    }
  }, [query.task_id, query.start_date, query.end_date])

  // 表单变更即搜索，仅保留 task_id、start_date、end_date
  const handleValuesChange = () => {
    const allValues = form.getFieldsValue()
    const nextQuery: Record<string, string> = {}
    if (allValues.task_id) nextQuery.task_id = allValues.task_id
    if (allValues.date_range && allValues.date_range.length === 2) {
      nextQuery.start_date = allValues.date_range[0].utc().format('YYYY-MM-DDTHH:mm:ss')
      nextQuery.end_date = allValues.date_range[1].utc().format('YYYY-MM-DDTHH:mm:ss')
    }
    setParams(nextQuery, { replace: true })
  }

  const handleRefresh = () => {
    refetch()
  }

  const handlePaginationChange = (page: number, pageSize: number) => {
    const next = new URLSearchParams({
      ...query,
      page: String(page),
      page_size: String(pageSize)
    })
    setParams(next, { replace: true })
    refetch()
  }

  const onDelete = async (id: string) => {
    try {
      const { data } = await api.delete(`/api/account/snapshot/${id}`)
      if (data?.code === 200) {
        message.success('已删除')
        refetch()
      } else {
        message.error(data?.msg || '删除失败')
      }
    } catch {
      message.error('删除失败')
    }
  }

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

  const columns = [
    { title: '快照ID', dataIndex: 'snapshot_id',hidden: true },
    { title: '账户', dataIndex: 'account_id',hidden: true },
    { title: '市场类型', dataIndex: 'market_type',hidden: true },
    { title: '标的', dataIndex: 'stock_symbol',hidden: true },
    { title: '时间', dataIndex: 'timestamp', render: (v: string) => formatUTC(v) },
    { title: '余额', dataIndex: 'balance', render: formatNumber },
    { title: '可用余额', dataIndex: 'available_balance', render: formatNumber },
    { title: '保证金', dataIndex: 'margin_used', render: formatNumber },
    { title: '持仓', dataIndex: 'stock_quantity', render: formatNumber },
    { title: '价格', dataIndex: 'stock_price', render: formatNumber },
    { title: '持仓市值', dataIndex: 'stock_market_value', render: formatNumber },
    { title: '累计费用', dataIndex: 'total_fees', render: formatNumber },
    { title: '总价值', dataIndex: 'total_value', render: formatNumber },
    { title: '盈亏', dataIndex: 'profit_loss', render: formatNumber },
    {
      title: '操作',
      render: (_: any, row: any) => (
        <Space size="middle">
          <Button type="link" onClick={() => actions.openDrawer('snapshot', row.snapshot_id)}>查看详情</Button>
          <Popconfirm title="确认删除该快照？" onConfirm={() => onDelete(row.snapshot_id)}>
            <Button danger type="link">删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <Card title="快照列表">
      <Form 
        form={form}
        layout="inline"
        initialValues={{
          task_id: (query as any).task_id,
          date_range: (query as any).start_date && (query as any).end_date 
            ? [dayjs((query as any).start_date), dayjs((query as any).end_date)] 
            : undefined
        }}
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
          >
            {tasksData?.items?.map((task: any) => (
             <Select.Option key={task.task_id} value={task.task_id}>
                             {task.task_id} - {task.stock_symbol || '未知股票'} - {dayjs(task.start_date).format('YYYY-MM-DD HH:mm')} - {dayjs(task.end_date).format('YYYY-MM-DD HH:mm')}
                            </Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item name="date_range" label="时间区间">
          <DatePicker.RangePicker placeholder={['开始时间', '结束时间']} style={{ width: 280 }} />
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
        rowKey="snapshot_id"
        pagination={{
          current: data?.page || parseInt((query as any).page || '1'),
          pageSize: data?.page_size || parseInt((query as any).page_size || '50'),
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
