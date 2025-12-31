import logging.config
import os

from colorama import init, Fore, Style

# 初始化colorama，确保Windows系统也能正常工作
init(autoreset=True)

# 预定义颜色列表
COLORS = [
    Fore.CYAN,
    Fore.GREEN,
    Fore.YELLOW,
    Fore.BLUE,
    Fore.MAGENTA,
    Fore.RED,
    Fore.LIGHTCYAN_EX,
    Fore.LIGHTGREEN_EX,
    Fore.LIGHTYELLOW_EX,
    Fore.LIGHTBLUE_EX,
    Fore.LIGHTMAGENTA_EX,
    Fore.LIGHTRED_EX
]

class ColoredFormatter(logging.Formatter):
    """自定义彩色日志格式化器，根据文件名随机分配颜色"""
    
    def __init__(self, fmt=None, datefmt=None, style='%', validate=True):
        super().__init__(fmt, datefmt, style, validate)
        # 缓存文件名到颜色的映射，确保同一文件始终使用相同颜色
        self.file_color_map = {}
    
    def format(self, record):
        # 保存原始格式
        original_fmt = self._style._fmt
        
        try:
            # 获取文件名
            filename = record.filename
            
            # 如果文件名不在缓存中，随机分配一个颜色
            if filename not in self.file_color_map:
                import random
                self.file_color_map[filename] = random.choice(COLORS)
            
            # 获取颜色
            color = self.file_color_map[filename]
            
            # 添加颜色到格式
            self._style._fmt = f"{color}{original_fmt}{Style.RESET_ALL}"
            
            # 调用父类format方法
            return super().format(record)
        finally:
            # 恢复原始格式
            self._style._fmt = original_fmt

# 自定义格式化器不需要注册，fileConfig会通过类名查找

env = os.getenv('BT_CONFIG') or 'default'
if env == 'prd':
    log_conf_file = 'logging.prd.conf'
else:
    log_conf_file = 'logging.conf'

# 日志配置中日志文件将保存在根目录的logs目录下，检查项目根目录下是否有logs目录，如果没有则创建
logs_dir = os.path.join(os.path.dirname(__file__), '..', 'logs')
if not os.path.exists(logs_dir):
    os.makedirs(logs_dir)

logging.config.fileConfig(os.path.join(os.path.dirname(__file__), log_conf_file))

# 获取根日志记录器
logger = logging.getLogger()

# 动态替换控制台处理器的格式化器为彩色格式化器
for handler in logger.handlers:
    if isinstance(handler, logging.StreamHandler):
        # 获取原始格式化器的格式和日期格式
        original_fmt = handler.formatter._style._fmt
        original_datefmt = handler.formatter.datefmt
        # 创建彩色格式化器并替换
        colored_formatter = ColoredFormatter(fmt=original_fmt, datefmt=original_datefmt)
        handler.setFormatter(colored_formatter)

def get_logger(name):
    return logging.getLogger(name)

def is_debug_able():
    return logger.level == logging.DEBUG
