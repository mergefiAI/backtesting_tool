"""
数据导入API路由
提供CSV文件上传、解析、映射和导入功能
"""
import os
import re
import tempfile
from datetime import datetime
from typing import Dict, List, Any

import pandas as pd
from fastapi import APIRouter, UploadFile, File, HTTPException, Form

from app.services.market_data_import_service import MarketDataImportService
from app.services.trend_data_service import upload_trend_data as import_trend_data

router = APIRouter(prefix="/api/data-import", tags=["数据导入"])


@router.post("/upload-csv", response_model=Dict[str, Any])
async def upload_csv(file: UploadFile = File(...)):
    """
    上传CSV文件并解析
    
    Args:
        file: 上传的CSV文件
        
    Returns:
        Dict[str, Any]: 解析结果，包含列名和数据预览
    """
    try:
        # 读取文件内容
        file_content = await file.read()
        
        # 解析CSV
        columns, df = MarketDataImportService.read_csv(file_content)
        
        # 生成数据预览
        preview = MarketDataImportService.generate_preview(df)
        
        return {
            "success": True,
            "message": "CSV文件解析成功",
            "columns": columns,
            "preview": preview,
            "total_rows": len(df)
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"CSV文件解析失败: {str(e)}")








@router.post("/suggest-mapping", response_model=Dict[str, Any])
def suggest_mapping_route(csv_columns: List[str]):
    """
    自动生成列映射建议
    
    Args:
        csv_columns: CSV列名列表
        
    Returns:
        Dict[str, Any]: 映射建议
    """
    try:
        # 生成映射建议
        mapping = MarketDataImportService.suggest_mapping(csv_columns)
        
        return {
            "success": True,
            "mapping": mapping
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成映射建议失败: {str(e)}")


@router.post("/validate-mapping", response_model=Dict[str, Any])
def validate_mapping(
    csv_columns: List[str], 
    mapping: Dict[str, str]
):
    """
    验证列映射关系
    
    Args:
        csv_columns: CSV列名列表
        mapping: 映射关系，键为CSV列名，值为目标列名
        
    Returns:
        Dict[str, Any]: 验证结果
    """
    try:
        # 验证映射
        is_valid, errors = MarketDataImportService.validate_mapping(
            csv_columns, mapping
        )
        
        return {
            "success": is_valid,
            "valid": is_valid,
            "errors": errors
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"验证映射关系失败: {str(e)}")


@router.post("/execute-import", response_model=Dict[str, Any])
async def execute_import(
    file: UploadFile = File(...),
    time_granularity: str = Form(...),
    mapping: str = Form(...),
    symbol: str = Form("BTC")
):
    """
    执行CSV数据导入
    
    Args:
        file: 上传的CSV文件
        time_granularity: 时间粒度（daily/hourly/minute）
        mapping: 映射关系，键为CSV列名，值为目标列名
        symbol: 交易标的（默认：BTC）
        
    Returns:
        Dict[str, Any]: 导入结果
    """
    try:
        # 输出接收到的参数
        print(f"DEBUG: Received time_granularity: '{time_granularity}'")
        print(f"DEBUG: Received mapping: '{mapping}'")
        print(f"DEBUG: time_granularity is None: {time_granularity is None}")
        print(f"DEBUG: mapping is None: {mapping is None}")
        
        # 验证参数
        if not time_granularity:
            raise HTTPException(status_code=400, detail="时间粒度不能为空")
        
        if not mapping:
            raise HTTPException(status_code=400, detail="列映射关系不能为空")
        
        # 解析mapping字符串为字典
        import json
        try:
            mapping_dict = json.loads(mapping)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="列映射关系格式错误，应该是有效的JSON字符串")
        
        # 读取文件内容
        file_content = await file.read()
        
        # 解析CSV
        csv_columns, df = MarketDataImportService.read_csv(file_content)
        
        # 验证映射
        is_valid, errors = MarketDataImportService.validate_mapping(
            csv_columns, mapping_dict
        )
        
        if not is_valid:
            raise HTTPException(status_code=400, detail={"errors": errors})
        
        # 执行导入
        # 转换映射后的DataFrame为CSV内容
        import io
        import json
        
        # 应用映射关系
        mapped_df = df.copy()
        
        # 过滤掉空映射，只保留有效的映射关系
        valid_mapping = {k: v for k, v in mapping_dict.items() if v}
        mapped_df = mapped_df.rename(columns=valid_mapping)
        
        # 确保所有必需的列都存在
        required_columns = ['open', 'close', 'high', 'low', 'volume', 'date']
        for col in required_columns:
            if col not in mapped_df.columns:
                # 尝试使用原始列名
                for orig_col in df.columns:
                    if orig_col.lower() == col.lower():
                        mapped_df[col] = df[orig_col]
                        break
        

        
        # 转换映射后的DataFrame为CSV内容
        csv_buffer = io.StringIO()
        mapped_df.to_csv(csv_buffer, index=False, encoding='utf-8')
        csv_content = csv_buffer.getvalue().encode('utf-8')
        
        # 使用MarketDataImportService.import_data执行导入
        result = MarketDataImportService.import_data(
            file_content=csv_content,
            time_granularity=time_granularity,
            symbol=symbol
        )
        
        # 处理导入结果
        if result['success']:
            inserted = result['data'].get('inserted_count', 0) if result['data'] else 0
            updated = result['data'].get('updated_count', 0) if result['data'] else 0
            rows_imported = inserted + updated
        else:
            rows_imported = 0
        
        return {
            "success": result["success"],
            "message": result["message"],
            "rows_imported": rows_imported
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"执行导入失败: {str(e)}")


