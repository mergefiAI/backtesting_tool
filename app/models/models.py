"""
数据模型定义
"""
import json
from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import ConfigDict, field_validator
from sqlalchemy import Numeric, DateTime, Text as sa_Text, JSON
from sqlmodel import SQLModel, Field

from app.utils.calc_utils import to_dec
from app.utils.timestamp_utils import TimestampUtils
from cfg import logger
from .enums import PromptStatus


class VirtualAccount(SQLModel, table=True):
    """虚拟账户模型"""
    __tablename__ = "virtual_accounts"
    # 启用赋值时验证，确保字段在赋值阶段也执行校验逻辑（例如小数位约束）
    model_config = ConfigDict(validate_assignment=True)
    market_type: str = Field(index=True, description="市场类型，例如 'US' 或 'COIN'")
    account_id: str = Field(primary_key=True, description="账户ID")
    initial_balance: Decimal = Field(description="初始余额", sa_type=Numeric[Decimal](38, 8))
    current_balance: Decimal = Field(description="当前余额", sa_type=Numeric[Decimal](38, 8))
    stock_symbol: str = Field(index=True, description="关联股票代码")
    stock_price: Decimal = Field(description="当前股价", sa_type=Numeric[Decimal](38, 8))
    stock_quantity: Decimal = Field(
        default=Decimal("0"), 
        description="持仓数量（正数表示多头，负数表示空头，支持加密货币小数位）", 
        sa_type=Numeric[Decimal](38, 8)
    )
    stock_market_value: Decimal = Field(description="持股价值", sa_type=Numeric[Decimal](38, 8))
    total_value: Decimal = Field(default=Decimal("0"), description="总价值", sa_type=Numeric[Decimal](38, 8))
    created_at: datetime = Field(default_factory=TimestampUtils.now_utc_naive, description="创建时间")
    updated_at: datetime = Field(default_factory=TimestampUtils.now_utc_naive, description="更新时间")
    
    # 新增字段：持仓方向
    position_side: str = Field(
        default="LONG", 
        description="持仓方向: LONG-多头, SHORT-空头",
        sa_type=sa_Text
    )
    
    # 新增字段：保证金占用
    margin_used: Decimal = Field(
        default=Decimal("0"), 
        description="当前保证金占用", 
        sa_type=Numeric[Decimal](38, 8)
    )
    
    # 新增字段：空头持仓均价
    short_avg_price: Decimal = Field(
        default=Decimal("0"), 
        description="空头持仓均价", 
        sa_type=Numeric[Decimal](38, 8)
    )
    
    # 新增字段：空头持仓总成本
    short_total_cost: Decimal = Field(
        default=Decimal("0"), 
        description="空头持仓总成本", 
        sa_type=Numeric[Decimal](38, 8)
    )
    
    # 新增字段：空头持仓明细（使用JSON存储每笔空头持仓）
    short_positions: Optional[list] = Field(
        default_factory=list, 
        description="空头持仓明细", 
        sa_type=JSON
    )
    
    # 新增字段：多头持仓明细（使用JSON存储每笔多头持仓）
    long_positions: Optional[list] = Field(
        default_factory=list, 
        description="多头持仓明细", 
        sa_type=JSON
    )
    
    # 新增字段：可用余额
    available_balance: Decimal = Field(
        default=Decimal("0"), 
        description="当前账户可用余额", 
        sa_type=Numeric[Decimal](38, 8)
    )

    # 交易费用配置
    commission_rate_buy: Decimal = Field(default=Decimal("0.001"), description="买入佣金率", sa_type=Numeric(10, 6))
    commission_rate_sell: Decimal = Field(default=Decimal("0.001"), description="卖出佣金率", sa_type=Numeric(10, 6))
    tax_rate: Decimal = Field(default=Decimal("0.001"), description="印花税率（仅卖出）", sa_type=Numeric(10, 6))
    min_commission: Decimal = Field(default=Decimal("5.00"), description="最低佣金", sa_type=Numeric(10, 2))

    # 累计交易费用
    total_fees: Decimal = Field(
        default=Decimal("0"), 
        description="累计交易费用", 
        sa_type=Numeric[Decimal](38, 8)
    )

    @field_validator("stock_quantity", mode="before")
    def _round_stock_quantity(cls, v):
        """
        数量字段校验：将持仓数量统一保留8位小数（满足BTC的最小单位要求）

        参数校验与错误处理：
        - 非数字输入将尝试转换为浮点；若失败，记录日志并回退为0.0
        - 成功时统一round到8位小数
        """
        try:
            return to_dec(v, 8)
        except Exception as e:
            logger.error(f"VirtualAccount.stock_quantity 校验失败，输入={v} 错误={e}")
            return to_dec(0, 8)

    @field_validator("initial_balance", "current_balance", "stock_market_value", "total_value", "margin_used", "short_avg_price", "short_total_cost", "available_balance", mode="before")
    def _round_amounts(cls, v):
        """
        金额字段校验：统一保留8位小数，确保一致的金额精度。
        """
        try:
            return to_dec(v, 8)
        except Exception as e:
            logger.error(f"VirtualAccount 金额校验失败，输入={v} 错误={e}")
            return to_dec(0, 8)
    
    @field_validator("stock_quantity", mode="after")
    def _update_position_side(cls, v, info):
        """根据持仓数量自动更新持仓方向"""
        if v > Decimal("0"):
            info.data["position_side"] = "LONG"
        elif v < Decimal("0"):
            info.data["position_side"] = "SHORT"
        else:
            info.data["position_side"] = "LONG"  # 空仓时默认多头方向
        return v

    # 已移除费率/费用相关字段


