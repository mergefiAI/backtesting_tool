"""
时间戳工具类
提供时间处理相关的辅助功能
"""
from datetime import datetime, timedelta, timezone
from typing import Optional, Union

import pytz

from cfg import logger


class TimestampUtils:
    """
    时间戳工具类
    提供各种时间格式转换和处理功能
    """

    # 常用时区
    UTC = timezone.utc
    EST = pytz.timezone('US/Eastern')
    CST = pytz.timezone('Asia/Shanghai')
    from cfg.config import get_settings
    settings = get_settings()

    @staticmethod
    def now_utc() -> datetime:
        """
        获取当前UTC时间
        
        Returns:
            当前UTC时间
        """
        return datetime.now(timezone.utc)

    # 别名函数（用于统一化后的导入）
    def get_utc_now(self) -> datetime:
        """获取当前UTC时间（无时区信息，用于数据库存储）"""
        return TimestampUtils.now_utc_naive()

    @staticmethod
    def now_utc_naive() -> datetime:
        """获取当前UTC时间（无时区信息，用于数据库存储）"""
        return datetime.now(timezone.utc).replace(tzinfo=None)

    @staticmethod
    def ensure_utc_aware(dt: datetime) -> datetime:
        """确保返回UTC时区的aware时间（输入naive视为UTC）。"""
        if dt is None:
            return datetime.now(timezone.utc)
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)

    @staticmethod
    def ensure_utc_naive(dt: datetime) -> datetime:
        """确保返回UTC无时区时间（输入aware转换为UTC后去掉tzinfo）。"""
        if dt is None:
            return TimestampUtils.now_utc_naive()
        if dt.tzinfo is None:
            return dt
        return dt.astimezone(timezone.utc).replace(tzinfo=None)

    @staticmethod
    def to_utc_iso(dt: datetime) -> str:
        """将时间统一格式化为UTC ISO字符串，结尾带Z。"""
        if dt is None:
            return TimestampUtils.now_utc().isoformat().replace('+00:00', 'Z')
        aware = TimestampUtils.ensure_utc_aware(dt)
        # Python的isoformat对UTC会输出+00:00，将其标准化为Z
        return aware.isoformat().replace('+00:00', 'Z')

    @staticmethod
    def now_local() -> datetime:
        """
        获取当前本地时间
        
        Returns:
            当前本地时间
        """
        return datetime.now(timezone.utc)

    @staticmethod
    def to_utc(dt: datetime) -> datetime:
        """
        将时间转换为UTC时间
        
        Args:
            dt: 要转换的时间
            
        Returns:
            UTC时间
        """
        if dt.tzinfo is None:
            # 无时区视为UTC
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)

    @staticmethod
    def to_timezone(dt: datetime, tz: Union[timezone, pytz.BaseTzInfo]) -> datetime:
        """
        将时间转换为指定时区
        
        Args:
            dt: 要转换的时间
            tz: 目标时区
            
        Returns:
            指定时区的时间
        """
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(tz)

    @staticmethod
    def format_datetime(dt: datetime, format_str: str = "%Y-%m-%d %H:%M:%S") -> str:
        """
        格式化时间为字符串
        
        Args:
            dt: 要格式化的时间
            format_str: 格式字符串
            
        Returns:
            格式化后的时间字符串
        """
        return dt.strftime(format_str)

    @staticmethod
    def parse_datetime(dt_str: str, format_str: str = "%Y-%m-%d %H:%M:%S") -> Optional[datetime]:
        """
        解析时间字符串为datetime对象
        
        Args:
            dt_str: 时间字符串
            format_str: 格式字符串
            
        Returns:
            解析后的datetime对象，解析失败返回None
        """
        try:
            return datetime.strptime(dt_str, format_str)
        except ValueError as e:
            logger.error(f"解析时间字符串失败: {dt_str}, 格式: {format_str}, 错误: {e}")
            return None

    @staticmethod
    def timestamp_to_datetime(timestamp: Union[int, float], tz: Optional[timezone] = None) -> datetime:
        """
        将时间戳转换为datetime对象
        
        Args:
            timestamp: 时间戳（秒）
            tz: 时区，默认为UTC
            
        Returns:
            datetime对象
        """
        if tz is None:
            tz = timezone.utc
        return datetime.fromtimestamp(timestamp, tz=tz)

    @staticmethod
    def datetime_to_timestamp(dt: datetime) -> float:
        """
        将datetime对象转换为时间戳
        
        Args:
            dt: datetime对象
            
        Returns:
            时间戳（秒）
        """
        return dt.timestamp()

    @staticmethod
    def is_market_hours(dt: Optional[datetime] = None, tz: Optional[pytz.BaseTzInfo] = None) -> bool:
        """
        判断是否在交易时间内（美股交易时间）
        
        Args:
            dt: 要检查的时间，默认为当前时间
            tz: 时区，默认为美国东部时间
            
        Returns:
            是否在交易时间内
        """
        if dt is None:
            dt = TimestampUtils.now_utc()

        if tz is None:
            tz = TimestampUtils.get_market_tz()

        # 转换为东部时间
        est_time = TimestampUtils.to_timezone(dt, tz)

        # 检查是否为工作日（周一到周五）
        if est_time.weekday() >= 5:  # 周六和周日
            return False

        # 检查是否在交易时间内（9:30 AM - 4:00 PM EST）
        market_open = est_time.replace(hour=9, minute=30, second=0, microsecond=0)
        market_close = est_time.replace(hour=16, minute=0, second=0, microsecond=0)

        return market_open <= est_time <= market_close

    @staticmethod
    def get_market_open_time(date: Optional[datetime] = None, tz: Optional[pytz.BaseTzInfo] = None) -> datetime:
        """
        获取指定日期的市场开盘时间
        
        Args:
            date: 指定日期，默认为今天
            tz: 时区，默认为美国东部时间
            
        Returns:
            市场开盘时间
        """
        if date is None:
            date = TimestampUtils.now_utc()

        if tz is None:
            tz = TimestampUtils.get_market_tz()

        # 转换为东部时间
        est_date = TimestampUtils.to_timezone(date, tz)

        # 设置开盘时间为9:30 AM
        return est_date.replace(hour=9, minute=30, second=0, microsecond=0)

    @staticmethod
    def get_market_close_time(date: Optional[datetime] = None, tz: Optional[pytz.BaseTzInfo] = None) -> datetime:
        """
        获取指定日期的市场收盘时间
        
        Args:
            date: 指定日期，默认为今天
            tz: 时区，默认为美国东部时间
            
        Returns:
            市场收盘时间
        """
        if date is None:
            date = TimestampUtils.now_utc()

        if tz is None:
            tz = TimestampUtils.get_market_tz()

        # 转换为东部时间
        est_date = TimestampUtils.to_timezone(date, tz)

        # 设置收盘时间为4:00 PM
        return est_date.replace(hour=16, minute=0, second=0, microsecond=0)

    @staticmethod
    def add_business_days(dt: datetime, days: int) -> datetime:
        """
        添加工作日
        
        Args:
            dt: 起始时间
            days: 要添加的工作日数
            
        Returns:
            添加工作日后的时间
        """
        current_date = dt
        days_added = 0

        while days_added < days:
            current_date += timedelta(days=1)
            # 如果是工作日（周一到周五），计数器加1
            if current_date.weekday() < 5:
                days_added += 1

        return current_date

    @staticmethod
    def get_session_id() -> str:
        """
        生成基于时间戳的会话ID
        
        Returns:
            会话ID字符串
        """
        now = TimestampUtils.now_utc()
        return f"session_{now.strftime('%Y%m%d_%H%M%S')}_{int(now.microsecond / 1000)}"

    @staticmethod
    def time_until_market_open(dt: Optional[datetime] = None) -> Optional[timedelta]:
        """
        计算距离下次开盘的时间
        
        Args:
            dt: 当前时间，默认为现在
            
        Returns:
            距离开盘的时间差，如果已经开盘则返回None
        """
        if dt is None:
            dt = TimestampUtils.now_utc()

        # 转换为东部时间
        est_time = TimestampUtils.to_timezone(dt, TimestampUtils.EST)

        # 如果当前在交易时间内，返回None
        if TimestampUtils.is_market_hours(dt):
            return None

        # 计算下一个开盘时间
        next_open = TimestampUtils.get_market_open_time(est_time)

        # 如果今天已经收盘，计算明天的开盘时间
        if est_time.time() > next_open.time():
            next_open = TimestampUtils.add_business_days(next_open, 1)
            next_open = TimestampUtils.get_market_open_time(next_open)

        return next_open - est_time
    
    @staticmethod
    def std_date_str(date_str: str) -> str:
        """
        标准化日期格式为YYYY-MM-DD
        
        Args:
            date_str: 日期字符串
            
        Returns:
            标准化后的日期字符串（YYYY-MM-DD）
            
        Example:
            >>> TimestampUtils.std_date_str("2023/01/15")
            "2023-01-15"
        """
        try:
            dt = datetime.strptime(date_str, "%Y-%m-%d")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            # 尝试其他常见格式
            for fmt in ["%Y/%m/%d", "%d-%m-%Y", "%d/%m/%Y"]:
                try:
                    dt = datetime.strptime(date_str, fmt)
                    return dt.strftime("%Y-%m-%d")
                except ValueError:
                    continue
            # 如果都失败，返回当前UTC日期
            return TimestampUtils.now_utc().strftime("%Y-%m-%d")
    
    @staticmethod
    def today_str() -> str:
        """
        获取当前日期字符串，格式：YYYY-MM-DD
        
        Returns:
            当前日期字符串（YYYY-MM-DD）
            
        Example:
            >>> TimestampUtils.today_str()
            "2023-01-15"
        """
        return TimestampUtils.now_utc().strftime("%Y-%m-%d")
    
    @staticmethod
    def n_days_before_day_str(date_str: str, n: int) -> str:
        """
        获取指定日期前n天的日期字符串
        
        Args:
            date_str: 基准日期字符串
            n: 天数
            
        Returns:
            目标日期字符串（YYYY-MM-DD）
            
        Example:
            >>> TimestampUtils.n_days_before_day_str("2023-01-15", 5)
            "2023-01-10"
        """
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        delta = dt - timedelta(days=n)
        return delta.strftime("%Y-%m-%d")
    
    @staticmethod
    def std_date_range(start_date: str, end_date: str, diff_days: int = 5000) -> tuple[str, str]:
        """
        标准化数据日期范围和日期格式
        
        Args:
            start_date: 开始日期
            end_date: 结束日期
            diff_days: 默认天数差，当start_date为空时使用
            
        Returns:
            标准化后的日期范围（开始日期, 结束日期），格式：YYYY-MM-DD
            
        Example:
            >>> TimestampUtils.std_date_range("2023-01-01", "2023-01-15")
            ("2023-01-01", "2023-01-15")
        """
        # 格式化输入的日期
        if end_date:
            end_date = TimestampUtils.std_date_str(end_date)
        else:
            end_date = TimestampUtils.today_str()

        if start_date:
            start_date = TimestampUtils.std_date_str(start_date)
        else:
            start_date = TimestampUtils.n_days_before_day_str(end_date, diff_days)

        return start_date, end_date
