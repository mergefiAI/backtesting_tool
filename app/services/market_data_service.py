"""
统一市场数据服务
提供股票市场数据获取、CSV数据读写和缓存功能
"""

import os
import time
from datetime import datetime, timedelta
from typing import Annotated, Dict, List, Optional, Any

# Add project root to Python path
import pandas as pd
from cfg import logger

from app.utils.timestamp_utils import TimestampUtils

# 市场数据缓存
_market_data_cache = {}
_cache_expiry = 30 * 60  # 30分钟


class CSVDataService:
    """CSV数据读写服务"""
    
    # 数据存储目录
    DATA_DIR = "data/kline"
    
    @staticmethod
    def get_csv_file_path(symbol: str, time_granularity: str) -> str:
        """
        获取CSV文件路径
        
        Args:
            symbol: 标的
            time_granularity: 时间粒度
            
        Returns:
            str: CSV文件路径
        """
        file_name = f"{symbol}_{time_granularity}_kline.csv"
        return os.path.join(CSVDataService.DATA_DIR, file_name)
    
    @staticmethod
    def read_data(symbol: str, time_granularity: str) -> pd.DataFrame:
        """
        读取CSV数据
        
        Args:
            symbol: 标的
            time_granularity: 时间粒度
            
        Returns:
            pd.DataFrame: 数据
        """
        file_path = CSVDataService.get_csv_file_path(symbol, time_granularity)
        
        if not os.path.exists(file_path):
            logger.info(f"文件不存在: {file_path}")
            return pd.DataFrame()
        
        try:
            # 先读取数据，不指定日期解析列
            df = pd.read_csv(file_path)
            
            # 解析日期列，优先使用date列
            if 'date' in df.columns:
                df['date'] = pd.to_datetime(df['date'], errors='coerce')
            
            # 删除不需要的列
            columns_to_drop = []
            if 'Symbol' in df.columns:
                columns_to_drop.append('Symbol')
            if 'symbol' in df.columns:
                columns_to_drop.append('symbol')
            
            if columns_to_drop:
                df = df.drop(columns=columns_to_drop)
                
            logger.info(f"读取文件成功: {file_path}, 包含 {len(df)} 行数据，列: {list(df.columns)}")
            return df
        except Exception as e:
            logger.error(f"读取文件失败: {file_path}, 错误: {e}")
            return pd.DataFrame()
    
    @staticmethod
    def write_data(df: pd.DataFrame, symbol: str, time_granularity: str) -> bool:
        """
        写入CSV数据
        
        Args:
            df: 数据
            symbol: 标的
            time_granularity: 时间粒度
            
        Returns:
            bool: 是否成功
        """
        if df.empty:
            logger.info("没有数据需要写入")
            return True
        
        # 确保目录存在
        os.makedirs(CSVDataService.DATA_DIR, exist_ok=True)
        
        file_path = CSVDataService.get_csv_file_path(symbol, time_granularity)
        
        try:
            # 读取现有数据
            existing_df = CSVDataService.read_data(symbol, time_granularity)
            
            # 如果现有数据不为空，合并数据并去重
            if not existing_df.empty:
                # 合并数据
                combined_df = pd.concat([existing_df, df], ignore_index=True)
                # 去重，根据date去重
                combined_df = combined_df.drop_duplicates(subset=['date'], keep='last')
                # 按date排序
                combined_df = combined_df.sort_values('date')
            else:
                combined_df = df
            
            # 写入数据
            combined_df.to_csv(file_path, index=False, float_format='%.8f')
            logger.info(f"写入文件成功: {file_path}, 包含 {len(combined_df)} 行数据")
            return True
        except Exception as e:
            logger.error(f"写入文件失败: {file_path}, 错误: {e}")
            return False
    
    @staticmethod
    def query_data(
        symbol: str,
        time_granularity: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> pd.DataFrame:
        """
        查询数据
        
        Args:
            symbol: 标的
            time_granularity: 时间粒度
            start_date: 开始日期
            end_date: 结束日期
            
        Returns:
            pd.DataFrame: 查询结果
        """
        # 读取数据
        df = CSVDataService.read_data(symbol, time_granularity)
        
        if df.empty:
            return df
        
        # 应用过滤器
        filters = []
        

        
        # 时间范围过滤
        # 确定使用的日期列名
        date_col = 'date'
        
        if start_date and date_col in df.columns:
            # 确保start_date为naive datetime以便与DataFrame中的datetime64[ns]比较
            s_date = start_date.replace(tzinfo=None) if start_date.tzinfo else start_date
            # 如果是日线，只比较日期部分
            if time_granularity == 'daily':
                s_date = s_date.replace(hour=0, minute=0, second=0, microsecond=0)
            filters.append(df[date_col] >= s_date)
        
        if end_date and date_col in df.columns:
            # 确保end_date为naive datetime以便与DataFrame中的datetime64[ns]比较
            e_date = end_date.replace(tzinfo=None) if end_date.tzinfo else end_date
            # 如果是日线，只比较日期部分，但要包含这一天，所以设置时间为23:59:59
            if time_granularity == 'daily':
                e_date = e_date.replace(hour=23, minute=59, second=59, microsecond=999999)
            filters.append(df[date_col] <= e_date)
        
        # 应用所有过滤器
        if filters:
            df = df[pd.concat(filters, axis=1).all(axis=1)]
        
        # 按日期列排序
        if date_col in df.columns:
            df = df.sort_values(date_col)
        
        return df
    
    @staticmethod
    def get_paginated_data(
        df: pd.DataFrame,
        page: int = 1,
        page_size: int = 100
    ) -> Dict[str, Any]:
        """
        获取分页数据
        
        Args:
            df: 数据
            page: 页码
            page_size: 每页大小
            
        Returns:
            Dict[str, Any]: 分页数据
        """
        total = len(df)
        total_pages = (total + page_size - 1) // page_size
        
        # 检查页码是否超出范围
        if page > total_pages and total > 0:
            page = min(page, total_pages)
        
        # 计算偏移量
        offset = (page - 1) * page_size
        
        # 获取分页数据
        paginated_df = df.iloc[offset:offset + page_size]
        
        # 转换为字典格式
        items = []
        for _, row in paginated_df.iterrows():
            # 确定使用的日期列名
            date_col = 'date'
            
            item = {
                "date": TimestampUtils.to_utc_iso(row[date_col]) if pd.notna(row[date_col]) else None,

                "open": str(row['open']) if pd.notna(row['open']) else None,
                "high": str(row['high']) if pd.notna(row['high']) else None,
                "low": str(row['low']) if pd.notna(row['low']) else None,
                "close": str(row['close']) if pd.notna(row['close']) else None,
                # 其他字段...
            }
            
            for col in row.index:
                if col not in item:
                    value = row[col]
                    if pd.notna(value):
                        if isinstance(value, (int, float)):
                            item[col] = str(value)
                        else:
                            item[col] = value
                    else:
                        item[col] = None
            
            items.append(item)
        
        return {
            "items": items,
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": total_pages
        }
    
    @staticmethod
    def delete_data(symbol: str, time_granularity: str) -> bool:
        """
        删除数据
        
        Args:
            symbol: 标的
            time_granularity: 时间粒度
            
        Returns:
            bool: 是否成功
        """
        file_path = CSVDataService.get_csv_file_path(symbol, time_granularity)
        
        if not os.path.exists(file_path):
            logger.info(f"文件不存在: {file_path}")
            return True
        
        try:
            os.remove(file_path)
            logger.info(f"删除文件成功: {file_path}")
            return True
        except Exception as e:
            logger.error(f"删除文件失败: {file_path}, 错误: {e}")
            return False
    
    @staticmethod
    def get_symbols(time_granularity: str) -> List[str]:
        """
        获取所有标的
        
        Args:
            time_granularity: 时间粒度
            
        Returns:
            List[str]: 标的列表
        """
        symbols = set()
        
        # 遍历数据目录
        for file_name in os.listdir(CSVDataService.DATA_DIR):
            if file_name.endswith(f"_{time_granularity}_kline.csv"):
                # 提取标的
                symbol = file_name.replace(f"_{time_granularity}_kline.csv", "")
                symbols.add(symbol)
        
        return list(symbols)

    @staticmethod
    def get_date_range(df: pd.DataFrame) -> Dict[str, Any]:
        """
        获取DataFrame的日期范围
        
        Args:
            df: 数据DataFrame
            
        Returns:
            Dict: 包含count、start_date、end_date的字典
        """
        if df.empty or 'date' not in df.columns:
            return {'count': 0, 'start_date': None, 'end_date': None}
        
        dates = pd.to_datetime(df['date'], errors='coerce').dropna()
        if dates.empty:
            return {'count': 0, 'start_date': None, 'end_date': None}
        
        return {
            'count': len(dates),
            'start_date': dates.min().strftime('%Y-%m-%d'),
            'end_date': dates.max().strftime('%Y-%m-%d')
        }


# @tool
def get_stock_market_data_unified(
        market_type: Annotated[str, "市场类型（A股、港股、美股、加密货币）"],
        ticker: Annotated[str, "股票或加密货币代码"],
        start_date: Annotated[str, "开始日期，格式：YYYY-MM-DD"],
        end_date: Annotated[str, "结束日期，格式：YYYY-MM-DD"],
        time_granularity: Annotated[str, "时间粒度：daily/hourly/minute"],
) -> str:
    """
    统一的股票市场数据工具

    Args:
        market_type: 市场类型（A股、港股、美股、加密货币）
        ticker: 股票或加密货币代码（如：000001、0700.HK、AAPL、BTC）
        start_date: 开始日期（格式：YYYY-MM-DD）
        end_date: 结束日期（格式：YYYY-MM-DD）
        time_granularity: 时间粒度：daily/hourly/minute

    Returns:
        str: 市场数据和技术分析报告
    """
    try:
        return get_market_data_txt(market_type, ticker, start_date, end_date, time_granularity)
    except Exception as e:
        error_msg = f"统一市场数据工具执行失败: {str(e)}"
        logger.error(f"❌ [统一市场工具] {error_msg}")
        return error_msg


def get_market_data_txt(market_type: str, ticker: str, start_date: str, end_date: str, time_granularity: str = "daily") -> str:
    """
    统一的市场数据工具
    :param market_type: 市场类型（如：A股、港股、美股、加密货币）
    :param ticker: 代码（如：000001、0700.HK、AAPL、BTC）
    :param start_date: 开始日期（格式：YYYY-MM-DD）
    :param end_date: 结束日期（格式：YYYY-MM-DD）
    :param time_granularity: 时间粒度：daily/hourly/minute
    :return: str: 市场数据报告
    """
    
    logger.info(f"📈 [统一市场工具] 处理{market_type} {ticker}市场数据...")
    
    # 1. 检查缓存，添加时间粒度到缓存键
    cache_key = f"{market_type}_{ticker}_{start_date}_{end_date}_{time_granularity}"
    if cache_key in _market_data_cache:
        cached_data, timestamp = _market_data_cache[cache_key]
        if time.time() - timestamp < _cache_expiry:
            logger.info(f"📋 [统一市场工具] 从缓存获取数据: {cache_key}")
            return cached_data
    
    try:
        from app.utils.timestamp_utils import TimestampUtils
        start_date, end_date = TimestampUtils.std_date_range(start_date, end_date)
        result_data = []
        ds = "根据股票类型自动选择最适合的数据源"
        
        # 2. 从CSV文件获取数据
        logger.info(f"📁 [统一市场工具] 从CSV文件获取数据: {market_type} {ticker} {start_date}~{end_date} 粒度: {time_granularity}")
        
        # 转换日期格式
        start_date_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_date_dt = datetime.strptime(end_date, "%Y-%m-%d")
        
        # 使用CSV数据服务获取数据
        df = CSVDataService.query_data(
            symbol=ticker,
            time_granularity=time_granularity,
            start_date=start_date_dt,
            end_date=end_date_dt
        )
        
        if not df.empty:
            logger.info(f"✅ [统一市场工具] 从CSV文件获取到 {len(df)} 条数据")
            
            # 构建简单数据表格
            data_str = f"## {market_type} {ticker} 市场数据分析\n\n"
            data_str += f"**分析期间**: {start_date} 至 {end_date}\n\n"
            
            # 获取所有必要的字段并显示数据
            field_names = ['date', 'open', 'high', 'low', 'close', 'volume',
                          'change', 'pct_chg', 'amplitude',
                          'close_5_sma', 'close_20_sma', 'close_50_sma', 'close_60_sma', 'close_200_sma',
                          'close_12_ema', 'close_26_ema', 'macd', 'macds', 'macdh',
                          'rsi_6', 'rsi_12', 'rsi_24', 'kdjk', 'kdjd', 'kdjj',
                          'boll', 'boll_ub', 'boll_lb', 'volume_5_sma', 'volume_10_sma']
            
            # 检查哪些字段存在
            available_fields = []
            for field_name in field_names:
                if field_name in df.columns and not df[field_name].isnull().all():
                    available_fields.append(field_name)
            
            # 创建表格头
            data_str += "| " + " | ".join([f.replace('_', ' ').title() for f in available_fields]) + " |\n"
            data_str += "|" + "------|" * len(available_fields) + "\n"
            
            # 添加数据行（显示前10条）
            for _, row in df.head(10).iterrows():
                row_data = []
                for field_name in available_fields:
                    value = row[field_name]
                    if field_name == 'date':
                        row_data.append(row[field_name].strftime('%Y-%m-%d %H:%M:%S'))
                    elif isinstance(value, (int, float)):
                        row_data.append(f"{value:.4f}")
                    else:
                        row_data.append(str(value) if pd.notna(value) else '-')
                data_str += "| " + " | ".join(row_data) + " |\n"
            
            result_data.append(data_str)
            ds = "CSV File"
            
            # 存入缓存
            final_result = f"**{ticker} 市场数据分析**\n\n"
            final_result += f"**分析期间**: {start_date} 至 {end_date}\n\n"
            final_result += f"{chr(10).join(result_data)}\n\n"
            final_result += f"*数据来源: {ds}*\n"
            
            _market_data_cache[cache_key] = (final_result, time.time())
            return final_result
        
        # 5. 组织最终结果
        final_result = f"**{ticker} 市场数据分析**\n\n"
        final_result += f"**分析期间**: {start_date} 至 {end_date}\n\n"
        final_result += f"{chr(10).join(result_data)}\n\n"
        if "数据来源" not in final_result:
            final_result += f"*数据来源: {ds}*\n"
        
        # 6. 存入缓存
        _market_data_cache[cache_key] = (final_result, time.time())
        return final_result
        
    except Exception as e:
        error_msg = f"统一市场数据工具执行失败: {str(e)}"
        logger.error(f"❌ [统一市场工具] {error_msg}")
        return error_msg