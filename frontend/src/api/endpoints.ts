import {api} from './client'
import type {Account, AIConfig, LocalDecision, Paginated, Snapshot, Trade} from '../types/api'

// 远程策略相关接口已移除

/**
 * 查询本地决策
 */
export async function fetchLocalDecisions(params: Record<string, any>, signal?: AbortSignal): Promise<Paginated<LocalDecision>> {
  try {
    const { data } = await api.get('/api/decision/local', { params, signal })
    return data?.data
  } catch {
    return { items: [], total: 0, page: 1, page_size: 0, total_pages: 0 }
  }
}

/**
 * 查询本地决策详情
 */
export async function fetchLocalDecisionDetail(decisionId: string, options?: { signal?: AbortSignal }): Promise<Record<string, any> | null> {
  try {
    const { data } = await api.get(`/api/decision/local-detail/${decisionId}`, options)
    return data?.data
  } catch {
    return null
  }
}


/**
 * 查询交易历史
 */
export async function fetchTrades(params: Record<string, any>, signal?: AbortSignal): Promise<Paginated<Trade>> {
  try {
    const { data } = await api.get('/api/trade/history', { params, signal })
    return data?.data
  } catch {
    return { items: [], total: 0, page: 1, page_size: 0, total_pages: 0 }
  }
}

/**
 * 查询交易详情
 */
export async function fetchTradeDetail(tradeId: string, options?: { signal?: AbortSignal }): Promise<Record<string, any> | null> {
  try {
    const { data } = await api.get(`/api/trade/history/${tradeId}`, options)
    return data?.data
  } catch {
    return null
  }
}

/**
 * 查询账户列表
 */
export async function fetchAccounts(params: Record<string, any>, signal?: AbortSignal): Promise<Paginated<Account>> {
  try {
    const { data } = await api.get('/api/account/virtual', { params, signal })
    return data?.data
  } catch {
    return { items: [], total: 0, page: 1, page_size: 0, total_pages: 0 }
  }
}

/**
 * 查询虚拟账户列表（兼容fetchAccounts）
 */
export async function fetchVirtualAccounts(params: Record<string, any>, signal?: AbortSignal): Promise<Paginated<Account>> {
  return fetchAccounts(params, signal)
}

/**
 * 查询账户详情
 */
export async function fetchAccountDetail(accountId: string, options?: { signal?: AbortSignal }): Promise<Record<string, any> | null> {
  try {
    const { data } = await api.get(`/api/account/virtual/${accountId}`, options)
    return data?.data
  } catch {
    return null
  }
}

/**
 * 创建账户
 */
export async function createAccount(payload: Record<string, any>, signal?: AbortSignal): Promise<any> {
  try {
    const { data } = await api.post('/api/account/virtual', payload, { signal })
    return data
  } catch (error) {
    throw error
  }
}

/**
 * 更新账户
 */
export async function updateAccount(accountId: string, payload: Record<string, any>, signal?: AbortSignal): Promise<any> {
  try {
    const { data } = await api.put(`/api/account/virtual/${accountId}`, payload, { signal })
    return data
  } catch (error) {
    throw error
  }
}

/**
 * 删除账户
 */
export async function deleteAccount(accountId: string, signal?: AbortSignal): Promise<any> {
  try {
    const { data } = await api.delete(`/api/account/virtual/${accountId}`, { signal })
    return data
  } catch (error) {
    throw error
  }
}

/**
 * 查询账户快照
 */
export async function fetchSnapshots(params: Record<string, any>, signal?: AbortSignal): Promise<Paginated<Snapshot>> {
  try {
    const { data } = await api.get('/api/account/snapshot', { params, signal })
    return data?.data
  } catch {
    return { items: [], total: 0, page: 1, page_size: 0, total_pages: 0 }
  }
}

/**
 * 查询账户快照详情
 */
export async function fetchSnapshotDetail(snapshotId: string, options?: { signal?: AbortSignal }): Promise<Record<string, any> | null> {
  try {
    const { data } = await api.get(`/api/account/snapshot/${snapshotId}`, options)
    return data?.data
  } catch {
    return null
  }
}

/**
 * 查询日线数据
 */
export async function fetchBTCDailyBars(params: Record<string, any>, signal?: AbortSignal): Promise<Paginated<any>> {
  try {
    const { data } = await api.get('/api/market/btc/daily', { params, signal })
    // 直接返回完整数据，pagination信息在根级别
    return data?.data
  } catch {
    return { items: [], total: 0, page: 1, page_size: 0, total_pages: 0 }
  }
}

