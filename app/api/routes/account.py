"""账户相关路由"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, func, select

from app.api.schemas import PaginatedResponse, ApiResponse
from app.database import get_session_dep
from app.models.models import AccountSnapshot, VirtualAccount, Task
from app.utils.timestamp_utils import TimestampUtils
from cfg import logger

router = APIRouter()


@router.get("/account/snapshot", response_model=PaginatedResponse)
async def get_account_snapshots(
    account_id: Optional[str] = Query(None),
    task_id: Optional[str] = Query(None, description="回测ID"),
    start_date: Optional[datetime] = Query(None, description="开始时间"),
    end_date: Optional[datetime] = Query(None, description="结束时间"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1),
    sort_order: str = Query("desc", description="排序顺序: desc 或 asc"),
    session: Session = Depends(get_session_dep)
):
    """
    查询账户快照
    
    Args:
        account_id: 账户ID
        task_id: 回测ID
        start_date: 开始时间（可选）
        end_date: 结束时间（可选）
        page: 页码
        page_size: 每页数量
        session: 数据库会话
        
    Returns:
        账户快照分页数据
    """
    try:
        # 构建查询条件
        statement = select(AccountSnapshot)
        
        # 添加账户ID过滤条件
        if account_id:
            statement = statement.where(AccountSnapshot.account_id == account_id)
        
        # 添加回测ID过滤条件
        if task_id:
            statement = statement.where(AccountSnapshot.task_id == task_id)
        
        # 添加时间范围过滤条件
        if start_date:
            statement = statement.where(AccountSnapshot.timestamp >= TimestampUtils.ensure_utc_naive(start_date))
        
        if end_date:
            statement = statement.where(AccountSnapshot.timestamp <= TimestampUtils.ensure_utc_naive(end_date))
        
        # 计算总数
        # 重新构建一个简单的count查询，确保过滤条件一致
        count_statement = select(func.count(AccountSnapshot.snapshot_id))
        if account_id:
            count_statement = count_statement.where(AccountSnapshot.account_id == account_id)
        if task_id:
            count_statement = count_statement.where(AccountSnapshot.task_id == task_id)
        if start_date:
            count_statement = count_statement.where(AccountSnapshot.timestamp >= TimestampUtils.ensure_utc_naive(start_date))
        if end_date:
            count_statement = count_statement.where(AccountSnapshot.timestamp <= TimestampUtils.ensure_utc_naive(end_date))
        total = session.exec(count_statement).first() or 0
        
        # 分页查询
        offset = (page - 1) * page_size
        order = AccountSnapshot.timestamp.desc() if sort_order == "desc" else AccountSnapshot.timestamp.asc()
        statement = statement.order_by(order).offset(offset).limit(page_size)
        
        snapshots = session.exec(statement).all()
        
        return PaginatedResponse(
            code=200,
            msg="success",
            data={
                "items": [snapshot.dict() for snapshot in snapshots],
                "page": page,
                "page_size": page_size,
                "total": total,
                "total_pages": (total + page_size - 1) // page_size
            }
        )
        
    except Exception as e:
        logger.error(f"查询账户快照失败: {e}")
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


@router.get("/account/virtual", response_model=PaginatedResponse)
async def get_virtual_accounts(
    account_id: Optional[str] = Query(None),
    stock_symbol: Optional[str] = Query(None),
    
    include_latest_snapshot: bool = Query(False),
    sort_order: str = Query("desc", description="排序顺序: desc 或 asc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1),
    session: Session = Depends(get_session_dep)
):
    """
    查询虚拟账户
    
    Args:
        account_id: 账户ID
        stock_symbol: 股票代码
        include_latest_snapshot: 是否包含最新快照
        sort_order: 排序顺序
        page: 页码
        page_size: 每页数量
        session: 数据库会话
        
    Returns:
        虚拟账户分页数据
    """
    try:
        # 构建查询条件
        statement = select(VirtualAccount)
        
        if account_id:
            statement = statement.where(VirtualAccount.account_id == account_id)
        if stock_symbol:
            statement = statement.where(VirtualAccount.stock_symbol == stock_symbol)
        
        # 计算总数
        count_statement = select(func.count(VirtualAccount.account_id))
        if account_id:
            count_statement = count_statement.where(VirtualAccount.account_id == account_id)
        if stock_symbol:
            count_statement = count_statement.where(VirtualAccount.stock_symbol == stock_symbol)
        
        total = session.exec(count_statement).first() or 0
        
        # 分页查询
        offset = (page - 1) * page_size
        order = VirtualAccount.created_at.desc() if sort_order == "desc" else VirtualAccount.created_at.asc()
        statement = statement.order_by(order).offset(offset).limit(page_size)
        
        accounts = session.exec(statement).all()
        
        # 如果需要包含最新快照
        result_items = []
        for account in accounts:
            account_data = account.dict()
            
            if include_latest_snapshot:
                # 获取最新快照
                snapshot_statement = (
                    select(AccountSnapshot)
                    .where(AccountSnapshot.account_id == account.account_id)
                    .order_by(AccountSnapshot.timestamp.desc())
                    .limit(1)
                )
                latest_snapshot = session.exec(snapshot_statement).first()
                account_data["latest_snapshot"] = latest_snapshot.dict() if latest_snapshot else None
            
            result_items.append(account_data)
        
        return PaginatedResponse(
            code=200,
            msg="success",
            data={
                "items": result_items,
                "page": page,
                "page_size": page_size,
                "total": total,
                "total_pages": (total + page_size - 1) // page_size
            }
        )
        
    except Exception as e:
        logger.error(f"查询虚拟账户失败: {e}")
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


@router.get("/account/snapshot/{snapshot_id}", response_model=ApiResponse)
async def get_snapshot_detail(snapshot_id: str, session: Session = Depends(get_session_dep)):
    """获取单个账户快照详情"""
    try:
        stmt = select(AccountSnapshot).where(AccountSnapshot.snapshot_id == snapshot_id)
        snap = session.exec(stmt).first()
        if not snap:
            return ApiResponse(code=404, msg="快照不存在", data=None)
        return ApiResponse(code=200, msg="success", data=snap.dict())
    except Exception as e:
        logger.error(f"获取账户快照详情失败: {e}")
        return ApiResponse(code=500, msg=str(e), data=None)


@router.delete("/account/snapshot/{snapshot_id}", response_model=ApiResponse)
async def delete_snapshot(snapshot_id: str, session: Session = Depends(get_session_dep)):
    """删除账户快照记录"""
    try:
        stmt = select(AccountSnapshot).where(AccountSnapshot.snapshot_id == snapshot_id)
        snap = session.exec(stmt).first()
        if not snap:
            return ApiResponse(code=404, msg="快照不存在", data=None)
        session.delete(snap)
        session.commit()
        return ApiResponse(code=200, msg="success", data={"snapshot_id": snapshot_id})
    except Exception as e:
        logger.error(f"删除账户快照失败: {e}")
        return ApiResponse(code=500, msg=str(e), data=None)


@router.get("/account/total-series", response_model=ApiResponse)
async def get_account_total_series(
    account_id: Optional[str] = Query(None),
    task_id: Optional[str] = Query(None, description="回测ID"),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    session: Session = Depends(get_session_dep),
):
    try:
        # 如果提供了task_id，优先从task获取account_id和时间范围
        if task_id:
            task = session.exec(select(Task).where(Task.task_id == task_id)).first()
            if task:
                account_id = task.account_id
                if not start_date:
                    start_date = task.start_date
                if not end_date:
                    end_date = task.end_date
        
        # 如果没有account_id，返回错误
        if not account_id:
            return ApiResponse(code=400, msg="缺少必要参数: account_id或有效的task_id", data=None)
        
        stmt = select(AccountSnapshot).where(AccountSnapshot.account_id == account_id)
        if task_id:
            stmt = stmt.where(AccountSnapshot.task_id == task_id)
        if start_date:
            # 确保日期是UTC时间且无时区信息，与数据库存储格式一致
            stmt = stmt.where(AccountSnapshot.timestamp >= TimestampUtils.ensure_utc_naive(start_date))
        if end_date:
            # 确保日期是UTC时间且无时区信息，与数据库存储格式一致
            stmt = stmt.where(AccountSnapshot.timestamp <= TimestampUtils.ensure_utc_naive(end_date))
        stmt = stmt.order_by(AccountSnapshot.timestamp.asc())
        snaps = list(session.exec(stmt))
        series = [{"date": TimestampUtils.to_utc_iso(s.timestamp), "total_value": str(s.total_value)} for s in snaps]
        return ApiResponse(code=200, msg="success", data=series)
    except Exception as e:
        logger.error(f"查询账户总额序列失败: {e}")
        return ApiResponse(code=500, msg=str(e), data=None)


@router.post("/account/virtual", response_model=ApiResponse)
async def create_virtual_account(
    body: dict,
    session: Session = Depends(get_session_dep),
):
    """
    创建虚拟账户
    
    Args:
        body: 账户信息
        session: 数据库会话
        
    Returns:
        创建结果
    """
    try:
        # 检查账户ID是否已存在
        account_id = body.get("account_id")
        if not account_id:
            return ApiResponse(code=400, msg="账户ID不能为空", data=None)
        
        existing_account = session.exec(select(VirtualAccount).where(VirtualAccount.account_id == account_id)).first()
        if existing_account:
            return ApiResponse(code=400, msg=f"账户ID {account_id} 已存在", data=None)
        
        # 创建账户
        account = VirtualAccount(**body)
        session.add(account)
        session.commit()
        session.refresh(account)
        
        return ApiResponse(code=200, msg="success", data=account.dict())
    except Exception as e:
        logger.error(f"创建虚拟账户失败: {e}")
        session.rollback()
        return ApiResponse(code=500, msg=str(e), data=None)


@router.put("/account/virtual/{account_id}", response_model=ApiResponse)
async def update_virtual_account(
    account_id: str,
    body: dict,
    session: Session = Depends(get_session_dep),
):
    """
    更新虚拟账户
    
    Args:
        account_id: 账户ID
        body: 账户信息
        session: 数据库会话
        
    Returns:
        更新结果
    """
    try:
        # 检查账户是否存在
        account = session.exec(select(VirtualAccount).where(VirtualAccount.account_id == account_id)).first()
        if not account:
            return ApiResponse(code=404, msg=f"账户 {account_id} 不存在", data=None)
        
        # 更新账户信息
        for key, value in body.items():
            if key != "account_id":  # 不允许修改账户ID
                setattr(account, key, value)
        
        account.updated_at = TimestampUtils.now_utc_naive()
        session.add(account)
        session.commit()
        session.refresh(account)
        
        return ApiResponse(code=200, msg="success", data=account.dict())
    except Exception as e:
        logger.error(f"更新虚拟账户失败: {e}")
        session.rollback()
        return ApiResponse(code=500, msg=str(e), data=None)


@router.get("/account/virtual/{account_id}", response_model=ApiResponse)
async def get_virtual_account_detail(
    account_id: str,
    session: Session = Depends(get_session_dep),
):
    """
    获取虚拟账户详情
    
    Args:
        account_id: 账户ID
        session: 数据库会话
        
    Returns:
        账户详情
    """
    try:
        # 查询账户是否存在
        account = session.exec(select(VirtualAccount).where(VirtualAccount.account_id == account_id)).first()
        if not account:
            return ApiResponse(code=404, msg=f"账户 {account_id} 不存在", data=None)
        
        # 返回账户详情
        return ApiResponse(code=200, msg="success", data=account.dict())
    except Exception as e:
        logger.error(f"获取虚拟账户详情失败: {e}")
        return ApiResponse(code=500, msg=str(e), data=None)


@router.delete("/account/virtual/{account_id}", response_model=ApiResponse)
async def delete_virtual_account(
    account_id: str,
    session: Session = Depends(get_session_dep),
):
    """
    删除虚拟账户
    
    Args:
        account_id: 账户ID
        session: 数据库会话
        
    Returns:
        删除结果
    """
    try:
        # 检查账户是否存在
        account = session.exec(select(VirtualAccount).where(VirtualAccount.account_id == account_id)).first()
        if not account:
            return ApiResponse(code=404, msg=f"账户 {account_id} 不存在", data=None)
        
        # 删除账户
        session.delete(account)
        session.commit()
        
        return ApiResponse(code=200, msg="success", data={"account_id": account_id})
    except Exception as e:
        logger.error(f"删除虚拟账户失败: {e}")
        session.rollback()
        return ApiResponse(code=500, msg=str(e), data=None)
