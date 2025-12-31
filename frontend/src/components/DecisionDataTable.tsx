import React, {useState, useEffect} from 'react'
import {Button, Collapse, Modal, Row, Switch, Table, Tag, Tooltip, Pagination} from 'antd'
import dayjs from 'dayjs'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {fetchLocalDecisions} from '../api/endpoints'
import {useQuery} from '@tanstack/react-query'

const { Panel } = Collapse

interface DecisionDataTableProps {
  taskId: string | undefined
  query: any
  onPaginationChange: (page: number, pageSize: number) => void
  refetchInterval?: number | false
}

export default function DecisionDataTable({ taskId, query, onPaginationChange, refetchInterval }: DecisionDataTableProps) {
  const [reasoningModalVisible, setReasoningModalVisible] = useState(false)
  const [selectedReasoning, setSelectedReasoning] = useState('')
  const [agentInputModalVisible, setAgentInputModalVisible] = useState(false)
  const [selectedAgentInput, setSelectedAgentInput] = useState('')
  const [onlyShowTrades, setOnlyShowTrades] = useState(false)
  
  const currentPage = parseInt((query as any).page || '1')
  const pageSize = parseInt((query as any).page_size || '20')

  const [paginationState, setPaginationState] = useState({
     current: currentPage,
     size: pageSize
   })

  const [tradesFilterChanged, setTradesFilterChanged] = useState(false)

  const handleTradesFilterChange = (checked: boolean) => {
    setOnlyShowTrades(checked)
    setPaginationState(prev => ({ ...prev, current: 1 }))
    setTradesFilterChanged(true)
    onPaginationChange(1, paginationState.size)
    setTimeout(() => setTradesFilterChanged(false), 100)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['local-decisions', { ...query, onlyShowTrades, currentPage: paginationState.current, pageSize: paginationState.size }],
    queryFn: ({ signal }) => fetchLocalDecisions({
      ...query,
      page: paginationState.current,
      page_size: paginationState.size,
      is_trade: onlyShowTrades ? true : undefined
    }, signal).then(result => {
      // console.log('API返回数据:', result)
      return result
    }),
    enabled: !!taskId,
    refetchInterval: refetchInterval,
    refetchIntervalInBackground: true
  })
  
  // 计算数据源长度，用于判断是否显示loading状态
  const itemsLength = data?.items?.length || 0

  const handlePaginationChange = (page: number, pageSize: number) => {
    setPaginationState({ current: page, size: pageSize })
    onPaginationChange(page, pageSize)
  }



  // 交易记录列定义
  const tradeColumns = [
    { title: '交易ID', dataIndex: 'trade_id', width: 200, hidden: true },
    { title: '交易动作', dataIndex: 'trade_action', width: 120, render: (action: string) => {
      let color = 'blue'
      if (action === 'BUY' || action === 'COVER_SHORT') color = 'green'
      else if (action === 'SELL' || action === 'SHORT_SELL') color = 'red'
      else if (action === 'HOLD') color = 'gray'
      return <Tag color={color}>{action}</Tag>
    }},
    { title: '交易数量', dataIndex: 'quantity', width: 120 },
    { title: '交易价格', dataIndex: 'price', width: 120 },
    { title: '交易总额', dataIndex: 'total_amount', width: 120 },
    { title: '交易费用', dataIndex: 'total_fees', width: 120 },
    { title: '交易时间', dataIndex: 'trade_time', width: 200, render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm:ss'),hidden: true },
    { title: '状态', dataIndex: 'status', width: 100, render: (status: string) => {
      return <Tag color={status === 'COMPLETED' ? 'green' : status === 'FAILED' ? 'red' : 'orange'}>{status}</Tag>
    },hidden: true},
  ]

  // 主列定义：展示所有关键信息
  const columns: any = [
    // 决策基本信息 - 按用户要求排序
    { title: '决策ID', dataIndex: 'decision_id', width: 200,hidden: true },
    { title: '回测ID', dataIndex: 'task_id', width: 150,hidden: true },
    { title: '账户ID', dataIndex: 'account_id', width: 150,hidden: true },
    { title: '股票代码', dataIndex: 'stock_symbol', width: 100,hidden: true },
    // 添加时间列 - 使用analysis_date
    { title: '时间', dataIndex: 'analysis_date', width: 160, render: (time: string) => time ? dayjs(time).format('YYYY-MM-DD HH:mm:ss') : '-' },
    // 决策结果
    { title: '决策结果', dataIndex: 'decision_result', width: 120, render: (action: string) => {
      let color = 'blue'
      let tooltipText = action
      if (action === 'BUY' || action === 'COVER_SHORT') {
        color = 'green'
        if (action === 'COVER_SHORT') tooltipText = '买入平仓'
      }
      else if (action === 'SELL' || action === 'SHORT_SELL') {
        color = 'red'
        if (action === 'SHORT_SELL') tooltipText = '做空卖出'
      }
      else if (action === 'HOLD') color = 'gray'
      return (
        <Tooltip title={tooltipText}>
          <Tag color={color}>{action}</Tag>
        </Tooltip>
      )
    }},
    // 账户快照信息
    { title: '总价值', dataIndex: 'snapshot', width: 150, render: (snapshot: any) => snapshot?.total_value || '-', fixed: 'left' as const  },
    { title: '盈亏金额', dataIndex: 'snapshot', width: 150, render: (snapshot: any) => snapshot?.profit_loss || '-' , fixed: 'left' as const },
    { title: '盈亏百分比', dataIndex: 'snapshot', width: 110, render: (snapshot: any) => {
      if (!snapshot?.profit_loss_percent) return '-'
      const percent = parseFloat(snapshot.profit_loss_percent)
      return (
        <span style={{ color: percent >= 0 ? 'green' : 'red' }}>
          {percent.toFixed(2)}%
        </span>
      )
    }},
    { title: '持仓数量', dataIndex: 'snapshot', width: 150, render: (snapshot: any) => snapshot?.stock_quantity || '-' },
    { title: '可用余额', dataIndex: 'snapshot', width: 150, render: (snapshot: any) => snapshot?.available_balance || '-' },
    { title: '余额', dataIndex: 'snapshot', width: 150, render: (snapshot: any) => snapshot?.current_balance || '-' },
    // 推理过程
    { 
      title: '推理过程', 
      dataIndex: 'reasoning', 
      width: 200, 
      render: (reasoning: string) => {
        if (!reasoning) return '-'
        // 限制显示为最多15个字
        const maxLength = 15
        const displayText = reasoning.length > maxLength 
          ? `${reasoning.substring(0, maxLength)}...` 
          : reasoning
        
        return (
          <Tooltip title={reasoning} placement="topLeft">
            <a 
              onClick={() => {
                setSelectedReasoning(reasoning)
                setReasoningModalVisible(true)
              }}
              style={{ 
                cursor: 'pointer', 
                color: '#1890ff',
                textDecoration: 'underline',
                fontSize: '14px',
                fontWeight: 500
              }}
            >
              {displayText}
            </a>
          </Tooltip>
        )
      }
    },
    // 交易统计信息
    { title: '交易次数', dataIndex: 'trade_count', width: 100,hidden: true },
    { 
      title: '主要交易动作', 
      dataIndex: 'trades', 
      width: 120, 
      render: (trades: any[]) => {
        if (!trades || trades.length === 0) return '-'
        if (trades.length === 1) {
          const action = trades[0].trade_action
          let color = 'blue'
          let tooltipText = action
          if (action === 'BUY' || action === 'COVER_SHORT'){
            color = 'green'
            if (action === 'COVER_SHORT') tooltipText = '买入平仓'
          }
          else if (action === 'SELL' || action === 'SHORT_SELL') {
            color = 'red'
            if (action === 'SHORT_SELL') tooltipText = '做空卖出'
          }
          else if (action === 'HOLD') color = 'gray'
          return (
            <Tooltip title={tooltipText}>
              <Tag color={color}>{action}</Tag>
            </Tooltip>
          )
        }
        return <Tag color="orange">多笔交易</Tag>
      }
    },
    { 
      title: '交易数量', 
      dataIndex: 'trades', 
      width: 120, 
      render: (trades: any[]) => {
        if (!trades || trades.length === 0) return '-'
        if (trades.length === 1) {
          return trades[0].quantity
        }
        return `${trades.length}笔交易`
      }
    },
    { 
      title: '交易价格', 
      dataIndex: 'trades', 
      width: 150, 
      render: (trades: any[]) => {
        if (!trades || trades.length === 0) return '-'
        if (trades.length === 1) {
          return trades[0].price
        }
        return '多种价格'
      }
    },
    { 
      title: '交易总额', 
      dataIndex: 'trades', 
      width: 150, 
      render: (trades: any[]) => {
        if (!trades || trades.length === 0) return '-'
        if (trades.length === 1) {
          return trades[0].total_amount
        }
        const totalAmount = trades.reduce((sum, trade) => {
          return sum + parseFloat(trade.total_amount || '0')
        }, 0)
        return totalAmount.toFixed(2)
      }
    },
    { 
      title: '总交易额', 
      dataIndex: 'trades', 
      width: 150, 
      render: (trades: any[]) => {
        if (!trades || trades.length === 0) return '-'
        const totalAmount = trades.reduce((sum, trade) => {
          return sum + parseFloat(trade.total_amount || '0')
        }, 0)
        return totalAmount.toFixed(2)
      }
    },
    { 
      title: '总交易费用', 
      dataIndex: 'trades', 
      width: 120, 
      render: (trades: any[]) => {
        if (!trades || trades.length === 0) return '-'
        const totalFee = trades.reduce((sum, trade) => {
          return sum + parseFloat(trade.total_fees || '0')
        }, 0)
        return totalFee.toFixed(2)
      }
    },
    // Agent输入
    { 
      title: 'Agent输入', 
      dataIndex: 'market_data', 
      width: 300, 
      render: (marketData: any) => {
        if (!marketData?.agent_response?.input) return '-'
        const input = marketData.agent_response.input
        // 限制显示为最多20个字
        const maxLength = 20
        const displayText = input.length > maxLength 
          ? `${input.substring(0, maxLength)}...` 
          : input
        
        return (
          <Tooltip title={input} placement="topLeft">
            <a 
              onClick={() => {
                setSelectedAgentInput(input)
                setAgentInputModalVisible(true)
              }}
              style={{ 
                cursor: 'pointer', 
                color: '#1890ff',
                textDecoration: 'underline',
                fontSize: '14px',
                fontWeight: 500
              }}
            >
              {displayText}
            </a>
          </Tooltip>
        )
      }
    },
    { title: '置信度', dataIndex: 'confidence_score', width: 100, render: (score: string) => parseFloat(score).toFixed(2),hidden: true },
    // 交易记录展开
    { 
      title: '交易记录', 
      dataIndex: 'trades', 
      width: 150, 
      render: (_: any, record: any) => {
        return (
          <Collapse defaultActiveKey={[]} ghost>
            <Panel header={`查看 ${record.trade_count || 0} 条交易记录`} key="1">
              <Table
                columns={tradeColumns}
                dataSource={record.trades || []}
                rowKey="trade_id"
                pagination={false}
                size="small"
                scroll={{ x: 800 }}
              />
            </Panel>
          </Collapse>
        )
      },hidden: true
    }
  ]

  return (
    <>
      {/* 当没有选择任务时显示提示信息 */}
      {!taskId ? (
        <div style={{ 
          height: 300, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          backgroundColor: '#fafafa',
          border: '1px dashed #d9d9d9',
          borderRadius: '4px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '16px', color: '#666', marginBottom: '8px' }}>
              请选择一个任务以查看决策数据
            </div>
            <div style={{ fontSize: '14px', color: '#999' }}>
              从上方回测ID下拉列表中选择一个任务
            </div>
          </div>
        </div>
      ) : (
        <>
          <Row justify="space-between" align="middle" style={{ marginBottom: 6 }}>
            <Pagination
              current={paginationState.current}
              pageSize={paginationState.size}
              total={data?.total || 0}
              showSizeChanger={true}
              showQuickJumper={true}
              pageSizeOptions={['20', '50', '100', '200']}
              onChange={handlePaginationChange}
              onShowSizeChange={(_, size) => handlePaginationChange(1, size)}
              showTotal={(total) => `共 ${total} 条记录`}
            />
            <Switch
              checked={onlyShowTrades}
              onChange={handleTradesFilterChange}
              checkedChildren="只显示决策交易"
              unCheckedChildren="全部"
            />
          </Row>
          <Table
          columns={columns}
          dataSource={data?.items || []}
          loading={isLoading && !(itemsLength > 0)}
          rowKey="decision_id"
          pagination={false}
          scroll={{ x: 2000, y: 'calc(100vh - 230px)' }}
          expandable={{
            expandedRowRender: (record) => {
              return (
                <div style={{ padding: '12px', maxWidth: '60vw', float: 'right', background: '#fff', }}>
                  <Table
                    columns={tradeColumns}
                    dataSource={record.trades || []}
                    rowKey="trade_id"
                    pagination={false}
                    size="small" bordered
                    scroll={{ x: 800 }}
                  />
                </div>
              )
            },
            expandIconColumnIndex: 2  // 将展开图标固定在第一列
          }}
          bordered
        />
        </>
      )}
      
      {/* 推理过程详情弹框 */}
      <Modal
        title="推理过程详情"
        open={reasoningModalVisible}
        onCancel={() => setReasoningModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setReasoningModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={900}
        style={{ top: 50 }}
        bodyStyle={{ height: '70vh', overflow: 'hidden' }}
      >
        <div style={{ 
          height: '100%',
          overflowY: 'auto',
          padding: '16px',
          backgroundColor: '#f5f5f5',
          borderRadius: '8px',
          fontSize: '16px',
          lineHeight: '1.6'
        }}>
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({children}) => <p style={{margin: '8px 0', lineHeight: '1.6'}}>{children}</p>,
              ul: ({children}) => <ul style={{margin: '8px 0', paddingLeft: '20px'}}>{children}</ul>,
              ol: ({children}) => <ol style={{margin: '8px 0', paddingLeft: '20px'}}>{children}</ol>,
              li: ({children}) => <li style={{margin: '4px 0'}}>{children}</li>,
              strong: ({children}) => <strong style={{fontWeight: 'bold', color: '#1890ff'}}>{children}</strong>,
              em: ({children}) => <em style={{fontStyle: 'italic'}}>{children}</em>,
              code: ({children}) => <code style={{backgroundColor: '#f0f0f0', padding: '2px 4px', borderRadius: '4px', fontSize: '14px'}}>{children}</code>,
              pre: ({children}) => <pre style={{backgroundColor: '#f0f0f0', padding: '12px', borderRadius: '6px', overflow: 'auto'}}>{children}</pre>,
              blockquote: ({children}) => <blockquote style={{borderLeft: '4px solid #1890ff', margin: '8px 0', paddingLeft: '16px', color: '#666'}}>{children}</blockquote>
            }}
          >
            {selectedReasoning || ''}
          </ReactMarkdown>
        </div>
      </Modal>
      
      {/* Agent输入详情弹框 */}
      <Modal
        title="Agent输入详情"
        open={agentInputModalVisible}
        onCancel={() => setAgentInputModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setAgentInputModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={900}
        style={{ top: 50 }}
        bodyStyle={{ height: '70vh', overflow: 'hidden' }}
      >
        <div style={{ 
          height: '100%',
          overflowY: 'auto',
          padding: '16px',
          backgroundColor: '#f0f0f0',
          borderRadius: '8px',
          fontSize: '16px',
          lineHeight: '1.6'
        }}>
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({children}) => <p style={{margin: '8px 0', lineHeight: '1.6'}}>{children}</p>,
              ul: ({children}) => <ul style={{margin: '8px 0', paddingLeft: '20px'}}>{children}</ul>,
              ol: ({children}) => <ol style={{margin: '8px 0', paddingLeft: '20px'}}>{children}</ol>,
              li: ({children}) => <li style={{margin: '4px 0'}}>{children}</li>,
              strong: ({children}) => <strong style={{fontWeight: 'bold', color: '#722ed1'}}>{children}</strong>,
              em: ({children}) => <em style={{fontStyle: 'italic'}}>{children}</em>,
              code: ({children}) => <code style={{backgroundColor: '#f5f5f5', padding: '2px 4px', borderRadius: '4px', fontSize: '14px'}}>{children}</code>,
              pre: ({children}) => <pre style={{backgroundColor: '#f5f5f5', padding: '12px', borderRadius: '6px', overflow: 'auto'}}>{children}</pre>,
              blockquote: ({children}) => <blockquote style={{borderLeft: '4px solid #722ed1', margin: '8px 0', paddingLeft: '16px', color: '#666'}}>{children}</blockquote>
            }}
          >
            {selectedAgentInput || ''}
          </ReactMarkdown>
        </div>
      </Modal>
    </>
  )
}
