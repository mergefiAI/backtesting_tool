"""
枚举类型定义
"""
from enum import Enum


class TradeStatus(str, Enum):
    """交易状态枚举"""
    PENDING = "PENDING"      # 待执行
    EXECUTED = "EXECUTED"    # 已执行
    COMPLETED = "COMPLETED"  # 已完成
    CANCELLED = "CANCELLED"  # 已取消
    FAILED = "FAILED"        # 执行失败


class TradeAction(str, Enum):
    """交易动作枚举"""
    BUY = "BUY"         # 买入
    SELL = "SELL"       # 卖出
    HOLD = "HOLD"       # 持有
    SHORT_SELL = "SHORT_SELL" # 做空卖出
    COVER_SHORT = "COVER_SHORT" # 买入平仓


class DecisionResult(str, Enum):
    """决策结果枚举"""
    BUY = "BUY"       # 买入
    SELL = "SELL"     # 卖出
    HOLD = "HOLD"     # 持有
    CANCEL = "CANCEL" # 取消


class PromptStatus(str, Enum):
    """提示词状态枚举"""
    AVAILABLE = "AVAILABLE"      # 可用
    UNAVAILABLE = "UNAVAILABLE"  # 不可用
    DELETED = "DELETED"          # 已删除
