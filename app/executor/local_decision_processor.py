import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlmodel import Session

import app.services.trading_service as trading_service
from app.database import engine
from app.models.models import LocalDecision, VirtualAccount, Task
from app.utils.timestamp_utils import TimestampUtils
# TaskType 已移除，不再使用
from cfg import logger
from cfg.config import get_settings

# 获取配置
settings = get_settings()


def make_decision_with_agent(session: Session, account: VirtualAccount, analysis_date: datetime,
                             price: Decimal, task_id: str | None = None, user_prompt: str | None = None,
                             time_granularity: str = "daily", ai_config_id: Optional[str] = None):
    """
    使用本地决策代理执行一次决策，并在同一事务内写入决策与快照。
    - 快照时间与交易时间统一采用传入的 `analysis_date`。
    - 金额与数量统一按 8 位精度量化。
    """
    start_time = TimestampUtils.now_utc()

    try:
        # 动态获取决策执行函数
        from app.services.ai_decision_agent import execute_decision
        decision, decision_id = execute_decision(
            account=account,
            price=price,
            session=session,
            task_id=task_id,
            user_prompt=user_prompt,
            analysis_date=analysis_date,
            time_granularity=time_granularity,
            ai_config_id=ai_config_id
        )
        # 检查决策结果是否有效
        if decision is None or decision_id is None:
            logger.error(f"AI决策执行失败，返回无效结果: decision={decision}, decision_id={decision_id}")
            return None, None
            
        confidence_val = decision.get("confidence") if isinstance(decision, dict) else 0.0
        if confidence_val is None:
            confidence_val = 0.0

        end_time = TimestampUtils.now_utc()
        
        # 在创建新记录前，先删除同key的已有记录（如果存在）
        existing_decision = session.get(LocalDecision, decision_id)
        if existing_decision:
            logger.info(f"发现重复决策记录，将删除: {decision_id}")
            session.delete(existing_decision)
        
        # 构建决策记录，确保reasoning非空
        new_decision = LocalDecision(
            decision_id=decision_id,
            account_id=account.account_id,
            stock_symbol=account.stock_symbol,
            start_time=TimestampUtils.ensure_utc_naive(start_time),
            end_time=TimestampUtils.ensure_utc_naive(end_time),
            decision_result=str(decision.get("action", "HOLD")).upper() if isinstance(decision, dict) else "HOLD",
            confidence_score=Decimal(str(confidence_val or 0)),
            reasoning=(
                (decision.get("reasoning") or decision.get("error") or "AI 决策完成")
                if isinstance(decision, dict)
                else "AI 决策完成"
            ),
            market_data=decision if isinstance(decision, dict) else {},
            execution_time_ms=int((end_time - start_time).total_seconds() * 1000),
            analysis_date=TimestampUtils.ensure_utc_naive(analysis_date),  # 使用解析出的分析日期
            task_id=task_id,
        )
        session.add(new_decision)

        # 使用统一的快照时间创建账户快照
        trading_service.create_account_snapshot(account, analysis_date, task_id, session=session, price=price)
        
        # 只在最后提交一次事务
        session.commit()
        
        action = decision.get("action") if isinstance(decision, dict) else "UNKNOWN"
        confidence = decision.get("confidence") if isinstance(decision, dict) else 0.0
        logger.info(
            f"AI决策完成 - 账户: {account.account_id}, 股票: {account.stock_symbol}, 动作: {action}, 置信度: {confidence}"
        )

        return decision, decision_id
    except Exception as e:
        logger.error(f"Agent 决策执行失败: {e}")
        return None, None


def _parse_date(date_str: str) -> datetime:
    """解析YYYY-MM-DD为UTC datetime"""
    return datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)


def _parse_end_date(date_str: str) -> datetime:
    """解析YYYY-MM-DD为UTC datetime，并设置为当天的23:59:59"""
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    dt = dt.replace(hour=23, minute=59, second=59, microsecond=999999)
    return dt.replace(tzinfo=timezone.utc)


