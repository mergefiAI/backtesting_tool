import sys

import uvicorn

from cfg import logger
from cfg.config import get_settings

if __name__ == "__main__":
    # 确认存在配置文件
    settings = get_settings()
    # 导入app实例
    from app import app
    logger.info(f"成功导入app实例: {app}")
    
    logger.info("准备启动服务...")
    
    # 使用uvicorn.run启动服务，添加调试参数
    try:
        logger.info(f"即将启动uvicorn服务: host={settings.api_host}, port={settings.api_port}")
        
        # 直接使用app对象
        uvicorn.run(
            app=app,  # 直接使用已导入的app对象
            host=settings.api_host,
            port=settings.api_port,
            log_config=None,  # 禁用uvicorn默认日志配置，使用我们自己的配置
            log_level="info",  # 设置日志级别为info
            reload=False,  # 禁用热重载
            workers=1,  # 在Windows环境下使用1个worker避免兼容性问题
            access_log=True,  # 启用访问日志
            use_colors=True  # 启用彩色日志
        )
        
        logger.info("uvicorn.run执行完成")
        
    except Exception as e:
        logger.error(f"启动服务失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    logger.info("服务启动结束")
