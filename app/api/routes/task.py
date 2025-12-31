"""任务相关路由"""
import json as _json
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlmodel import Session, func, select
from starlette.responses import StreamingResponse

from app.api.schemas import ApiResponse, PaginatedResponse
from app.api.schemas import TaskCreateRequest, TaskStartRequest, TaskStopRequest, TaskPauseRequest, TaskResumeRequest
from app.database import engine
from app.database import get_session_dep, get_session
from app.executor.backtesting_processor import start_backtest_task
from app.executor.local_decision_processor import create_local_decision_task
from app.models.models import Task, LocalDecision, TradeRecord, AccountSnapshot, VirtualAccount
from app.services.task_runner import run_task_thread
from app.utils.error_utils import ErrorCode, ErrorMessage, handle_exception, log_error
from app.utils.timestamp_utils import TimestampUtils
from cfg import logger

router = APIRouter()

@router.delete("/task/{task_id}")
async def delete_task(
    task_id: str,
    session: Session = Depends(get_session_dep)
):
    """
    删除任务及其关联数据，包括关联的虚拟账户（如果该账户没有其他任务关联）
    
    Args:
        task_id: 回测ID
        session: 数据库会话
        
    Returns:
        删除结果
    """
    try:
        # 开始事务
        with session.begin():
            # 获取任务
            task = session.get(Task, task_id)
            if not task:
                return ApiResponse(code=ErrorCode.RESOURCE_NOT_FOUND, msg=ErrorMessage.RESOURCE_NOT_FOUND, data={"error_detail": f"任务不存在: {task_id}"})
            
            # 保存账户ID，用于后续检查是否需要删除账户
            account_id = task.account_id
            
            # 1. 删除关联的本地决策记录
            local_decisions = session.exec(select(LocalDecision).where(LocalDecision.task_id == task_id)).all()
            for decision in local_decisions:
                session.delete(decision)
            logger.info(f"已删除 {len(local_decisions)} 条本地决策记录")
            
            # 2. 删除关联的交易记录
            trade_records = session.exec(select(TradeRecord).where(TradeRecord.task_id == task_id)).all()
            for trade in trade_records:
                session.delete(trade)
            logger.info(f"已删除 {len(trade_records)} 条交易记录")
            
            # 3. 删除关联的账户快照
            account_snapshots = session.exec(select(AccountSnapshot).where(AccountSnapshot.task_id == task_id)).all()
            for snapshot in account_snapshots:
                session.delete(snapshot)
            logger.info(f"已删除 {len(account_snapshots)} 条账户快照记录")
            
            # 4. 删除任务本身
            session.delete(task)
            logger.info(f"已删除任务: {task_id}")
            
            # 5. 检查是否有其他任务关联到这个账户
            other_tasks = session.exec(select(Task).where(Task.account_id == account_id)).all()
            if not other_tasks:
                # 没有其他任务关联，删除账户
                account = session.get(VirtualAccount, account_id)
                if account:
                    session.delete(account)
                    logger.info(f"已删除无关联任务的账户: {account_id}")
        
        return ApiResponse(code=200, msg="success", data={"deleted_task_id": task_id})
    except Exception as e:
        error_code, error_msg, error_detail = handle_exception(e, "删除任务", context={"task_id": task_id})
        session.rollback()
        return ApiResponse(code=error_code, msg=error_msg, data={"error_detail": error_detail})


