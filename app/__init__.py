# AI交易策略系统
__version__ = "1.0.0"

from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlmodel import Session, select
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.routes import router
from app.api.schemas import ApiResponse
from app.database import create_db_and_tables, engine
from app.models.models import Task, AIConfig
from app.utils.error_utils import ErrorCode, ErrorMessage, handle_exception, log_error
from app.utils.timestamp_utils import TimestampUtils
from cfg import logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    应用生命周期管理
    
    Args:
        app: FastAPI应用实例
    """
    logger.info("正在启动AI交易策略系统 (模式: api)...")
    
    try:
        # 创建数据库表
        create_db_and_tables()
        logger.info("数据库表创建完成")
        
        logger.info("AI交易策略系统启动成功")
        
        logger.info("准备yield控制权给应用...")
        yield
        logger.info("应用已关闭，从yield恢复执行...")
        
    except Exception as e:
        logger.error(f"系统启动失败: {e}")
        raise
    
    finally:
        logger.info("AI交易策略系统已关闭")


# 创建FastAPI应用
app = FastAPI(
    title="AI交易策略系统",
    description="基于AI的智能交易策略执行系统",
    version="1.0.0",
    lifespan=lifespan
)

# 添加CORS中间件
# CORS
origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 全局异常处理

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """
    HTTP异常处理器
    
    Args:
        request: 请求对象
        exc: HTTP异常对象
    """
    log_error("HTTP请求", exc, context={"url": str(request.url), "method": request.method})
    return JSONResponse(
        content={
            "code": exc.status_code,
            "msg": exc.detail,
            "data": None
        },
        status_code=exc.status_code
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    请求验证异常处理器
    
    Args:
        request: 请求对象
        exc: 请求验证异常对象
    """
    log_error("请求验证", exc, context={"url": str(request.url), "method": request.method, "errors": exc.errors()})
    return JSONResponse(
        content={
            "code": ErrorCode.INVALID_PARAMETER,
            "msg": ErrorMessage.INVALID_PARAMETER,
            "data": {"error_detail": str(exc), "errors": exc.errors()}
        },
        status_code=ErrorCode.INVALID_PARAMETER
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """
    通用异常处理器
    
    Args:
        request: 请求对象
        exc: 异常对象
    """
    error_code, error_msg, error_detail = handle_exception(exc, "API请求", context={"url": str(request.url), "method": request.method})
    return JSONResponse(
        content={
            "code": error_code,
            "msg": error_msg,
            "data": {"error_detail": error_detail}
        },
        status_code=error_code
    )


# 注册路由
app.include_router(router)


@app.get("/")
async def root():
    """
    根路径健康检查
    
    Returns:
        系统状态信息
    """
    return ApiResponse(
        code=200,
        msg="success",
        data={
            "message": "AI交易策略系统运行正常",
            "version": "1.0.0",
            "status": "healthy"
        }
    )


@app.get("/health")
async def health_check():
    """
    健康检查接口
    
    Returns:
        详细的系统健康状态
    """
    db_status = "connected"
    try:
        with Session(engine) as s:
            s.exec(select(Task).limit(1))
    except Exception as e:
        db_status = "error"
        log_error("数据库连接检查", e)
    
    return ApiResponse(
        code=200,
        msg="success",
        data={
            "status": "healthy" if db_status == "connected" else "degraded",
            "timestamp": TimestampUtils.to_utc_iso(datetime.utcnow()),
            "services": {
                "database": db_status,
                "api": "running"
            }
        }
    )