class AccountSnapshot(SQLModel, table=True):
    """账户快照模型"""
    __tablename__ = "account_snapshots"
    # 启用赋值时验证，确保快照数量按8位小数存储
    model_config = ConfigDict(validate_assignment=True)
    
    snapshot_id: str = Field(primary_key=True, description="快照ID")
    task_id: Optional[str] = Field(default=None, index=True, description="关联的远程策略回测ID")
    account_id: str = Field(index=True, description="账户ID")
    balance: Decimal = Field(description="余额", sa_type=Numeric(38, 8))
    stock_quantity: Decimal = Field(description="持仓数量（支持加密货币小数位）", sa_type=Numeric(38, 8))
    stock_price: Decimal = Field(description="快照时股价", sa_type=Numeric(38, 8))
    stock_market_value: Decimal = Field(description="持股价值", sa_type=Numeric(38, 8))
    total_value: Decimal = Field(description="总价值", sa_type=Numeric(38, 8))
    profit_loss: Decimal = Field(description="盈亏金额", sa_type=Numeric(38, 8))
    profit_loss_percent: Decimal = Field(description="盈亏百分比", sa_type=Numeric(15, 6))
    timestamp: datetime = Field(default_factory=TimestampUtils.now_utc_naive, index=True, description="快照时间")
    
    # 新增字段：保证金占用
    margin_used: Decimal = Field(
        default=Decimal("0"), 
        description="当前保证金占用", 
        sa_type=Numeric(38, 8)
    )
    
    # 新增字段：市场类型
    market_type: str = Field(description="市场类型，例如 'US' 或 'COIN'", sa_type=sa_Text)
    
    # 新增字段：初始余额
    initial_balance: Decimal = Field(description="初始余额", sa_type=Numeric(38, 8))
    
    # 新增字段：关联股票代码
    stock_symbol: str = Field(description="关联股票代码", sa_type=sa_Text)
    
    # 新增字段：当前余额（与balance字段保持一致，用于兼容性）
    current_balance: Decimal = Field(description="当前余额", sa_type=Numeric(38, 8))
    
    # 新增字段：持仓方向
    position_side: str = Field(
        default="LONG", 
        description="持仓方向: LONG-多头, SHORT-空头",
        sa_type=sa_Text
    )
    
    # 新增字段：空头持仓均价
    short_avg_price: Decimal = Field(
        default=Decimal("0"), 
        description="空头持仓均价", 
        sa_type=Numeric(38, 8)
    )
    
    # 新增字段：空头持仓总成本
    short_total_cost: Decimal = Field(
        default=Decimal("0"), 
        description="空头持仓总成本", 
        sa_type=Numeric(38, 8)
    )
    
    # 新增字段：空头持仓明细
    short_positions: Optional[list] = Field(
        default_factory=list, 
        description="空头持仓明细", 
        sa_type=JSON
    )
    
    # 新增字段：多头持仓明细
    long_positions: Optional[list] = Field(
        default_factory=list, 
        description="多头持仓明细", 
        sa_type=JSON
    )
    
    # 新增字段：可用余额
    available_balance: Decimal = Field(
        default=Decimal("0"), 
        description="当前账户可用余额", 
        sa_type=Numeric(38, 8)
    )
    
    # 新增字段：累计交易费用
    total_fees: Decimal = Field(
        default=Decimal("0"), 
        description="累计交易费用", 
        sa_type=Numeric(38, 8)
    )

    @field_validator("stock_quantity", mode="before")
    def _round_snapshot_quantity(cls, v):
        """
        快照数量字段校验：保留8位小数，确保与加密资产最小单位一致
        """
        try:
            return to_dec(v, 8)
        except Exception as e:
            logger.error(f"AccountSnapshot.stock_quantity 校验失败，输入={v} 错误={e}")
            return to_dec(0, 8)

    @field_validator("balance", "stock_market_value", "total_value", "profit_loss", "margin_used", "initial_balance", "current_balance", "short_avg_price", "short_total_cost", "available_balance", mode="before")
    def _round_snapshot_amounts(cls, v):
        """
        快照金额字段校验：统一保留8位小数
        """
        try:
            return to_dec(v, 8)
        except Exception as e:
            logger.error(f"AccountSnapshot 金额校验失败，输入={v} 错误={e}")
            return to_dec(0, 8)

    @field_validator("profit_loss_percent", mode="before")
    def _round_snapshot_percent(cls, v):
        """
        百分比字段校验：保留6位小数（防止过度精确导致显示问题）
        """
        try:
            return to_dec(v, 6)
        except Exception as e:
            logger.error(f"AccountSnapshot 百分比校验失败，输入={v} 错误={e}")
            return to_dec(0, 6)