@router.post("/task/create", response_model=ApiResponse)
async def create_task(body: TaskCreateRequest, session: Session = Depends(get_session_dep)):
    try:
        # 添加详细的请求日志
        logger.info(f"收到任务创建请求:account_id={body.account_id}, stock_symbol={body.stock_symbol}, start_date={body.start_date}, end_date={body.end_date}, market_type={body.market_type}, time_granularity={body.time_granularity}, decision_interval={body.decision_interval}, ai_config_id={body.ai_config_id}")
        
        # 基础参数验证
        if not body.account_id:
            return ApiResponse(code=ErrorCode.INVALID_PARAMETER, msg=ErrorMessage.INVALID_PARAMETER, data={"error_detail": "账户ID不能为空"})
        if not body.stock_symbol:
            return ApiResponse(code=ErrorCode.INVALID_PARAMETER, msg=ErrorMessage.INVALID_PARAMETER, data={"error_detail": "股票代码不能为空"})
        if not body.start_date:
            return ApiResponse(code=ErrorCode.INVALID_PARAMETER, msg=ErrorMessage.INVALID_PARAMETER, data={"error_detail": "开始日期不能为空"})
        if not body.end_date:
            return ApiResponse(code=ErrorCode.INVALID_PARAMETER, msg=ErrorMessage.INVALID_PARAMETER, data={"error_detail": "结束日期不能为空"})
        if body.start_date > body.end_date:
            return ApiResponse(code=ErrorCode.INVALID_PARAMETER, msg=ErrorMessage.INVALID_PARAMETER, data={"error_detail": "开始日期不能晚于结束日期"})
        
        # 检查或创建账户
        account = session.get(VirtualAccount, body.account_id)
        if not account:
            logger.info(f"自动创建新账户: {body.account_id}")
            account = VirtualAccount(
                account_id=body.account_id,
                market_type=body.market_type,
                stock_symbol=body.stock_symbol,
                initial_balance=Decimal(str(body.initial_balance)),
                current_balance=Decimal(str(body.initial_balance)),
                available_balance=Decimal(str(body.initial_balance)),
                stock_quantity=Decimal("0"),
                stock_price=Decimal("0"),
                stock_market_value=Decimal("0"),
                total_value=Decimal(str(body.initial_balance)),
                is_active=True,
                created_at=TimestampUtils.now_utc_naive(),
                updated_at=TimestampUtils.now_utc_naive()
            )
            session.add(account)
            session.commit()
            session.refresh(account)
        
        # 仅支持本地决策任务
        task_id = create_local_decision_task(
            body.account_id, 
            body.stock_symbol, 
            body.start_date, 
            body.end_date, 
            body.user_prompt_id,
            body.time_granularity,
            body.decision_interval,
            body.ai_config_id,
            body.commission_rate_buy,
            body.commission_rate_sell,
            body.tax_rate,
            body.min_commission,
            session
        )
        return ApiResponse(code=200, msg="success", data={"task_id": task_id})
    except Exception as e:
        error_code, error_msg, error_detail = handle_exception(e, "创建策略回测", context={"body": body.dict()})
        return ApiResponse(code=error_code, msg=error_msg, data={"error_detail": error_detail})


@router.post("/task/start", response_model=ApiResponse)
async def start_task(body: TaskStartRequest):
    try:
        with get_session() as session:
            t = session.get(Task, body.task_id)
            if not t:
                return ApiResponse(code=ErrorCode.RESOURCE_NOT_FOUND, msg=ErrorMessage.RESOURCE_NOT_FOUND, data={"error_detail": "任务不存在"})
            
            if t.status == "RUNNING":
                return ApiResponse(code=ErrorCode.BUSINESS_RULE_VIOLATION, msg=ErrorMessage.BUSINESS_RULE_VIOLATION, data={"error_detail": "任务正在运行中"})
            
            # 移除并发任务限制，允许同时运行多个任务
            
            # Update status to RUNNING immediately to prevent race conditions
            t.status = "RUNNING"
            t.started_at = TimestampUtils.now_utc_naive()
            session.add(t)
            session.commit()
            session.refresh(t)

            logger.info(f"启动本地决策任务线程: {body.task_id}")
            run_task_thread(body.task_id, start_backtest_task, ())
            return ApiResponse(code=200, msg="success", data={"task_id": body.task_id})
    except Exception as e:
        error_code, error_msg, error_detail = handle_exception(e, "启动任务", context={"body": body.dict()})
        return ApiResponse(code=error_code, msg=error_msg, data={"error_detail": error_detail})