@router.post("/import-trend-data", response_model=Dict[str, Any])
async def import_trend_data_endpoint(
    file: UploadFile = File(...),
    symbol: str = Form("BTC")
):
    """
    导入趋势数据（转换为CSV格式）
    
    Args:
        file: 上传的Excel文件
        symbol: 交易标的（默认：BTC）
        
    Returns:
        Dict[str, Any]: 转换结果
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        # 添加调试日志
        logger.info(f"收到趋势数据转换请求，文件: {file.filename}, 标的: {symbol}")
        
        # 验证文件类型
        if not file.filename or not file.filename.endswith((".xlsx", ".xls", ".csv")):
            raise HTTPException(status_code=400, detail="只支持Excel和CSV文件格式（.xlsx, .xls, .csv）")
        
        # 获取文件扩展名，创建正确后缀的临时文件
        _, file_extension = os.path.splitext(file.filename)
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as temp_file:
            temp_file_path = temp_file.name
            temp_file.write(await file.read())
        
        try:
            # 执行趋势数据转换，传递标的参数
            result = import_trend_data(temp_file_path, symbol=symbol)
            
            return {
                "success": result["success"],
                "message": result["message"],
                "parsed_count": result["parsed_count"],
                "skipped_count": result["skipped_count"],
                "csv_saved": result["csv_saved"],
                "csv_path": result.get("csv_path", "")
            }
        finally:
            # 清理临时文件
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"转换趋势数据失败: {str(e)}")


def parse_chinese_date(date_str):
    """解析中文日期格式，如 '2025年1月1日' -> datetime"""
    # 移除多余空格并匹配中文日期格式的正则表达式
    cleaned_date = date_str.replace(' ', '')  # 移除所有空格
    pattern = r'(\d{4})年(\d{1,2})月(\d{1,2})日'
    match = re.match(pattern, cleaned_date)
    
    if match:
        year, month, day = match.groups()
        return datetime(int(year), int(month), int(day))
    else:
        raise ValueError(f"无法解析日期格式: {date_str}")


@router.post("/preview-trend-data", response_model=Dict[str, Any])
async def preview_trend_data_endpoint(
    file: UploadFile = File(...),
    symbol: str = Form("BTC")
):
    """
    预览趋势数据
    
    Args:
        file: 上传的Excel或CSV文件
        symbol: 交易标的（默认：BTC）
        
    Returns:
        Dict[str, Any]: 预览结果
    """
    try:
        # 验证文件类型
        if not file.filename or not file.filename.endswith((".xlsx", ".xls", ".csv")):
            raise HTTPException(status_code=400, detail="只支持Excel和CSV文件格式（.xlsx, .xls, .csv）")
        
        # 获取文件扩展名
        _, file_extension = os.path.splitext(file.filename)
        file_content = await file.read()
        temp_file_path = None
        
        try:
            # 保存文件到临时目录
            with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as temp_file:
                temp_file_path = temp_file.name
                temp_file.write(file_content)
            
            # 根据文件类型读取文件
            if file_extension in ['.xlsx', '.xls']:
                # 读取Excel文件
                df = pd.read_excel(temp_file_path)
            else:
                # 读取CSV文件，尝试不同编码
                try:
                    # 尝试UTF-8编码
                    df = pd.read_csv(temp_file_path, encoding='utf-8')
                except UnicodeDecodeError:
                    try:
                        # 尝试GBK编码（中文常见编码）
                        df = pd.read_csv(temp_file_path, encoding='gbk')
                    except UnicodeDecodeError:
                        try:
                            # 尝试GB2312编码
                            df = pd.read_csv(temp_file_path, encoding='gb2312')
                        except UnicodeDecodeError:
                            # 尝试自动检测编码
                            df = pd.read_csv(temp_file_path, encoding='auto')
            
            # 验证列结构 - 至少需要1列
            if len(df.columns) < 1:
                raise HTTPException(status_code=400, detail="文件格式错误，至少需要1列（日期和趋势组合）")
            
            # 趋势映射：将文件中的趋势类型映射到标准类型
            trend_mapping = {
                '空头趋势': '下降',
                '多头趋势': '上升', 
                '震荡趋势': '震荡',
                '空头': '下降',
                '多头': '上升',
                '震荡': '震荡',
                '上升': '上升',
                '下降': '下降',
                '横盘': '横盘'
            }
            
            preview_data = []
            valid_count = 0
            invalid_count = 0
            
            # 根据文件类型和结构处理数据
            if file_extension in ['.xlsx', '.xls'] or (file_extension == '.csv' and len(df.columns) == 1):
                # 获取唯一列（假设所有数据都在第一列）
                data_col = df.columns[0]
                
                for index, row in df.iterrows():
                    try:
                        # 获取原始数据行
                        raw_data = str(row[data_col]).strip()
                        
                        if not raw_data:
                            invalid_count += 1
                            continue
                        
                        # 解析格式：日期和趋势在同一列，用空格分隔
                        parts = raw_data.split(' ', 1)  # 只分割第一个空格
                        if len(parts) != 2:
                            raise ValueError(f"数据格式错误，应该包含日期和趋势两部分: {raw_data}")
                        
                        date_part, trend_part = parts
                        
                        # 解析日期
                        parsed_date = parse_chinese_date(date_part)
                        formatted_date = parsed_date.strftime('%Y-%m-%d')
                        
                        # 映射趋势类型
                        trend = trend_mapping.get(trend_part, trend_part)
                        
                        # 验证趋势类型
                        valid_trends = ['上升', '下降', '横盘', '上涨', '下跌', '震荡']
                        is_valid = trend in valid_trends
                        
                        if is_valid:
                            valid_count += 1
                            preview_data.append({
                                'id': index + 1,
                                'date': formatted_date,
                                'trend': trend,
                                'valid': True
                            })
                        else:
                            invalid_count += 1
                            preview_data.append({
                                'id': index + 1,
                                'date': formatted_date,
                                'trend': trend,
                                'valid': False,
                                'error': f'不支持的趋势类型: {trend} (原始: {trend_part})'
                            })
                            
                    except Exception as e:
                        invalid_count += 1
                        preview_data.append({
                            'id': index + 1,
                            'date': str(row[data_col]),
                            'trend': str(row[data_col]),
                            'valid': False,
                            'error': f'数据解析错误: {str(e)}'
                        })
            elif file_extension == '.csv' and len(df.columns) >= 2 and 'date' in df.columns and 'trend' in df.columns:
                # CSV文件带有'date'和'trend'列
                for index, row in df.iterrows():
                    try:
                        # 获取日期和趋势数据
                        date_str = str(row['date']).strip()
                        trend_str = str(row['trend']).strip()
                        
                        if not date_str or not trend_str:
                            invalid_count += 1
                            continue
                        
                        # 解析日期
                        try:
                            # 尝试直接解析为日期对象
                            if '年' in date_str and '月' in date_str and '日' in date_str:
                                parsed_date = parse_chinese_date(date_str)
                            else:
                                # 尝试解析标准日期格式
                                parsed_date = datetime.strptime(date_str, '%Y-%m-%d')
                            formatted_date = parsed_date.strftime('%Y-%m-%d')
                        except ValueError:
                            # 如果解析失败，尝试作为字符串直接使用
                            formatted_date = date_str
                        
                        # 映射趋势类型
                        trend = trend_mapping.get(trend_str, trend_str)
                        
                        # 验证趋势类型
                        valid_trends = ['上升', '下降', '横盘', '上涨', '下跌', '震荡']
                        is_valid = trend in valid_trends
                        
                        if is_valid:
                            valid_count += 1
                            preview_data.append({
                                'id': index + 1,
                                'date': formatted_date,
                                'trend': trend,
                                'valid': True
                            })
                        else:
                            invalid_count += 1
                            preview_data.append({
                                'id': index + 1,
                                'date': formatted_date,
                                'trend': trend,
                                'valid': False,
                                'error': f'不支持的趋势类型: {trend} (原始: {trend_str})'
                            })
                    except Exception as e:
                        invalid_count += 1
                        preview_data.append({
                            'id': index + 1,
                            'date': str(row['date']) if 'date' in row else 'N/A',
                            'trend': str(row['trend']) if 'trend' in row else 'N/A',
                            'valid': False,
                            'error': f'数据解析错误: {str(e)}'
                        })
            else:
                # 不支持的文件格式
                raise HTTPException(status_code=400, detail="文件格式错误，CSV文件应该包含date和trend列，或日期和趋势在同一列")
            
            return {
                "success": True,
                "message": "数据预览生成成功",
                "preview_data": preview_data,
                "total_records": len(preview_data),
                "valid_records": valid_count,
                "invalid_records": invalid_count,
                "symbol": symbol
            }
            
        finally:
            # 清理临时文件
            if temp_file_path and os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"预览趋势数据失败: {str(e)}")
