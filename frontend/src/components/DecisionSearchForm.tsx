import React, {useEffect} from 'react'
import {Button, DatePicker, Form, Select} from 'antd'
import {ReloadOutlined} from '@ant-design/icons'
import dayjs from 'dayjs'
import {formatNoTimezoneISO} from '../utils/timezone'
import {fetchTasks} from '../api/endpoints'
import {useQuery} from '@tanstack/react-query'

interface DecisionSearchFormProps {
  initialTaskId?: string
  onValuesChange: (values: any) => void
  onRefresh: () => void
}

export default function DecisionSearchForm({ initialTaskId, onValuesChange, onRefresh }: DecisionSearchFormProps) {
  const [form] = Form.useForm()

  // 获取任务列表
  const { data: tasksData } = useQuery({
    queryKey: ['tasks'],
    queryFn: ({ signal }) => fetchTasks({ page: 1, page_size: 100 }, signal),
    enabled: true
  })

  // 初始化任务ID
  useEffect(() => {
    if (initialTaskId) {
      form.setFieldsValue({ task_id: initialTaskId })
    }
  }, [initialTaskId, form])

  // 处理任务选择变化
  const handleTaskChange = (taskId: string) => {
    form.setFieldsValue({ task_id: taskId })
  }

  // 处理表单值变化
  const handleFormValuesChange = (_changedValues: any, allValues: any) => {
    const nextQuery: Record<string, string> = {}
    if (allValues.task_id) nextQuery.task_id = allValues.task_id
    if (allValues.date_range && allValues.date_range.length === 2) {
      nextQuery.start_date = formatNoTimezoneISO(allValues.date_range[0].toDate())
      nextQuery.end_date = formatNoTimezoneISO(allValues.date_range[1].toDate())
    }
    nextQuery.page = '1'
    onValuesChange(nextQuery)
  }

  return (
    <Form 
      form={form} 
      layout="inline" 
      onValuesChange={handleFormValuesChange}
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
          onClick={onRefresh}
          title="刷新数据"
        >
          刷新
        </Button>
      </Form.Item>
    </Form>
  )
}