@router.post("/task/stop", response_model=ApiResponse)
async def stop_task(body: TaskStopRequest, session: Session = Depends(get_session_dep)):
    try:
        t = session.get(Task, body.task_id)
        if not t:
            return ApiResponse(code=ErrorCode.RESOURCE_NOT_FOUND, msg=ErrorMessage.RESOURCE_NOT_FOUND, data={"error_detail": "任务不存在"})
        
        if t.status not in ["RUNNING", "PENDING", "PAUSED"]:
            return ApiResponse(code=ErrorCode.BUSINESS_RULE_VIOLATION, msg=ErrorMessage.BUSINESS_RULE_VIOLATION, data={"error_detail": f"任务当前状态为 {t.status}，无法停止"})

        t.status = "CANCELLED"
        session.add(t)
        session.commit()
        return ApiResponse(code=200, msg="success", data={"task_id": body.task_id, "status": t.status})
    except Exception as e:
        error_code, error_msg, error_detail = handle_exception(e, "停止任务", context={"body": body.dict()})
        return ApiResponse(code=error_code, msg=error_msg, data={"error_detail": error_detail})


@router.post("/task/pause", response_model=ApiResponse)
async def pause_task(body: TaskPauseRequest, session: Session = Depends(get_session_dep)):
    try:
        t = session.get(Task, body.task_id)
        if not t:
            return ApiResponse(code=ErrorCode.RESOURCE_NOT_FOUND, msg=ErrorMessage.RESOURCE_NOT_FOUND, data={"error_detail": "任务不存在"})
        
        if t.status != "RUNNING":
            return ApiResponse(code=ErrorCode.BUSINESS_RULE_VIOLATION, msg=ErrorMessage.BUSINESS_RULE_VIOLATION, data={"error_detail": f"任务当前状态为 {t.status}，无法暂停"})

        t.status = "PAUSED"
        t.paused_at = TimestampUtils.now_utc_naive()
        session.add(t)
        session.commit()
        return ApiResponse(code=200, msg="success", data={"task_id": body.task_id, "status": t.status})
    except Exception as e:
        error_code, error_msg, error_detail = handle_exception(e, "暂停任务", context={"body": body.dict()})
        return ApiResponse(code=error_code, msg=error_msg, data={"error_detail": error_detail})


@router.post("/task/resume", response_model=ApiResponse)
async def resume_task(body: TaskResumeRequest, session: Session = Depends(get_session_dep)):
    try:
        t = session.get(Task, body.task_id)
        if not t:
            return ApiResponse(code=ErrorCode.RESOURCE_NOT_FOUND, msg=ErrorMessage.RESOURCE_NOT_FOUND, data={"error_detail": "任务不存在"})
        
        if t.status != "PAUSED":
            return ApiResponse(code=ErrorCode.BUSINESS_RULE_VIOLATION, msg=ErrorMessage.BUSINESS_RULE_VIOLATION, data={"error_detail": f"任务当前状态为 {t.status}，无法继续"})

        logger.info(f"恢复本地决策任务线程: {body.task_id}")
        run_task_thread(body.task_id, start_backtest_task, ())
        return ApiResponse(code=200, msg="success", data={"task_id": body.task_id, "status": t.status})
    except Exception as e:
        error_code, error_msg, error_detail = handle_exception(e, "继续任务", context={"body": body.dict()})
        return ApiResponse(code=error_code, msg=error_msg, data={"error_detail": error_detail})


