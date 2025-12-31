import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { Card, Form, Button, DatePicker, Table, Tag, Select, Space, Radio, Spin, Modal, message } from 'antd'
import ErrorBoundary from '../components/ErrorBoundary'

const { RangePicker } = DatePicker
const { Option } = Select
import { UploadOutlined, DeleteOutlined } from '@ant-design/icons'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { fetchBTCDailyBars, fetchBTCHourlyBars, fetchBTCMinutelyBars, fetchSymbolDataCount, fetchAllSymbolsDataCount, clearBTCDailyData, clearBTCHourlyData, clearBTCMinutelyData } from '../api/endpoints'
import { formatUTC } from '../utils/timezone'
import { SYMBOLS, TIME_GRANULARITY_OPTIONS } from '../constants/symbols'

// TypeScript类型定义
interface SymbolCounts {
  daily: { count: number; start_date?: string; end_date?: string };
  hourly: { count: number; start_date?: string; end_date?: string };
  minute: { count: number; start_date?: string; end_date?: string };
}

interface MarketDataItem {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;
  pct_chg: number;
  amplitude: number;
  close_5_sma: number;
  close_20_sma: number;
  close_50_sma: number;
  close_60_sma: number;
  close_200_sma: number;
  close_12_ema: number;
  close_26_ema: number;
  macd: number;
  macds: number;
  macdh: number;
  rsi_6: number;
  rsi_12: number;
  rsi_24: number;
  kdjk: number;
  kdjd: number;
  kdjj: number;
  boll: number;
  boll_ub: number;
  boll_lb: number;
  volume_5_sma: number;
  volume_10_sma: number;
  trend: string;
}

interface PaginatedMarketData {
  items: MarketDataItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages?: number;
}

interface FormValues {
  granularity: string;
  dateRange?: [dayjs.Dayjs, dayjs.Dayjs];
  trend?: string;
}

interface SymbolBlockProps {
  symbol: string;
  selectedSymbol: string;
  onSymbolClick: (symbol: string) => void;
  counts: SymbolCounts | undefined;
  isLoading: boolean;
  isError: boolean;
}

