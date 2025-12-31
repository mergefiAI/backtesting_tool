import React, {useEffect} from 'react'
import {Button, Card, DatePicker, Form, Select, Space} from 'antd'
import {ReloadOutlined} from '@ant-design/icons'
import DataTable from '../components/DataTable'
import dayjs from 'dayjs'
import {formatNoTimezoneISO} from '../utils/timezone'

import {fetchLocalDecisions, fetchTasks} from '../api/endpoints'
import {useQuery} from '@tanstack/react-query'
import {useSearchParams} from 'react-router-dom'
import {useDrawer} from '../components/DetailDrawer'

/**
 * 本地决策列表页：支持搜索与跳转至交易列表
 */
export default function LocalDecisionList() {
  const [params, setParams] = useSearchParams()
  const { actions } = useDrawer()
  const query = Object.fromEntries(params.entries())
  const [form] = Form.useForm()
  
  // 获取任务列表（不再按账户过滤）- 只显示决策任务
  const { data: tasksData } = useQuery({
    queryKey: ['tasks'],
    queryFn: ({ signal }) => fetchTasks({ page: 1, page_size: 100 }, signal),
    enabled: true
  })

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['local-decisions', query],
    queryFn: ({ signal }) => fetchLocalDecisions({
      ...query,
      page: parseInt((query as any).page || '1'),
      page_size: parseInt((query as any).page_size || '50')
    }, signal),
    enabled: !!query.task_id
  })

  // 初始化URL参数至表单
  useEffect(() => {
    form.setFieldsValue({
      task_id: query.task_id || undefined,
      start_date: query.start_date ? dayjs(query.start_date) : undefined,
      end_date: query.end_date ? dayjs(query.end_date) : undefined,
    })
  }, [query, form])

  // 移除账户同步逻辑

  // 处理表单值变化，自动搜索
  const handleValuesChange = (_changedValues: any, allValues: any) => {
    const nextQuery: Record<string, string> = {}
    if (allValues.task_id) nextQuery.task_id = allValues.task_id
    if (allValues.start_date) nextQuery.start_date = formatNoTimezoneISO(allValues.start_date)
    if (allValues.end_date) nextQuery.end_date = formatNoTimezoneISO(allValues.end_date)
    nextQuery.page = '1'
    const next = new URLSearchParams(nextQuery)
    setParams(next, { replace: true })
    refetch()
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

  // 移除账户选择逻辑

  // 处理任务选择变化
  const handleTaskChange = (taskId: string) => {
    const task = tasksData?.items?.find((t: any) => t.task_id === taskId)
    if (taskId && task) {
      form.setFieldsValue({ task_id: taskId })
    } else {
      form.setFieldsValue({ task_id: undefined })
    }
  }

  const columns = [
    { title: '决策ID', dataIndex: 'decision_id',hidden: false },
    { title: '回测ID', dataIndex: 'task_id',hidden: true },
    { title: '账户', dataIndex: 'account_id',hidden: true },
    { title: '标的', dataIndex: 'stock_symbol',hidden: false },
    { title: '结果', dataIndex: 'decision_result' },
    { title: '置信度', dataIndex: 'confidence_score',hidden: false },
    { 
      title: '耗时', 
      dataIndex: 'execution_time_ms',
      render: (value: number) => {
        if (!value) return '-'
        if (value < 1000) {
          return `${value}ms`
        } else {
          return `${(value / 1000).toFixed(2)}s`
        }
      },
      hidden: false
    },
    {
      title: '操作',
      render: (_: any, row: any) => (
        <Space size="middle">
          <Button type="link" onClick={() => actions.openDrawer('local-decision', row.decision_id)}>查看详情</Button>
          <Button type="link" onClick={() => actions.openDrawer('trade', row.decision_id)}>查看关联交易</Button>
          {/* 远程策略已移除 */}
        </Space>
      ),
      hidden: false
    }
  ]

  return (
    <>
      <Card title="本地决策列表">
        <Form 
          form={form} 
          layout="inline" 
          initialValues={query}
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
          rowKey="decision_id"
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

    </>
  )
}
