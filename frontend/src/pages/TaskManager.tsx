import {useEffect, useRef, useState} from 'react'
import {
    deleteTask,
    fetchTasks,
    pauseTask,
    resumeTask,
    startTask,
    stopTask,
    subscribeTaskProgress
} from '../api/endpoints'
import {useDrawer} from '../components/DetailDrawer'
import AccountDetail from '../components/AccountDetail'
import {Button, Card, Input, message, Modal, Pagination, Radio, Select, Space, Table, Tag} from 'antd'
import {FileTextOutlined, PlusOutlined, ReloadOutlined, UserOutlined} from '@ant-design/icons'
import {formatUTC} from '../utils/timezone'
import { SYMBOLS } from '../constants/symbols'

type TaskItem = {
  task_id: string
  account_id: string
  stock_symbol: string
  market_type?: string | null
  start_date: string
  end_date: string
  status: string
  created_at?: string
  started_at?: string | null
  completed_at?: string | null
  error_message?: string | null
  total_items?: number
  processed_items?: number
  user_prompt_id?: string | null
  ai_config_id?: string | null
  stats?: {
    total_trades?: number
    cumulative_return?: number
    max_single_profit?: number
    max_drawdown?: number
    sharpe_ratio?: number
    win_rate?: number
    avg_profit?: number
    avg_loss?: number
    profit_loss_ratio?: number
    fees_to_profit_ratio?: number
    trades_per_day?: number
    avg_hold_days?: number
    final_balance?: number
    final_total_value?: number
  } | null
}