// 标的方块子组件，用于显示单个标的的数据数量（数据从父组件传入）
const SymbolBlock = ({ 
  symbol, 
  selectedSymbol, 
  onSymbolClick, 
  counts, 
  isLoading, 
  isError 
}: SymbolBlockProps) => {
  const isSelected = selectedSymbol === symbol;
  
  return (
    <div 
      onClick={() => onSymbolClick(symbol)}
      style={{
        border: `1px solid ${isSelected ? '#1890ff' : '#e8e8e8'}`,
        borderRadius: '6px',
        padding: '8px',
        cursor: 'pointer',
        backgroundColor: isSelected ? '#e6f7ff' : '#fff',
        transition: 'all 0.2s ease',
        textAlign: 'center',
        boxShadow: isSelected ? '0 1px 4px rgba(24, 144, 255, 0.15)' : 'none',
        height: '80px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        width: '100%',
        transform: isSelected ? 'translateY(-1px)' : 'translateY(0)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 1px 4px rgba(0, 0, 0, 0.06)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.boxShadow = 'none';
          e.currentTarget.style.transform = 'translateY(0)';
        } else {
          e.currentTarget.style.boxShadow = '0 1px 4px rgba(24, 144, 255, 0.15)';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }
      }}
    >
      <div style={{ 
        fontSize: '14px', 
        fontWeight: '600', 
        marginBottom: '6px',
        color: isSelected ? '#1890ff' : '#262626'
      }}>{symbol}</div>
      <div style={{ fontSize: '10px', color: '#666', lineHeight: '1.3', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {isLoading ? (
          <>
            <div>日线: 加载中</div>
            <div>小时线: 加载中</div>
            <div>分钟线: 加载中</div>
          </>
        ) : isError ? (
          <div style={{ color: '#ff4d4f', fontWeight: '500', fontSize: '9px' }}>加载失败</div>
        ) : (
          <>
            <div>日线: <span style={{ fontWeight: '500', color: '#262626' }}>{counts?.daily?.count || 0}</span></div>
            <div>小时线: <span style={{ fontWeight: '500', color: '#262626' }}>{counts?.hourly?.count || 0}</span></div>
            <div>分钟线: <span style={{ fontWeight: '500', color: '#262626' }}>{counts?.minute?.count || 0}</span></div>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * 市场数据管理界面：支持查询、导入和清空功能
 * 合并日线、小时线、分钟线管理到一页
 */
// 自定义debounce hook
const useDebounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => {
        func(...args)
      }, delay)
    },
    [func, delay]
  )
}

export default function MarketDataManager() {
  const [params, setParams] = useSearchParams()
  const query = Object.fromEntries(params.entries())
  const [queryForm] = Form.useForm()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // 状态管理
  const [selectedSymbol, setSelectedSymbol] = useState(query.symbol || 'BTC')
  const [selectedGranularity, setSelectedGranularity] = useState(query.granularity || 'daily')
  
  // 使用单个API请求获取所有标的数据数量和日期范围
  const allSymbolsCountsQuery = useQuery({
    queryKey: ['all-symbols-data-counts'],
    queryFn: ({ signal }) => fetchAllSymbolsDataCount(signal),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
    retryDelay: 1000,
    enabled: true
  });

  // 根据symbol和granularity获取可用时间范围（从API动态获取）
  const availableTimeRange = useMemo<{ start: string; end: string }>(() => {
    const symbol = selectedSymbol || 'BTC'
    const granularity = selectedGranularity || 'daily'
    const data = allSymbolsCountsQuery.data?.[symbol]?.[granularity as keyof typeof allSymbolsCountsQuery.data[string]]
    if (!data) {
      return { start: '-', end: '-' }
    }
    return {
      start: data.start_date || '-',
      end: data.end_date || '-'
    }
  }, [selectedSymbol, selectedGranularity, allSymbolsCountsQuery.data])

  // 将所有标的的查询结果存储在一个对象中，方便访问
  const allSymbolCounts = useMemo((): { [key: string]: any } => {
    const allSymbolsData = allSymbolsCountsQuery.data || {};
    const result: { [key: string]: any } = {};
    
    // 为每个标的创建与原结构兼容的数据格式
    SYMBOLS.forEach(symbol => {
      const counts = allSymbolsData[symbol] || { daily: { count: 0 }, hourly: { count: 0 }, minute: { count: 0 } };
      result[symbol] = {
        data: counts,
        isLoading: allSymbolsCountsQuery.isLoading,
        isError: allSymbolsCountsQuery.isError
      };
    });
    
    return result;
  }, [allSymbolsCountsQuery.data, allSymbolsCountsQuery.isLoading, allSymbolsCountsQuery.isError]);

  // 处理搜索，包含页面和页面大小参数
  const onSearch = (values: any) => {
    const searchParams = new URLSearchParams()
    if (selectedSymbol) {
      searchParams.append('symbol', selectedSymbol)
    }
    if (values.granularity) {
      searchParams.append('granularity', values.granularity)
    }
    if (values.dateRange?.[0]) {
      searchParams.append('start_date', values.dateRange[0].toISOString())
    }
    if (values.dateRange?.[1]) {
      searchParams.append('end_date', values.dateRange[1].toISOString())
    }
    if (values.trend) {
      searchParams.append('trend', values.trend)
    }
    // 保持当前页面和页面大小参数
    if (query.page) {
      searchParams.append('page', query.page)
    }
    if (query.page_size) {
      searchParams.append('page_size', query.page_size)
    }
    navigate({ search: searchParams.toString() })
  }

  // 使用自定义debounce hook优化表单值变化处理，避免无限循环
  const debouncedSearch = useDebounce(
    (values: any) => {
      onSearch(values)
    },
    500
  )

  // 监听表单值变化，自动查询
  const handleValuesChange = (changedValues: any, allValues: any) => {
    // 只在特定字段变化时触发搜索
    if (changedValues.granularity || changedValues.dateRange || changedValues.trend) {
      debouncedSearch(allValues)
    }
  }

  // 获取数据
  // 注意：目前后端API只支持BTC，无论传入什么symbol，都会返回BTC的数据
  const fetchData = async (params: Record<string, any>, signal?: AbortSignal): Promise<PaginatedMarketData> => {
    const granularity = params.granularity || 'daily';
    // 明确：后端只支持BTC，忽略传入的symbol参数
    const symbol = 'BTC';
    
    // 目前后端API只支持BTC，这里根据粒度选择对应的API
    let fetchFn;
    
    if (granularity === 'daily') {
      fetchFn = fetchBTCDailyBars;
    } else if (granularity === 'hourly') {
      fetchFn = fetchBTCHourlyBars;
    } else {
      fetchFn = fetchBTCMinutelyBars;
    }
    
    try {
      // 明确：由于后端限制，始终返回BTC的数据
      const result = await fetchFn(params, signal);
      return result as PaginatedMarketData;
    } catch (error) {
      console.error(`获取${symbol} ${granularity}数据失败:`, error);
      throw error;
    }
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['market-data', params.toString()],
    queryFn: ({ signal }) => {
      const currentQuery = Object.fromEntries(params.entries());
      return fetchData({
        ...currentQuery,
        page: parseInt(currentQuery.page || '1'),
        page_size: parseInt(currentQuery.page_size || '50')
      }, signal);
    },
    enabled: true
  })

  // 使用useMemo优化初始值计算，只在query变化时重新计算
  const initialFormValues = useMemo(() => ({
    ...query,
    granularity: query.granularity || 'daily',
    // 使用更简洁的方式处理日期范围
    dateRange: (() => {
      if (!query.start_date || !query.end_date) return undefined;
      const startDate = dayjs(query.start_date);
      const endDate = dayjs(query.end_date);
      return startDate.isValid() && endDate.isValid() ? [startDate, endDate] : undefined;
    })(),
    trend: query.trend || undefined
  }), [query]);

  // 处理标的点击
  const handleSymbolClick = (symbol: string) => {
    const granularities = ['daily', 'hourly', 'minute']
    setSelectedSymbol(symbol)
    setSelectedGranularity(granularities[0])
    
    // 更新搜索参数，重置页码为1
    const searchParams = new URLSearchParams()
    searchParams.set('symbol', symbol)
    searchParams.set('granularity', granularities[0])
    searchParams.set('page', '1')
    if (query.page_size) {
      searchParams.set('page_size', query.page_size)
    }
    navigate({ search: searchParams.toString() })
  }

  // 处理颗粒度变化
  const handleGranularityChange = (granularity: string) => {
    setSelectedGranularity(granularity)
    
    // 更新搜索参数，重置页码为1
    const searchParams = new URLSearchParams()
    searchParams.set('symbol', selectedSymbol)
    searchParams.set('granularity', granularity)
    searchParams.set('page', '1')
    // 保留其他必要参数
    if (query.start_date) {
      searchParams.set('start_date', query.start_date)
    }
    if (query.end_date) {
      searchParams.set('end_date', query.end_date)
    }
    if (query.trend) {
      searchParams.set('trend', query.trend)
    }
    if (query.page_size) {
      searchParams.set('page_size', query.page_size)
    }
    navigate({ search: searchParams.toString() })
  }

  // 跳转到数据导入页面
  const handleGoToImportPage = () => {
    navigate('/data-import')
  }

  // 清空数据
  const handleClearData = () => {
    Modal.confirm({
      title: '确认清空',
      content: `确定要清空 ${selectedSymbol} 的 ${selectedGranularity === 'daily' ? '日线' : selectedGranularity === 'hourly' ? '小时线' : '分钟线'} 数据吗？此操作不可恢复。`,
      okText: '确认',
      okType: 'danger',
      cancelText: '取消',
      async onOk() {
        try {
          console.log('[清空数据] 开始清空:', { symbol: selectedSymbol, granularity: selectedGranularity })
          if (selectedGranularity === 'daily') {
            console.log('[清空数据] 调用 clearBTCDailyData，symbol:', selectedSymbol)
            const result = await clearBTCDailyData(selectedSymbol)
            console.log('[清空数据] clearBTCDailyData 返回:', result)
          } else if (selectedGranularity === 'hourly') {
            console.log('[清空数据] 调用 clearBTCHourlyData，symbol:', selectedSymbol)
            const result = await clearBTCHourlyData(selectedSymbol)
            console.log('[清空数据] clearBTCHourlyData 返回:', result)
          } else {
            console.log('[清空数据] 调用 clearBTCMinutelyData，symbol:', selectedSymbol)
            const result = await clearBTCMinutelyData(selectedSymbol)
            console.log('[清空数据] clearBTCMinutelyData 返回:', result)
          }
          message.success('数据清空成功')
          queryClient.invalidateQueries({ queryKey: ['all-symbols-data-counts'] })
          queryClient.invalidateQueries({ queryKey: ['market-data'] })
        } catch (error: any) {
          console.error('[清空数据] 失败:', error)
          message.error(error.message || '清空数据失败')
        }
      }
    })
  }

  // 表格容器Ref和高度状态
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const [tableScrollY, setTableScrollY] = useState<number>(500)

  // 监听表格容器高度变化，动态调整表格滚动区域高度
  useEffect(() => {
    if (!tableContainerRef.current) return

    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        const { height } = entry.contentRect
        // 减去表头高度(~47px)和分页高度(~64px)，预留少量缓冲
        // header: ~47px (size="middle")
        // pagination: ~64px
        setTableScrollY(Math.max(200, height - 120))
      }
    })

    resizeObserver.observe(tableContainerRef.current)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  // 表格列定义，使用useMemo优化性能
  const columns = useMemo(() => [
    { 
      title: '日期(Date)', 
      dataIndex: 'date', 
      key: 'date', 
      render: (date: string) => formatUTC(date), 
      fixed: 'left' as const, 
      width: 180,
      ellipsis: true,
      align: 'center' as const,
      headerAlign: 'center' as const,
      style: { fontWeight: '500' }
    },
    { 
      title: '开盘价(Open)', 
      dataIndex: 'open', 
      key: 'open', 
      width: 100,
      align: 'right' as const,
      headerAlign: 'center' as const,
      ellipsis: true,
      render: (value: any) => value || '-'
    },
    { 
      title: '最高价(High)', 
      dataIndex: 'high', 
      key: 'high', 
      width: 100,
      align: 'right' as const,
      headerAlign: 'center' as const,
      ellipsis: true,
      render: (value: any) => value || '-'
    },
    { 
      title: '最低价(Low)', 
      dataIndex: 'low', 
      key: 'low', 
      width: 100,
      align: 'right' as const,
      headerAlign: 'center' as const,
      ellipsis: true,
      render: (value: any) => value || '-'  
    },
    { 
      title: '收盘价(Close)', 
      dataIndex: 'close', 
      key: 'close', 
      width: 100,
      align: 'right' as const,
      headerAlign: 'center' as const,
      ellipsis: true,
      render: (value: any) => value || '-',
      style: { fontWeight: '500' }
    },
    { 
      title: '成交量(Volume)', 
      dataIndex: 'volume', 
      key: 'volume', 
      width: 120,
      align: 'right' as const,
      headerAlign: 'center' as const,
      ellipsis: true,
      render: (value: any) => value || '-'  
    },
    { 
      title: '涨跌额(Change)', 
      dataIndex: 'change', 
      key: 'change', 
      width: 100,
      align: 'right' as const,
      headerAlign: 'center' as const,
      ellipsis: true,
      render: (value: any) => value || '-'  
    },
    { 
      title: '涨跌幅(%)', 
      dataIndex: 'pct_chg', 
      key: 'pct_chg', 
      width: 100,
      align: 'right' as const,
      headerAlign: 'center' as const,
      ellipsis: true,
      render: (value: any) => value || '-'  
    },
    { 
      title: '振幅(%)', 
      dataIndex: 'amplitude', 
      key: 'amplitude', 
      width: 100,
      align: 'right' as const,
      headerAlign: 'center' as const,
      ellipsis: true,
      render: (value: any) => value || '-'  
    },
    { 
      title: '5日均线', 
      dataIndex: 'close_5_sma', 
      key: 'close_5_sma', 
      width: 100,
      align: 'right' as const,
      headerAlign: 'center' as const,
      ellipsis: true,
      render: (value: any) => value || '-'  
    },
    { 
      title: '20日均线', 
      dataIndex: 'close_20_sma', 
      key: 'close_20_sma', 
      width: 100,
      align: 'right' as const,
      headerAlign: 'center' as const,
      ellipsis: true,
      render: (value: any) => value || '-'  
    },
    { 
      title: '50日均线', 
      dataIndex: 'close_50_sma', 
      key: 'close_50_sma', 
      width: 100,
      align: 'right' as const,
      headerAlign: 'center' as const,
      ellipsis: true,
      render: (value: any) => value || '-'  
    },
    { 
      title: '60日均线', 
      dataIndex: 'close_60_sma', 
      key: 'close_60_sma', 
      width: 100,
      align: 'right' as const,
      headerAlign: 'center' as const,
      ellipsis: true,
      render: (value: any) => value || '-'  
    },
    { 
      title: '200日均线', 
      dataIndex: 'close_200_sma', 
      key: 'close_200_sma', 
      width: 110,
      align: 'right' as const,
      headerAlign: 'center' as const,
      ellipsis: true,
      render: (value: any) => value || '-'  
    },
    { 
      title: '12日EMA', 
      dataIndex: 'close_12_ema', 
      key: 'close_12_ema', 
      width: 100,
      align: 'right' as const,
      headerAlign: 'center' as const,
      ellipsis: true,
      render: (value: any) => value || '-'  
    },
    { 
      title: '26日EMA', 
      dataIndex: 'close_26_ema', 
      key: 'close_26_ema', 
      width: 100,
      align: 'right' as const,
      headerAlign: 'center' as const,
      ellipsis: true,
      render: (value: any) => value || '-'  
    },
    { 
      title: 'MACD', 
      dataIndex: 'macd', 
      key: 'macd', 
      width: 100,
      align: 'right' as const,
      headerAlign: 'center' as const,
      ellipsis: true,
      render: (value: any) => value || '-'
    },
    { 
      title: 'MACD信号线', 
      dataIndex: 'macds', 
      key: 'macds', 
      width: 110,
      align: 'right' as const,
      headerAlign: 'center' as const,
      ellipsis: true,
      render: (value: any) => value || '-'  
    },
    { 
      title: 'MACD柱状图', 
      dataIndex: 'macdh', 
      key: 'macdh', 
      width: 110,
      align: 'right' as const,
      headerAlign: 'center' as const,
      ellipsis: true,
      render: (value: any) => value || '-'  
    },
    { 
      title: '6日RSI', 
      dataIndex: 'rsi_6', 
      key: 'rsi_6', 
      width: 100,
      align: 'right' as const,
      headerAlign: 'center' as const,
      ellipsis: true,
      render: (value: any) => value || '-'  
    },
    { 
      title: '12日RSI', 
      dataIndex: 'rsi_12', 
      key: 'rsi_12', 
      width: 100,
      align: 'right' as const,
      headerAlign: 'center' as const,
      ellipsis: true,
      render: (value: any) => value || '-'  
    },
    { 
      title: '24日RSI', 
      dataIndex: 'rsi_24', 
      key: 'rsi_24', 
      width: 100,
      align: 'right' as const,
      headerAlign: 'center' as const,
      ellipsis: true,
      render: (value: any) => value || '-'  
    },
    { 
      title: 'KDJ-K', 
      dataIndex: 'kdjk', 
      key: 'kdjk', 
      width: 100,
      align: 'right' as const,
      headerAlign: 'center' as const,
      ellipsis: true,
      render: (value: any) => value || '-'  
    },
    { 
      title: 'KDJ-D', 
      dataIndex: 'kdjd', 
      key: 'kdjd', 
      width: 100,
      align: 'right' as const,
      headerAlign: 'center' as const,
      ellipsis: true,
      render: (value: any) => value || '-'  
    },
    { 
      title: 'KDJ-J', 
      dataIndex: 'kdjj', 
      key: 'kdjj', 
      width: 100,
      align: 'right' as const,
      headerAlign: 'center' as const,
      ellipsis: true,
      render: (value: any) => value || '-'  
    },
    { 
      title: '布林中轨', 
      dataIndex: 'boll', 
      key: 'boll', 
      width: 100,
      align: 'right' as const,
      headerAlign: 'center' as const,
      ellipsis: true,
      render: (value: any) => value || '-'  
    },
    { 
      title: '布林上轨', 
      dataIndex: 'boll_ub', 
      key: 'boll_ub', 
      width: 110,
      align: 'right' as const,
      headerAlign: 'center' as const,
      ellipsis: true,
      render: (value: any) => value || '-'  
    },
    { 
      title: '布林下轨', 
      dataIndex: 'boll_lb', 
      key: 'boll_lb', 
      width: 110,
      align: 'right' as const,
      headerAlign: 'center' as const,
      ellipsis: true,
      render: (value: any) => value || '-'  
    },
    { 
      title: '5日成交量均线', 
      dataIndex: 'volume_5_sma', 
      key: 'volume_5_sma', 
      width: 120,
      align: 'right' as const,
      headerAlign: 'center' as const,
      ellipsis: true,
      render: (value: any) => value || '-' 
    },
    { 
      title: '10日成交量均线', 
      dataIndex: 'volume_10_sma', 
      key: 'volume_10_sma', 
      width: 130,
      align: 'right' as const,
      headerAlign: 'center' as const,
      ellipsis: true,
      render: (value: any) => value || '-' 
    },
    // { 
    //   title: '趋势(Trend)', 
    //   dataIndex: 'trend', 
    //   key: 'trend',
    //   width: 100,
    //   align: 'center' as const,
    //   headerAlign: 'center' as const,
    //   render: (trend: string) => {
    //     const trendConfig: { [key: string]: { color: string; label: string } } = {
    //       '上升': { color: 'green', label: '上升' },
    //       '下降': { color: 'red', label: '下降' },
    //       '横盘': { color: 'blue', label: '横盘' },
    //       '上涨': { color: 'green', label: '上涨' },
    //       '下跌': { color: 'red', label: '下跌' },
    //       '震荡': { color: 'orange', label: '震荡' }
    //     }
    //     const config = trendConfig[trend] || { color: 'default', label: trend || '未知' }
    //     return (
    //       <Tag color={config.color} style={{ fontWeight: '500' }}>
    //         {config.label}
    //       </Tag>
    //     )
    //   }
    // },
  ], [])

  return (
    <div style={{ 
      height: '100%', 
      width: '100%',
      display: 'flex', 
      flexDirection: 'column', 
      gap: '8px',
      overflow: 'hidden'
    }}>
      {/* 标的列表卡片 */}
      <Card 
        // title={<div style={{ fontSize: '14px', fontWeight: '600' }}>标的列表</div>}
        style={{ 
          width: '100%', 
          borderRadius: '6px', 
          boxShadow: '0 1px 4px rgba(0, 0, 0, 0.06)', 
          overflow: 'hidden',
          marginBottom: '12px' // 减小与下方卡片的间距
        }}
        bodyStyle={{ 
          padding: '8px', 
          backgroundColor: '#fff' 
        }}
      >
        {/* 标的容器 - 使用CSS Grid实现响应式布局 */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', 
          gap: '8px' 
        }}>
          {SYMBOLS.map(symbol => {
            const symbolData = allSymbolCounts[symbol] || { data: undefined, isLoading: false, isError: false };
            return (
              <SymbolBlock 
                key={symbol} 
                symbol={symbol} 
                selectedSymbol={selectedSymbol} 
                onSymbolClick={handleSymbolClick} 
                counts={symbolData.data} 
                isLoading={symbolData.isLoading} 
                isError={symbolData.isError} 
              />
            );
          })}
        </div>
      </Card>

      {/* 主功能卡片 */}
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
        <div style={{ flex: 'none', marginBottom: '8px' }}>
          {/* 搜索表单 */}
          <Form 
            layout="vertical" 
            initialValues={initialFormValues}
            style={{ 
              width: '100%', 
              marginBottom: '16px' 
            }}
            onFinish={onSearch}
            onValuesChange={handleValuesChange}
            form={queryForm}
          >
            <div style={{ 
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              marginBottom: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <Form.Item name="granularity" style={{ marginBottom: 0 }}>
                    <Radio.Group 
                      buttonStyle="solid"
                      value={selectedGranularity}
                      onChange={(e) => handleGranularityChange(e.target.value)}
                    >
                      {TIME_GRANULARITY_OPTIONS.map(option => (
                        <Radio.Button key={option.value} value={option.value}>
                          {option.label}
                        </Radio.Button>
                      ))}
                    </Radio.Group>
                  </Form.Item>

                  {/* 显示当前选择的标的的时间颗粒度的数据的可用时间范围 - 紧邻时间颗粒度右侧 */}
                  {selectedSymbol && (
                    <div style={{ 
                      color: '#1890ff', 
                      fontSize: '12px', 
                      fontWeight: '500',
                      padding: '6px 10px',
                      backgroundColor: '#e6f7ff',
                      borderRadius: '4px',
                      border: '1px solid #91d5ff',
                      marginBottom: 0,
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}>
                      {selectedSymbol} {selectedGranularity === 'daily' ? '日线' : selectedGranularity === 'hourly' ? '小时线' : '分钟线'} 可用时间范围: {availableTimeRange.start} ~ {availableTimeRange.end}
                    </div>
                  )}
                </div>

                <Form.Item name="dateRange" style={{ marginBottom: 0, flex: '1 1 auto', minWidth: '280px' }}>
                <RangePicker showTime style={{ width: '100%' }} />
              </Form.Item>

                {/* <Form.Item name="trend" style={{ marginBottom: 0 }}>
                  <Select placeholder="请选择趋势" allowClear style={{ width: '150px' }}>
                    <Option value="上升">上升</Option>
                    <Option value="下降">下降</Option>
                    <Option value="横盘">横盘</Option>
                  </Select>
                </Form.Item> */}

                <Button 
                  onClick={() => {
                    queryForm.resetFields()
                    navigate({ search: '' })
                  }}
                  style={{ marginBottom: 0 }}
                >
                  重置
                </Button>
              </div>

              <div style={{ 
                display: 'flex', 
                gap: '8px', 
                alignItems: 'center',
                marginBottom: 0
              }}>
                <Button 
                  type="primary" 
                  icon={<UploadOutlined />}
                  onClick={handleGoToImportPage}
                >
                  导入数据
                </Button>
                <Button 
                  danger 
                  icon={<DeleteOutlined />}
                  onClick={handleClearData}
                >
                  清空数据
                </Button>

              </div>
            </div>
          </Form>
        </div>

        {/* 数据表格 */}
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
            columns={columns}
            dataSource={data?.items || []}
            loading={isLoading}
            rowKey="date"
            pagination={{
              current: data?.page || 1,
              pageSize: data?.page_size || 50,
              total: data?.total || 0,
              showSizeChanger: true,
              showQuickJumper: true,
              pageSizeOptions: ['20', '50', '100', '200'],
              onChange: (page, pageSize) => {
                const searchParams = new URLSearchParams(query)
                searchParams.set('page', String(page))
                searchParams.set('page_size', String(pageSize))
                navigate({ search: searchParams.toString() })
              },
              style: {
                padding: '16px',
                borderTop: '1px solid #e8e8e8',
                margin: 0 // Ensure pagination sticks to bottom without extra margin
              }
            }}
            scroll={{ 
              x: 'max-content',
              y: tableScrollY
            }}
            size="middle"
            style={{
              borderRadius: '8px',
              overflow: 'hidden'
            }}
            rowClassName={(record, index) => index % 2 === 0 ? 'table-row-even' : 'table-row-odd'}
            locale={{
              emptyText: isError ? (
                <div style={{ padding: '24px', textAlign: 'center' }}>
                  <p style={{ color: '#ff4d4f', marginBottom: '8px' }}>数据加载失败</p>
                </div>
              ) : selectedSymbol ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#999' }}>
                  <p>暂无数据</p>
                </div>
              ) : (
                <div style={{ padding: '24px', textAlign: 'center', color: '#999' }}>
                  <p>请选择标的查看数据</p>
                </div>
              )
            }}
          />
        </div>
      </Card>
    </div>
  )
}