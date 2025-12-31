"""
统一市场数据导入服务
支持日线、小时线、分钟线数据导入
"""
import io
from typing import Dict, Any, List, Tuple

import pandas as pd

from app.utils.calc_utils import calc_indicators
from cfg import logger


class MarketDataImportService:
    """统一市场数据导入服务"""
    
    # 必需的列
    REQUIRED_COLUMNS = ['date', 'open', 'close', 'high', 'low', 'volume']
    
    # 列名映射配置 - 系统列名: [可能的用户列名列表]
    # 注意：volume对应Volume USDT列
    COLUMN_MAPPING = {
        'date': ['date'],
        'open': ['open'],
        'high': ['high'],
        'low': ['low'],
        'close': ['close'],
        'volume': ['volume usdt']  # 系统volume对应用户的Volume USDT
        # 移除了tradecount映射，不再导入该列
    }
    
    @staticmethod
    def _normalize_column_name(col_name: str) -> str:
        """
        规范化列名，用于匹配映射
        
        Args:
            col_name: 原始列名
            
        Returns:
            str: 规范化后的列名
        """
        return col_name.lower().strip()
    
    @staticmethod
    def _map_columns(df: pd.DataFrame) -> pd.DataFrame:
        """
        将用户CSV列映射到系统要求的列，只保留必要的列
        
        Args:
            df: 原始数据
            
        Returns:
            pd.DataFrame: 映射后的数据
        """
        # 定义必要的列
        required_columns = ['date', 'open', 'close', 'high', 'low', 'volume']
        
        # 创建一个空的DataFrame，只包含必要的列
        mapped_df = pd.DataFrame()
        
        # 保存原始列名到规范化列名的映射
        normalized_columns = {MarketDataImportService._normalize_column_name(col): col for col in df.columns}
        
        # 反向映射：规范化后的列名 -> 系统列名
        reverse_mapping = {}
        for sys_col, user_cols in MarketDataImportService.COLUMN_MAPPING.items():
            for user_col in user_cols:
                reverse_mapping[user_col.lower()] = sys_col
        
        # 映射列名，优先处理Volume USDT和日期列
        for normalized_col, original_col in normalized_columns.items():
            # 精确处理Volume USDT
            if normalized_col == 'volume usdt':
                # Volume USDT -> volume
                mapped_df['volume'] = df[original_col]
            elif normalized_col in reverse_mapping:
                # 处理其他列映射，包括日期列
                sys_col = reverse_mapping[normalized_col]
                # 只映射必要的列
                if sys_col in required_columns:
                    mapped_df[sys_col] = df[original_col]
        
        # 从原始数据中直接复制必要的列
        for col in required_columns:
            if col in df.columns and col not in mapped_df.columns:
                mapped_df[col] = df[col]
        
        return mapped_df
    
    @staticmethod
    def validate_csv_columns(columns: List[str]) -> Tuple[bool, List[str]]:
        """
        验证CSV文件是否包含必需的列
        支持灵活的列名匹配，只要能够映射到系统要求的列名即可
        
        Args:
            columns: CSV文件的列名列表（可以是原始列名或映射后的列名）
            
        Returns:
            Tuple[bool, List[str]]: 验证结果和错误信息列表
        """
        errors = []
        
        # 规范化所有输入列名
        normalized_columns = {MarketDataImportService._normalize_column_name(col): col for col in columns}
        
        # 检查必需列是否存在，symbol字段由系统自动处理，不需要验证
        for req_col in MarketDataImportService.REQUIRED_COLUMNS:
            # 检查映射后的列是否直接包含必需列
            if req_col.lower() in normalized_columns:
                continue
            
            # 如果没有直接包含，检查是否可以通过映射找到
            has_mapping = False
            for sys_col, user_cols in MarketDataImportService.COLUMN_MAPPING.items():
                if sys_col == req_col:
                    for user_col in user_cols:
                        if user_col.lower() in normalized_columns:
                            has_mapping = True
                            break
                if has_mapping:
                    break
            
            if not has_mapping:
                errors.append(f"缺少必需列: {req_col}")
        
        return len(errors) == 0, errors
    
    @staticmethod
    def process_data(df: pd.DataFrame, time_granularity: str) -> pd.DataFrame:
        """
        处理数据，计算指标
        
        Args:
            df: 原始数据DataFrame
            time_granularity: 时间粒度
            
        Returns:
            pd.DataFrame: 处理后的数据
        """
        logger.info(f"📋 开始处理数据，原始数据包含 {len(df)} 行，列: {list(df.columns)}")
        
        # 1. 映射列名
        df = MarketDataImportService._map_columns(df)
        logger.info(f"📋 列名映射后，数据包含 {len(df)} 行，列: {list(df.columns)}")
        
        # 2. 确保日期列格式正确
        # 只使用date列
        if 'date' in df.columns:
            df['date'] = pd.to_datetime(df['date'], errors='coerce')
        else:
            raise ValueError("缺少 'date' 列")
        
        # 过滤掉日期转换失败的行
        df = df.dropna(subset=['date'])
        logger.info(f"📋 日期转换后，数据包含 {len(df)} 行")
        
        # 去重，确保每个date只出现一次
        df = df.drop_duplicates(subset=['date'])
        logger.info(f"📋 去重后，数据包含 {len(df)} 行")
        
        # 执行指标计算
        processed_df = calc_indicators(df)
        
        # 计算完成后删除trade_date列，只保留date列
        logger.info(f"📋 指标计算后，数据包含 {len(processed_df)} 行")
        
        return processed_df
    
    @staticmethod
    def batch_upsert(
        df: pd.DataFrame,
        symbol: str,
        time_granularity: str
    ) -> Dict[str, int]:
        """
        批量插入或更新数据
        
        Args:
            df: 处理后的数据
            symbol: 标的
            time_granularity: 时间粒度
            
        Returns:
            Dict[str, int]: 插入和更新的记录数
        """
        from app.services.market_data_service import CSVDataService
        
        if df.empty:
            return {'inserted': 0, 'updated': 0}
        
        # 确保date列存在
        if 'date' not in df.columns:
            raise ValueError("date列不存在")
        
        # 读取现有数据
        existing_df = CSVDataService.read_data(symbol, time_granularity)
        
        # 计算插入和更新的记录数
        if existing_df.empty:
            inserted = len(df)
            updated = 0
        else:
            # 合并数据并去重
            combined_df = pd.concat([existing_df, df], ignore_index=True)
            combined_df = combined_df.drop_duplicates(subset=['date'], keep='last')
            
            # 计算插入和更新的记录数
            existing_dates = set(existing_df['date'])
            new_dates = set(df['date'])
            
            inserted = len(new_dates - existing_dates)
            updated = len(new_dates & existing_dates)
        
        # 写入数据到CSV文件
        success = CSVDataService.write_data(df, symbol, time_granularity)
        
        if not success:
            return {'inserted': 0, 'updated': 0}
        
        return {
            'inserted': inserted,
            'updated': updated
        }
    
    @staticmethod
    def import_data(
        file_content: bytes,
        time_granularity: str,
        symbol: str,
        max_file_size: int = 200 * 1024 * 1024  # 20MB
    ) -> Dict[str, Any]:
        """
        导入市场数据
        
        Args:
            file_content: CSV文件内容
            time_granularity: 时间粒度（daily/hourly/minute）
            symbol: 标的
            max_file_size: 最大文件大小
            
        Returns:
            Dict[str, Any]: 导入结果
        """
        try:
            # 检查文件大小
            if len(file_content) > max_file_size:
                return {
                    'success': False,
                    'code': 413,
                    'message': "文件大小超过限制，最大允许200MB",
                    'data': None
                }
            
            # 读取CSV数据
            df = pd.read_csv(io.StringIO(file_content.decode("utf-8")))
            logger.info(f"📋 读取CSV数据成功，包含 {len(df)} 行，原始列: {list(df.columns)}")
            
            # 保存原始列名，用于最终输出
            original_columns = list(df.columns)
            
            # 1. 映射列名到系统要求的列
            mapped_df = MarketDataImportService._map_columns(df)
            logger.info(f"📋 列名映射后，数据包含 {len(mapped_df)} 行，映射列: {list(mapped_df.columns)}")
            
            # 2. 验证必需列
            is_valid, errors = MarketDataImportService.validate_csv_columns(list(mapped_df.columns))
            if not is_valid:
                return {
                    'success': False,
                    'code': 400,
                    'message': f"CSV文件验证失败: {', '.join(errors)}",
                    'data': None
                }
            

            
            # 3. 处理数据和计算指标
            processed_df = MarketDataImportService.process_data(mapped_df, time_granularity)
            logger.info(f"📋 数据处理完成，包含 {len(processed_df)} 行，处理后列: {list(processed_df.columns)}")
            
            # 4. 确保最终输出包含用户要求的标准列
            # 用户要求的标准列: date, open, high, low, close, volume
            standard_columns = [
                'date', 'open', 'high', 'low', 'close', 
                'volume'
            ]
            
            # 添加缺失的标准列
            for col in standard_columns:
                if col not in processed_df.columns:
                    # 尝试从原始数据中获取
                    found = False
                    for original_col in original_columns:
                        if MarketDataImportService._normalize_column_name(original_col) == col:
                            processed_df[col] = df[original_col]
                            found = True
                            break
                    # 如果原始数据中没有，则创建空列
                    if not found:
                        processed_df[col] = None
            
            # 5. 重命名列名，确保与系统要求的完全一致
            column_rename_map = {
                'volume usdt': 'volume'  # Volume USDT列映射为volume
            }
            
            for old_col, new_col in column_rename_map.items():
                if old_col in processed_df.columns:
                    processed_df[new_col] = processed_df[old_col]
            
            # 6. 删除不需要的列
            columns_to_drop = []
            if 'unix' in processed_df.columns:
                columns_to_drop.append('unix')
            if 'volume_btc' in processed_df.columns:
                columns_to_drop.append('volume_btc')
            if 'symbol' in processed_df.columns:
                columns_to_drop.append('symbol')
            if 'tradecount' in processed_df.columns:
                columns_to_drop.append('tradecount')
            
            if columns_to_drop:
                processed_df = processed_df.drop(columns=columns_to_drop)
            
            # 8. 确保日期格式正确
            if 'date' in processed_df.columns:
                processed_df['date'] = pd.to_datetime(processed_df['date'])
            
            # 9. 批量插入或更新数据
            result = MarketDataImportService.batch_upsert(processed_df, symbol, time_granularity)
            logger.info(f"📋 批量操作完成，插入 {result['inserted']} 行，更新 {result['updated']} 行")
            
            logger.info(f"✅ 数据导入成功，总共处理 {result['inserted'] + result['updated']} 行")
            
            return {
                'success': True,
                'code': 200,
                'message': "数据导入成功",
                'data': {
                    'inserted_count': result['inserted'],
                    'updated_count': result['updated']
                }
            }
        except Exception as e:
            logger.error(f"❌ 导入市场数据失败: {e}", exc_info=True)
            return {
                'success': False,
                'code': 500,
                'message': f"数据导入失败: {str(e)}",
                'data': None
            }
    
    @staticmethod
    def read_csv(file_content: bytes, encoding: str = 'utf-8') -> Tuple[List[str], pd.DataFrame]:
        """
        读取CSV文件内容，返回列名和数据
        
        Args:
            file_content: CSV文件内容
            encoding: 文件编码
            
        Returns:
            Tuple[List[str], pd.DataFrame]: 列名列表和数据DataFrame
        """
        try:
            # 读取CSV文件
            df = pd.read_csv(io.BytesIO(file_content), encoding=encoding)
            
            # 获取列名
            columns = df.columns.tolist()
            
            logger.info(f"📋 成功读取CSV文件，包含 {len(columns)} 列， {len(df)} 行数据")
            
            return columns, df
        except Exception as e:
            logger.error(f"❌ 读取CSV文件失败: {str(e)}")
            raise
    
    @staticmethod
    def validate_mapping(csv_columns: List[str], mapping: Dict[str, str]) -> Tuple[bool, List[str]]:
        """
        验证列映射关系的合法性
        
        Args:
            csv_columns: CSV列名列表
            mapping: 映射关系，键为CSV列名，值为目标列名
            
        Returns:
            Tuple[bool, List[str]]: 验证结果和错误信息列表
        """
        errors = []
        
        # 过滤掉空值映射（用户选择了"不映射"的情况）
        filtered_mapping = {k: v for k, v in mapping.items() if v}
        
        # 检查映射中的CSV列是否存在
        for csv_col in filtered_mapping.keys():
            if csv_col not in csv_columns:
                errors.append(f"CSV列 '{csv_col}' 不存在")
        
        # 检查必需的字段是否都有映射
        required_fields = ['open', 'close', 'high', 'low', 'volume', 'date']
        mapped_fields = set(filtered_mapping.values())
        
        for field in required_fields:
            if field not in mapped_fields:
                errors.append(f"必需字段 '{field}' 必须映射")
        
        is_valid = len(errors) == 0
        
        if is_valid:
            logger.info("✅ 列映射验证通过")
        else:
            logger.warning(f"⚠️  列映射验证失败: {', '.join(errors)}")
        
        return is_valid, errors
    
    @staticmethod
    def generate_preview(df: pd.DataFrame, limit: int = 10) -> List[Dict[str, Any]]:
        """
        生成数据预览
        
        Args:
            df: 数据DataFrame
            limit: 预览行数
            
        Returns:
            List[Dict[str, Any]]: 预览数据列表
        """
        try:
            # 获取前N行数据
            preview_df = df.head(limit)
            
            # 转换为字典列表
            preview_data = preview_df.to_dict('records')
            
            logger.info(f"📋 生成数据预览，包含 {len(preview_data)} 行数据")
            
            return preview_data
        except Exception as e:
            logger.error(f"❌ 生成数据预览失败: {str(e)}")
            raise
    
    @staticmethod
    def suggest_mapping(csv_columns: List[str]) -> Dict[str, str]:
        """
        自动生成列映射建议
        
        Args:
            csv_columns: CSV列名列表
            
        Returns:
            Dict[str, str]: 建议的映射关系
        """
        mapping = {}
        
        # 必需的目标字段
        target_fields = ['open', 'close', 'high', 'low', 'volume', 'date']
        
        # 尝试直接匹配相同的列名
        for csv_col in csv_columns:
            csv_col_lower = csv_col.lower()
            
            # 特殊处理日期列
            if csv_col_lower in ['date', 'time', 'datetime']:
                mapping[csv_col] = 'date'
            # 处理其他必需字段
            elif csv_col_lower in target_fields:
                mapping[csv_col] = csv_col_lower
            # 处理成交量列
            elif csv_col_lower == 'volume usdt':
                mapping[csv_col] = 'volume'
        
        logger.info(f"📋 生成映射建议，自动匹配 {len(mapping)} 列")
        
        return mapping
