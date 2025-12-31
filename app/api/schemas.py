"""
API请求响应模型
"""
from datetime import datetime
from typing import Optional, Any, Generic, TypeVar

from pydantic import BaseModel, Field

from ..models.enums import TradeAction, TradeStatus, DecisionResult, PromptStatus

# 定义泛型类型变量
DataT = TypeVar('DataT')


class ApiResponse(BaseModel, Generic[DataT]):
    """
    统一API响应模型
    
    Attributes:
        code: 响应码，200表示成功
        msg: 响应消息
        data: 响应数据
    """
    code: int = Field(200, description="响应码")
    msg: str = Field("success", description="响应消息")
    data: Optional[DataT] = Field(None, description="响应数据")


class PaginationInfo(BaseModel):
    """
    分页信息模型
    
    Attributes:
        page: 当前页码
        page_size: 每页大小
        total: 总记录数
        total_pages: 总页数
    """
    page: int = Field(..., description="当前页码")
    page_size: int = Field(..., description="每页大小")
    total: int = Field(..., description="总记录数")
    total_pages: int = Field(..., description="总页数")


class PaginatedResponse(BaseModel, Generic[DataT]):
    """
    分页响应模型
    
    Attributes:
        code: 响应码，200表示成功
        msg: 响应消息
        data: 响应数据，包含items列表和分页信息
    """
    code: int = Field(200, description="响应码")
    msg: str = Field("success", description="响应消息")
    data: dict = Field(..., description="响应数据")


class ErrorResponse(BaseModel):
    """
    错误响应模型
    
    Attributes:
        code: 错误码
        msg: 错误消息
        detail: 错误详情（可选）
    """
    code: int = Field(..., description="错误码")
    msg: str = Field(..., description="错误消息")
    detail: Optional[Any] = Field(None, description="错误详情")


class TradeHistoryQuery(BaseModel):
    """交易历史查询参数"""
    account_id: Optional[str] = Field(None, description="账户ID")
    stock_symbol: Optional[str] = Field(None, description="股票代码")
    trade_action: Optional[TradeAction] = Field(None, description="交易动作")
    status: Optional[TradeStatus] = Field(None, description="交易状态")
    start_date: Optional[datetime] = Field(None, description="开始日期")
    end_date: Optional[datetime] = Field(None, description="结束日期")
    page: int = Field(1, ge=1, description="页码")
    page_size: int = Field(20, ge=1, le=100, description="每页数量")


class AccountSnapshotQuery(BaseModel):
    """账户快照查询参数"""
    account_id: Optional[str] = Field(None, description="账户ID")
    start_date: Optional[datetime] = Field(None, description="开始日期")
    end_date: Optional[datetime] = Field(None, description="结束日期")
    page: int = Field(1, ge=1, description="页码")
    page_size: int = Field(20, ge=1, le=100, description="每页数量")


class VirtualAccountQuery(BaseModel):
    """虚拟账户查询参数"""
    account_id: Optional[str] = Field(None, description="账户ID")
    stock_symbol: Optional[str] = Field(None, description="股票代码")
    include_latest_snapshot: bool = Field(False, description="是否包含最新快照")


class LocalDecisionQuery(BaseModel):
    """本地决策查询参数"""
    account_id: Optional[str] = Field(None, description="账户ID")
    stock_symbol: Optional[str] = Field(None, description="股票代码")
    decision_result: Optional[DecisionResult] = Field(None, description="决策结果")
    start_date: Optional[datetime] = Field(None, description="开始日期")
    end_date: Optional[datetime] = Field(None, description="结束日期")
    page: int = Field(1, ge=1, description="页码")
    page_size: int = Field(20, ge=1, le=100, description="每页数量")


class LocalDecisionRunRequest(BaseModel):
    account_id: str = Field(..., description="账户ID")
    stock_symbol: str = Field(..., description="股票代码")
    analysis_date: Optional[str] = Field(None, description="分析日期")
    options: Optional[dict] = Field(None, description="执行选项JSON")


class LocalDecisionTestRequest(BaseModel):
    """本地决策测试请求（远程策略相关已移除）"""
    user_prompt_id: Optional[str] = Field(None, description="用户策略ID")
    override_price: Optional[float] = Field(None, description="可选覆盖测试执行价格，不传则使用BTCDailyBar收盘价")


class SystemStatusResponse(ApiResponse):
    """系统状态响应"""
    pass


class LocalDecisionTaskCreateRequest(BaseModel):
    """本地决策任务创建请求"""
    account_id: str = Field(..., description="虚拟账户ID")
    stock_symbol: str = Field(..., description="股票/加密代码")
    start_date: str = Field(..., description="开始日期 YYYY-MM-DD")
    end_date: str = Field(..., description="结束日期 YYYY-MM-DD")
    market_type: str = Field(..., description="市场类型")
    initial_balance: float = Field(..., description="初始余额")
    ai_config_id: Optional[str] = Field(None, description="AI配置ID")
    time_granularity: str = Field(default="daily", description="时间粒度: daily/hourly/minute")
    decision_interval: int = Field(default=24, description="决策间隔单位数，从0点整开始确定决策时间点")