class LocalDecision(SQLModel, table=True):
    """本地决策记录模型"""
    __tablename__ = "local_decisions"
    
    decision_id: str = Field(primary_key=True, description="决策ID")
    task_id: Optional[str] = Field(default=None, index=True, description="关联的回测ID")
    account_id: str = Field(index=True, description="账户ID")
    stock_symbol: str = Field(index=True, description="股票代码")
    decision_result: str = Field(description="决策结果")
    confidence_score: Decimal = Field(description="置信度分数", sa_type=Numeric(10, 6))
    reasoning: str = Field(description="决策理由")
    market_data: dict | None = Field(default=None, description="市场数据JSON", sa_type=JSON)
    start_time: datetime = Field(default_factory=TimestampUtils.now_utc_naive, description="开始时间", sa_type=DateTime, index=True)
    end_time: Optional[datetime] = Field(default=None, description="结束时间", sa_type=DateTime, index=True)
    execution_time_ms: Optional[int] = Field(default=None, description="执行时间(毫秒)")
    analysis_date: Optional[datetime] = Field(default=None, description="分析日期", sa_type=DateTime)

    @field_validator("market_data", mode="before")
    def parse_json_string(cls, v):
        """
        兼容处理：如果数据库中存储的是JSON字符串，尝试解析为字典
        """
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                # 解析失败则返回原值，由后续校验处理
                return v
        return v


class Task(SQLModel, table=True):
    __tablename__ = "tasks"
    task_id: str = Field(primary_key=True, description="回测ID")
    account_id: str = Field(index=True, description="虚拟账户ID")
    stock_symbol: str = Field(index=True, description="股票/加密代码")
    market_type: Optional[str] = Field(default=None, description="市场类型，例如 US/COIN")
    user_prompt_id: Optional[str] = Field(default=None, description="用户策略ID")
    ai_config_id: Optional[str] = Field(default=None, index=True, description="关联的AI配置ID")
    start_date: datetime = Field(description="开始日期", sa_type=DateTime, index=True)
    end_date: datetime = Field(description="结束日期", sa_type=DateTime, index=True)
    status: str = Field(default="PENDING", description="任务状态: PENDING/RUNNING/PAUSED/COMPLETED/COMPLETED_WITH_ERRORS/FAILED/CANCELLED", index=True)
    created_at: datetime = Field(default_factory=TimestampUtils.now_utc_naive, description="创建时间", index=True)
    started_at: Optional[datetime] = Field(default=None, description="启动时间")
    paused_at: Optional[datetime] = Field(default=None, description="暂停时间")
    resumed_at: Optional[datetime] = Field(default=None, description="恢复时间")
    completed_at: Optional[datetime] = Field(default=None, description="完成时间")
    error_message: Optional[str] = Field(default=None, description="错误信息")
    total_items: Optional[int] = Field(default=None, description="计划处理的数量")
    processed_items: Optional[int] = Field(default=0, description="已处理数量")
    time_granularity: str = Field(default="daily", description="时间粒度: daily/hourly/minute", index=True)
    decision_interval: int = Field(default=1, description="决策间隔单位数，从0点整开始确定决策时间点")
    
    # 新增回测统计字段
    stats: Optional[dict] = Field(
        default=None, 
        description="回测统计数据，包含合计交易次数、累计收益率、最大回撤等指标", 
        sa_type=JSON
    )


