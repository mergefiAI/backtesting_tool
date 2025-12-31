#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
趋势数据管理服务
用于处理趋势数据的上传、转换和查询，完全基于文件系统（CSV）
"""

import os
import re
from datetime import datetime

import pandas as pd

from cfg import logger


def parse_chinese_date(date_str):
    """解析中文日期格式，如 '2025年1月1日' -> datetime"""
    cleaned_date = date_str.replace(' ', '')  # 移除所有空格
    pattern = r'(\d{4})年(\d{1,2})月(\d{1,2})日'
    match = re.match(pattern, cleaned_date)
    
    if match:
        year, month, day = match.groups()
        return datetime(int(year), int(month), int(day))
    else:
        raise ValueError(f"无法解析日期格式: {date_str}")


def upload_trend_data(file_path, output_dir="data", symbol="BTC"):
    """
    从Excel或CSV上传趋势数据并转换为CSV格式
    
    Args:
        file_path: 文件路径（支持Excel和CSV格式）
        output_dir: 输出目录，默认为data
        symbol: 交易标的，默认为BTC
        
    Returns:
        转换结果字典，包含成功状态、消息和处理统计
    """
    try:
        trend_data_list = []
        parsed_count = 0
        skipped_count = 0
        
        # 获取文件扩展名，判断文件类型
        file_extension = os.path.splitext(file_path)[1].lower()
        
        if file_extension in ['.xlsx', '.xls']:
            # Excel文件处理
            logger.info(f"开始读取Excel文件: {file_path}")
            # 读取Excel文件，不使用表头
            df = pd.read_excel(file_path, header=None)
            
            for _, row in df.iterrows():
                # 解析每行数据，格式为"2025年1月1日 空头趋势"
                row_str = str(row[0]).strip()
                if not row_str:
                    skipped_count += 1
                    continue
                
                # 分割日期和趋势类型
                parts = row_str.split(" ")
                if len(parts) < 2:
                    logger.warning(f"无效的行数据: {row_str}")
                    skipped_count += 1
                    continue
                
                date_str = parts[0]
                trend = " ".join(parts[1:])
                
                # 将中文日期转换为datetime对象
                try:
                    dt = parse_chinese_date(date_str)
                    # 格式化为标准日期字符串 YYYY-MM-DD
                    formatted_date = dt.strftime('%Y-%m-%d')
                    
                    trend_data_list.append({
                        "date": formatted_date,
                        "trend": trend
                    })
                    parsed_count += 1
                    
                    if parsed_count <= 5:  # 打印前5条成功解析的数据用于调试
                        logger.info(f"解析成功 {parsed_count}: {date_str} -> {formatted_date} | {trend}")
                        
                except ValueError as e:
                    logger.warning(f"日期格式错误: {date_str}, 错误: {e}")
                    skipped_count += 1
                    continue
        elif file_extension == '.csv':
            # CSV文件处理
            logger.info(f"开始读取CSV文件: {file_path}")
            # 读取CSV文件，支持带表头和不带表头两种格式
            try:
                # 尝试读取带有表头的CSV文件，尝试不同编码
                try:
                    # 尝试UTF-8编码
                    df = pd.read_csv(file_path, encoding='utf-8')
                except UnicodeDecodeError:
                    try:
                        # 尝试GBK编码（中文常见编码）
                        df = pd.read_csv(file_path, encoding='gbk')
                    except UnicodeDecodeError:
                        try:
                            # 尝试GB2312编码
                            df = pd.read_csv(file_path, encoding='gb2312')
                        except UnicodeDecodeError:
                            # 尝试自动检测编码
                            df = pd.read_csv(file_path, encoding='auto')
                
                # 检查文件格式：如果有'date'和'trend'列，则按列解析
                if 'date' in df.columns and 'trend' in df.columns:
                    logger.info("CSV文件带有'date'和'trend'列，按列解析")
                    for _, row in df.iterrows():
                        try:
                            date_str = str(row['date']).strip()
                            trend = str(row['trend']).strip()
                            
                            if not date_str or not trend:
                                skipped_count += 1
                                continue
                            
                            # 解析日期
                            try:
                                # 尝试直接解析为日期对象
                                if isinstance(date_str, str):
                                    # 先尝试解析中文日期格式
                                    if '年' in date_str and '月' in date_str and '日' in date_str:
                                        dt = parse_chinese_date(date_str)
                                    else:
                                        # 尝试解析标准日期格式
                                        dt = datetime.strptime(date_str, '%Y-%m-%d')
                                elif isinstance(date_str, datetime):
                                    dt = date_str
                                else:
                                    # 尝试转换为字符串再解析
                                    dt = datetime.strptime(str(date_str), '%Y-%m-%d')
                                
                                # 格式化为标准日期字符串 YYYY-MM-DD
                                formatted_date = dt.strftime('%Y-%m-%d')
                                
                                trend_data_list.append({
                                    "date": formatted_date,
                                    "trend": trend
                                })
                                parsed_count += 1
                                
                                if parsed_count <= 5:  # 打印前5条成功解析的数据用于调试
                                    logger.info(f"解析成功 {parsed_count}: {date_str} -> {formatted_date} | {trend}")
                                    
                            except ValueError as e:
                                logger.warning(f"日期格式错误: {date_str}, 错误: {e}")
                                skipped_count += 1
                                continue
                        except Exception as e:
                            logger.warning(f"CSV行解析错误: {e}")
                            skipped_count += 1
                            continue
                else:
                    # 如果没有'date'和'trend'列，则按行解析，格式为"2025年1月1日 空头趋势"
                    logger.info("CSV文件不包含'date'和'trend'列，按行解析")
                    # 重新读取，不使用表头，尝试不同编码
                    try:
                        # 尝试UTF-8编码
                        df = pd.read_csv(file_path, header=None, encoding='utf-8')
                    except UnicodeDecodeError:
                        try:
                            # 尝试GBK编码（中文常见编码）
                            df = pd.read_csv(file_path, header=None, encoding='gbk')
                        except UnicodeDecodeError:
                            try:
                                # 尝试GB2312编码
                                df = pd.read_csv(file_path, header=None, encoding='gb2312')
                            except UnicodeDecodeError:
                                # 尝试自动检测编码
                                df = pd.read_csv(file_path, header=None, encoding='auto')
                    for _, row in df.iterrows():
                        try:
                            # 解析每行数据，格式为"2025年1月1日 空头趋势"
                            row_str = str(row[0]).strip()
                            if not row_str:
                                skipped_count += 1
                                continue
                            
                            # 分割日期和趋势类型
                            parts = row_str.split(" ")
                            if len(parts) < 2:
                                logger.warning(f"无效的行数据: {row_str}")
                                skipped_count += 1
                                continue
                            
                            date_str = parts[0]
                            trend = " ".join(parts[1:])
                            
                            # 将中文日期转换为datetime对象
                            dt = parse_chinese_date(date_str)
                            # 格式化为标准日期字符串 YYYY-MM-DD
                            formatted_date = dt.strftime('%Y-%m-%d')
                            
                            trend_data_list.append({
                                "date": formatted_date,
                                "trend": trend
                            })
                            parsed_count += 1
                            
                            if parsed_count <= 5:  # 打印前5条成功解析的数据用于调试
                                logger.info(f"解析成功 {parsed_count}: {date_str} -> {formatted_date} | {trend}")
                                
                        except ValueError as e:
                            logger.warning(f"日期格式错误: {date_str}, 错误: {e}")
                            skipped_count += 1
                            continue
                
            except pd.errors.ParserError:
                # 如果解析失败，尝试使用不同的分隔符和编码
                logger.info("尝试使用不同的分隔符和编码解析CSV文件")
                try:
                    # 尝试使用制表符分隔，UTF-8编码
                    df = pd.read_csv(file_path, header=None, sep='\t', encoding='utf-8')
                except UnicodeDecodeError:
                    try:
                        # 尝试使用制表符分隔，GBK编码
                        df = pd.read_csv(file_path, header=None, sep='\t', encoding='gbk')
                    except UnicodeDecodeError:
                        try:
                            # 尝试使用制表符分隔，GB2312编码
                            df = pd.read_csv(file_path, header=None, sep='\t', encoding='gb2312')
                        except UnicodeDecodeError:
                            # 尝试使用制表符分隔，自动检测编码
                            df = pd.read_csv(file_path, header=None, sep='\t', encoding='auto')
                
                for _, row in df.iterrows():
                    try:
                        # 解析每行数据，格式为"2025年1月1日 空头趋势"
                        row_str = str(row[0]).strip()
                        if not row_str:
                            skipped_count += 1
                            continue
                        
                        # 分割日期和趋势类型
                        parts = row_str.split(" ")
                        if len(parts) < 2:
                            logger.warning(f"无效的行数据: {row_str}")
                            skipped_count += 1
                            continue
                        
                        date_str = parts[0]
                        trend = " ".join(parts[1:])
                        
                        # 将中文日期转换为datetime对象
                        dt = parse_chinese_date(date_str)
                        # 格式化为标准日期字符串 YYYY-MM-DD
                        formatted_date = dt.strftime('%Y-%m-%d')
                        
                        trend_data_list.append({
                            "date": formatted_date,
                            "trend": trend
                        })
                        parsed_count += 1
                        
                        if parsed_count <= 5:  # 打印前5条成功解析的数据用于调试
                            logger.info(f"解析成功 {parsed_count}: {date_str} -> {formatted_date} | {trend}")
                            
                    except ValueError as e:
                        logger.warning(f"日期格式错误: {date_str}, 错误: {e}")
                        skipped_count += 1
                        continue
        else:
            # 不支持的文件类型
            logger.error(f"不支持的文件类型: {file_extension}")
            return {
                "success": False,
                "message": f"不支持的文件类型: {file_extension}，仅支持.xlsx, .xls, .csv格式",
                "parsed_count": 0,
                "skipped_count": 0,
                "csv_saved": False
            }
        
        if not trend_data_list:
            return {
                "success": False,
                "message": "未找到有效数据",
                "parsed_count": 0,
                "skipped_count": skipped_count,
                "csv_saved": False
            }
        
        # 生成包含标的名称的CSV文件名
        output_csv_path = os.path.join(output_dir, f"{symbol}_trend_data.csv")
        
        # 创建DataFrame并保存为CSV
        trend_df = pd.DataFrame(trend_data_list)
        # 确保输出目录存在
        os.makedirs(output_dir, exist_ok=True)
        # 保存为CSV，不带索引
        trend_df.to_csv(output_csv_path, index=False, encoding='utf-8')
        
        logger.info(f"趋势数据转换完成，共解析{parsed_count}条有效数据，跳过{skipped_count}条无效数据")
        logger.info(f"CSV文件已保存至: {output_csv_path}")
        
        return {
            "success": True,
            "message": "趋势数据转换成功",
            "parsed_count": parsed_count,
            "skipped_count": skipped_count,
            "csv_saved": True,
            "csv_path": output_csv_path
        }
    except Exception as e:
        logger.error(f"处理趋势数据失败: {e}")
        return {
            "success": False,
            "message": f"处理失败: {str(e)}",
            "parsed_count": 0,
            "skipped_count": 0,
            "csv_saved": False
        }


def get_trend_by_date(target_date, data_dir="data", symbol="BTC"):
    """
    根据日期查询趋势数据
    
    Args:
        target_date: 目标日期，支持多种格式（YYYY-MM-DD, YYYY年MM月DD日等）
        data_dir: 数据目录，默认为data
        symbol: 交易标的，默认为BTC
        
    Returns:
        趋势信息字典，包含date和trend字段，若未找到则返回None
    """
    try:
        # 生成CSV文件路径
        csv_path = os.path.join(data_dir, f"{symbol}_trend_data.csv")
        
        # 检查CSV文件是否存在
        if not os.path.exists(csv_path):
            logger.error(f"CSV文件不存在: {csv_path}")
            return None
        
        logger.info(f"查询趋势数据，日期: {target_date}, 标的: {symbol}, CSV文件: {csv_path}")
        
        # 读取CSV文件
        df = pd.read_csv(csv_path)
        
        # 标准化目标日期格式
        try:
            # 尝试直接解析为日期对象
            if isinstance(target_date, str):
                # 先尝试解析中文日期格式
                if '年' in target_date and '月' in target_date and '日' in target_date:
                    dt = parse_chinese_date(target_date)
                else:
                    # 尝试解析标准日期格式
                    dt = datetime.strptime(target_date, '%Y-%m-%d')
            elif isinstance(target_date, datetime):
                dt = target_date
            else:
                raise ValueError(f"不支持的日期类型: {type(target_date)}")
            
            # 格式化为标准日期字符串
            formatted_target_date = dt.strftime('%Y-%m-%d')
        except ValueError as e:
            logger.error(f"无法解析目标日期: {target_date}, 错误: {e}")
            return None
        
        # 查询趋势数据
        result = df[df['date'] == formatted_target_date]
        
        if result.empty:
            logger.info(f"未找到日期 {formatted_target_date} 的趋势数据")
            return None
        
        # 返回第一条匹配记录
        trend_info = result.iloc[0].to_dict()
        logger.info(f"找到日期 {formatted_target_date} 的趋势数据: {trend_info['trend']}")
        
        return trend_info
    except Exception as e:
        logger.error(f"查询趋势数据失败: {e}")
        return None


def get_trend_by_date_range(start_date, end_date, data_dir="data", symbol="BTC"):
    """
    根据日期范围查询趋势数据
    
    Args:
        start_date: 开始日期，支持多种格式（YYYY-MM-DD, datetime对象等）
        end_date: 结束日期，支持多种格式（YYYY-MM-DD, datetime对象等）
        data_dir: 数据目录，默认为data
        symbol: 交易标的，默认为BTC
        
    Returns:
        趋势数据列表，包含多个字典，每个字典包含date和trend字段
    """
    try:
        # 生成CSV文件路径
        csv_path = os.path.join(data_dir, f"{symbol}_trend_data.csv")
        
        # 检查CSV文件是否存在
        if not os.path.exists(csv_path):
            logger.error(f"CSV文件不存在: {csv_path}")
            return []
        
        logger.info(f"查询趋势数据，日期范围: {start_date} 至 {end_date}, 标的: {symbol}, CSV文件: {csv_path}")
        
        # 读取CSV文件
        df = pd.read_csv(csv_path)
        
        # 转换日期列为datetime类型
        df['date'] = pd.to_datetime(df['date'], format='%Y-%m-%d')
        
        # 标准化开始日期格式
        try:
            if isinstance(start_date, str):
                start_dt = datetime.strptime(start_date, '%Y-%m-%d')
            elif isinstance(start_date, datetime):
                start_dt = start_date
            else:
                raise ValueError(f"不支持的开始日期类型: {type(start_date)}")
        except ValueError as e:
            logger.error(f"无法解析开始日期: {start_date}, 错误: {e}")
            return []
        
        # 标准化结束日期格式
        try:
            if isinstance(end_date, str):
                end_dt = datetime.strptime(end_date, '%Y-%m-%d')
            elif isinstance(end_date, datetime):
                end_dt = end_date
            else:
                raise ValueError(f"不支持的结束日期类型: {type(end_date)}")
        except ValueError as e:
            logger.error(f"无法解析结束日期: {end_date}, 错误: {e}")
            return []
        
        # 查询日期范围内的趋势数据
        result = df[(df['date'] >= start_dt) & (df['date'] <= end_dt)]
        
        if result.empty:
            logger.info(f"未找到日期范围 {start_dt.strftime('%Y-%m-%d')} 至 {end_dt.strftime('%Y-%m-%d')} 的趋势数据")
            return []
        
        # 转换为列表格式，将date转换为字符串
        trend_data_list = []
        for _, row in result.iterrows():
            trend_data_list.append({
                "date": row['date'].strftime('%Y-%m-%d'),
                "trend": row['trend']
            })
        
        logger.info(f"找到 {len(trend_data_list)} 条趋势数据")
        return trend_data_list
    except Exception as e:
        logger.error(f"查询趋势数据失败: {e}")
        return []