def _list_trading_dates(session: Session, symbol: str, start_date: datetime, end_date: datetime,
                        time_granularity: str = "daily") -> list[datetime]:
    """返回指定时间粒度下存在的交易日期列表"""
    from app.services.market_data_service import CSVDataService
    import pandas as pd
    
    # 确保start_date和end_date有时区信息
    if start_date.tzinfo is None:
        start_date = start_date.replace(tzinfo=timezone.utc)
    if end_date.tzinfo is None:
        end_date = end_date.replace(tzinfo=timezone.utc)
        
    # 准备查询用的日期（转为naive UTC以匹配pandas默认行为）
    s_date = start_date.replace(tzinfo=None)
    e_date = end_date.replace(tzinfo=None)
    
    logger.info(f"_list_trading_dates(CSV): time_granularity={time_granularity}, symbol={symbol}")
    
    # 使用CSVDataService查询数据
    # 注意：query_data内部已经处理了按照start_date和end_date过滤
    df = CSVDataService.query_data(
        symbol=symbol,
        time_granularity=time_granularity,
        start_date=s_date,
        end_date=e_date
    )
    
    dates = []
    if not df.empty:
        # 确定日期列
        if 'date' in df.columns:
            date_col = 'date'
        else:
            date_col = None
            
        if date_col:
            # 确保日期列为datetime类型
            if not pd.api.types.is_datetime64_any_dtype(df[date_col]):
                df[date_col] = pd.to_datetime(df[date_col], errors='coerce')
            
            # 获取日期列表（转换为Python datetime对象）
            dates = df[date_col].tolist()
    
    logger.info(f"_list_trading_dates: 查询到 {len(dates)} 条原始记录")
    
    # 根据时间粒度去重
    unique_dates = []
    seen_timestamps = set()
    
    for d in dates:
        # 确保d有时区信息（pandas通常返回naive datetime）
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        
        # 根据时间粒度生成唯一键和标准化日期
        if time_granularity == "daily":
            # 日线：只保留日期部分
            unique_key = d.date()
            # 转换为0点整
            normalized_date = d.replace(hour=0, minute=0, second=0, microsecond=0)
        elif time_granularity == "hourly":
            # 小时线：保留到小时
            unique_key = (d.date(), d.hour)
            # 转换为整点
            normalized_date = d.replace(minute=0, second=0, microsecond=0)
        else: # minute
            # 分钟线：根据决策间隔生成唯一键
            unique_key = (d.date(), d.hour, d.minute)
            normalized_date = d.replace(second=0, microsecond=0)
        
        if unique_key not in seen_timestamps:
            seen_timestamps.add(unique_key)
            unique_dates.append(normalized_date)
    
    # 确保包含起始日期和结束日期
    if time_granularity == "daily":
        # 处理起始日期
        start_key = start_date.date()
        start_normalized = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
        if start_key not in seen_timestamps:
            seen_timestamps.add(start_key)
            unique_dates.append(start_normalized)
            logger.info(f"添加起始日期到结果中: {start_normalized}")
        
        # 处理结束日期
        end_key = end_date.date()
        end_normalized = end_date.replace(hour=0, minute=0, second=0, microsecond=0)
        if end_key not in seen_timestamps:
            seen_timestamps.add(end_key)
            unique_dates.append(end_normalized)
            logger.info(f"添加结束日期到结果中: {end_normalized}")
        
        # 按日期排序
        unique_dates.sort()
    elif time_granularity == "hourly":
        # 处理起始日期
        start_key = (start_date.date(), start_date.hour)
        start_normalized = start_date.replace(minute=0, second=0, microsecond=0)
        if start_key not in seen_timestamps:
            seen_timestamps.add(start_key)
            unique_dates.append(start_normalized)
            logger.info(f"添加起始小时到结果中: {start_normalized}")
        
        # 处理结束日期
        end_key = (end_date.date(), end_date.hour)
        end_normalized = end_date.replace(minute=0, second=0, microsecond=0)
        if end_key not in seen_timestamps:
            seen_timestamps.add(end_key)
            unique_dates.append(end_normalized)
            logger.info(f"添加结束小时到结果中: {end_normalized}")
        
        # 按时间排序
        unique_dates.sort()
    else: # minute
        # 处理起始日期
        start_key = (start_date.date(), start_date.hour, start_date.minute)
        start_normalized = start_date.replace(second=0, microsecond=0)
        if start_key not in seen_timestamps:
            seen_timestamps.add(start_key)
            unique_dates.append(start_normalized)
            logger.info(f"添加起始分钟到结果中: {start_normalized}")
        
        # 处理结束日期
        end_key = (end_date.date(), end_date.hour, end_date.minute)
        end_normalized = end_date.replace(second=0, microsecond=0)
        if end_key not in seen_timestamps:
            seen_timestamps.add(end_key)
            unique_dates.append(end_normalized)
            logger.info(f"添加结束分钟到结果中: {end_normalized}")
        
        # 按时间排序
        unique_dates.sort()
    
    logger.info(f"_list_trading_dates: 去重后 {len(unique_dates)} 条记录")
    
    return unique_dates


