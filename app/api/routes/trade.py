"""交易相关路由"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, func, select

from app.api.schemas import PaginatedResponse, ApiResponse
from app.database import get_session_dep
from app.models.enums import TradeAction, TradeStatus
from app.models.models import TradeRecord, Task
from app.utils.timestamp_utils import TimestampUtils
from cfg import logger

router = APIRouter()


@router.get("/trade/history", response_model=PaginatedResponse)
async def get_trade_history(
    task_id: Optional[str] = Query(None, description="回测ID"),
    account_id: Optional[str] = Query(None),
    stock_symbol: Optional[str] = Query(None),
    decision_id: Optional[str] = Query(None),
    trade_action: Optional[TradeAction] = Query(None),
    status: Optional[TradeStatus] = Query(None),
    start_date: Optional[datetime] = Query(None, description="开始时间"),
    end_date: Optional[datetime] = Query(None, description="结束时间"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1),
    sort_order: str = Query("desc", description="排序顺序: desc 或 asc"),
    session: Session = Depends(get_session_dep)
):
    """
    查询交易历史
    
    Args:
        task_id: 回测ID
        account_id: 账户ID
        stock_symbol: 股票代码
        trade_action: 交易动作
        status: 交易状态
        start_date: 开始时间
        end_date: 结束时间
        page: 页码
        page_size: 每页数量
        session: 数据库会话
        
    Returns:
        交易历史分页数据
    """
    try:
        # 如果提供了task_id，优先从task获取account_id、stock_symbol、start_date和end_date
        if task_id:
            task = session.exec(select(Task).where(Task.task_id == task_id)).first()
            if task:
                if not account_id:
                    account_id = task.account_id
                if not stock_symbol:
                    stock_symbol = task.stock_symbol
                if not start_date:
                    start_date = task.start_date
                if not end_date:
                    end_date = task.end_date
        
        # 构建查询条件
        statement = select(TradeRecord)
        
        if task_id:
            statement = statement.where(TradeRecord.task_id == task_id)
        if account_id:
            statement = statement.where(TradeRecord.account_id == account_id)
        if stock_symbol:
            statement = statement.where(TradeRecord.stock_symbol == stock_symbol)
        if decision_id:
            statement = statement.where(TradeRecord.decision_id == decision_id)
        if trade_action:
            statement = statement.where(TradeRecord.trade_action == trade_action)
        if status:
            statement = statement.where(TradeRecord.status == status)
        if start_date:
            statement = statement.where(TradeRecord.trade_time >= TimestampUtils.ensure_utc_naive(start_date))
        if end_date:
            statement = statement.where(TradeRecord.trade_time <= TimestampUtils.ensure_utc_naive(end_date))
        
        # 计算总数
        # 直接构建计数查询，确保过滤条件正确应用
        count_statement = select(func.count(TradeRecord.trade_id))
        # 复制原始查询的where条件
        if task_id:
            count_statement = count_statement.where(TradeRecord.task_id == task_id)
        if account_id:
            count_statement = count_statement.where(TradeRecord.account_id == account_id)
        if stock_symbol:
            count_statement = count_statement.where(TradeRecord.stock_symbol == stock_symbol)
        if decision_id:
            count_statement = count_statement.where(TradeRecord.decision_id == decision_id)
        if trade_action:
            count_statement = count_statement.where(TradeRecord.trade_action == trade_action)
        if status:
            count_statement = count_statement.where(TradeRecord.status == status)
        if start_date:
            count_statement = count_statement.where(TradeRecord.trade_time >= TimestampUtils.ensure_utc_naive(start_date))
        if end_date:
            count_statement = count_statement.where(TradeRecord.trade_time <= TimestampUtils.ensure_utc_naive(end_date))
        total = session.exec(count_statement).first() or 0
        
        # 分页查询
        offset = (page - 1) * page_size
        order = TradeRecord.trade_time.desc() if sort_order == "desc" else TradeRecord.trade_time.asc()
        statement = statement.order_by(order).offset(offset).limit(page_size)
        
        trades = session.exec(statement).all()
        
        return PaginatedResponse(
            code=200,
            msg="success",
            data={
                "items": [trade.dict() for trade in trades],
                "page": page,
                "page_size": page_size,
                "total": total,
                "total_pages": (total + page_size - 1) // page_size
            }
        )
        
    except Exception as e:
        logger.error(f"查询交易历史失败: {e}")
        return PaginatedResponse(
            code=500,
            msg=str(e),
            data={
                "items": [],
                "page": page,
                "page_size": page_size,
                "total": 0,
                "total_pages": 0
            }
        )


@router.get("/trade/history/{trade_id}", response_model=ApiResponse)
async def get_trade_detail(trade_id: str, session: Session = Depends(get_session_dep)):
    """
    获取单个交易详情
    
    Args:
        trade_id: 交易ID
        session: 数据库会话
        
    Returns:
        交易详情数据
    """
    try:
        statement = select(TradeRecord).where(TradeRecord.trade_id == trade_id)
        trade = session.exec(statement).first()
        
        if not trade:
            return ApiResponse(code=404, msg=f"交易记录不存在: {trade_id}", data=None)
        
        return ApiResponse(
            code=200,
            msg="success",
            data=trade.dict()
        )
        
    except Exception as e:
        logger.error(f"获取交易详情失败: {e}")
        return ApiResponse(code=500, msg=str(e), data=None)
