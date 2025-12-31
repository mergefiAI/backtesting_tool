# coding: utf-8
import os
from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    配置对象，配置在这里的参数是默认设置，在项目.env文件中可以配置覆盖同名参数;
    本文件是python文件，取值是python规范，在.env文件中取值要遵循env格式，例如boolean是小写true
    可以将.env文件的参数设置理解为继承了Setting属性
    """
    name: str = '默认设置'
    root_path: str = '/backtesting_tool'


    port: int = 5085
    workers: int = 1
    reload: bool = False
    debug: bool = False
    show_api_docs: bool = False
    
    # 数据库配置
    database_url: str = "sqlite:///./db/backtesting_dev.db"
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_pool_timeout: int = 30
    db_pool_recycle: int = 3600
    db_pool_pre_ping: bool = False

    # API配置
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    

    # SSE配置
    market_summary_sse_interval: int = 10
    
    # 测试配置
    cleanup_test_data: bool = True  # 测试后是否清理测试数据
    test_mode: bool = False  # 是否启用测试模式

    class Config:
        env_file = os.getenv('ENV_FILE', '.env')
        env_file_encoding = 'utf-8'
        extra = 'ignore'  # 允许忽略.env文件中未在Settings类中定义的配置项


@lru_cache()
def get_settings():
    return Settings()