/**
 * 查询小时线数据
 */
export async function fetchBTCHourlyBars(params: Record<string, any>, signal?: AbortSignal): Promise<Paginated<any>> {
  try {
    const { data } = await api.get('/api/market/btc/hourly', { params, signal })
    // 直接返回完整数据，pagination信息在根级别
    return data?.data
  } catch {
    return { items: [], total: 0, page: 1, page_size: 0, total_pages: 0 }
  }
}

/**
 * 查询分钟线数据
 */
export async function fetchBTCMinutelyBars(params: Record<string, any>, signal?: AbortSignal): Promise<Paginated<any>> {
  try {
    const { data } = await api.get('/api/market/btc/minute', { params, signal })
    // 直接返回完整数据，pagination信息在根级别
    return data?.data
  } catch {
    return { items: [], total: 0, page: 1, page_size: 0, total_pages: 0 }
  }
}

/**
 * 获取单个标的数据数量
 * @param symbol 标的符号
 * @returns 各时间粒度下的数据数量
 */
export async function fetchSymbolDataCount(symbol: string, signal?: AbortSignal): Promise<{ daily: number; hourly: number; minute: number }> {
  try {
    // 后端只支持BTC的市场数据API，所以所有标的都使用BTC的API
    // 并行请求获取不同时间粒度的数据数量
    const [dailyData, hourlyData, minutelyData] = await Promise.all([
      api.get('/api/market/btc/daily', { params: { page: 1, page_size: 1 }, signal }),
      api.get('/api/market/btc/hourly', { params: { page: 1, page_size: 1 }, signal }),
      api.get('/api/market/btc/minute', { params: { page: 1, page_size: 1 }, signal })
    ])

    return {
      daily: dailyData?.data?.data?.total || 0,
      hourly: hourlyData?.data?.data?.total || 0,
      minute: minutelyData?.data?.data?.total || 0
    }
  } catch (error) {
    console.error(`获取${symbol}数据数量失败:`, error)
    return { daily: 0, hourly: 0, minute: 0 }
  }
}

/**
 * 获取所有标的数据数量和日期范围
 * @returns 所有标的各时间粒度下的数据数量和日期范围
 */
export async function fetchAllSymbolsDataCount(signal?: AbortSignal): Promise<{ [symbol: string]: { daily: { count: number; start_date?: string; end_date?: string }; hourly: { count: number; start_date?: string; end_date?: string }; minute: { count: number; start_date?: string; end_date?: string } } }> {
  try {
    // 调用后端新API获取所有标的数据数量
    const response = await api.get('/api/market/symbols-data-count', { signal });
    // 检查响应状态码
    if (response?.status !== 200) {
      console.error('获取所有标的数据数量失败: 响应状态码异常', response?.status);
      return {};
    }
    // 检查响应数据格式
    if (!response?.data || typeof response.data !== 'object' || !response.data.data) {
      console.error('获取所有标的数据数量失败: 响应数据格式异常', response?.data);
      return {};
    }
    return response.data.data;
  } catch (error: any) {
    console.error('获取所有标的数据数量失败:', error.message || error);
    // 如果新API调用失败，返回空对象，后续逻辑会使用单个标的查询作为降级方案
    return {};
  }
}

/**
 * 导入日线数据
 */
export async function importBTCDailyData(file: File, symbol?: string, signal?: AbortSignal): Promise<any> {
  const formData = new FormData()
  formData.append('file', file)
  if (symbol) {
    formData.append('symbol', symbol)
  }
  
  try {
    const { data } = await api.post('/api/market/btc/daily/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      signal
    })
    return data
  } catch (error) {
    throw error
  }
}

/**
 * 清空日线数据
 */
export async function clearBTCDailyData(symbol?: string, signal?: AbortSignal): Promise<any> {
  try {
    const { data } = await api.delete('/api/market/btc/daily', {
      params: symbol ? { symbol } : {},
      signal
    })
    return data
  } catch (error) {
    throw error
  }
}

/**
 * 清空小时线数据
 */
export async function clearBTCHourlyData(symbol?: string, signal?: AbortSignal): Promise<any> {
  try {
    const { data } = await api.delete('/api/market/btc/hourly', {
      params: symbol ? { symbol } : {},
      signal
    })
    return data
  } catch (error) {
    throw error
  }
}

/**
 * 清空分钟线数据
 */
export async function clearBTCMinutelyData(symbol?: string, signal?: AbortSignal): Promise<any> {
  try {
    const { data } = await api.delete('/api/market/btc/minute', {
      params: symbol ? { symbol } : {},
      signal
    })
    return data
  } catch (error) {
    throw error
  }
}

