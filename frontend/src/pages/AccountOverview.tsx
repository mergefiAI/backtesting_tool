import React from 'react'
import {Button, Card, Radio} from 'antd'
import {ReloadOutlined} from '@ant-design/icons'
import DataTable from '../components/DataTable'
import {fetchAccounts} from '../api/endpoints'
import {SYMBOLS} from '../constants/symbols'
import {useQuery} from '@tanstack/react-query'
import {useSearchParams} from 'react-router-dom'
import {useDrawer} from '../components/DetailDrawer'

export default function AccountOverview() {
  const [params, setParams] = useSearchParams()
  const query = Object.fromEntries(params.entries())
  const { actions } = useDrawer()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['accounts', query],
    queryFn: ({ signal }) => fetchAccounts({
      ...query,
      page: parseInt((query as any).page || '1'),
      page_size: parseInt((query as any).page_size || '50')
    }, signal)
  })

  const handleSymbolChange = (e: any) => {
    const symbol = e.target.value
    const next = new URLSearchParams({ ...query })
    if (symbol) {
      next.set('stock_symbol', symbol)
    } else {
      next.delete('stock_symbol')
    }
    next.set('page', '1')
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

  const formatNumber = (value: any) => {
    if (value === null || value === undefined) return '-'
    const num = Number(value)
    if (isNaN(num)) return value
    if (Math.abs(num) < 0.00000001) return '0'
    return num.toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8
    })
  }

  const handleViewDetail = (record: any) => {
    actions.openDrawer('account', record.account_id)
  }

  const columns = [
    { title: '账户ID', dataIndex: 'account_id', sorter: true },
    { title: '市场类型', dataIndex: 'market_type', sorter: true },
    { title: '标的', dataIndex: 'stock_symbol', sorter: true },
    { title: '初始余额', dataIndex: 'initial_balance', render: (text: any) => formatNumber(text), sorter: true },
    { title: '当前余额', dataIndex: 'current_balance', render: (text: any) => formatNumber(text), sorter: true },
    { title: '可用余额', dataIndex: 'available_balance', render: (text: any) => formatNumber(text), sorter: true },
    { title: '持仓', dataIndex: 'stock_quantity', render: (text: any) => formatNumber(text), sorter: true },
    { title: '价格', dataIndex: 'stock_price', render: (text: any) => formatNumber(text), sorter: true },
    { title: '总价值', dataIndex: 'total_value', render: (text: any) => formatNumber(text), sorter: true },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Button type="link" onClick={() => handleViewDetail(record)}>
          查看详情
        </Button>
      )
    }
  ]

  return (
    <Card title="账户列表">
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <Radio.Group
          value={query.stock_symbol || ''}
          onChange={handleSymbolChange}
          buttonStyle="solid"
        >
          <Radio.Button value="" style={{ fontWeight: query.stock_symbol ? 'normal' : 'bold' }}>全部</Radio.Button>
          {SYMBOLS.map(symbol => (
            <Radio.Button key={symbol} value={symbol} style={{ fontWeight: query.stock_symbol === symbol ? 'bold' : 'normal' }}>{symbol}</Radio.Button>
          ))}
        </Radio.Group>
        <Button icon={<ReloadOutlined />} onClick={handleRefresh}>刷新</Button>
      </div>
      <DataTable
        columns={columns}
        data={data?.items}
        loading={isLoading}
        rowKey="account_id"
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