class TradeRecord(SQLModel, table=True):
    """交易记录模型"""
    __tablename__ = "trade_records"
    # 启用赋值时验证，确保交易数量按8位小数存储
    model_config = ConfigDict(validate_assignment=True)
    
    trade_id: str = Field(primary_key=True, description="交易ID")
    task_id: Optional[str] = Field(default=None, index=True, description="关联的回测ID")
    account_id: str = Field(index=True, description="账户ID")
    stock_symbol: str = Field(description="股票代码", index=True)
    trade_action: str = Field(description="交易动作", index=True)
    quantity: Decimal = Field(description="交易数量（支持加密货币小数位）", sa_type=Numeric(38, 8))
    price: Decimal = Field(description="交易价格", sa_type=Numeric(38, 8))
    total_amount: Decimal = Field(description="交易总额", sa_type=Numeric(38, 8))
    status: str = Field(default="PENDING", description="交易状态")
    trade_time: datetime = Field(default_factory=TimestampUtils.now_utc_naive, index=True, description="交易时间")
    decision_id: Optional[str] = Field(default=None, description="关联决策ID")
    
    # 交易费用
    commission: Decimal = Field(default=Decimal("0"), description="佣金", sa_type=Numeric(38, 8))
    tax: Decimal = Field(default=Decimal("0"), description="税费", sa_type=Numeric(38, 8))
    total_fees: Decimal = Field(default=Decimal("0"), description="总费用", sa_type=Numeric(38, 8))
    
    # 新增字段：持仓方向
    position_side: str = Field(
        default="LONG", 
        description="仓位方向: LONG-多头交易, SHORT-空头交易",
        sa_type=sa_Text
    )
    
    # 新增字段：开仓交易ID（平仓时关联）
    open_id: Optional[str] = Field(default=None, description="关联的开仓交易ID", sa_type=sa_Text)
    
    # 新增字段：交易后的账户状态
    stock_market_value_after: Decimal = Field(
        default=Decimal("0"), 
        description="交易后的持仓金额", 
        sa_type=Numeric(38, 8)
    )
    total_value_after: Decimal = Field(
        default=Decimal("0"), 
        description="交易后的账户总金额", 
        sa_type=Numeric(38, 8)
    )
    margin_used_after: Decimal = Field(
        default=Decimal("0"), 
        description="交易后的保证金占用", 
        sa_type=Numeric(38, 8)
    )
    remaining_quantity_after: Decimal = Field(
        default=Decimal("0"), 
        description="交易后的剩余持仓数量", 
        sa_type=Numeric(38, 8)
    )
    avg_price_after: Decimal = Field(
        default=Decimal("0"), 
        description="交易后的持仓均价", 
        sa_type=Numeric(38, 8)
    )


class PromptTemplate(SQLModel, table=True):
    """策略模型"""
    __tablename__ = "prompt_templates"
    
    prompt_id: str = Field(primary_key=True, description="提示词ID")
    content: str = Field(description="提示词内容", sa_type=sa_Text)
    description: Optional[str] = Field(default=None, description="提示词描述")
    status: PromptStatus = Field(default=PromptStatus.AVAILABLE, description="状态: AVAILABLE/UNAVAILABLE/DELETED")
    tags: Optional[str] = Field(default=None, description="标签，多个用逗号分隔")
    created_at: datetime = Field(default_factory=TimestampUtils.now_utc_naive, description="创建时间")
    updated_at: datetime = Field(default_factory=TimestampUtils.now_utc_naive, description="更新时间")





class AIConfig(SQLModel, table=True):
    """AI配置模型"""
    __tablename__ = "ai_configs"
    
    config_id: str = Field(primary_key=True, description="配置ID")
    name: str = Field(description="配置名称")
    local_ai_base_url: str = Field(description="AI服务基础URL")
    local_ai_api_key: str = Field(description="AI服务API密钥")
    local_ai_model_name: str = Field(description="AI模型名称")
    created_at: datetime = Field(default_factory=TimestampUtils.now_utc_naive, description="创建时间")
    updated_at: datetime = Field(default_factory=TimestampUtils.now_utc_naive, description="更新时间")