export default function TaskManager() {
  const [items, setItems] = useState<TaskItem[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState<{ type?: string; status?: string; stock_symbol?: string }>({})
  const [selected, setSelected] = useState<TaskItem | null>(null)
  const [runningTasks, setRunningTasks] = useState<Map<string, {
    running: boolean
    task_id: string
    stock_symbol?: string
    status?: string
    processed_items?: number
    total_items?: number
    error_message?: string
  }>>(new Map())
  const taskSseConnections = useRef<Map<string, EventSource>>(new Map())
  const prevRunningRef = useRef<boolean>(false)
  const [accountDetailVisible, setAccountDetailVisible] = useState(false)
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const [tableScrollY, setTableScrollY] = useState<number>(500)

  const load = async () => {
    setLoading(true)
    try {
        const params: Record<string, any> = { ...filters, page, page_size: pageSize }
        const rs = await fetchTasks(params)
        setItems(rs.items || [])
        setTotal(rs.total || 0)
    } catch (e) {
        message.error('加载任务列表失败')
    } finally {
        setLoading(false)
    }
  }

  useEffect(() => {
    setPage(1)
  }, [filters])

  useEffect(() => {
    load()
  }, [page, pageSize, filters])

  useEffect(() => {
    const anyTaskRunning = Array.from(runningTasks.values()).some(task => task.running)
    prevRunningRef.current = anyTaskRunning
  }, [runningTasks])

  useEffect(() => {
    return () => {
      taskSseConnections.current.forEach((es, taskId) => {
        es.close()
        console.log(`组件卸载时关闭任务 ${taskId} SSE 连接`)
      })
      taskSseConnections.current.clear()
      setRunningTasks(new Map())
    }
  }, [])

  const createTaskSseConnection = (taskId: string) => {
    if (taskSseConnections.current.has(taskId)) {
      taskSseConnections.current.get(taskId)?.close()
      taskSseConnections.current.delete(taskId)
    }
    
    const es = subscribeTaskProgress(taskId)
    
    es.onmessage = (ev) => {
      try {
        if (ev.data.startsWith(": keepalive")) {
          return
        }
        
        const data = JSON.parse(ev.data)
        
        setItems((prev) => prev.map((it) => (it.task_id === taskId ? { ...it, processed_items: data.processed_items, total_items: data.total_items, status: data.status, error_message: data.error_message } : it)))
        
        setRunningTasks((prev) => {
          const newMap = new Map(prev)
          if (data.status === "RUNNING") {
            newMap.set(taskId, { ...data, running: true })
          } else {
            newMap.delete(taskId)
            es.close()
            taskSseConnections.current.delete(taskId)
          }
          return newMap
        })
      } catch (error) {
        console.error(`任务 ${taskId} SSE 消息解析错误:`, error, ev.data)
      }
    }
    
    es.onerror = (error) => {
      console.error(`任务 ${taskId} SSE 连接错误:`, error)
      es.close()
      taskSseConnections.current.delete(taskId)
    }
    
    taskSseConnections.current.set(taskId, es)
    console.log(`任务 ${taskId} SSE 连接创建成功`)
  }
  
  const onStart = async (task: TaskItem) => {
    try {
        const payload: Record<string, any> = { task_id: task.task_id }
        await startTask(payload)
        message.success(`任务 ${task.task_id} 已启动`)
        setSelected(task)
        await load()
        createTaskSseConnection(task.task_id)
    } catch (e: any) {
        message.error(`任务 ${task.task_id} 启动失败: ${e.message || '未知错误'}`)
    }
  }

  const onStop = async (task: TaskItem) => {
    try {
        await stopTask({ task_id: task.task_id })
        message.success('停止指令已发送')
        await load()
        const es = taskSseConnections.current.get(task.task_id)
        if (es) {
          es.close()
          taskSseConnections.current.delete(task.task_id)
          console.log(`任务 ${task.task_id} SSE 连接已关闭`)
        }
        setRunningTasks((prev) => {
          const newMap = new Map(prev)
          newMap.delete(task.task_id)
          return newMap
        })
    } catch (e: any) {
        message.error(`停止失败: ${e.message || '未知错误'}`)
    }
  }

  const onPause = async (task: TaskItem) => {
    try {
        await pauseTask({ task_id: task.task_id })
        message.success('暂停指令已发送')
        await load()
        const es = taskSseConnections.current.get(task.task_id)
        if (es) {
          es.close()
          taskSseConnections.current.delete(task.task_id)
          console.log(`任务 ${task.task_id} SSE 连接已关闭（暂停）`)
        }
        setRunningTasks((prev) => {
          const newMap = new Map(prev)
          newMap.delete(task.task_id)
          return newMap
        })
    } catch (e: any) {
        message.error(`暂停失败: ${e.message || '未知错误'}`)
    }
  }

  const onResume = async (task: TaskItem) => {
    try {
        await resumeTask({ task_id: task.task_id })
        message.success('继续指令已发送')
        await load()
        createTaskSseConnection(task.task_id)
    } catch (e: any) {
        message.error(`继续失败: ${e.message || '未知错误'}`)
    }
  }

  const onDelete = async (task: TaskItem) => {
    try {
        Modal.confirm({
            title: '确认删除',
            content: `确定要删除任务 ${task.task_id} 及其所有关联数据吗？此操作不可恢复。`,
            okText: '确定',
            okType: 'danger',
            cancelText: '取消',
            async onOk() {
                await deleteTask(task.task_id)
                message.success('任务删除成功')
                await load()
            },
        })
    } catch (e: any) {
        message.error(`删除失败: ${e.message || '未知错误'}`)
    }
  }

  const onViewAccount = (accountId: string) => {
    setSelectedAccountId(accountId)
    setAccountDetailVisible(true)
  }

  const onViewTemplate = (taskId: string) => {
    const task = items.find(t => t.task_id === taskId);
    if (task?.user_prompt_id) {
      actions.openDrawer('prompt-template', task.user_prompt_id);
    } else {
      message.warning('该任务未关联策略');
    }
  }

  const { actions } = useDrawer()

  useEffect(() => {
    if (!tableContainerRef.current) return

    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        const { height } = entry.contentRect
        setTableScrollY(Math.max(200, height - 120))
      }
    })

    resizeObserver.observe(tableContainerRef.current)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  const columns = [
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 200, fixed: 'left' as const, render: formatUTC },
    { title: '回测ID', dataIndex: 'task_id', key: 'task_id', width: 200, fixed: 'left' as const, hidden: true },
    { 
        title: '账户', 
        dataIndex: 'account_id', 
        key: 'account_id', 
        width: 150,
        fixed: 'left' as const,
        render: (accountId: string) => (
            <Button 
                type="link" 
                size="small" 
                icon={<UserOutlined />}
                onClick={() => onViewAccount(accountId)}
            >
                {accountId}
            </Button>
        ),
        hidden: true
    },
    { title: '标的', dataIndex: 'stock_symbol', key: 'stock_symbol', width: 100, fixed: 'left' as const },
    { 
        title: '范围', 
        key: 'range', 
        fixed: 'left' as const,
        render: (_: any, r: TaskItem) => `${formatUTC(r.start_date)} ~ ${formatUTC(r.end_date)}`,
        width: 200
    },
    { 
        title: '状态', 
        dataIndex: 'status', 
        key: 'status',
        fixed: 'left' as const,
        width: 100,
        render: (status: string) => {
            let color = 'default'
            if (status === 'RUNNING') color = 'processing'
            else if (status === 'COMPLETED') color = 'success'
            else if (status === 'FAILED') color = 'error'
            else if (status === 'CANCELLED') color = 'warning'
            else if (status === 'PAUSED') color = 'default'
            return <Tag color={color}>{status}</Tag>
        }
    },
    { 
        title: '进度', 
        key: 'progress',
        fixed: 'left' as const,
        width: 120,
        render: (_: any, r: TaskItem) => {
            if (!r.total_items) return '-'
            const percent = Math.round(((r.processed_items || 0) / r.total_items) * 100)
            return `${r.processed_items}/${r.total_items} (${percent}%)`
        }
    },
    {
        title: '交易次数',
        key: 'total_trades',
        width: 90,
        render: (_: any, r: TaskItem) => r.stats?.total_trades ?? '-'
    },
    {
        title: '累计收益',
        key: 'cumulative_return',
        width: 100,
        render: (_: any, r: TaskItem) => {
            if (r.stats?.cumulative_return === undefined) return '-'
            const value = r.stats.cumulative_return * 100
            return <span style={{ color: value >= 0 ? '#52c41a' : '#ff4d4f' }}>{value.toFixed(2)}%</span>
        }
    },
    {
        title: '最大单利',
        key: 'max_single_profit',
        width: 90,
        render: (_: any, r: TaskItem) => {
            if (r.stats?.max_single_profit === undefined) return '-'
            const value = r.stats.max_single_profit * 100
            return <span style={{ color: value >= 0 ? '#52c41a' : '#ff4d4f' }}>{value.toFixed(2)}%</span>
        }
    },
    {
        title: '最大回撤',
        key: 'max_drawdown',
        width: 90,
        render: (_: any, r: TaskItem) => {
            if (r.stats?.max_drawdown === undefined) return '-'
            return `${(r.stats.max_drawdown * 100).toFixed(2)}%`
        }
    },
    {
        title: '夏普比率',
        key: 'sharpe_ratio',
        width: 90,
        render: (_: any, r: TaskItem) => {
            if (r.stats?.sharpe_ratio === undefined) return '-'
            return r.stats.sharpe_ratio.toFixed(3)
        }
    },
    {
        title: '胜率',
        key: 'win_rate',
        width: 80,
        render: (_: any, r: TaskItem) => {
            if (r.stats?.win_rate === undefined) return '-'
            return `${r.stats.win_rate.toFixed(1)}%`
        }
    },
    {
        title: '平均盈利',
        key: 'avg_profit',
        width: 90,
        render: (_: any, r: TaskItem) => {
            if (r.stats?.avg_profit === undefined) return '-'
            const value = r.stats.avg_profit * 100
            return <span style={{ color: value >= 0 ? '#52c41a' : '#ff4d4f' }}>{value.toFixed(2)}%</span>
        }
    },
    {
        title: '平均亏损',
        key: 'avg_loss',
        width: 90,
        render: (_: any, r: TaskItem) => {
            if (r.stats?.avg_loss === undefined) return '-'
            const value = r.stats.avg_loss * 100
            return <span style={{ color: value >= 0 ? '#52c41a' : '#ff4d4f' }}>{value.toFixed(2)}%</span>
        }
    },
    {
        title: '盈亏比',
        key: 'profit_loss_ratio',
        width: 80,
        render: (_: any, r: TaskItem) => {
            if (r.stats?.profit_loss_ratio === undefined) return '-'
            return r.stats.profit_loss_ratio.toFixed(2)
        }
    },
    {
        title: '手续费占比',
        key: 'fees_to_profit_ratio',
        width: 90,
        render: (_: any, r: TaskItem) => {
            if (r.stats?.fees_to_profit_ratio === undefined) return '-'
            return `${(r.stats.fees_to_profit_ratio * 100).toFixed(2)}%`
        }
    },
    {
        title: '日均交易',
        key: 'trades_per_day',
        width: 90,
        render: (_: any, r: TaskItem) => {
            if (r.stats?.trades_per_day === undefined) return '-'
            return r.stats.trades_per_day.toFixed(2)
        }
    },
    {
        title: '平均持仓',
        key: 'avg_hold_days',
        width: 90,
        render: (_: any, r: TaskItem) => {
            if (r.stats?.avg_hold_days === undefined) return '-'
            return `${r.stats.avg_hold_days.toFixed(1)}天`
        }
    },
    {
        title: '最终余额',
        key: 'final_balance',
        width: 120,
        render: (_: any, r: TaskItem) => {
            if (r.stats?.final_balance === undefined) return '-'
            return r.stats.final_balance.toFixed(2)
        }
    },
    {
        title: '最终价值',
        key: 'final_total_value',
        width: 120,
        render: (_: any, r: TaskItem) => {
            if (r.stats?.final_total_value === undefined) return '-'
            return r.stats.final_total_value.toFixed(2)
        }
    },
    { 
        title: '操作',
        key: 'action',
        fixed: 'right' as const,
        width: 260,
        render: (_: any, r: TaskItem) => (
            <Space>
                <Button 
                    size="small" 
                    type="primary" 
                    disabled={r.status === 'RUNNING' || r.status === 'PAUSED' || r.status === 'COMPLETED'} 
                    onClick={() => onStart(r)}
                >
                    启动
                </Button>
                <Button 
                    size="small" 
                    danger 
                    disabled={r.status !== 'RUNNING' && r.status !== 'PAUSED'}
                    onClick={() => onStop(r)}
                >
                    停止
                </Button>
                {r.status === 'RUNNING' && (
                    <Button 
                        size="small" 
                        onClick={() => onPause(r)}
                    >
                        暂停
                    </Button>
                )}
                {r.status === 'PAUSED' && (
                    <Button 
                        size="small" 
                        type="primary" 
                        onClick={() => onResume(r)}
                    >
                        继续
                    </Button>
                )}
                <Button 
                    size="small" 
                    danger 
                    disabled={r.status === 'RUNNING' || r.status === 'PAUSED'}
                    onClick={() => onDelete(r)}
                >
                    删除
                </Button>
                <Button 
                    size="small" 
                    icon={<FileTextOutlined />}
                    onClick={() => onViewTemplate(r.task_id)}
                >
                    查看策略
                </Button>
            </Space>
        )
    }
  ]

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
              style={{ width: 150 }} 
              placeholder="状态" 
              allowClear
              value={filters.status} 
              onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
            >
              <Select.Option value='PENDING'>PENDING</Select.Option>
              <Select.Option value='RUNNING'>RUNNING</Select.Option>
              <Select.Option value='PAUSED'>PAUSED</Select.Option>
              <Select.Option value='COMPLETED'>COMPLETED</Select.Option>
              <Select.Option value='FAILED'>FAILED</Select.Option>
              <Select.Option value='CANCELLED'>CANCELLED</Select.Option>
            </Select>
            <Radio.Group
              value={filters.stock_symbol || ''}
              onChange={(e) => setFilters((f) => ({ ...f, stock_symbol: e.target.value || undefined }))}
              buttonStyle="solid"
            >
              <Radio.Button value="" style={{ fontWeight: filters.stock_symbol ? 'normal' : 'bold' }}>全部</Radio.Button>
              {SYMBOLS.map(symbol => (
                <Radio.Button key={symbol} value={symbol} style={{ fontWeight: filters.stock_symbol === symbol ? 'bold' : 'normal' }}>{symbol}</Radio.Button>
              ))}
            </Radio.Group>
          </div>
          <Space>
              <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => actions.openDrawer('task-create', { onSuccess: load })}>创建策略回测</Button>
          </Space>
        </div>
      </Card>

      {Array.from(runningTasks.values()).length > 0 && (
        <Card 
          style={{ 
            width: '100%', 
            borderRadius: '6px', 
            boxShadow: '0 1px 4px rgba(0, 0, 0, 0.06)', 
            overflow: 'hidden',
            borderColor: '#91d5ff', 
            backgroundColor: '#e6f7ff',
            marginBottom: '12px'
          }}
          bodyStyle={{ padding: '12px 16px', backgroundColor: 'transparent' }}
        >
          <div>
            <strong style={{ marginBottom: 8, display: 'block', fontSize: '14px' }}>正在运行任务:</strong>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Array.from(runningTasks.values()).map(task => (
                <Space key={task.task_id} size="large">
                  <span>{task.stock_symbol} ({task.task_id})</span>
                  <Tag color="processing">{task.status}</Tag>
                  <span>进度: {task.processed_items}/{task.total_items}</span>
                  {task.error_message && <span style={{ color: 'red' }}>错误: {task.error_message}</span>}
                </Space>
              ))}
            </div>
          </div>
        </Card>
      )}

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
                dataSource={items} 
                columns={columns} 
                rowKey="task_id"
                loading={loading}
                pagination={{
                  current: page, 
                  pageSize: pageSize, 
                  total: total, 
                  onChange: (p, ps) => { setPage(p); setPageSize(ps); },
                  showSizeChanger: true,
                  showTotal: (t) => `共 ${t} 条`,
                  style: {
                    padding: '12px 16px',
                    borderTop: '1px solid #e8e8e8',
                    margin: 0
                  }
                }}
                scroll={{ x: 2600, y: tableScrollY }}
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
        title="账户详情"
        open={accountDetailVisible}
        onCancel={() => {
          setAccountDetailVisible(false)
          setSelectedAccountId(null)
        }}
        footer={null}
        width={800}
        destroyOnHidden
      >
        {selectedAccountId && (
          <AccountDetail 
            accountId={selectedAccountId}
            onClose={() => {
              setAccountDetailVisible(false)
              setSelectedAccountId(null)
            }}
          />
        )}
      </Modal>
    </div>
  )
}
