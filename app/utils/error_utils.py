"""错误处理工具"""
import logging
import traceback
from typing import Any, Dict, Optional, Tuple

from cfg import logger


class ErrorCode:
    """统一错误码定义"""
    # 系统错误
    INTERNAL_ERROR = 500
    DATABASE_ERROR = 501
    CACHE_ERROR = 502
    
    # 业务错误
    INVALID_PARAMETER = 400
    RESOURCE_NOT_FOUND = 404
    PERMISSION_DENIED = 403
    BUSINESS_RULE_VIOLATION = 405
    
    # 第三方服务错误
    THIRD_PARTY_SERVICE_ERROR = 503
    MARKET_DATA_ERROR = 504
    AI_SERVICE_ERROR = 505


class ErrorMessage:
    """统一错误信息定义"""
    # 系统错误
    INTERNAL_ERROR = "系统内部错误"
    DATABASE_ERROR = "数据库操作失败"
    CACHE_ERROR = "缓存操作失败"
    
    # 业务错误
    INVALID_PARAMETER = "无效的请求参数"
    RESOURCE_NOT_FOUND = "资源不存在"
    PERMISSION_DENIED = "无权限访问该资源"
    BUSINESS_RULE_VIOLATION = "违反业务规则"
    
    # 第三方服务错误
    THIRD_PARTY_SERVICE_ERROR = "第三方服务调用失败"
    MARKET_DATA_ERROR = "市场数据获取失败"
    AI_SERVICE_ERROR = "AI服务调用失败"


def build_error_response(
    code: int,
    message: str,
    error_detail: Optional[str] = None,
    context: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    构建统一的错误响应
    
    Args:
        code: 错误码
        message: 错误信息
        error_detail: 错误详情，可选
        context: 错误上下文，可选
        
    Returns:
        统一格式的错误响应字典
    """
    response = {
        "code": code,
        "msg": message,
        "data": None
    }
    
    if error_detail or context:
        response["data"] = {
            "error_detail": error_detail,
            "context": context
        }
    
    return response


def log_error(
    operation: str,
    error: Exception,
    context: Optional[Dict[str, Any]] = None,
    level: int = logging.ERROR
) -> None:
    """
    统一记录错误日志
    
    Args:
        operation: 操作描述
        error: 异常对象
        context: 错误上下文，可选
        level: 日志级别，默认ERROR
    """
    error_info = {
        "operation": operation,
        "error_type": type(error).__name__,
        "error_message": str(error),
        "traceback": traceback.format_exc(),
        "context": context
    }
    
    logger.log(level, f"错误信息: {error_info}")


def handle_exception(
    exception: Exception,
    operation: str,
    context: Optional[Dict[str, Any]] = None
) -> Tuple[int, str, str]:
    """
    处理异常，返回统一的错误码、错误信息和错误详情
    
    Args:
        exception: 异常对象
        operation: 操作描述
        context: 错误上下文，可选
        
    Returns:
        (错误码, 错误信息, 错误详情)
    """
    # 记录错误日志
    log_error(operation, exception, context)
    
    # 处理不同类型的异常
    exception_type = type(exception).__name__
    error_message = str(exception)
    
    # 根据异常类型返回不同的错误码和错误信息
    if exception_type in ["SQLAlchemyError", "DatabaseError"]:
        return (
            ErrorCode.DATABASE_ERROR,
            ErrorMessage.DATABASE_ERROR,
            f"数据库操作失败: {error_message}"
        )
    elif exception_type in ["KeyError", "ValueError", "TypeError", "ValidationError"]:
        return (
            ErrorCode.INVALID_PARAMETER,
            ErrorMessage.INVALID_PARAMETER,
            f"无效的参数: {error_message}"
        )
    elif exception_type == "FileNotFoundError":
        return (
            ErrorCode.RESOURCE_NOT_FOUND,
            ErrorMessage.RESOURCE_NOT_FOUND,
            f"文件不存在: {error_message}"
        )
    elif exception_type == "PermissionError":
        return (
            ErrorCode.PERMISSION_DENIED,
            ErrorMessage.PERMISSION_DENIED,
            f"权限不足: {error_message}"
        )
    else:
        # 默认处理
        return (
            ErrorCode.INTERNAL_ERROR,
            ErrorMessage.INTERNAL_ERROR,
            f"系统内部错误: {error_message}"
        )


def get_error_context(
    **kwargs: Any
) -> Dict[str, Any]:
    """
    获取错误上下文信息
    
    Args:
        **kwargs: 上下文信息
        
    Returns:
        上下文信息字典
    """
    return kwargs
