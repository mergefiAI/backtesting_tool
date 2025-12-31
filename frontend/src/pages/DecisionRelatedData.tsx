import React, {useEffect} from 'react'
import {Button, Card, DatePicker, Form, Select} from 'antd'
import {ReloadOutlined} from '@ant-design/icons'
import dayjs from 'dayjs'
import {formatNoTimezoneISO} from '../utils/timezone'
import {fetchTasks} from '../api/endpoints'
import {useQuery} from '@tanstack/react-query'
import {useSearchParams} from 'react-router-dom'
import DecisionDataTable from '../components/DecisionDataTable'

/**
 * 决策关联数据页面：主行全量展示决策、账户快照和交易信息
 */
export default function DecisionRelatedData({ taskId: externalTaskId }: { taskId?: string }) {
  const [params, setParams] = useSearchParams()
  const query = Object.fromEntries(params.entries())
  const [form] = Form.useForm()
  
  // 获取任务列表
  const { data: tasksData } = useQuery({
    queryKey: ['tasks'],
    queryFn: ({ signal }) => fetchTasks({ page: 1, page_size: 100 }, signal),
    enabled: true
  })

  // 初始化URL参数至表单
  useEffect(() => {
    const taskIdToUse = externalTaskId || query.task_id || undefined
    form.setFieldsValue({
      task_id: taskIdToUse,
      date_range: (query.start_date && query.end_date) ? [
        dayjs(query.start_date), 
        dayjs(query.end_date)
      ] : undefined,
    })
  }, [query, form, externalTaskId])

  // 处理表单值变化，自动搜索
  const handleValuesChange = (_changedValues: any, allValues: any) => {
    const nextQuery: Record<string, string> = {}
    if (allValues.task_id) nextQuery.task_id = allValues.task_id
    if (allValues.date_range && allValues.date_range.length === 2) {
      nextQuery.start_date = formatNoTimezoneISO(allValues.date_range[0].toDate())
      nextQuery.end_date = formatNoTimezoneISO(allValues.date_range[1].toDate())
    }
    nextQuery.page = '1'
    const next = new URLSearchParams(nextQuery)
    setParams(next, { replace: true })
  }

  const handleRefresh = () => {
    // 刷新操作通过重新设置相同的搜索参数来触发
    const next = new URLSearchParams(query)
    setParams(next, { replace: true })
  }

  const handlePaginationChange = (page: number, pageSize: number) => {
    const next = new URLSearchParams({
      ...query,
      page: String(page),
      page_size: String(pageSize)
    })
    setParams(next, { replace: true })
  }

  // 处理任务选择变化
  const handleTaskChange = (taskId: string) => {
    const task = tasksData?.items?.find((t: any) => t.task_id === taskId)
    if (taskId && task) {
      form.setFieldsValue({ task_id: taskId })
      // 切换任务时重置页码到第一页
      const next = new URLSearchParams({
        ...query,
        task_id: taskId,
        page: '1' // 重置页码为1
      })
      setParams(next, { replace: true })
    } else {
      form.setFieldsValue({ task_id: undefined })
      // 清除任务时重置页码到第一页
      // 使用URLSearchParams实例来处理，避免undefined值问题
      const next = new URLSearchParams(query)
      next.delete('task_id')
      next.set('page', '1') // 重置页码为1
      setParams(next, { replace: true })
    }
  }

  return (
    <>
      <Card title="决策关联数据查询">
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
          <Form.Item name="date_range" label="日期范围">
            <DatePicker.RangePicker 
              placeholder={['开始日期', '结束日期']}
              style={{ width: 300 }}
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
        
        <DecisionDataTable 
          taskId={query.task_id} 
          query={query} 
          onPaginationChange={handlePaginationChange} 
        />
      </Card>
    </>
  )
}