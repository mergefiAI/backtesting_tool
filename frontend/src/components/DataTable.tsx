import React from 'react'
import {Table} from 'antd'

type Props<T> = {
  columns: any[]
  data?: T[]
  loading?: boolean
  rowKey?: string
  pagination?: any
}

/**
 * 通用数据表格组件：统一 loading/rowKey，自动处理undefined值
 */
export default function DataTable<T extends Record<string, any>>({ columns, data, loading, rowKey = 'id', pagination }: Props<T>) {
  // 处理undefined值：为每个列添加默认渲染器
  const processedColumns = columns.map(col => {
    if (col.render) return col
    
    return {
      ...col,
      render: (value: any) => {
        if (value === undefined || value === null) return '-'
        return value
      }
    }
  })

  // 默认分页配置
  const defaultPagination = {
    pageSize: 20,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total: number, range: [number, number]) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
  }

  // 合并分页配置
  const paginationConfig = pagination ? { ...defaultPagination, ...pagination } : defaultPagination

  return (
    <Table
      columns={processedColumns}
      dataSource={data}
      loading={loading}
      rowKey={(record) => {
        // 如果是K线数据，使用trade_date和symbol组合作为key
        if (record.trade_date && record.symbol) {
          return `${record.trade_date}_${record.symbol}`
        }
        // 否则使用默认的rowKey
        return record[rowKey] || Math.random().toString(36)
      }}
      pagination={paginationConfig}
    />
  )
}