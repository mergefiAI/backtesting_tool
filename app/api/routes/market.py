"""市场数据相关路由"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query, UploadFile, File, Form
from sqlmodel import Session

from app.api.schemas import ApiResponse, PaginatedResponse
from app.database import get_session_dep
from app.models.models import Task
from cfg import logger
from cfg.config import get_settings

settings = get_settings()
router = APIRouter()

from app.services.market_data_import_service import MarketDataImportService


@router.post("/market/btc/daily/import", response_model=ApiResponse)
async def import_btc_daily_csv(
    file: UploadFile = File(...), 
    symbol: Optional[str] = Form(None)
):
    try:
        # 读取文件内容
        content = await file.read()
        
        # 使用统一数据导入服务
        result = MarketDataImportService.import_data(
            file_content=content,
            time_granularity='daily',
            symbol=symbol or 'BTC'
        )
        
        return ApiResponse(
            code=result['code'],
            msg=result['message'],
            data=result['data']
        )
    except Exception as e:
        logger.error(f"导入日线数据失败: {e}")
        return ApiResponse(code=500, msg=str(e), data=None)


@router.post("/market/btc/{time_granularity}/import", response_model=ApiResponse)
async def import_btc_market_data(
    time_granularity: str,  # daily, hourly, minute
    file: UploadFile = File(...), 
    symbol: Optional[str] = Form(None)
):
    """
    统一的市场数据导入接口
    支持日线、小时线、分钟线数据导入
    
    Args:
        time_granularity: 时间粒度（daily/hourly/minute）
        file: 上传的CSV文件
        symbol: 标的，默认 BTC
        
    Returns:
        ApiResponse: 导入结果
    """
    try:
        # 验证时间粒度
        if time_granularity not in ['daily', 'hourly', 'minute']:
            return ApiResponse(code=400, msg="不支持的时间粒度，支持：daily, hourly, minute", data=None)
        
        # 读取文件内容
        content = await file.read()
        
        # 使用统一数据导入服务
        result = MarketDataImportService.import_data(
            file_content=content,
            time_granularity=time_granularity,
            symbol=symbol or 'BTC'
        )
        
        return ApiResponse(
            code=result['code'],
            msg=result['message'],
            data=result['data']
        )
    except Exception as e:
        logger.error(f"导入{time_granularity}数据失败: {e}")
        return ApiResponse(code=500, msg=str(e), data=None)


@router.delete("/market/btc/{time_granularity}", response_model=ApiResponse)
async def clear_btc_market_data(
    time_granularity: str,  # daily, hourly, minute
    symbol: Optional[str] = Query(None, description="要清空数据的标的，如 BTC-USD，不提供则清空所有数据")
):
    """
    统一的市场数据清空接口
    支持日线、小时线、分钟线数据清空
    
    Args:
        time_granularity: 时间粒度（daily/hourly/minute）
        symbol: 标的，默认清空所有标的
        
    Returns:
        ApiResponse: 清空结果
    """
    try:
        from app.services.market_data_service import CSVDataService
        
        # 验证时间粒度
        if time_granularity not in ['daily', 'hourly', 'minute']:
            return ApiResponse(code=400, msg="不支持的时间粒度，支持：daily, hourly, minute", data=None)
        
        deleted_count = 0
        
        # 如果指定了标的，只删除该标的的数据
        if symbol:
            # 移除通配符，只取实际标的名
            symbol = symbol.replace("%", "").split("_")[0]
            success = CSVDataService.delete_data(symbol, time_granularity)
            if success:
                deleted_count = 1
        else:
            # 清空所有标的的数据
            from app.services.market_data_service import CSVDataService
            # 获取所有标的
            symbols = CSVDataService.get_symbols(time_granularity)
            for inst in symbols:
                success = CSVDataService.delete_data(inst, time_granularity)
                if success:
                    deleted_count += 1
        
        return ApiResponse(
            code=200, 
            msg=f"{time_granularity}数据清空成功", 
            data={"deleted_count": deleted_count}
        )
    except Exception as e:
        logger.error(f"清空{time_granularity}数据失败: {e}")
        return ApiResponse(code=500, msg=str(e), data=None)


def get_btc_market_bars(
    time_granularity: str,  # daily, hourly, minute
    symbol: Optional[str] = None,
    task_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    page: int = 1,
    page_size: int = 100,
    session: Optional[Session] = None
):
    """
    查询指定标的的市场数据（通用方法）
    支持日线、小时线、分钟线数据查询

    参数说明：symbol 默认 BTC；时间范围与分页可选
    使用CSV文件存储，避免数据库依赖
    """
    try:
        from app.services.market_data_service import CSVDataService
        
        # 如果有task_id且提供了session，从数据库获取任务信息
        if task_id and session:
            try:
                task = session.get(Task, task_id)
                if task:
                    # 如果未指定symbol或为默认值，优先使用任务中的股票代码
                    if not symbol or symbol == "undefined" or not symbol.strip() or symbol == "BTC":
                        if task.stock_symbol:
                            symbol = task.stock_symbol
                    
                    # 如果未指定时间范围，优先使用任务的时间范围
                    if not start_date:
                        start_date = task.start_date
                    if not end_date:
                        end_date = task.end_date
            except Exception as e:
                logger.warning(f"获取任务信息失败，忽略task_id: {e}")
        
        # 默认标的为BTC
        if not symbol or symbol == "undefined" or not symbol.strip():
            symbol = "BTC"
        else:
            # 移除通配符，只取实际标的名
            symbol = symbol.replace("%", "").split("_")[0]
        
        # 使用CSV数据服务查询数据
        df = CSVDataService.query_data(
            symbol=symbol,
            time_granularity=time_granularity,
            start_date=start_date,
            end_date=end_date
        )
        
        # 获取分页数据
        result = CSVDataService.get_paginated_data(
            df=df,
            page=page,
            page_size=page_size
        )
        
        return result
    except Exception as e:
        logger.error(f"查询{time_granularity}数据失败: {e}")
        raise


@router.get("/market/btc/daily", response_model=PaginatedResponse)
async def get_btc_daily_bars(
    symbol: Optional[str] = Query(None, description="标的，默认 BTC"),
    task_id: Optional[str] = Query(None, description="回测ID"),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1),
    session: Session = Depends(get_session_dep)
):
    """
    查询指定标的的日线数据
    """
    try:
        result = get_btc_market_bars(
            time_granularity='daily',
            symbol=symbol,
            task_id=task_id,
            start_date=start_date,
            end_date=end_date,
            page=page,
            page_size=page_size,
            session=session
        )
        return PaginatedResponse(
            code=200,
            msg="success",
            data=result
        )
    except Exception as e:
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


@router.get("/market/btc/hourly", response_model=PaginatedResponse)
async def get_btc_hourly_bars(
    symbol: Optional[str] = Query(None, description="标的，默认 BTC"),
    task_id: Optional[str] = Query(None, description="回测ID"),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1),
    session: Session = Depends(get_session_dep)
):
    """
    查询指定标的的小时线数据
    """
    try:
        result = get_btc_market_bars(
            time_granularity='hourly',
            symbol=symbol,
            task_id=task_id,
            start_date=start_date,
            end_date=end_date,
            page=page,
            page_size=page_size,
            session=session
        )
        return PaginatedResponse(
            code=200,
            msg="success",
            data=result
        )
    except Exception as e:
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


@router.get("/market/btc/minute", response_model=PaginatedResponse)
async def get_btc_minutely_bars(
    symbol: Optional[str] = Query(None, description="标的，默认 BTC"),
    task_id: Optional[str] = Query(None, description="回测ID"),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1),
    session: Session = Depends(get_session_dep)
):
    """
    查询指定标的的分钟线数据
    """
    try:
        result = get_btc_market_bars(
            time_granularity='minute',
            symbol=symbol,
            task_id=task_id,
            start_date=start_date,
            end_date=end_date,
            page=page,
            page_size=page_size,
            session=session
        )
        return PaginatedResponse(
            code=200,
            msg="success",
            data=result
        )
    except Exception as e:
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


@router.get("/config/timezone", response_model=ApiResponse)
async def get_timezone_config():
    """获取前端显示与市场时区配置（默认北京时间）。"""
    try:
        return ApiResponse(
            code=200,
            msg="success",
            data={
                "display_timezone": settings.display_timezone,
                "market_timezone": settings.market_timezone,
            }
        )
    except Exception as e:
        logger.error(f"获取时区配置失败: {e}")
        return ApiResponse(
            code=500,
            msg=str(e),
            data=None
        )


@router.get("/trend-data/{symbol}", response_model=ApiResponse)
async def get_trend_data(
    symbol: str,
    task_id: Optional[str] = Query(None, description="回测ID"),
    start_date: Optional[str] = Query(None, description="开始日期，格式：YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="结束日期，格式：YYYY-MM-DD")
):
    """
    获取指定标的的趋势数据
    支持根据task_id获取起止时间，或直接指定日期范围
    """
    try:
        from app.services.trend_data_service import get_trend_by_date_range
        
        data_dir = "data"  # 与trend_data_service.py中保持一致
        
        # 初始化日期范围
        actual_start_date = start_date
        actual_end_date = end_date
        
        # 忽略task_id参数，不再从数据库获取任务信息
        # 如果需要task_id相关功能，可以考虑从CSV文件或其他非数据库源获取
        
        # 查询趋势数据
        trend_data_list = []
        if actual_start_date and actual_end_date:
            # 根据日期范围查询
            trend_data_list = get_trend_by_date_range(
                start_date=actual_start_date,
                end_date=actual_end_date,
                data_dir=data_dir,
                symbol=symbol
            )
        else:
            # 查询所有趋势数据
            import pandas as pd
            import os
            
            # 生成CSV文件路径
            csv_path = os.path.join(data_dir, f"{symbol}_trend_data.csv")
            
            # 检查CSV文件是否存在
            if os.path.exists(csv_path):
                # 读取CSV文件
                df = pd.read_csv(csv_path)
                # 转换为列表格式
                trend_data_list = df.to_dict(orient="records")
        
        return ApiResponse(
            code=200,
            msg="success",
            data={"trend_data": trend_data_list}
        )
    except Exception as e:
        logger.error(f"获取趋势数据失败: {e}")
        return ApiResponse(
            code=500,
            msg=str(e),
            data={"trend_data": []}
        )


@router.get("/market/symbols-data-count", response_model=ApiResponse)
async def get_all_symbols_data_count():
    """
    获取所有标的的数量和日期范围信息
    返回格式：{ 
        symbol1: { 
            daily: { count: number, start_date: string, end_date: string }, 
            hourly: { count: number, start_date: string, end_date: string }, 
            minute: { count: number, start_date: string, end_date: string } 
        }, 
        symbol2: { ... }, 
        ... 
    }
    """
    try:
        from app.services.market_data_service import CSVDataService
        
        # 从所有粒度数据中获取标的列表的并集
        daily_symbols = set(CSVDataService.get_symbols('daily'))
        hourly_symbols = set(CSVDataService.get_symbols('hourly'))
        minute_symbols = set(CSVDataService.get_symbols('minute'))
        all_symbols = daily_symbols | hourly_symbols | minute_symbols
        
        # 构建结果字典
        result = {}
        for symbol in all_symbols:
            daily_df = CSVDataService.read_data(symbol, 'daily')
            hourly_df = CSVDataService.read_data(symbol, 'hourly')
            minute_df = CSVDataService.read_data(symbol, 'minute')
            
            result[symbol] = {
                'daily': CSVDataService.get_date_range(daily_df),
                'hourly': CSVDataService.get_date_range(hourly_df),
                'minute': CSVDataService.get_date_range(minute_df)
            }
        
        return ApiResponse(
            code=200,
            msg="success",
            data=result
        )
    except Exception as e:
        logger.error(f"获取所有标的数量信息失败: {e}")
        return ApiResponse(code=500, msg=str(e), data=None)
