from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

import pandas as pd
from stockstats import wrap, unwrap

from cfg import logger


def to_dec(value: float | int | str | Decimal, scale: int = 8) -> Decimal:
    """
    将输入转换为 Decimal 并量化到指定小数位（四舍五入）。

    Args:
        value: 输入的数值（float/int/str/Decimal）
        scale: 保留的小数位数，默认8位（满足BTC等加密资产最小单位）

    Returns:
        量化后的 Decimal 值
    """
    try:
        q = Decimal(10) ** -scale
        return Decimal(str(value)).quantize(q, rounding=ROUND_HALF_UP)
    except Exception as e:
        logger.error(f"Decimal转换失败: value={value}, scale={scale}, error={e}")
        return Decimal("0").quantize(Decimal(10) ** -scale, rounding=ROUND_HALF_UP)


def calc_indicators(ndf: Optional[pd.DataFrame]) -> pd.DataFrame:
    """
    计算技术指标
    
    必需列（不区分大小写）：
    - open: 开盘价
    - close: 收盘价
    - high: 最高价
    - low: 最低价
    - volume: 成交量
    - amount: 成交额（加密货币无此列）
    - date: 时间戳，格式不限，会重新作为index

    支持的指标：
    - 价格相关指标：移动平均线(MA)、指数移动平均线(EMA)、MACD、RSI、KDJ、布林带等
    - 成交量相关指标：成交量均线(volume_5_sma、volume_10_sma)等
    
    Args:
        ndf: 原始数据DataFrame
        
    Returns:
        计算后的数据DataFrame，包含所有原始列和新增的技术指标列
        
    Example:
        >>> df = pd.DataFrame({
        ...     'date': pd.date_range('2023-01-01', periods=100),
        ...     'open': np.random.rand(100) * 100,
        ...     'high': np.random.rand(100) * 100 + 50,
        ...     'low': np.random.rand(100) * 100,
        ...     'close': np.random.rand(100) * 100 + 25,
        ...     'volume': np.random.randint(1000, 100000, 100)
        ... })
        >>> result = calc_indicators(df)
    """
    # 获取历史数据
    # 做一个df的复制
    if ndf is None or ndf.empty:
        return ndf
    
    # 确保我们有原始数据的完整副本
    df = ndf.copy()
    # cd的数据经过下载和简单转换后已经符合stockstats要求，这里无需转换

    # 检查是否存在 'date' 列
    if 'date' not in df.columns:
        if isinstance(df.index, pd.DatetimeIndex):
            # 如果索引是日期类型，则重置索引获取日期列
            df = df.reset_index()
            # 确保列名正确（索引重置后可能叫 'index' 或其他名称）
            if df.columns[0] == 'index':
                df.rename(columns={'index': 'date'}, inplace=True)
        else:
            raise ValueError("缺少 'date' 列且索引不是日期类型")
    
    # 原始数据缺少这些字段，涨跌额、涨跌幅、振幅，可以基于现有数据计算
    if 'change' not in df.columns:
        df['change'] = df['close'].diff()
    if 'pct_chg' not in df.columns:
        df['pct_chg'] = df['close'].pct_change() * 100
    if 'amplitude' not in df.columns:
        df['amplitude'] = (df['high'] - df['low']) / df['open'] * 100
    
    # 创建一个临时DataFrame用于计算指标，保留原始数据
    temp_df = df.copy()
    
    # 使用stockstats，需要将日期设为索引
    temp_df = temp_df.set_index('date')
    sdf = wrap(temp_df)
    
    # 【注】以下的调用会触发指标计算，不是没有用！!!
    # 移动平均线 (MA)
    _ = sdf['close_5_sma']  # 5日均线
    _ = sdf['close_20_sma']  # 20日均线
    _ = sdf['close_50_sma']  # 50日均线
    _ = sdf['close_60_sma']  # 60日均线
    _ = sdf['close_200_sma']  # 200日均线

    # 指数移动平均线 (EMA)
    _ = sdf['close_12_ema']  # 12日EMA
    _ = sdf['close_26_ema']  # 26日EMA

    # MACD，当访问 sdf['macd'] 时，stockstats 会自动计算整个 MACD 指标族
    # 包括 macd（MACD线）、macds（信号线）和 macdh（柱状图），再次调用是为了小数点设置
    _ = sdf['macd']
    _ = sdf['macds']
    
    # 其他指标
    _ = sdf['rsi_6']  # RSI 6
    _ = sdf['rsi_12']  # RSI 12
    _ = sdf['rsi_24']  # RSI 24
    _ = sdf['kdjk']  # KDJ K值
    _ = sdf['kdjd']  # KDJ D值
    _ = sdf['kdjj']  # KDJ J值
    _ = sdf['boll']  # 布林带中轨
    _ = sdf['boll_ub']  # 布林带上轨
    _ = sdf['boll_lb']  # 布林带下轨
    _ = sdf['volume_5_sma']  # 成交量5日均线
    _ = sdf['volume_10_sma']  # 成交量10日均线
    
    # 将计算好的指标合并回原始数据
    calc_df = unwrap(sdf)
    
    # 确保日期列存在
    if 'date' not in calc_df.columns:
        calc_df.reset_index(inplace=True)
    
    return calc_df