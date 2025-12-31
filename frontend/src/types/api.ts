/**
 * API类型定义
 */
export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface Trade {
  trade_id: string
  account_id: string
  stock_symbol: string
  trade_action: 'BUY' | 'SELL' | 'HOLD' | 'SHORT_SELL' | 'COVER_SHORT'
  quantity: string
  price: string
  total_amount: string
  fee: string
  status: 'PENDING' | 'EXECUTED' | 'COMPLETED' | 'CANCELLED' | 'FAILED'
  trade_time: string
  decision_id?: string
  notes?: string
  // 新增字段：持仓方向
  position_side: 'LONG' | 'SHORT'
  // 新增字段：交易后的账户状态
  stock_market_value_after: string
  total_value_after: string
  margin_used_after: string
  remaining_quantity_after: string
  avg_price_after: string
  // 新增字段：开仓交易ID（平仓时关联）
  open_id?: string
}

export interface Account {
  market_type: string
  account_id: string
  initial_balance: string
  current_balance: string
  stock_symbol: string
  stock_price: string
  stock_quantity: string
  stock_market_value: string
  total_value: string
  created_at: string
  updated_at: string
  latest_snapshot?: Snapshot | null
  
  // 费用配置
  commission_rate_buy?: string
  commission_rate_sell?: string
  tax_rate?: string
  min_commission?: string
  
  // 累计费用
  total_fees?: string
}

export interface Snapshot {
  snapshot_id: string
  account_id: string
  balance: string
  margin_used: string
  stock_quantity: string
  stock_price: string
  stock_market_value: string
  total_value: string
  profit_loss: string
  profit_loss_percent: string
  timestamp: string
}

export interface LocalDecision {
  decision_id: string
  account_id: string
  stock_symbol: string
  decision_result: 'BUY' | 'SELL' | 'HOLD' | 'SHORT_SELL' | 'COVER_SHORT' | 'CANCEL'
  confidence_score: string
  reasoning: string
  market_data?: Record<string, any> | null
  start_time: string
  end_time?: string
  execution_time_ms?: number
  task_id?: string
  analysis_date?: string
  // 关联数据
  snapshot?: Snapshot | null
  trades?: Trade[]
  trade_count?: number
}
// 远程策略类型已移除

export interface AIConfig {
  config_id: string;
  name: string;
  local_ai_base_url: string;
  local_ai_api_key: string;
  local_ai_model_name: string;
  created_at: string;
  updated_at: string;
}

// 任务统计类型
export interface TaskStats {
  task_id: string;
  time_period: {
    start_date: string;
    end_date: string;
  };
  total_trades: number;
  max_profit: string;
  max_drawdown: string;
  sharpe_ratio: string;
  win_rate: string;
  total_fees?: string;
  avg_fees?: string;
  fees_to_profit_ratio?: string;
}

// 任务类型
export interface Task {
  task_id: string;
  account_id: string;
  stock_symbol: string;
  market_type?: string;
  user_prompt_id?: string;
  ai_config_id?: string;
  start_date: string;
  end_date: string;
  status: 'PENDING' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'COMPLETED_WITH_ERRORS' | 'FAILED' | 'CANCELLED';
  created_at: string;
  started_at?: string;
  paused_at?: string;
  resumed_at?: string;
  completed_at?: string;
  error_message?: string;
  total_items?: number;
  processed_items?: number;
  time_granularity: 'daily' | 'hourly' | 'minute';
  decision_interval: number;
  
  // 统计结果
  stats?: TaskStats;
}