@router.get("/task/list", response_model=PaginatedResponse)
async def list_tasks(
    type: str | None = Query(None),
    status: str | None = Query(None),
    account_id: str | None = Query(None),
    stock_symbol: str | None = Query(None),
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1),
    session: Session = Depends(get_session_dep),
):
    try:
        conditions = []
        # 任务类型字段已移除，不再按类型过滤
        if status:
            conditions.append(Task.status == status)
        if account_id:
            conditions.append(Task.account_id == account_id)
        if stock_symbol:
            conditions.append(Task.stock_symbol == stock_symbol)
        if start_date:
            conditions.append(Task.start_date >= start_date)
        if end_date:
            conditions.append(Task.end_date <= end_date)

        # Count
        count_stmt = select(func.count(Task.task_id)).where(*conditions)
        total = session.exec(count_stmt).first() or 0

        # Query
        offset = (page - 1) * page_size
        stmt = select(Task).where(*conditions).order_by(Task.created_at.desc()).offset(offset).limit(page_size)
        items = session.exec(stmt).all()

        return PaginatedResponse(
            code=200,
            msg="success",
            data={
                "items": [i.dict() for i in items],
                "page": page,
                "page_size": page_size,
                "total": total,
                "total_pages": (total + page_size - 1) // page_size
            }
        )
    except Exception as e:
        error_code, error_msg, error_detail = handle_exception(e, "查询任务列表", context={"query_params": {"type": type, "status": status, "account_id": account_id, "stock_symbol": stock_symbol, "start_date": start_date, "end_date": end_date, "page": page, "page_size": page_size}})
        return PaginatedResponse(
            code=error_code,
            msg=error_msg,
            data={
                "items": [],
                "page": page,
                "page_size": page_size,
                "total": 0,
                "total_pages": 0
            }
        )


@router.get("/task/monitor")
async def monitor_tasks():
    """全局任务状态监控流"""
    try:
        def gen():
            import time as _time
            while True:
                try:
                    with Session(engine) as session:
                        # 查找所有正在运行的任务
                        running_tasks = session.exec(select(Task).where(Task.status == "RUNNING")).all()
                        
                        # 发送所有正在运行的任务状态
                        for t in running_tasks:
                            payload = {
                                "running": True,
                                "task_id": t.task_id,
                                "stock_symbol": t.stock_symbol,
                                "status": t.status,
                                "processed_items": t.processed_items or 0,
                                "total_items": t.total_items or 0,
                                "error_message": t.error_message
                            }
                            # Session is closed here
                            yield f"data: {_json.dumps(payload)}\n\n"
                        
                        # 如果没有正在运行的任务，发送一个空的运行状态
                        if not running_tasks:
                            payload = {
                                "running": False,
                                "task_id": None
                            }
                            yield f"data: {_json.dumps(payload)}\n\n"

                except Exception as inner_e:
                    log_error("监控循环", inner_e, context={"task_id": "global"})
                    # 继续下一次循环，不要中断
                    yield f"data: {_json.dumps({'running': False, 'task_id': None, 'error': str(inner_e)})}"
                # 确保每次循环都发送心跳消息
                yield ": keepalive\n\n"
                # 缩短轮询间隔，提高实时性
                _time.sleep(0.5)
                
        return StreamingResponse(gen(), media_type="text/event-stream")
    except Exception as e:
        error_code, error_msg, error_detail = handle_exception(e, "创建策略回测监控流")
        raise HTTPException(status_code=error_code, detail=error_detail)


@router.get("/task/progress/{task_id}")
async def get_task_progress(task_id: str):
    try:
        def gen():
            import time as _time
            while True:
                payload = None
                status = None
                found = False
                
                with Session(engine) as session:
                    t = session.exec(select(Task).where(Task.task_id == task_id)).first()
                    if t:
                        found = True
                        status = t.status
                        payload = {
                            "task_id": t.task_id,
                            "status": t.status,
                            "processed_items": t.processed_items or 0,
                            "total_items": t.total_items or 0,
                            "started_at": TimestampUtils.to_utc_iso(t.started_at) if t.started_at else None,
                            "completed_at": TimestampUtils.to_utc_iso(t.completed_at) if t.completed_at else None,
                            "error_message": t.error_message,
                        }

                if not found:
                    yield "data: {}\n\n"
                    break
                
                yield f"data: {_json.dumps(payload)}\n\n"
                
                if status in ("COMPLETED", "FAILED", "CANCELLED"):
                    break

                yield ": keepalive\n\n"
                _time.sleep(1.0)
                
        return StreamingResponse(gen(), media_type="text/event-stream")
    except Exception as e:
        error_code, error_msg, error_detail = handle_exception(e, "创建策略回测进度流", context={"task_id": task_id})
        raise HTTPException(status_code=error_code, detail=error_detail)