def create_local_decision_task(account_id: str, stock_symbol: str, start_date_str: str, end_date_str: str,
                               user_prompt_id: Optional[str] = None, time_granularity: str = "daily",
                               decision_interval: int = 24, ai_config_id: Optional[str] = None,
                               commission_rate_buy: float = 0.001, commission_rate_sell: float = 0.001,
                               tax_rate: float = 0.001, min_commission: float = 5.0,
                               session: Session | None = None) -> str:
    """创建本地决策任务并返回回测ID"""
    try:
        start_dt = _parse_date(start_date_str)
        end_dt = _parse_end_date(end_date_str)
        if start_dt > end_dt:
            raise ValueError("开始日期不能晚于结束日期")

        # 验证时间粒度
        valid_granularities = ["daily", "hourly", "minute"]
        if time_granularity not in valid_granularities:
            raise ValueError(f"无效的时间粒度: {time_granularity}，有效值为: {', '.join(valid_granularities)}")

        # 验证决策间隔
        if decision_interval <= 0:
            raise ValueError("决策间隔必须为正数")

        def _logic(sess: Session):
            acc = sess.get(VirtualAccount, account_id)
            if not acc:
                # 尝试再次查询，防止缓存问题
                sess.expire_all()
                acc = sess.get(VirtualAccount, account_id)
                if not acc:
                     raise ValueError(f"虚拟账户不存在: {account_id}")

            # 更新账户的交易费用配置
            acc.commission_rate_buy = Decimal(str(commission_rate_buy))
            acc.commission_rate_sell = Decimal(str(commission_rate_sell))
            acc.tax_rate = Decimal(str(tax_rate))
            acc.min_commission = Decimal(str(min_commission))
            sess.add(acc)

            # 处理stock_symbol，提取基础标的名称，例如从"BTC-USD"提取"BTC"
            # 这是因为BTCDailyBar表中的symbol字段存储的是基础标的名称，而不是完整的交易对
            base_symbol = stock_symbol.split('-')[0] if '-' in stock_symbol else stock_symbol
            
            # 校验数据范围
            dates = _list_trading_dates(sess, base_symbol, start_dt, end_dt, time_granularity)
            if not dates:
                raise ValueError(f"所选日期范围在{time_granularity}数据中无数据")
            logger.info(f"{time_granularity}数据中存在的交易日期列表 - 股票: {base_symbol}, 日期数量: {len(dates)}")
            # 生成包含时间戳的回测ID: 格式为 timestamp-uuid
            timestamp = TimestampUtils.now_utc().strftime("%Y%m%d%H%M%S")
            task_id = f"{timestamp}-{uuid.uuid4().hex[:8]}"
            new_task = Task(
                    task_id=task_id,
                    account_id=account_id,
                    stock_symbol=base_symbol,
                    market_type="COIN",  # 默认COIN
                    user_prompt_id=user_prompt_id,  # 设置用户策略ID
                    ai_config_id=ai_config_id,  # 设置AI配置ID
                    start_date=TimestampUtils.ensure_utc_naive(start_dt),
                    end_date=TimestampUtils.ensure_utc_naive(end_dt),
                    status="PENDING",
                    total_items=len(dates),
                    processed_items=0,
                    time_granularity=time_granularity,
                    decision_interval=decision_interval
                )
            sess.add(new_task)
            sess.commit()
            logger.info(f"已创建本地决策任务: {task_id} {base_symbol} {start_date_str}~{end_date_str}，"
                        f"粒度: {time_granularity}，间隔: {decision_interval}")
            return task_id

        if session:
            return _logic(session)
        else:
            with Session(engine) as new_session:
                return _logic(new_session)

    except KeyError as e:
        logger.error(f"create_local_decision_task KeyError: {e}")
        raise ValueError(f"创建策略回测时缺少必要数据字段: {e}")
    except Exception as e:
        logger.error(f"create_local_decision_task Error: {e}")
        raise