class LocalDecisionTaskStartRequest(BaseModel):
    """本地决策任务启动请求"""
    task_id: str = Field(..., description="回测ID")


class TaskCreateRequest(BaseModel):
    """统一任务创建请求（仅支持本地决策任务）"""
    account_id: str = Field(..., description="虚拟账户ID")
    stock_symbol: str = Field(..., description="股票/加密代码")
    start_date: str = Field(..., description="开始日期 YYYY-MM-DD")
    end_date: str = Field(..., description="结束日期 YYYY-MM-DD")
    market_type: str = Field(..., description="市场类型，例如 US/COIN")
    user_prompt_id: Optional[str] = Field(None, description="用户策略ID")
    ai_config_id: Optional[str] = Field(None, description="AI配置ID")
    initial_balance: float = Field(..., description="初始余额")
    time_granularity: str = Field(default="daily", description="时间粒度: daily/hourly/minute")
    decision_interval: int = Field(default=24, description="决策间隔单位数，从0点整开始确定决策时间点")
    
    # 费用配置
    commission_rate_buy: Optional[float] = Field(0.001, description="买入佣金率")
    commission_rate_sell: Optional[float] = Field(0.001, description="卖出佣金率")
    tax_rate: Optional[float] = Field(0.001, description="印花税率")
    min_commission: Optional[float] = Field(5.0, description="最低佣金")


class TaskStartRequest(BaseModel):
    """统一任务启动请求"""
    task_id: str = Field(..., description="回测ID")
    market_type: Optional[str] = Field(None, description="市场类型")


class TaskStopRequest(BaseModel):
    """统一任务停止请求"""
    task_id: str = Field(..., description="回测ID")


class TaskPauseRequest(BaseModel):
    """统一任务暂停请求"""
    task_id: str = Field(..., description="回测ID")


class TaskResumeRequest(BaseModel):
    """统一任务继续请求"""
    task_id: str = Field(..., description="回测ID")


class TaskQuery(BaseModel):
    """统一任务查询参数"""
    status: Optional[str] = Field(None, description="任务状态")
    account_id: Optional[str] = Field(None, description="账户ID")
    stock_symbol: Optional[str] = Field(None, description="股票/加密代码")
    start_date: Optional[datetime] = Field(None, description="开始时间")
    end_date: Optional[datetime] = Field(None, description="结束时间")
    page: int = Field(1, ge=1, description="页码")
    page_size: int = Field(20, ge=1, le=100, description="每页数量")


class PromptTemplateQuery(BaseModel):
    """策略查询参数"""
    # 已移除提示词类型字段
    status: Optional[PromptStatus] = Field(None, description="状态")
    keyword: Optional[str] = Field(None, description="关键词搜索（内容或描述）")
    page: int = Field(1, ge=1, description="页码")
    page_size: int = Field(20, ge=1, le=100, description="每页数量")


class PromptTemplateCreateRequest(BaseModel):
    """策略创建请求"""
    # 已移除提示词类型字段
    content: str = Field(..., description="提示词内容")
    description: Optional[str] = Field(None, description="描述")
    tags: Optional[str] = Field(None, description="标签，用逗号分隔")
    status: PromptStatus = Field(PromptStatus.AVAILABLE, description="状态")


class PromptTemplateUpdateRequest(BaseModel):
    """策略更新请求"""
    # 已移除提示词类型字段
    content: Optional[str] = Field(None, description="提示词内容")
    description: Optional[str] = Field(None, description="描述")
    tags: Optional[str] = Field(None, description="标签，用逗号分隔")
    status: Optional[PromptStatus] = Field(None, description="状态")


class AIConfigQuery(BaseModel):
    """AI配置查询参数"""
    keyword: Optional[str] = Field(None, description="关键词搜索（名称）")
    page: int = Field(1, ge=1, description="页码")
    page_size: int = Field(20, ge=1, le=100, description="每页数量")


class AIConfigCreateRequest(BaseModel):
    """AI配置创建请求"""
    name: str = Field(..., description="配置名称")
    local_ai_base_url: str = Field(..., description="AI服务基础URL")
    local_ai_api_key: str = Field(..., description="AI服务API密钥")
    local_ai_model_name: str = Field(..., description="AI模型名称")


class AIConfigUpdateRequest(BaseModel):
    """AI配置更新请求"""
    name: Optional[str] = Field(None, description="配置名称")
    local_ai_base_url: Optional[str] = Field(None, description="AI服务基础URL")
    local_ai_api_key: Optional[str] = Field(None, description="AI服务API密钥")
    local_ai_model_name: Optional[str] = Field(None, description="AI模型名称")
