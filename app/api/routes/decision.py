"""决策相关路由"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, func, select

from app.api.schemas import PaginatedResponse, ApiResponse
from app.database import get_session_dep
from app.models.models import LocalDecision, Task, TradeRecord, AccountSnapshot
from app.utils.backtest_utils import BacktestUtils
from app.utils.timestamp_utils import TimestampUtils
from cfg import logger

router = APIRouter()


@router.get("/decision/local-detail/{decision_id}", response_model=ApiResponse)
async def get_local_decision_detail(decision_id: str, session: Session = Depends(get_session_dep)):
    """
    获取单个本地决策详情
    
    Args:
        decision_id: 决策ID
        session: 数据库会话
        
    Returns:
        本地决策详情数据，包含关联的账户快照和交易记录
    """
    try:
        statement = select(LocalDecision).where(LocalDecision.decision_id == decision_id)
        decision = session.exec(statement).first()
        
        if not decision:
            return ApiResponse(code=404, msg=f"决策记录不存在: {decision_id}", data=None)
        
        # 查询关联的账户快照 - 使用精确时间匹配
        snapshot_stmt = select(AccountSnapshot).where(
            AccountSnapshot.account_id == decision.account_id,
            AccountSnapshot.timestamp == decision.analysis_date
        )
        snapshot = session.exec(snapshot_stmt).first()
        
        # 查询关联的交易记录
        trade_stmt = select(TradeRecord).where(
            TradeRecord.decision_id == decision.decision_id
        )
        trades = session.exec(trade_stmt).all()
        
        # 构建响应数据
        decision_data = decision.dict()
        decision_data["snapshot"] = snapshot.dict() if snapshot else None
        decision_data["trades"] = [trade.dict() for trade in trades] if trades else []
        decision_data["trade_count"] = len(trades)
        
        return ApiResponse(
            code=200,
            msg="success",
            data=decision_data
        )
        
    except Exception as e:
        logger.error(f"获取本地决策详情失败: {e}")
        return ApiResponse(code=500, msg=str(e), data=None)


@router.get("/decision/local", response_model=PaginatedResponse)
async def get_local_decisions(
    task_id: Optional[str] = Query(None, description="回测ID"),
    account_id: Optional[str] = Query(None),
    stock_symbol: Optional[str] = Query(None),
    decision_id: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None, description="开始时间"),
    end_date: Optional[datetime] = Query(None, description="结束时间"),
    has_trades: Optional[bool] = Query(None, description="是否只显示有交易的决策"),
    is_trade: Optional[bool] = Query(None, description="是否只显示交易决策（排除 HOLD、WAIT）"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1),
    sort_order: str = Query("desc", description="排序顺序: desc 或 asc"),
    session: Session = Depends(get_session_dep)
):
    """
    查询本地决策记录
    
    Args:
        task_id: 回测ID
        account_id: 账户ID
        stock_symbol: 股票代码
        decision_id: 决策ID
        start_date: 开始时间
        end_date: 结束时间
        page: 页码
        page_size: 每页数量
        session: 数据库会话
        
    Returns:
        本地决策分页数据，包含关联的账户快照和交易记录
    """
    try:
        # 构建查询条件
        statement = select(LocalDecision)
        
        if task_id:
            statement = statement.where(LocalDecision.task_id == task_id)
        if account_id:
            statement = statement.where(LocalDecision.account_id == account_id)
        if stock_symbol:
            statement = statement.where(LocalDecision.stock_symbol == stock_symbol)
        if decision_id:
            from sqlalchemy import literal
            statement = statement.where(LocalDecision.decision_id.contains(decision_id))
        if start_date:
            statement = statement.where(LocalDecision.start_time >= TimestampUtils.ensure_utc_naive(start_date))
        if end_date:
            statement = statement.where(LocalDecision.start_time <= TimestampUtils.ensure_utc_naive(end_date))
        
        # 如果指定了 has_trades，过滤有交易或无交易的决策
        if has_trades is not None:
            # 使用 EXISTS 子查询来检查是否有交易记录
            if has_trades:
                # 只显示有交易的决策
                from sqlalchemy import exists
                statement = statement.where(
                    exists().where(TradeRecord.decision_id == LocalDecision.decision_id)
                )
            else:
                # 只显示无交易的决策
                from sqlalchemy import not_
                statement = statement.where(
                    ~exists().where(TradeRecord.decision_id == LocalDecision.decision_id)
                )
        
        # 如果指定了 is_trade，过滤交易决策（排除 HOLD、WAIT）
        if is_trade is not None:
            from sqlalchemy import or_
            trade_actions = ['BUY', 'SELL', 'SHORT_SELL', 'COVER_SHORT']
            non_trade_actions = ['HOLD', 'WAIT', 'CANCEL']
            if is_trade:
                statement = statement.where(LocalDecision.decision_result.in_(trade_actions))
                logger.info(f"过滤交易决策: is_trade=True, 交易动作={trade_actions}")
            else:
                statement = statement.where(LocalDecision.decision_result.in_(non_trade_actions))
                logger.info(f"过滤非交易决策: is_trade=False, 非交易动作={non_trade_actions}")
        else:
            logger.info(f"不过滤决策类型: is_trade=None")
        
        # 计算总数：与过滤条件保持一致，避免由于子查询引起的统计偏差
        count_statement = select(func.count(LocalDecision.decision_id))
        if task_id:
            count_statement = count_statement.where(LocalDecision.task_id == task_id)
        if account_id:
            count_statement = count_statement.where(LocalDecision.account_id == account_id)
        if stock_symbol:
            count_statement = count_statement.where(LocalDecision.stock_symbol == stock_symbol)
        if decision_id:
            count_statement = count_statement.where(LocalDecision.decision_id.contains(decision_id))
        if start_date:
            count_statement = count_statement.where(LocalDecision.start_time >= TimestampUtils.ensure_utc_naive(start_date))
        if end_date:
            count_statement = count_statement.where(LocalDecision.start_time <= TimestampUtils.ensure_utc_naive(end_date))
        
        # 如果指定了 has_trades，在计数查询中也添加相同条件
        if has_trades is not None:
            from sqlalchemy import exists
            if has_trades:
                count_statement = count_statement.where(
                    exists().where(TradeRecord.decision_id == LocalDecision.decision_id)
                )
            else:
                from sqlalchemy import not_
                count_statement = count_statement.where(
                    ~exists().where(TradeRecord.decision_id == LocalDecision.decision_id)
                )
        
        # 如果指定了 is_trade，在计数查询中也添加相同条件
        if is_trade is not None:
            trade_actions = ['BUY', 'SELL', 'SHORT_SELL', 'COVER_SHORT']
            non_trade_actions = ['HOLD', 'WAIT', 'CANCEL']
            if is_trade:
                count_statement = count_statement.where(LocalDecision.decision_result.in_(trade_actions))
            else:
                count_statement = count_statement.where(LocalDecision.decision_result.in_(non_trade_actions))
        
        total = session.exec(count_statement).first() or 0
        
        # 分页查询
        offset = (page - 1) * page_size
        order = LocalDecision.start_time.desc() if sort_order == "desc" else LocalDecision.start_time.asc()
        statement = statement.order_by(order).offset(offset).limit(page_size)
        
        decisions = session.exec(statement).all()
        
        # 批量获取所有相关数据，避免N+1查询
        decision_ids = [decision.decision_id for decision in decisions]
        
        # 获取所有关联的账户快照 - 使用精确的时间匹配，支持小时粒度
        if decisions:
            # 获取所有决策的账户ID和分析时间
            all_account_ids = [decision.account_id for decision in decisions]
            all_analysis_dates = [decision.analysis_date for decision in decisions]
            
            # 构建账户快照查询条件 - 获取所有相关账户和时间范围内的快照
            snapshots_stmt = select(AccountSnapshot).where(
                AccountSnapshot.account_id.in_(all_account_ids),
                AccountSnapshot.timestamp.in_(all_analysis_dates)
            )
            snapshots = session.exec(snapshots_stmt).all()
        else:
            snapshots = []
        
        # 构建快照字典，便于快速查找 - 使用精确的时间戳作为键
        snapshot_dict = {}
        for snapshot in snapshots:
            # 使用精确的时间戳作为键进行匹配
            key = (snapshot.account_id, snapshot.timestamp)
            snapshot_dict[key] = snapshot
        
        # 获取所有关联的交易记录
        if decision_ids:
            trades_stmt = select(TradeRecord).where(
                TradeRecord.decision_id.in_(decision_ids)
            )
            trades = session.exec(trades_stmt).all()
        else:
            trades = []
        
        # 构建交易字典，便于快速查找
        trade_dict = {}
        for trade in trades:
            if trade.decision_id not in trade_dict:
                trade_dict[trade.decision_id] = []
            trade_dict[trade.decision_id].append(trade)
        
        # 为每个决策组装关联数据
        decisions_with_related = []
        for decision in decisions:
            decision_dict = decision.dict()
            
            # 获取关联的账户快照 - 使用精确的时间匹配
            snapshot_key = (decision.account_id, decision.analysis_date)
            snapshot = snapshot_dict.get(snapshot_key)
            
            # 获取关联的交易记录
            decision_trades = trade_dict.get(decision.decision_id, [])
            
            # 添加关联数据
            decision_dict["snapshot"] = snapshot.dict() if snapshot else None
            decision_dict["trades"] = [trade.dict() for trade in decision_trades] if decision_trades else []
            decision_dict["trade_count"] = len(decision_trades)
            
            decisions_with_related.append(decision_dict)
        
        logger.info(f"查询结果: total={total}, page={page}, page_size={page_size}, items_count={len(decisions_with_related)}")
        
        return PaginatedResponse(
            code=200,
            msg="success",
            data={
                "items": decisions_with_related,
                "page": page,
                "page_size": page_size,
                "total": total,
                "total_pages": (total + page_size - 1) // page_size
            }
        )
        
    except Exception as e:
        logger.error(f"查询本地决策失败: {e}")
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


@router.get("/kline/related-data", response_model=ApiResponse)
async def get_kline_related_data(
    task_id: str = Query(..., description="回测ID"),
    account_id: str = Query(..., description="账户ID"),
    analysis_date: datetime = Query(..., description="分析日期"),
    session: Session = Depends(get_session_dep)
):
    """
    根据回测ID、账户ID和分析日期查询关联数据
    
    获取逻辑：
    1. 根据传入的task_id获取任务信息，确定时间颗粒度
    2. 根据时间颗粒度和分析日期，查询关联决策
    3. 根据查询到的决策，查询关联的交易记录
    4. 根据分析日期和账户ID，查询关联的账户快照
    
    Args:
        task_id: 回测ID
        account_id: 账户ID
        analysis_date: 分析日期
        session: 数据库会话
        
    Returns:
        包含决策、交易和快照的数据
    """
    try:
        # 构建响应数据
        data = {
            "decision": None,
            "trades": [],
            "snapshot": None
        }
        
        # 1. 获取任务信息，确定时间颗粒度
        task_stmt = select(Task).where(Task.task_id == task_id)
        task = session.exec(task_stmt).first()
        
        if not task:
            return ApiResponse(code=404, msg=f"任务不存在: {task_id}", data=None)
        
        # 2. 根据任务时间颗粒度构建不同的查询条件
        time_granularity = task.time_granularity or 'daily'
        
        # 转换分析日期为UTC naive datetime，确保时区一致
        naive_analysis_date = TimestampUtils.ensure_utc_naive(analysis_date)
        
        # 3. 构建决策查询条件
        decision_stmt = select(LocalDecision).where(
            LocalDecision.task_id == task_id,
            LocalDecision.account_id == account_id
        )
        
        # 根据时间颗粒度添加不同的时间过滤条件
        if time_granularity == 'daily':
            # 日粒度：只比较日期部分
            decision_stmt = decision_stmt.where(
                func.date(LocalDecision.analysis_date) == func.date(naive_analysis_date)
            )
        elif time_granularity == 'hourly':
            # 小时粒度：比较年月日小时
            decision_stmt = decision_stmt.where(
                func.extract('year', LocalDecision.analysis_date) == func.extract('year', naive_analysis_date),
                func.extract('month', LocalDecision.analysis_date) == func.extract('month', naive_analysis_date),
                func.extract('day', LocalDecision.analysis_date) == func.extract('day', naive_analysis_date),
                func.extract('hour', LocalDecision.analysis_date) == func.extract('hour', naive_analysis_date)
            )
        elif time_granularity == 'minute':
            # 分钟粒度：比较年月日小时分钟
            decision_stmt = decision_stmt.where(
                func.extract('year', LocalDecision.analysis_date) == func.extract('year', naive_analysis_date),
                func.extract('month', LocalDecision.analysis_date) == func.extract('month', naive_analysis_date),
                func.extract('day', LocalDecision.analysis_date) == func.extract('day', naive_analysis_date),
                func.extract('hour', LocalDecision.analysis_date) == func.extract('hour', naive_analysis_date),
                func.extract('minute', LocalDecision.analysis_date) == func.extract('minute', naive_analysis_date)
            )
        else:
            # 默认日粒度
            decision_stmt = decision_stmt.where(
                func.date(LocalDecision.analysis_date) == func.date(naive_analysis_date)
            )
        
        decision = session.exec(decision_stmt).first()
        
        if decision:
            # 处理决策数据
            data["decision"] = {
                "decision_id": decision.decision_id,
                "task_id": decision.task_id,
                "account_id": decision.account_id,
                "stock_symbol": decision.stock_symbol,
                "decision_result": decision.decision_result,
                "confidence_score": decision.confidence_score,
                "reasoning": decision.reasoning,
                "market_data": decision.market_data,
                "start_time": TimestampUtils.to_utc_iso(decision.start_time) if decision.start_time else None,
                "end_time": TimestampUtils.to_utc_iso(decision.end_time) if decision.end_time else None,
                "execution_time_ms": decision.execution_time_ms,
                "analysis_date": TimestampUtils.to_utc_iso(decision.analysis_date) if decision.analysis_date else None
            }
            
            # 4. 根据决策的decision_id查询关联的交易记录
            trade_stmt = select(TradeRecord).where(
                TradeRecord.decision_id == decision.decision_id
            )
            trades = session.exec(trade_stmt).all()
            
            if trades:
                data["trades"] = [{"trade_id": trade.trade_id,
                    "task_id": trade.task_id,
                    "account_id": trade.account_id,
                    "decision_id": trade.decision_id,
                    "stock_symbol": trade.stock_symbol,
                    "trade_action": trade.trade_action,
                    "trade_fees": str(trade.total_fees) if trade.total_fees else None,
                    "trade_price": str(trade.price) if trade.price else None,
                    "trade_quantity": str(trade.quantity) if trade.quantity else None,
                    "trade_amount": str(trade.total_amount) if trade.total_amount else None,
                    "trade_time": TimestampUtils.to_utc_iso(trade.trade_time) if trade.trade_time else None,
                    "status": trade.status
                } for trade in trades]
        
        # 5. 查询关联的账户快照
        snapshot_stmt = select(AccountSnapshot).where(
            AccountSnapshot.account_id == account_id
        )
        
        # 根据时间颗粒度添加不同的时间过滤条件
        if time_granularity == 'daily':
            # 日粒度：只比较日期部分
            snapshot_stmt = snapshot_stmt.where(
                func.date(AccountSnapshot.timestamp) == func.date(naive_analysis_date)
            )
        elif time_granularity == 'hourly':
            # 小时粒度：比较年月日小时
            snapshot_stmt = snapshot_stmt.where(
                func.extract('year', AccountSnapshot.timestamp) == func.extract('year', naive_analysis_date),
                func.extract('month', AccountSnapshot.timestamp) == func.extract('month', naive_analysis_date),
                func.extract('day', AccountSnapshot.timestamp) == func.extract('day', naive_analysis_date),
                func.extract('hour', AccountSnapshot.timestamp) == func.extract('hour', naive_analysis_date)
            )
        elif time_granularity == 'minute':
            # 分钟粒度：比较年月日小时分钟
            snapshot_stmt = snapshot_stmt.where(
                func.extract('year', AccountSnapshot.timestamp) == func.extract('year', naive_analysis_date),
                func.extract('month', AccountSnapshot.timestamp) == func.extract('month', naive_analysis_date),
                func.extract('day', AccountSnapshot.timestamp) == func.extract('day', naive_analysis_date),
                func.extract('hour', AccountSnapshot.timestamp) == func.extract('hour', naive_analysis_date),
                func.extract('minute', AccountSnapshot.timestamp) == func.extract('minute', naive_analysis_date)
            )
        else:
            # 默认日粒度
            snapshot_stmt = snapshot_stmt.where(
                func.date(AccountSnapshot.timestamp) == func.date(naive_analysis_date)
            )
        
        snapshot = session.exec(snapshot_stmt).first()
        
        if snapshot:
            # 处理快照数据
            data["snapshot"] = {
                "snapshot_id": snapshot.snapshot_id,
                "account_id": snapshot.account_id,
                "market_type": snapshot.market_type,
                "stock_symbol": snapshot.stock_symbol,
                "initial_balance": snapshot.initial_balance,
                "balance": snapshot.balance,
                "available_balance": snapshot.available_balance,
                "stock_quantity": snapshot.stock_quantity,
                "stock_price": snapshot.stock_price,
                "stock_market_value": snapshot.stock_market_value,
                "total_value": snapshot.total_value,
                "total_fees": snapshot.total_fees,
                "margin_used": snapshot.margin_used,
                "position_side": snapshot.position_side,
                "short_avg_price": snapshot.short_avg_price,
                "short_total_cost": snapshot.short_total_cost,
                "profit_loss": snapshot.profit_loss,
                "profit_loss_percent": snapshot.profit_loss_percent,
                "timestamp": TimestampUtils.to_utc_iso(snapshot.timestamp) if snapshot.timestamp else None
            }
        
        return ApiResponse(code=200, msg="success", data=data)
    except Exception as e:
        logger.error(f"查询K线关联数据失败: {e}")
        return ApiResponse(code=500, msg=str(e), data=None)


@router.get("/task/stats", response_model=ApiResponse)
async def get_task_statistics(
    task_id: str = Query(..., description="回测ID"),
    session: Session = Depends(get_session_dep)
):
    """
    获取回测结果统计
    
    Args:
        task_id: 回测ID
        session: 数据库会话
        
    Returns:
        任务统计数据，包括：
        - 时间段
        - 合计交易次数
        - 累计收益率
        - 单笔最大收益
        - 最大回撤
        - 夏普率
        - 胜率
        - 平均盈利
        - 平均亏损
        - 盈亏比
    """
    try:
        # 查询任务基本信息
        task_stmt = select(Task).where(Task.task_id == task_id)
        task = session.exec(task_stmt).first()
        
        if not task:
            return ApiResponse(code=404, msg=f"任务不存在: {task_id}", data=None)
        
        # 如果stats字段为空或不存在，计算并更新
        if not task.stats:
            logger.info(f"任务统计数据为空，开始计算: {task_id}")
            stats = BacktestUtils.calculate_backtest_stats(task_id, session)
            
            # 更新任务的stats字段
            task.stats = stats
            session.add(task)
            session.commit()
        else:
            # 直接使用已有的stats字段
            stats = task.stats
        
        # 构建最终返回结果
        result = {
            "task_id": task.task_id,
            "time_period": {
                "start_date": TimestampUtils.to_utc_iso(task.start_date),
                "end_date": TimestampUtils.to_utc_iso(task.end_date)
            },
            **stats
        }
        
        return ApiResponse(
            code=200,
            msg="success",
            data=result
        )
    except Exception as e:
        logger.error(f"获取回测结果统计失败: {e}")
        return ApiResponse(code=500, msg=str(e), data=None)