export async function createTask(payload: Record<string, any>, signal?: AbortSignal): Promise<any> {
  try {
    const { data } = await api.post('/api/task/create', payload, { signal })
    return data?.data
  } catch (error: any) {
    console.error('createTask error:', error);
    // 返回错误信息而不是null，便于前端显示具体错误
    if (error.response?.data?.detail) {
      throw new Error(error.response.data.detail);
    } else if (error.message) {
      throw new Error(error.message);
    } else {
      throw new Error('创建策略回测失败');
    }
  }
}

export async function startTask(payload: Record<string, any>, signal?: AbortSignal): Promise<any> {
  try {
    const { data } = await api.post('/api/task/start', payload, { signal })
    return data?.data
  } catch {
    return null
  }
}

export async function stopTask(payload: Record<string, any>, signal?: AbortSignal): Promise<any> {
  try {
    const { data } = await api.post('/api/task/stop', payload, { signal })
    return data?.data
  } catch {
    return null
  }
}

export async function pauseTask(payload: Record<string, any>, signal?: AbortSignal): Promise<any> {
  try {
    const { data } = await api.post('/api/task/pause', payload, { signal })
    return data?.data
  } catch {
    return null
  }
}

export async function resumeTask(payload: Record<string, any>, signal?: AbortSignal): Promise<any> {
  try {
    const { data } = await api.post('/api/task/resume', payload, { signal })
    return data?.data
  } catch {
    return null
  }
}

export async function fetchTasks(params: Record<string, any>, signal?: AbortSignal): Promise<Paginated<any>> {
  try {
    const { data } = await api.get('/api/task/list', { params, signal })
    return data?.data
  } catch {
    return { items: [], total: 0, page: 1, page_size: 0, total_pages: 0 }
  }
}

export function subscribeTaskProgress(taskId: string): EventSource {
  const url = `${api.defaults.baseURL}/api/task/progress/${taskId}`
  return new EventSource(url)
}

export function subscribeTaskMonitor(): EventSource {
  const url = `${api.defaults.baseURL}/api/task/monitor`
  return new EventSource(url)
}

/**
 * 删除任务
 */
export async function deleteTask(taskId: string): Promise<any> {
  try {
    const { data } = await api.delete(`/api/task/${taskId}`)
    return data
  } catch (error) {
    throw error
  }
}

/**
 * 获取K线 + 净值关联数据
 */
export async function fetchKlineRelatedData(params: Record<string, any>, signal?: AbortSignal): Promise<any> {
  try {
    const validParams = {
      task_id: params.task_id,
      account_id: params.account_id,
      analysis_date: params.analysis_date
    }
    const { data } = await api.get('/api/kline/related-data', { params: validParams, signal })
    return data?.data
  } catch (error) {
    console.error('fetchKlineRelatedData error:', error)
    return {
      strategy: null,
      decision: null,
      trades: []
    }
  }
}

// ==================== 策略相关接口 ====================

export interface PromptTemplateQuery {
  status?: 'AVAILABLE' | 'UNAVAILABLE' | 'DELETED';
  keyword?: string;
  page?: number;
  page_size?: number;
}

export interface PromptTemplateCreateRequest {
  content: string;
  description?: string;
  tags?: string;
  status: 'AVAILABLE' | 'UNAVAILABLE' | 'DELETED';
}

export interface PromptTemplateUpdateRequest {
  content?: string;
  description?: string;
  tags?: string;
  status?: 'AVAILABLE' | 'UNAVAILABLE' | 'DELETED';
}

