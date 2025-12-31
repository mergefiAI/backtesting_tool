"""
数据库连接和会话管理
"""
from contextlib import contextmanager

from sqlmodel import SQLModel, create_engine, Session

from cfg import logger
from cfg.config import get_settings

settings = get_settings()

def _create_engine():
    """
    创建数据库引擎，优化连接池以处理连续访问
    
    Returns:
        创建的数据库引擎实例
    
    Raises:
        Exception: 数据库引擎创建失败时抛出
    """
    try:
        logger.info(f"正在创建数据库引擎: {settings.database_url}")
        engine = create_engine(
            settings.database_url,
            echo=False,
            pool_size=settings.db_pool_size,  # 使用配置中的池大小
            max_overflow=settings.db_max_overflow,
            pool_timeout=settings.db_pool_timeout,
            pool_recycle=settings.db_pool_recycle,  # 每小时回收连接
            pool_pre_ping=settings.db_pool_pre_ping,  # 预检查连接
        )
        
        # 不再设置数据库时区，使用不带时区的时间存储
            
        logger.info("数据库引擎创建成功")
        return engine
    except Exception as e:
        logger.error(f"数据库引擎创建失败: {e}")
        raise




# 全局引擎实例
engine = _create_engine()


def create_db_and_tables():
    """创建数据库表
    
    自动创建所有SQLModel模型对应的数据库表
    """
    try:
        logger.info("开始创建数据库表")
        SQLModel.metadata.create_all(engine)
        logger.info("数据库表创建成功")
    except Exception as e:
        logger.error(f"数据库表创建失败: {e}")
        raise


@contextmanager
def get_session():
    """获取数据库会话（上下文管理器）
    
    用法:
        with get_session() as session:
            # 使用session执行数据库操作
            pass
    """
    with Session(engine) as session:
        yield session


@contextmanager
def get_transaction_session():
    """获取数据库会话并管理事务（上下文管理器）
    
    用法:
        with get_transaction_session() as session:
            # 使用session执行数据库操作
            # 自动提交事务
            pass
    """
    with Session(engine) as session:
        try:
            yield session
            session.commit()
            logger.info("事务提交成功")
        except Exception as e:
            session.rollback()
            logger.error(f"事务回滚: {e}")
            raise



def get_session_dep():
    """FastAPI依赖：提供一个数据库会话（生成器形式）
    
    用于FastAPI路由的依赖注入，自动管理会话的生命周期
    """
    try:
        with Session(engine) as session:
            yield session
    except Exception as e:
        logger.error(f"提供FastAPI会话失败: {e}")
        raise
