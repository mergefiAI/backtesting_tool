import React, { useState } from 'react'
import {Button, Card, Col, message, Row, Select, Spin, Statistic, Switch} from 'antd'
import ReactECharts from 'echarts-for-react'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import {useQuery, useQueryClient} from '@tanstack/react-query'
import {fetchAccounts, fetchTasks, fetchTaskStats, fetchTrendData} from '../api/endpoints'
import {api} from '../api/client'
import {useDrawer} from '../components/DetailDrawer'
import DecisionDataTable from '../components/DecisionDataTable'

dayjs.extend(utc)

/**
 * 使用 ECharts 显示两条曲线（BTC 日线与账户总额曲线）
 */
export default function KlineEcharts() {
  const [symbol, setSymbol] = React.useState('')
  const [accountId, setAccountId] = React.useState<string | undefined>(undefined)
  const [taskId, setTaskId] = React.useState<string | undefined>(undefined)
  // 任务的时间颗粒度
  const [timeGranularity, setTimeGranularity] = React.useState<string>('daily')
  // 初始化为更长的时间范围，确保加载更多历史数据
  const [range, setRange] = React.useState<any>([dayjs().subtract(1, 'year'), dayjs()])
  const [bars, setBars] = React.useState<any[]>([])
  const [equity, setEquity] = React.useState<Array<{ date: string, value: number }>>([])
  const [buyPoints, setBuyPoints] = React.useState<any[]>([])
  const [sellPoints, setSellPoints] = React.useState<any[]>([])
  const [shortSellPoints, setShortSellPoints] = React.useState<any[]>([])
  const [coverShortPoints, setCoverShortPoints] = React.useState<any[]>([])
  const [taskTimeRange, setTaskTimeRange] = React.useState<string>('')
  const [loading, setLoading] = React.useState<boolean>(false)
  // 趋势数据
  const [trendData, setTrendData] = React.useState<any[]>([])
  // 分页状态管理
  const [pagination, setPagination] = React.useState({ page: 1, pageSize: 20 })
  const dayTradesRef = React.useRef<Map<string, any[]>>(new Map())
  // 保存echarts实例
  const chartRef = React.useRef<any>(null)
  // 保存dataZoom的缩放状态
  const dataZoomRef = React.useRef<{ start: number; end: number }>({ start: 0, end: 100 })
  // 保存当前视图范围的索引
  const [viewRange, setViewRange] = React.useState<[number, number]>([0, bars.length > 0 ? bars.length - 1 : 0])
  // 竖轴模式：single(单轴) 或 dual(双轴：净值左轴、K线右轴)
  const [yAxisMode, setYAxisMode] = React.useState<'single' | 'dual'>('single')
  
  // 使用useDrawer hook获取抽屉操作
  const { actions } = useDrawer()
  
  // 获取queryClient实例，用于刷新决策数据
  const queryClient = useQueryClient()

  const { data: accounts } = useQuery({ queryKey: ['accounts-all'], queryFn: ({ signal }) => fetchAccounts({ include_latest_snapshot: false }, signal) })
  
  // 获取任务列表 - 只显示已完成的任务
  const { data: tasksData, refetch: refetchTasks } = useQuery({
      queryKey: ['tasks'],
      queryFn: ({ signal }) => fetchTasks({ page: 1, page_size: 100 }, signal),
      enabled: true
    })

  // 获取回测结果统计
  const { data: taskStats, isLoading: isStatsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['task-stats', taskId],
    queryFn: ({ signal }) => fetchTaskStats(taskId || '', signal),
    enabled: !!taskId
  })
  
  // 获取当前任务的状态
  const currentTask = React.useMemo(() => {
    if (!tasksData?.items || !taskId) return undefined;
    return tasksData.items.find((task: any) => task.task_id === taskId);
  }, [tasksData, taskId]);
  
  // 判断当前任务是否已完成
  const isTaskCompleted = React.useMemo(() => {
    return currentTask?.status === 'COMPLETED';
  }, [currentTask]);
  
  // 定时轮询相关状态
  const [isPolling, setIsPolling] = React.useState(false);
  const pollIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const currentTaskRef = React.useRef(currentTask);
  
  // 保存最新的currentTask到ref中
  React.useEffect(() => {
    currentTaskRef.current = currentTask;
  }, [currentTask]);
  
  // 自动选择最近的任务
  React.useEffect(() => {
    if (tasksData?.items && tasksData.items.length > 0) {
      const localDecisionTasks = tasksData.items.filter((t: any) => t.type === 'LocalDecision')
      if (localDecisionTasks.length === 0) return
      
      const isCurrentTaskInList = localDecisionTasks.find((t: any) => t.task_id === taskId)
      
      if (!taskId || !isCurrentTaskInList) {
        const latestTask = localDecisionTasks[0]
        setTaskId(latestTask.task_id)
        // 手动设置时间范围，避免循环依赖
        if (latestTask.start_date && latestTask.end_date) {
          const timeRange = `${dayjs(latestTask.start_date).format('YYYY-MM-DD HH:mm')} 至 ${dayjs(latestTask.end_date).format('YYYY-MM-DD HH:mm')}`
          setTaskTimeRange(timeRange)
          // 设置range为任务的时间范围
          setRange([dayjs(latestTask.start_date), dayjs(latestTask.end_date)])
        } else if (latestTask.created_at) {
          const timeRange = `创建于: ${dayjs(latestTask.created_at).format('YYYY-MM-DD HH:mm')}`
          setTaskTimeRange(timeRange)
          // 设置range为创建时间前后30天
          setRange([dayjs(latestTask.created_at).subtract(30, 'day'), dayjs(latestTask.created_at).add(30, 'day')])
        }
        
        // 设置账户和股票信息
        setAccountId(latestTask.account_id)
        const acc = (accounts?.items || []).find((a: any) => a.account_id === latestTask.account_id)
        setSymbol(acc?.stock_symbol || latestTask.stock_symbol || '')
        // 设置任务的时间颗粒度
        setTimeGranularity(latestTask.time_granularity || 'daily')
      }
    }
  }, [tasksData, taskId])

  /**
   * 加载 BTC 日线与账户总额曲线（按日对齐并前向填充）
   */
  const loadData = React.useCallback(async () => {
    if (!symbol) return
    try {
      if (bars.length === 0) {
        setLoading(true)
      }
      const fetchAllPages = async (url: string, baseParams: any) => {
        const pageSize = 1000
        let page = 1
        let all: any[] = []
        while (true) {
          const resp = await api.get(url, { 
            params: { 
              ...baseParams, 
              page, 
              page_size: pageSize,
              _t: Date.now()
            } 
          })
          const data = resp?.data?.data
          const items = (data?.items || [])
          all = all.concat(items)
          const totalPages = data?.total_pages || 1
          if (page >= totalPages) break
          page += 1
        }
        return all
      }

      // 根据时间颗粒度选择不同的API端点
      const klineEndpoint = {
        daily: '/api/market/btc/daily',
        hourly: '/api/market/btc/hourly',
        minute: '/api/market/btc/minute'
      }[timeGranularity] || '/api/market/btc/daily'
      
      const [klineItems, equityResponse, tradeItems, trendResponse] = await Promise.all([
        fetchAllPages(klineEndpoint, {
          task_id: taskId
        }),
        accountId ? api.get('/api/account/total-series', {
          params: {
            task_id: taskId,
            _t: Date.now()
          }
        }) : Promise.resolve({ data: { data: [] } }),
        accountId ? fetchAllPages('/api/trade/history', {
          task_id: taskId,
          sort_order: 'asc'
        }) : Promise.resolve([]),
        fetchTrendData(symbol, taskId)
      ])

      // 处理K线数据，直接使用后端返回的UTC时间，不进行时区转换
      const items = (klineItems || [])
        .filter((i: any) => [i.open, i.close, i.low, i.high].every((v) => Number.isFinite(Number(v))))
        .map((i: any) => ({
          date: i.date || i.trade_date,
          open: Number(i.open),
          close: Number(i.close),
          low: Number(i.low),
          high: Number(i.high)
        }))
      setBars(items)

      // 处理账户总额曲线数据
      let equityData: Array<{ date: string, value: number }> = []
      if (accountId) {
        const series = (equityResponse?.data?.data || []) as any[]
        
        // 根据时间粒度选择不同的时间格式，使用UTC时间确保与后端一致
      const getTimeKey = (date: string) => {
        switch (timeGranularity) {
          case 'hourly':
            return dayjs.utc(date).format('YYYY-MM-DD HH:00')
          case 'minute':
            return dayjs.utc(date).format('YYYY-MM-DD HH:mm')
          default: // daily
            return dayjs.utc(date).format('YYYY-MM-DD')
        }
      }
        
        const timeMap = new Map<string, number>()
        series.forEach((s: any) => {
          const timeKey = getTimeKey(s.date)
          const v = Number(s.total_value)
          if (Number.isFinite(v)) timeMap.set(timeKey, v)
        })
        let last: number | null = null
        equityData = items.map((b: any) => {
          const timeKey = getTimeKey(b.date)
          const cur = timeMap.get(timeKey)
          if (Number.isFinite(cur as number)) last = cur as number
          return { date: b.date, value: (Number.isFinite(cur as number) ? (cur as number) : (last ?? NaN)) }
        }).filter((e: any) => Number.isFinite(e.value))
      }
      setEquity(equityData)

      // 处理交易点数据
      let buys: any[] = []
      let sells: any[] = []
      let shortSells: any[] = []
      let coverShorts: any[] = []
      const dayTrades = new Map<string, any[]>()
      if (accountId) {
        const trades = (tradeItems || []) as any[]
        // 构建坐标轴日期映射，解决交易时间与日线坐标不一致问题，使用UTC时间确保与后端一致
        const axisDays = items.map((b: any) => ({
          axis: b.date,
          day: dayjs.utc(b.date).format('YYYY-MM-DD HH:mm'),
          epoch: dayjs.utc(b.date).startOf('day').valueOf()
        }))
        const dayToAxis = new Map<string, string>(axisDays.map((d: any) => [d.day, d.axis]))
        const epochs = axisDays.map((d: any) => d.epoch)
        const epochToAxis = new Map<number, string>(axisDays.map((d: any) => [d.epoch, d.axis]))
        const mapTradeTimeToAxis = (tradeTime: string) => {
          const td = dayjs.utc(tradeTime)
          const tDay = td.format('YYYY-MM-DD HH:mm')
          const direct = dayToAxis.get(tDay)
          if (direct) return direct
          const tEpoch = td.startOf('day').valueOf()
          // 二分查找最近不大于 tEpoch 的日期
          let lo = 0, hi = epochs.length - 1, ans = 0
          while (lo <= hi) {
            const mid = (lo + hi) >> 1
            if (epochs[mid] <= tEpoch) { ans = mid; lo = mid + 1 } else { hi = mid - 1 }
          }
          return epochToAxis.get(epochs[ans]) || null
        }
        trades.forEach((t) => {
          const price = Number(t.price)
          if (!Number.isFinite(price)) return
          const x = mapTradeTimeToAxis(t.trade_time)
          if (!x) return
          const point = { value: [x, price], quantity: Number(t.quantity), fee: Number(t.fee), time: t.trade_time, id: t.trade_id }
          if (t.trade_action === 'BUY') {
            buys.push(point)
            const day = dayjs(t.trade_time).format('YYYY-MM-DD')
            const arr = dayTrades.get(day) || []
            arr.push({ action: 'BUY', price: price, quantity: point.quantity, fee: point.fee, time: point.time })
            dayTrades.set(day, arr)
          } else if (t.trade_action === 'SELL') {
            sells.push(point)
            const day = dayjs(t.trade_time).format('YYYY-MM-DD')
            const arr = dayTrades.get(day) || []
            arr.push({ action: 'SELL', price: price, quantity: point.quantity, fee: point.fee, time: point.time })
            dayTrades.set(day, arr)
          } else if (t.trade_action === 'SHORT_SELL') {
            shortSells.push(point)
            const day = dayjs(t.trade_time).format('YYYY-MM-DD')
            const arr = dayTrades.get(day) || []
            arr.push({ action: 'SHORT_SELL', price: price, quantity: point.quantity, fee: point.fee, time: point.time })
            dayTrades.set(day, arr)
          } else if (t.trade_action === 'COVER_SHORT') {
            coverShorts.push(point)
            const day = dayjs(t.trade_time).format('YYYY-MM-DD')
            const arr = dayTrades.get(day) || []
            arr.push({ action: 'COVER_SHORT', price: price, quantity: point.quantity, fee: point.fee, time: point.time })
            dayTrades.set(day, arr)
          }
        })
      }
      setBuyPoints(buys)
      setSellPoints(sells)
      setShortSellPoints(shortSells)
      setCoverShortPoints(coverShorts)
      dayTradesRef.current = dayTrades
      
      // 设置趋势数据
      setTrendData(trendResponse || [])
      
      // 重置视图范围
      setViewRange([0, items.length > 0 ? items.length - 1 : 0])
      
      // 数据加载完成后刷新统计信息
      try {
        await refetchStats()
        
        // 刷新决策关联列表数据
        queryClient.invalidateQueries({
          queryKey: ['local-decisions']
        })
      } catch (error: any) {
        // 忽略CanceledError错误，这是正常的请求取消
        if (error?.code !== 'ERR_CANCELED' && error?.name !== 'CanceledError') {
          console.error('刷新统计信息失败:', error)
        }
      }
    } catch (e: any) {
      message.error(e?.message || '数据加载失败')
    } finally {
      // 无论成功或失败，都关闭加载状态
      setLoading(false)
    }
  }, [symbol, accountId, taskId, range?.[0], range?.[1], timeGranularity, refetchStats])

  React.useEffect(() => { loadData() }, [loadData])
  
  // 定时轮询逻辑：当任务处于RUNNING状态时，每20秒更新一次数据
  React.useEffect(() => {
    // 清除现有定时器
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
      setIsPolling(false);
    }
    
    // 如果任务正在运行，启动定时器
    if (taskId && currentTask?.status === 'RUNNING') {
      // 立即执行一次更新
      loadData();
      
      // 启动定时器，每20秒更新一次
      pollIntervalRef.current = setInterval(async () => {
        // 先刷新任务列表，获取最新的任务状态
        await refetchTasks();
        
        // 重新获取最新的任务状态
        const latestTask = tasksData?.items?.find((t: any) => t.task_id === taskId);
        if (latestTask?.status !== 'RUNNING') {
          // 任务已完成或停止，先更新一次数据，然后清除定时器
          await loadData();
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
            setIsPolling(false);
          }
          return;
        }
        // 任务仍在运行，继续更新
        await loadData();
      }, 20000); // 20秒
      
      setIsPolling(true);
    }
    
    // 组件卸载或依赖变化时清除定时器
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
        setIsPolling(false);
      }
    };
  }, [taskId, currentTask?.status, loadData, tasksData]); // 重新添加tasksData依赖，确保能获取最新的任务状态

  // 当任务状态从RUNNING变为其他状态时，最后更新一次数据
  React.useEffect(() => {
    // 只有当任务存在且状态不是RUNNING时，才执行最后一次更新
    if (taskId && currentTask?.status && currentTask?.status !== 'RUNNING') {
      loadData();
    }
  }, [taskId, currentTask?.status, loadData]);

  const equityMap = React.useMemo(() => {
    // 根据时间粒度选择不同的时间格式，使用UTC时间确保与后端一致
    const getTimeKey = (date: string) => {
      switch (timeGranularity) {
        case 'hourly':
          return dayjs.utc(date).format('YYYY-MM-DD HH:00')
        case 'minute':
          return dayjs.utc(date).format('YYYY-MM-DD HH:mm')
        default: // daily
          return dayjs.utc(date).format('YYYY-MM-DD')
      }
    }
    
    const m = new Map<string, number>()
    equity.forEach((e) => {
      const d = getTimeKey(e.date)
      m.set(d, e.value)
    })
    return m
  }, [equity, timeGranularity])

  // 保存格式化日期到原始日期的映射，用于非series点击时查找原始UTC时间
  const [formattedDateToOriginal, setFormattedDateToOriginal] = React.useState<Map<string, string>>(new Map())
  
  // 当bars数据变化时，更新格式化日期到原始日期的映射
  React.useEffect(() => {
    const formatDateMap = new Map<string, string>()
    bars.forEach((i) => {
      const originalDate = i.date
      const formattedDate = dayjs.utc(originalDate).format('YYYY-MM-DD HH:mm')
      formatDateMap.set(formattedDate, originalDate)
    })
    setFormattedDateToOriginal(formatDateMap)
  }, [bars])

  // 处理趋势数据，生成柱状图数据
  const getTrendBarData = React.useMemo(() => {
    if (!trendData || !trendData.length || !bars || !bars.length) {
      return []
    }

    // 创建日期到趋势的映射，使用YYYY-MM-DD格式作为键
    const trendMap = new Map<string, string>()
    trendData.forEach((t) => {
      if (t && t.date) {  // 添加null检查
        try {
          const dateKey = dayjs.utc(t.date).format('YYYY-MM-DD')
          if (t.trend) {  // 确保trend存在
            trendMap.set(dateKey, t.trend)
          }
        } catch (error) {
          console.warn('处理趋势数据时出错:', error, t)
        }
      }
    })

    // 为每个bar生成对应的趋势数据
    const barData = bars.map((bar) => {
      if (!bar || !bar.date) {  // 添加bar数据的有效性检查
        return [null, 0, '']
      }
      
      try {
        const barDate = dayjs.utc(bar.date)
        const dateKey = barDate.format('YYYY-MM-DD')
        const trend = trendMap.get(dateKey) || ''
        
        // 根据趋势类型映射到对应的数值
        let trendValue = 0
        if (trend.includes('多头')) {
          trendValue = 1
        } else if (trend.includes('空头')) {
          trendValue = -1
        } else if (trend.includes('震荡')) {
          trendValue = 0
        }
        
        return [bar.date, trendValue, trend]
      } catch (error) {
        console.warn('处理bar数据时出错:', error, bar)
        return [bar.date || null, 0, '']
        }
      })

      return barData
  }, [trendData, bars])

  // 生成markArea数据，用于在图表和dataZoom中显示趋势区域
  const trendMarkAreaData = React.useMemo(() => {
    if (!trendData || !trendData.length || !bars || !bars.length) {
      return [];
    }
    
    // 创建日期到趋势的映射，使用YYYY-MM-DD格式作为键
    const trendMap = new Map<string, string>();
    trendData.forEach((t) => {
      if (t.date) {
        const dateKey = dayjs.utc(t.date).format('YYYY-MM-DD');
        trendMap.set(dateKey, t.trend);
      }
    });
    
    // 为每个趋势类型生成markArea数据
    const markAreaData: any[] = [];
    let currentTrend = '';
    let startIndex = 0;
    
    bars.forEach((bar, index) => {
      const barDate = dayjs.utc(bar.date);
      const dateKey = barDate.format('YYYY-MM-DD');
      const trend = trendMap.get(dateKey) || '';
      
      // 当趋势变化或到达最后一个数据点时，生成一个区域
      if (trend !== currentTrend || index === bars.length - 1) {
        if (currentTrend && startIndex !== index) {
          // 根据趋势类型设置颜色
          let color = '#95a5a6'; // 默认灰色
          if (currentTrend.includes('多头')) {
            color = '#2ecc71'; // 多头趋势：绿色
          } else if (currentTrend.includes('空头')) {
            color = '#e74c3c'; // 空头趋势：红色
          }
          
          // 生成markArea区域
          markAreaData.push({
            name: currentTrend,
            value: [
              { xAxis: startIndex },
              { xAxis: index === bars.length - 1 ? index : index - 1 }
            ],
            itemStyle: {
              color: color
            }
          });
        }
        
        currentTrend = trend;
        startIndex = index;
      }
    });
    
    return markAreaData;
  }, [trendData, bars])


  
  // 处理图表点击事件
  const handleChartClick = (params: any) => {
    let clickedDate: string | null = null
    
    // 优先使用事件中的name或axisValue作为x轴类别
    const axisVal = (params?.name as string) || (params?.axisValue as string)
    
    if (params.componentType === 'series') {
      const seriesType = params?.seriesType
      if (seriesType === 'scatter') {
        // 对于散点，x值存放在value[0]，确保使用原始UTC时间
        const v = Array.isArray(params?.value) ? params.value : (params?.data?.value || [])
        clickedDate = (v && v[0]) || null
      } else {
        // 线/蜡烛图按索引映射到bars，使用原始UTC时间
        clickedDate = (params.dataIndex !== undefined && bars[params.dataIndex]) ? bars[params.dataIndex].date : null
      }
    } else {
      // 非series点击，根据格式化日期查找原始UTC时间
      if (axisVal) {
        clickedDate = formattedDateToOriginal.get(axisVal) || null
      }
    }
    
    // 添加调试信息
    console.log('handleChartClick params:', params);
    console.log('handleChartClick state:', { symbol, accountId, taskId, clickedDate, axisVal });
    
    if (clickedDate) {
      // 确保symbol有值
      if (!symbol && bars.length > 0) {
        // 从bars中获取第一个数据点的股票代码作为symbol
        const firstBar = bars[0];
        if (firstBar && firstBar.symbol) {
          setSymbol(firstBar.symbol);
        } else if (firstBar && firstBar.symbol) {
          setSymbol(firstBar.symbol);
        }
      }
      
      // 打开抽屉，显示关联数据
      actions.openDrawer('kline-related', clickedDate, { symbol, accountId, taskId, range });
    }
  };

  /**
   * 根据模式生成y轴配置
   * single: 使用左侧单轴
   * dual: 左侧净值轴、右侧价格轴
   */
  const getYAxisConfig = React.useCallback(() => {
    // 自定义y轴刻度格式化函数
    const axisLabelFormatter = (value: number) => {
      // 当数值大于1000时，显示为整数
      if (Math.abs(value) >= 1000) {
        return value.toFixed(0);
      }
      // 当数值在100-1000之间时，最多显示1位小数
      if (Math.abs(value) >= 100) {
        return value.toFixed(1);
      }
      // 当数值在1-100之间时，最多显示2位小数
      if (Math.abs(value) >= 1) {
        return value.toFixed(2);
      }
      // 当数值小于1时，显示4位小数
      return value.toFixed(4);
    };
    
    // 计算合适的刻度间隔
    const calculateInterval = (min: number, max: number) => {
      const range = max - min;
      const desiredTicks = 5; // 期望的刻度数量
      let interval = Math.ceil(range / desiredTicks);
      
      // 调整间隔为更美观的数值
      if (interval >= 10000) {
        interval = Math.ceil(interval / 10000) * 10000;
      } else if (interval >= 1000) {
        interval = Math.ceil(interval / 1000) * 1000;
      } else if (interval >= 100) {
        interval = Math.ceil(interval / 100) * 100;
      } else if (interval >= 10) {
        interval = Math.ceil(interval / 10) * 10;
      }
      
      return interval;
    };
    
    // 调整min和max到最近的间隔倍数
    const adjustToInterval = (value: number, interval: number, roundUp: boolean) => {
      if (roundUp) {
        return Math.ceil(value / interval) * interval;
      } else {
        return Math.floor(value / interval) * interval;
      }
    };
    
    if (yAxisMode === 'dual') {
      return [
        {
          type: 'value',
          position: 'left',
          scale: true,
          name: '净值',
          axisLabel: { formatter: axisLabelFormatter }
        },
        {
          type: 'value',
          position: 'right',
          scale: true,
          name: '价格',
          axisLabel: { formatter: axisLabelFormatter }
        },
      ]
    }
    // 单轴模式 - 根据当前视图范围计算动态范围
    // 过滤K线数据到当前视图范围
    const filteredBars = bars.slice(viewRange[0], viewRange[1] + 1);
    const klineValues = filteredBars.flatMap(i => [i.open, i.close, i.low, i.high]).filter(v => Number.isFinite(v));
    const klineMin = klineValues.length > 0 ? Math.min(...klineValues) : 0;
    const klineMax = klineValues.length > 0 ? Math.max(...klineValues) : 1;
    
    // 过滤净值数据到当前视图范围
    const filteredEquity = equity.filter((e, index) => index >= viewRange[0] && index <= viewRange[1]);
    const equityValues = filteredEquity.map(e => e.value).filter(v => Number.isFinite(v));
    const equityMin = equityValues.length > 0 ? Math.min(...equityValues) : 0;
    const equityMax = equityValues.length > 0 ? Math.max(...equityValues) : 1;
    
    // 过滤交易点到当前视图范围
    const filteredTradePoints = [...buyPoints, ...sellPoints, ...shortSellPoints, ...coverShortPoints].filter((point) => {
      const index = bars.findIndex((bar: any) => bar.date === point.value[0]);
      return index >= viewRange[0] && index <= viewRange[1];
    });
    const tradeValues = filteredTradePoints.map(p => Array.isArray(p.value) ? p.value[1] : p.value).filter(v => Number.isFinite(v));
    const tradeMin = tradeValues.length > 0 ? Math.min(...tradeValues) : 0;
    const tradeMax = tradeValues.length > 0 ? Math.max(...tradeValues) : 1;
    
    // 合并所有数据的范围
    const allMin = Math.min(klineMin, equityMin, tradeMin);
    const allMax = Math.max(klineMax, equityMax, tradeMax);
    // 添加一些边距，确保数据不会紧贴边缘
    const margin = (allMax - allMin) * 0.05;
    let minWithMargin = allMin - margin;
    let maxWithMargin = allMax + margin;
    
    // 计算刻度间隔
    const interval = calculateInterval(minWithMargin, maxWithMargin);
    
    // 调整min和max到最近的间隔倍数
    minWithMargin = adjustToInterval(minWithMargin, interval, false);
    maxWithMargin = adjustToInterval(maxWithMargin, interval, true);
    
    return [
      {
        type: 'value',
        position: 'left',
        name: '价格/净值',
        axisLabel: { formatter: axisLabelFormatter },
        min: minWithMargin,
        max: maxWithMargin,
        interval: interval
      }
    ]
  }, [yAxisMode, bars, equity, buyPoints, sellPoints, shortSellPoints, coverShortPoints, viewRange])

  /**
   * 构建 ECharts 配置，显示K线 + 净值与净值线
   */
  const option = React.useMemo(() => ({
    // 性能优化：关闭不必要的动画
    animation: false,
    // 性能优化：启用渐进式渲染
    progressive: 200,
    // 性能优化：设置渐进式渲染阈值
    progressiveThreshold: 500,
    // 调整图表边距，减少左右空白
    grid: {
      left: '3%',
      right: '3%',
      top: '10%',
      bottom: '10%',
      containLabel: true
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      renderMode: 'html',
      confine: true,
      extraCssText: 'white-space:pre-line; background-color: rgba(0, 0, 0, 0.8); color: white; border-radius: 4px; padding: 8px; font-size: 12px;',
      formatter: (params: any[]) => {
        if (!params || params.length === 0) return ''
        const axisVal = params[0]?.axisValue as string
        const day = dayjs(axisVal).format('YYYY-MM-DD HH:mm')
        let klineVal: any[] | undefined
        let eqVal: number | undefined
        let currentPoint: any = null
        
        // 检查是否悬停在买卖点上
        params.forEach((p) => {
          if (p?.seriesName === 'K线') klineVal = p?.data
          if (p?.seriesName === '净值') eqVal = p?.data
          if (p?.seriesName === '买入' || p?.seriesName === '卖出' || p?.seriesName === '做空卖出' || p?.seriesName === '买入平仓') {
            currentPoint = p
          }
        })
        
        const lines: string[] = []
        lines.push(`<b style="color: #1890ff;">日期(UTC):</b> ${dayjs.utc(axisVal).format('YYYY-MM-DD HH:mm')}`)
        
        if (klineVal) {
          lines.push(`<b style="color: #52c41a;">K线数据:</b>`)
          lines.push(`• 开盘: ${klineVal[1]}`)
          lines.push(`• 收盘: ${klineVal[2]}`)
          lines.push(`• 最低: ${klineVal[3]}`)
          lines.push(`• 最高: ${klineVal[4]}`)
        }
        
        if (eqVal !== undefined) {
          lines.push(`<b style="color: #faad14;">净值:</b> ${eqVal}`)
        }
        
        // 如果悬停在买卖点上，显示该点的详细信息
        if (currentPoint) {
          const pointData = currentPoint.data
          const pointInfo = pointData?.value ? pointData : { value: pointData }
          const price = pointInfo.value[1]
          const quantity = pointInfo.quantity || 0
          const fee = pointInfo.fee || 0
          const time = pointInfo.time || ''
          let action = ''
          let actionColor = ''
          
          if (currentPoint.seriesName === '买入') {
            action = '买入'
            actionColor = '#2ecc71'
          } else if (currentPoint.seriesName === '卖出') {
            action = '卖出'
            actionColor = '#e74c3c'
          } else if (currentPoint.seriesName === '做空卖出') {
            action = '做空卖出'
            actionColor = '#ff6b35'
          } else if (currentPoint.seriesName === '买入平仓') {
            action = '买入平仓'
            actionColor = '#ffa500'
          }
          
          lines.push(`<br/><b style="color: ${actionColor};">${action}点详情:</b>`)
          lines.push(`• 价格: ${price}`)
          lines.push(`• 数量: ${quantity}`)
          if (time) {
            lines.push(`• 时间: ${dayjs.utc(time).format('YYYY-MM-DD HH:mm')}`)
          }
        } else {
          // 否则显示当天所有交易
          const trades = dayTradesRef.current.get(day) || []
          if (trades.length) {
            lines.push('<br/><b style="color: #722ed1;">当日交易:</b>')
            trades.forEach((t, index) => {
              const actionColor = t.action === 'BUY' ? '#2ecc71' : 
                               t.action === 'SELL' ? '#e74c3c' :
                               t.action === 'SHORT_SELL' ? '#ff6b35' : '#ffa500'
              const tradeIndex = index + 1
              const actionText = t.action === 'BUY' ? '买入' :
                               t.action === 'SELL' ? '卖出' :
                               t.action === 'SHORT_SELL' ? '做空卖出' : '买入平仓'
              lines.push(`<br/>• <span style="color: ${actionColor};">${tradeIndex}. ${actionText}</span>`)
              lines.push(`  - 价格: ${t.price}`)
              lines.push(`  - 数量: ${t.quantity}`)
              lines.push(`  - 时间: ${dayjs.utc(t.time).format('YYYY-MM-DD HH:mm')}`)
            })
          }
        }
        
        return lines.join('<br/>')
      }
    },
    legend: { 
      data: ['K线', '净值', '买入', '卖出', '做空卖出', '买入平仓', '多头趋势', '空头趋势', '震荡趋势'],
      top: 0 
    },
    // 添加dataZoom组件，实现鼠标滚动缩放和左右拖动
    dataZoom: [
      {
        type: 'inside',
        start: dataZoomRef.current.start,
        end: dataZoomRef.current.end,
        zoomLock: false,
        // 支持鼠标滚轮缩放
        wheelZoom: true,
        // 支持鼠标拖动
        moveOnMouseMove: true,
        // 支持左右键拖动
        moveOnMouseWheel: true,
        preventDefaultMouseMove: true,
        // 性能优化：启用lazyLoad
        lazyLoad: true
      },
      {
        // type: 'slider',
        start: dataZoomRef.current.start,
        end: dataZoomRef.current.end,
        height: 20,
        bottom: 0,
        borderColor: '#ccc',
        fillerColor: 'rgba(144, 197, 237, 0.2)',
        handleStyle: {
          color: '#409EFF',
          borderColor: '#409EFF'
        },
        // 显示详细信息
        // showDetail: true,
        // 背景颜色
        // backgroundColor: '#f0f0f0',
        // 性能优化：启用lazyLoad
        lazyLoad: true
      }
    ],
    xAxis: { 
      type: 'category', 
      data: bars.map((i) => i.date), 
      boundaryGap: true,
      // 性能优化：减少坐标轴标签数量
      axisLabel: {
        interval: 'auto',
        // 使用 UTC 格式：YYYY-MM-DD HH:mm
        formatter: (value: string) => {
          return dayjs.utc(value).format('YYYY-MM-DD HH:mm');
        }
      }
    },
    yAxis: getYAxisConfig(),
    series: [
      // 趋势背景系列
      { 
        type: 'custom', 
        name: '趋势', 
        renderItem: function (params: any, api: any) { 
          // 检查必要参数是否存在
          if (!params || !api || typeof api.coord !== 'function') {
            return null;
          }
          
          var categoryIndex = api.value(0);
          var value = api.value(1);
          
          try {
            // 获取x轴上的位置
            var xAxisIndex = api.coord([categoryIndex, 0])[0];
            // 计算矩形的宽度
            var xAxisNext = api.coord([categoryIndex + 1, 0])[0];
            var rectWidth = xAxisNext - xAxisIndex;
            
            // 检查是否获取到了有效的坐标
            if (isNaN(xAxisIndex) || isNaN(xAxisNext) || isNaN(rectWidth)) {
              return null;
            }
            
            // 根据趋势值设置颜色
            var color = '#95a5a6'; // 默认灰色
            if (value === 1) color = '#2ecc71'; // 多头趋势：绿色
            if (value === -1) color = '#e74c3c'; // 空头趋势：红色
            
            // 获取图表的像素边界和坐标系信息
            var viewWidth = params.coordSys ? (params.coordSys.width || 0) : 0;
            var viewHeight = params.coordSys ? (params.coordSys.height || 0) : 0;
            
            // 获取坐标系的原点（左上角位置）
            var originX = params.coordSys ? (params.coordSys.x || 0) : 0;
            var originY = params.coordSys ? (params.coordSys.y || 0) : 0;
            
            // 计算坐标系的底部位置（x轴位置）
            // 在ECharts中，y轴是从上到下的，所以底部是 originY + viewHeight
            var xAxisY = originY + viewHeight;
            
            // 计算底部显示区域（从x轴开始向上20%）
            var displayHeight = viewHeight * 0.2;
            // 从x轴位置开始绘制（xAxisY是x轴的y坐标，但我们绘制的是矩形的左上角，
            // 所以需要减去高度来定位）
            var rectY = xAxisY - displayHeight;
            
            return {
              type: 'rect',
              shape: {
                x: xAxisIndex,
                y: rectY, // 从x轴位置向上显示
                width: rectWidth,
                height: displayHeight
              },
              style: {
                fill: color,
                opacity: 0.2
              }
            };
          } catch (error) {
            // 如果发生错误，返回null，避免整个图表崩溃
            console.error('Error rendering trend background:', error);
            return null;
          }
        }, 
        encode: {
          x: 0,
          y: 1
        },
        data: getTrendBarData.map((d, index) => [index, d[1]]),
        // 性能优化：减少不必要的动画
        animation: false,
        // 确保趋势线显示在合适的层级，位于所有数据之下
        z: -100
      },
      // 多头趋势图例系列（虚拟系列，仅用于图例显示）
      { 
        type: 'line',
        name: '多头趋势',
        data: [],
        showSymbol: false,
        lineStyle: {
          color: '#2ecc71' // 多头趋势：绿色
        },
        itemStyle: {
          color: '#2ecc71'
        },
        animation: false
      },
      // 空头趋势图例系列（虚拟系列，仅用于图例显示）
      { 
        type: 'line',
        name: '空头趋势',
        data: [],
        showSymbol: false,
        lineStyle: {
          color: '#e74c3c' // 空头趋势：红色
        },
        itemStyle: {
          color: '#e74c3c'
        },
        animation: false
      },
      // 震荡趋势图例系列（虚拟系列，仅用于图例显示）
      { 
        type: 'line',
        name: '震荡趋势',
        data: [],
        showSymbol: false,
        lineStyle: {
          color: '#95a5a6' // 震荡趋势：灰色
        },
        itemStyle: {
          color: '#95a5a6'
        },
        animation: false
      },
      { 
        type: 'candlestick', 
        name: 'K线', 
        yAxisIndex: yAxisMode === 'dual' ? 1 : 0, 
        data: bars.map((i) => {
          if (!i) return [null, null, null, null]; // 防御性编程，防止 i 为 null
          return [i.open, i.close, i.low, i.high];
        }),
        // 性能优化：减少不必要的动画
        animation: false
      },
      { 
        type: 'line', 
        name: '净值', 
        yAxisIndex: 0, 
        smooth: true, 
        showSymbol: false, 
        lineStyle: {
          color: '#1890ff' // 蓝色
        },
        itemStyle: {
          color: '#1890ff' // 蓝色
        },
        data: bars.map((bar) => {
          // 根据时间粒度选择不同的时间格式，使用UTC时间确保与后端一致
          const getTimeKey = (date: string) => {
            switch (timeGranularity) {
              case 'hourly':
                return dayjs.utc(date).format('YYYY-MM-DD HH:00')
              case 'minute':
                return dayjs.utc(date).format('YYYY-MM-DD HH:mm')
              default: // daily
                return dayjs.utc(date).format('YYYY-MM-DD')
            }
          }
          
          if (!bar || !bar.date) return null; // 防御性编程
          
          const key = getTimeKey(bar.date)
          const val = equityMap.get(key)
          return val ?? null
        }),
        animation: false
      },
      { 
        type: 'scatter', 
        name: '买入', 
        yAxisIndex: yAxisMode === 'dual' ? 1 : 0, 
        symbol: 'path://M6,2 L2,12 L10,12 Z', 
        symbolSize: 11,
        itemStyle: { color: '#2ecc71' },
        encode: { x: 0, y: 1 },
        data: buyPoints,
        // 性能优化：减少不必要的动画
        animation: false
      },
      { 
        type: 'scatter', 
        name: '卖出', 
        yAxisIndex: yAxisMode === 'dual' ? 1 : 0, 
        symbol: 'path://M2,2 L10,2 L6,12 Z', 
        symbolSize: 11,
        itemStyle: { color: '#e74c3c' },
        encode: { x: 0, y: 1 },
        data: sellPoints,
        // 性能优化：减少不必要的动画
        animation: false
      },
      { 
        type: 'scatter', 
        name: '做空卖出', 
        yAxisIndex: yAxisMode === 'dual' ? 1 : 0, 
        symbol: 'path://M6,2 L2,12 L10,12 Z', 
        symbolSize: 11,
        itemStyle: { color: '#e74c3c' },
        encode: { x: 0, y: 1 },
        data: shortSellPoints,
        // 性能优化：减少不必要的动画
        animation: false
      },
      { 
        type: 'scatter', 
        name: '买入平仓', 
        yAxisIndex: yAxisMode === 'dual' ? 1 : 0, 
        symbol: 'path://M2,2 L10,2 L6,12 Z', 
        symbolSize: 11,
        itemStyle: { color: '#2ecc71' },
        encode: { x: 0, y: 1 },
        data: coverShortPoints,
        // 性能优化：减少不必要的动画
        animation: false
      }
    ]
  }), [bars, equityMap, buyPoints, sellPoints, dataZoomRef.current, yAxisMode, getYAxisConfig, timeGranularity])

  // 处理任务选择变化
  const handleTaskChange = (val: string) => {
    setTaskId(val)
    // 切换任务时重置页码到第一页
    setPagination({ page: 1, pageSize: 20 })
    const task = tasksData?.items?.find((t: any) => t.task_id === val)
    
    if (task) {
      // 更新回测时间范围
      if (task.start_date && task.end_date) {
        const timeRange = `${dayjs(task.start_date).format('YYYY-MM-DD HH:mm')} 至 ${dayjs(task.end_date).format('YYYY-MM-DD HH:mm')}`
        setTaskTimeRange(timeRange)
        // 设置日期范围为任务的时间范围
        setRange([dayjs(task.start_date), dayjs(task.end_date)])
      } else if (task.created_at) {
        const timeRange = `创建于: ${dayjs(task.created_at).format('YYYY-MM-DD HH:mm')}`
        setTaskTimeRange(timeRange)
        // 如果没有明确的起止日期，使用创建时间前后30天作为范围
        setRange([dayjs(task.created_at).subtract(30, 'day'), dayjs(task.created_at).add(30, 'day')])
      } else {
        setTaskTimeRange('')
        setRange([dayjs().subtract(30, 'day'), dayjs()])
      }
      
      if (task.account_id && task.account_id !== accountId) {
        setAccountId(task.account_id)
        const acc = (accounts?.items || []).find((a: any) => a.account_id === task.account_id)
        setSymbol(acc?.stock_symbol || '')
      }
      
      // 设置任务的时间颗粒度
      setTimeGranularity(task.time_granularity || 'daily')
    } else {
      setTaskTimeRange('')
      setRange([dayjs().subtract(30, 'day'), dayjs()])
      // 重置时间颗粒度为默认值
      setTimeGranularity('daily')
    }
  }
  
  

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'auto', padding: '0 8px' }}>
          <Card style={{ marginBottom: 24, flex: 'none', width: '100%', boxSizing: 'border-box', padding: '12px' }}>
        <Row gutter={[4, 8]} style={{ marginBottom: 16, flexWrap: 'wrap' }} align="middle">
          {/* 任务选择 */}
          <Col xs={24} sm={24} md={12} lg={6} xl={7}>
            <Select
              placeholder="选择回测"
              allowClear
              showSearch
              value={taskId}
              onChange={handleTaskChange}
              style={{ width: '100%' }}
              filterOption={(input, option) =>
                (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
              }
            >
              {tasksData?.items?.map((task: any) => {
                const account = (accounts?.items || []).find((a: any) => a.account_id === task.account_id);
                return (
                  <Select.Option key={task.task_id} value={task.task_id}>
                    {task.task_id} - {task.stock_symbol || account?.stock_symbol || '未知股票'} - {dayjs(task.start_date).format('YYYY-MM-DD HH:mm')} - {dayjs(task.end_date).format('YYYY-MM-DD HH:mm')}
                  </Select.Option>
                );
              })}
            </Select>
          </Col>
          
          <Col xs={24} sm={24} md={12} lg={18} xl={17}>
            <Row gutter={[8, 8]} style={{ width: '100%', display: 'flex', alignItems: 'center' }}>
              {/* 回测时间范围 */}
              {taskTimeRange && (
                <Col xs={24} sm={24} md={10} lg={10} xl={8}>
                  <div style={{ 
                    color: '#1890ff', 
                    fontSize: '14px', 
                    whiteSpace: 'nowrap',
                    backgroundColor: '#f0f5ff',
                    padding: '4px 12px',
                    borderRadius: '4px',
                    border: '1px solid #d6e4ff',
                    display: 'inline-block',
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    <span style={{ fontWeight: 600 }}>回测时间范围:</span> {taskTimeRange}
                  </div>
                </Col>
              )}
              
              {/* 任务运行状态提示 */}
              {currentTask?.status === 'RUNNING' && (
                <Col xs={24} sm={24} md={10} lg={10} xl={8}>
                  <div style={{ 
                    color: '#52c41a', 
                    fontSize: '14px', 
                    whiteSpace: 'nowrap',
                    backgroundColor: '#f6ffed',
                    padding: '4px 12px',
                    borderRadius: '4px',
                    border: '1px solid #b7eb8f',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    <span style={{ fontWeight: 600 }}>⏱️ 任务运行中:</span> 
                    {isPolling && <span style={{ color: '#52c41a', fontWeight: 500 }}>🟢 每20秒自动更新</span>}
                    {!isPolling && <span style={{ color: '#faad14', fontWeight: 500 }}>🟡 准备更新...</span>}
                  </div>
                </Col>
              )}
              
              {/* 竖轴模式 */}
              <Col xs={12} sm={6} md={4} lg={4} xl={4}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-start', flexWrap: 'nowrap' }}>
                  <span style={{ color: '#666', fontSize: 12 }}>竖轴模式</span>
                  <Switch
                    checked={yAxisMode === 'dual'}
                    onChange={(checked) => setYAxisMode(checked ? 'dual' : 'single')}
                    checkedChildren="双轴"
                    unCheckedChildren="单轴"
                    size="small"
                  />
                </div>
              </Col>
              
              {/* 刷新按钮 - 靠右 */}
              <Col xs={12} sm={6} md={4} lg={4} xl={4} style={{ marginLeft: 'auto' }}>
                <Button onClick={loadData} style={{ width: '100%' }} size="middle">刷新</Button>
              </Col>
            </Row>
          </Col>
        </Row>
        
        {/* 条件渲染：只有在选择了有效任务时才显示图表 */}
        {taskId ? (
          <div style={{ 
            position: 'relative', 
            height: 600, 
            width: '100%', 
            boxSizing: 'border-box',
            overflow: 'hidden'
          }}>
            <Spin spinning={loading} tip="加载中..." style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
            <ReactECharts 
              option={option} 
              style={{ height: '100%', width: '100%' }} 
              notMerge={false}
              lazyUpdate={true}
              onEvents={{ 
                click: handleChartClick,
                dataZoom: (params: any) => {
                  // 保存dataZoom的缩放状态
                  if (params.batch && params.batch.length > 0) {
                    const dataZoomEvent = params.batch[0];
                    if (dataZoomEvent.start !== undefined && dataZoomEvent.end !== undefined) {
                      dataZoomRef.current = { start: dataZoomEvent.start, end: dataZoomEvent.end };
                      // 计算实际的索引范围
                      const startIndex = Math.floor(dataZoomEvent.start / 100 * (bars.length - 1));
                      const endIndex = Math.ceil(dataZoomEvent.end / 100 * (bars.length - 1));
                      setViewRange([startIndex, endIndex]);
                    }
                  } else if (params.start !== undefined && params.end !== undefined) {
                    dataZoomRef.current = { start: params.start, end: params.end };
                    // 计算实际的索引范围
                    const startIndex = Math.floor(params.start / 100 * (bars.length - 1));
                    const endIndex = Math.ceil(params.end / 100 * (bars.length - 1));
                    setViewRange([startIndex, endIndex]);
                  }
                }
              }} 
              onChartReady={(chartInstance: any) => {
                // 保存图表实例
                chartRef.current = chartInstance;
              }}
            />
          </div>
        ) : (
          <div style={{ 
            height: 600, 
            width: '100%',
            boxSizing: 'border-box',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            backgroundColor: '#fafafa',
            border: '1px dashed #d9d9d9',
            borderRadius: '4px'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '16px', color: '#666', marginBottom: '8px' }}>
                请选择一个任务以查看K线 + 净值表
              </div>
              <div style={{ fontSize: '14px', color: '#999' }}>
                从上方回测ID下拉列表中选择一个任务
              </div>
            </div>
          </div>
        )}
          </Card>
      
      {/* 回测结果统计区域 - 只有当任务完成时才显示，位于列表上方 */}
      {isTaskCompleted && (
        <Card 
          title={
            <span>
              回测结果统计
              {taskStats?.time_period && (
                <span style={{ marginLeft: 12, fontSize: '12px', color: '#666', fontWeight: 'normal' }}>
                  {dayjs(taskStats.time_period.start_date).format('YYYY-MM-DD')} 至 {dayjs(taskStats.time_period.end_date).format('YYYY-MM-DD')}
                </span>
              )}
            </span>
          } 
          loading={isStatsLoading} 
          style={{ marginBottom: 16, padding: '4px', border: '1px solid #e8e8e8' }}
        >
          <Row gutter={[2, 0]} align="middle">
            {/* 合计交易次数 */}
            <Col xs={6} sm={4} md={3} lg={2}>
              <div style={{ padding: '2px', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Statistic 
                  title={<span style={{ fontSize: '10px', marginBottom: '1px' }}>交易次数</span>}
                  value={taskStats?.total_trades || 0} 
                  valueStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#1890ff' }}
                  formatter={(value) => `${value}`}
                />
              </div>
            </Col>
            
            {/* 最大收益 */}
            <Col xs={6} sm={4} md={3} lg={2}>
              <div style={{ padding: '2px', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Statistic 
                  title={<span style={{ fontSize: '10px', marginBottom: '1px' }}>最大收益</span>}
                  value={taskStats?.max_single_profit ? (parseFloat(taskStats.max_single_profit) * 100).toFixed(2) : 0} 
                  precision={2}
                  suffix="%"
                  valueStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#52c41a' }}
                />
              </div>
            </Col>
            
            {/* 最大回撤 */}
            <Col xs={6} sm={4} md={3} lg={2}>
              <div style={{ padding: '2px', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Statistic 
                  title={<span style={{ fontSize: '10px', marginBottom: '1px' }}>最大回撤</span>}
                  value={taskStats?.max_drawdown ? (parseFloat(taskStats.max_drawdown) * 100).toFixed(2) : 0} 
                  precision={2}
                  suffix="%"
                  valueStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#ff4d4f' }}
                />
              </div>
            </Col>
            
            {/* 夏普率 */}
            <Col xs={6} sm={4} md={3} lg={2}>
              <div style={{ padding: '2px', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Statistic 
                  title={<span style={{ fontSize: '10px', marginBottom: '1px' }}>夏普率</span>}
                  value={taskStats?.sharpe_ratio ? parseFloat(taskStats.sharpe_ratio).toFixed(2) : 0} 
                  precision={2}
                  valueStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#722ed1' }}
                />
              </div>
            </Col>
            
            {/* 胜率 */}
            <Col xs={6} sm={4} md={3} lg={2}>
              <div style={{ padding: '2px', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Statistic 
                  title={<span style={{ fontSize: '10px', marginBottom: '1px' }}>胜率</span>}
                  value={taskStats?.win_rate ? parseFloat(taskStats.win_rate).toFixed(2) : 0} 
                  precision={2}
                  suffix="%"
                  valueStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#fa8c16' }}
                />
              </div>
            </Col>
            
            {/* 累计收益 */}
            <Col xs={6} sm={4} md={3} lg={2}>
              <div style={{ padding: '2px', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Statistic 
                  title={<span style={{ fontSize: '10px', marginBottom: '1px' }}>累计收益</span>}
                  value={taskStats?.cumulative_return ? (parseFloat(taskStats.cumulative_return) * 100).toFixed(2) : 0} 
                  precision={2}
                  suffix="%"
                  valueStyle={{ fontSize: '12px', fontWeight: 'bold', color: parseFloat(taskStats?.cumulative_return || 0) >= 0 ? '#52c41a' : '#ff4d4f' }}
                />
              </div>
            </Col>

            {/* 平均盈利 */}
            <Col xs={6} sm={4} md={3} lg={2}>
              <div style={{ padding: '2px', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Statistic 
                  title={<span style={{ fontSize: '10px', marginBottom: '1px' }}>平均盈利</span>}
                  value={taskStats?.avg_profit ? (parseFloat(taskStats.avg_profit) * 100).toFixed(2) : 0} 
                  precision={2}
                  suffix="%"
                  valueStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#52c41a' }}
                />
              </div>
            </Col>

            {/* 平均亏损 */}
            <Col xs={6} sm={4} md={3} lg={2}>
              <div style={{ padding: '2px', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Statistic 
                  title={<span style={{ fontSize: '10px', marginBottom: '1px' }}>平均亏损</span>}
                  value={taskStats?.avg_loss ? (parseFloat(taskStats.avg_loss) * 100).toFixed(2) : 0} 
                  precision={2}
                  suffix="%"
                  valueStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#ff4d4f' }}
                />
              </div>
            </Col>

            {/* 盈亏比 */}
            <Col xs={6} sm={4} md={3} lg={2}>
              <div style={{ padding: '2px', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Statistic 
                  title={<span style={{ fontSize: '10px', marginBottom: '1px' }}>盈亏比</span>}
                  value={taskStats?.profit_loss_ratio ? parseFloat(taskStats.profit_loss_ratio).toFixed(2) : 0} 
                  precision={2}
                  valueStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#1890ff' }}
                />
              </div>
            </Col>

            {/* 最终总值 */}
            <Col xs={8} sm={6} md={4} lg={3}>
              <div style={{ padding: '2px', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Statistic 
                  title={<span style={{ fontSize: '10px', marginBottom: '1px' }}>最终总值</span>}
                  value={taskStats?.final_total_value ? parseFloat(taskStats.final_total_value).toFixed(2) : 0} 
                  precision={2}
                  valueStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#666' }}
                  prefix="¥"
                />
              </div>
            </Col>
          </Row>
        </Card>
      )}
      
      {/* 决策关联数据：使用DecisionDataTable组件，直接传递任务ID */}
      {taskId && (
        <Card title="">
          <DecisionDataTable 
            taskId={taskId} 
            query={{ 
              task_id: taskId, 
              sort_order:'asc',
              page: pagination.page, 
              page_size: pagination.pageSize 
            }} 
            onPaginationChange={(page, pageSize) => {
              setPagination({ page, pageSize })
            }} 
            refetchInterval={currentTask?.status === 'RUNNING' ? 20000 : false}
          />
        </Card>
      )}
    </div>
  )
}