export interface PromptTemplate {
  prompt_id: string;
  content: string;
  description?: string;
  status: 'AVAILABLE' | 'UNAVAILABLE' | 'DELETED';
  tags?: string;
  created_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// 策略相关API
export const promptTemplatesApi = {
  // 获取策略列表
  getList: (params: PromptTemplateQuery) => {
    return api.get('/api/prompt-templates', { params });
  },

  // 创建策略
  create: (data: PromptTemplateCreateRequest) => {
    return api.post('/api/prompt-templates', data);
  },

  // 获取单个策略
  getById: (promptId: string) => {
    return api.get(`/api/prompt-templates/${promptId}`);
  },

  // 更新策略
  update: (promptId: string, data: PromptTemplateUpdateRequest) => {
    return api.put(`/api/prompt-templates/${promptId}`, data);
  },

  // 删除策略
  delete: (promptId: string) => {
    return api.delete(`/api/prompt-templates/${promptId}`);
  },
};

// 导出具体的函数供页面使用
export const getPromptTemplates = async (params: PromptTemplateQuery) => {
  const response = await promptTemplatesApi.getList(params);
  return response.data?.data || response; // 提取axios响应的data字段
};

export const createPromptTemplate = async (data: PromptTemplateCreateRequest) => {
  const response = await promptTemplatesApi.create(data);
  return response;
};

export const getPromptTemplate = async (promptId: string) => {
  const response = await promptTemplatesApi.getById(promptId);
  // 提取axios响应的data字段，其中包含后端返回的{code, msg, data}
  return response.data;
};

export const updatePromptTemplate = async (promptId: string, data: PromptTemplateUpdateRequest) => {
  const response = await promptTemplatesApi.update(promptId, data);
  return response;
};

export const deletePromptTemplate = async (promptId: string) => {
  const response = await promptTemplatesApi.delete(promptId);
  return response;
};

// 策略详情查询函数
export const fetchPromptTemplateDetail = async (promptId: string) => {
  try {
    const backendResponse = await getPromptTemplate(promptId);
    // 检查后端响应结构
    if (backendResponse?.code === 200 && backendResponse?.data) {
      return backendResponse.data;
    } else {
      throw new Error(backendResponse?.msg || '获取数据失败');
    }
  } catch (error) {
    console.error('获取策略详情失败:', error);
    throw error;
  }
};



// ==================== AI配置相关接口 ====================

/**
 * 获取AI配置列表
 */
export async function fetchAIConfigs(params: Record<string, any>, signal?: AbortSignal): Promise<Paginated<AIConfig>> {
  try {
    const { data } = await api.get('/api/ai-configs', { params, signal });
    return data?.data;
  } catch {
    return { items: [], total: 0, page: 1, page_size: 0, total_pages: 0 };
  }
}

/**
 * 获取单个AI配置详情
 */
export async function fetchAIConfigDetail(configId: string, options?: { signal?: AbortSignal }): Promise<AIConfig | null> {
  try {
    const { data } = await api.get(`/api/ai-configs/${configId}`, options);
    return data?.data;
  } catch {
    return null;
  }
}

/**
 * 创建AI配置
 */
export async function createAIConfig(payload: Record<string, any>, signal?: AbortSignal): Promise<any> {
  try {
    const { data } = await api.post('/api/ai-configs', payload, { signal });
    return data;
  } catch (error) {
    throw error;
  }
}

/**
 * 更新AI配置
 */
export async function updateAIConfig(configId: string, payload: Record<string, any>, signal?: AbortSignal): Promise<any> {
  try {
    const { data } = await api.put(`/api/ai-configs/${configId}`, payload, { signal });
    return data;
  } catch (error) {
    throw error;
  }
}

/**
 * 删除AI配置
 */
export async function deleteAIConfig(configId: string, signal?: AbortSignal): Promise<any> {
  try {
    const { data } = await api.delete(`/api/ai-configs/${configId}`, { signal });
    return data;
  } catch (error) {
    throw error;
  }
}

/**
 * 导入趋势数据
 */
export async function importTrendData(formData: FormData, signal?: AbortSignal): Promise<any> {
  try {
    const { data } = await api.post('/api/data-import/import-trend-data', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      signal
    })
    return data
  } catch (error) {
    throw error
  }
}

/**
 * 获取回测结果统计
 */
export async function fetchTaskStats(taskId: string, signal?: AbortSignal): Promise<any> {
  try {
    const { data } = await api.get(`/api/task/stats`, { params: { task_id: taskId }, signal });
    return data?.data;
  } catch (error: any) {
    // 忽略CanceledError错误，这是正常的请求取消
    if (error?.code !== 'ERR_CANCELED' && error?.name !== 'CanceledError') {
      console.error('获取回测结果统计失败:', error);
    }
    return null;
  }
}

/**
 * 获取趋势数据
 */
export async function fetchTrendData(symbol: string, taskId?: string, signal?: AbortSignal): Promise<any[]> {
  try {
    const params: Record<string, string> = {}
    if (taskId) {
      params.task_id = taskId
    }
    const { data } = await api.get(`/api/trend-data/${symbol}`, { params, signal });
    // 后端返回格式: { code: 200, msg: "success", data: { trend_data: [...] } }
    // 返回趋势数据数组
    return data?.data?.trend_data || [];
  } catch (error: any) {
    // 忽略CanceledError错误，这是正常的请求取消
    if (error?.code !== 'ERR_CANCELED' && error?.name !== 'CanceledError') {
      console.error('获取趋势数据失败:', error);
    }
    return [];
  }
}