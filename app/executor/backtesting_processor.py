import json
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List

import pandas as pd
from sqlmodel import Session, select

import app.services.trading_service as trading_service
from app.database import engine
from app.models.models import LocalDecision, VirtualAccount, Task, AccountSnapshot, TradeRecord
from app.utils.backtest_utils import BacktestUtils
from app.utils.timestamp_utils import TimestampUtils
from cfg import logger
from cfg.config import get_settings

# 获取配置
settings = get_settings()


class BacktestProcessor:
    """回测任务处理器，采用自上而下的设计模式"""
    
    def __init__(self, task_id: str, thread_logger=None):
        """
        初始化回测处理器
        
        Args:
            task_id: 回测任务ID
            thread_logger: 线程日志记录器
        """
        self.task_id = task_id
        self.logger = thread_logger if thread_logger else logger
        self.session = None
        self.task = None
        self.account = None
        self.time_granularity = "daily"
        self.decision_interval = 24
        self.user_prompt_content = None
        self.price_data = {}
    
    def execute(self) -> None:
        """执行完整回测流程"""
        self.logger.info(f"=== 回测任务执行开始 ===: task_id={self.task_id}")
        
        try:
            with Session(engine) as self.session:
                self.logger.info("1. 开始任务初始化阶段")
                self._initialize_task()
                self.logger.info("1. 任务初始化阶段完成")
                
                self.logger.info("2. 开始账户准备阶段")
                self._prepare_account()
                self.logger.info("2. 账户准备阶段完成")
                
                self.logger.info("3. 开始数据准备阶段")
                trading_dates = self._prepare_backtest_data()
                self.logger.info(f"3. 数据准备阶段完成: 准备了 {len(trading_dates)} 个交易时间点")
                
                self.logger.info("4. 开始回测执行阶段")
                self._execute_backtest(trading_dates)
                self.logger.info("4. 回测执行阶段完成")
                
                self.logger.info("5. 开始结果结算阶段")
                self._finalize_backtest()
                self.logger.info("5. 结果结算阶段完成")
                
            self.logger.info(f"=== 回测任务执行成功完成 ===: task_id={self.task_id}")
        except Exception as e:
            self.logger.error(f"=== 回测任务执行失败 ===: task_id={self.task_id}")
            self._handle_execution_error(e)
    
    def _initialize_task(self) -> None:
        """初始化回测任务"""
        self.logger.info(f"初始化回测任务: task_id={self.task_id}")
        
        # 获取任务信息
        self.task = self.session.get(Task, self.task_id)
        if not self.task:
            raise ValueError(f"任务不存在: {self.task_id}")
        
        # 获取任务配置
        self.time_granularity = getattr(self.task, 'time_granularity', 'daily')
        self.decision_interval = getattr(self.task, 'decision_interval', 24)
        
        # 验证任务状态
        valid_statuses = ["PENDING", "RUNNING", "PAUSED", "FAILED"]
        if self.task.status not in valid_statuses:
            raise ValueError(f"任务状态无效: {self.task.status}, 有效值: {', '.join(valid_statuses)}")
        
        self.logger.info(f"任务初始化完成: symbol={self.task.stock_symbol}, status={self.task.status}, "
                      f"granularity={self.time_granularity}, interval={self.decision_interval}, "
                      f"start_date={self.task.start_date}, end_date={self.task.end_date}")
        
        # 预加载用户策略提示词
        self.user_prompt_content = self._get_user_prompt()
    
    def _prepare_account(self) -> None:
        """准备回测账户"""
        self.logger.info(f"准备回测账户: account_id={self.task.account_id}")
        
        # 获取账户信息
        self.account = self.session.exec(
            select(VirtualAccount).where(VirtualAccount.account_id == self.task.account_id)
        ).first()
        
        if not self.account:
            raise ValueError(f"账户不存在: {self.task.account_id}")
        
        # 检查任务状态，决定是否需要清理数据和重置账户
        if self.task.status in ["PENDING", "FAILED", "RUNNING"]:
            # 对于RUNNING状态，可能是从API直接设置的，需要清理数据和重置账户
            self._cleanup_task_data()
            self._reset_account()
        elif self.task.status == "PAUSED":
            self.logger.info(f"从暂停状态恢复任务: processed_items={self.task.processed_items}")
        else:
            raise ValueError(f"无效的任务状态: {self.task.status}")
    
    def _cleanup_task_data(self) -> None:
        """清理任务相关数据"""
        self.logger.info(f"清理任务相关数据: task_id={self.task_id}")
        
        # 删除本地决策记录
        deleted_decisions = self.session.exec(
            select(LocalDecision).where(LocalDecision.task_id == self.task_id)
        ).all()
        for decision in deleted_decisions:
            self.session.delete(decision)
        
        # 删除当前任务相关的账户快照
        deleted_snapshots = self.session.exec(
            select(AccountSnapshot).where(AccountSnapshot.task_id == self.task_id)
        ).all()
        for snapshot in deleted_snapshots:
            self.session.delete(snapshot)
        
        # 删除交易记录（现在TradeRecord表已有task_id字段）
        deleted_trades = self.session.exec(
            select(TradeRecord).where(TradeRecord.task_id == self.task_id)
        ).all()
        for trade in deleted_trades:
            self.session.delete(trade)
        
        self.session.commit()
        self.logger.info(f"数据清理完成 - 决策: {len(deleted_decisions)}, 快照: {len(deleted_snapshots)}, 交易: {len(deleted_trades)}")
    
    def _reset_account(self) -> None:
        """重置账户状态"""
        self.logger.info(f"重置账户状态: account_id={self.account.account_id}, initial_balance={self.account.initial_balance}")
        
        # 重置账户余额和持仓
        self.account.current_balance = self.account.initial_balance
        self.account.available_balance = self.account.initial_balance
        self.account.stock_quantity = Decimal("0")
        self.account.stock_market_value = Decimal("0")
        self.account.total_value = self.account.initial_balance
        self.account.position_side = "LONG"
        self.account.margin_used = Decimal("0")
        self.account.short_avg_price = Decimal("0")
        self.account.short_total_cost = Decimal("0")
        self.account.short_positions = []
        self.account.long_positions = []
        self.account.updated_at = TimestampUtils.now_utc_naive()
        
        self.session.add(self.account)
        self.session.commit()
        self.logger.info("账户重置完成")
    
    def _prepare_backtest_data(self) -> List[datetime]:
        """准备回测数据"""
        self.logger.info(f"准备回测数据: time_granularity={self.time_granularity}")
        
        # 确保日期有时区信息
        start_date = self.task.start_date.replace(tzinfo=timezone.utc) if self.task.start_date.tzinfo is None else self.task.start_date
        end_date = self.task.end_date.replace(tzinfo=timezone.utc) if self.task.end_date.tzinfo is None else self.task.end_date
        
        # 获取交易日期列表及价格数据
        dates_and_prices = self._fetch_trading_dates_with_prices(start_date, end_date)
        
        # 提取日期列表
        dates = list(dates_and_prices.keys())
        
        # 根据决策间隔筛选日期
        filtered_dates = self._filter_dates_by_interval(dates)
        
        # 更新任务总项数
        self.task.total_items = len(filtered_dates)
        self.session.add(self.task)
        self.session.commit()
        
        # 提取筛选后的价格数据
        self.price_data = {dt: dates_and_prices[dt] for dt in filtered_dates}
        
        # 创建初始快照
        if self.task.status in ["PENDING", "FAILED"]:
            self._create_initial_snapshot(start_date)
        
        self.logger.info(f"回测数据准备完成: {len(filtered_dates)} 个时间点")
        return filtered_dates
    
    def _fetch_trading_dates_with_prices(self, start_date: datetime, end_date: datetime) -> dict:
        """
        获取交易日期列表及对应价格
        
        Returns:
            dict: 键为标准化日期，值为价格
        """
        self.logger.info(f"获取交易日期列表及价格: {start_date.date()} - {end_date.date()}")
        
        from app.services.market_data_service import CSVDataService
        
        # 使用CSV数据服务查询数据
        df = CSVDataService.query_data(
            symbol=self.task.stock_symbol,
            time_granularity=self.time_granularity,
            start_date=start_date,
            end_date=end_date
        )
        
        if df.empty:
            return {}
        
        # 确定使用的日期列名和价格列名
        date_col = 'date'
        price_col = 'close'  # 假设价格列名为close
        
        # 提取日期和价格数据
        dates_and_prices = {}
        
        for _, row in df.iterrows():
            raw_date = row[date_col]
            price = Decimal(str(row[price_col]))  # 转换为Decimal类型
            
            # 标准化日期
            if isinstance(raw_date, pd.Timestamp):
                # 转换为datetime对象
                dt = raw_date.to_pydatetime()
                # 根据时间粒度标准化
                if self.time_granularity == "daily":
                    # 日线：只保留日期部分，设置为0点
                    normalized_date = dt.replace(hour=0, minute=0, second=0, microsecond=0)
                elif self.time_granularity == "hourly":
                    # 小时线：保留到小时
                    normalized_date = dt.replace(minute=0, second=0, microsecond=0)
                else:  # minute
                    # 分钟线：保留到分钟
                    normalized_date = dt.replace(second=0, microsecond=0)
                
                dates_and_prices[normalized_date] = price
        
        self.logger.info(f"获取到 {len(dates_and_prices)} 个交易日期及价格")
        return dates_and_prices
    
    def _filter_dates_by_interval(self, dates: List[datetime]) -> List[datetime]:
        """根据决策间隔筛选日期"""
        self.logger.info(f"根据决策间隔筛选日期: interval={self.decision_interval}")
        
        if not dates:
            return []
        
        from app.utils.backtest_utils import BacktestUtils
        filtered_dates = BacktestUtils.filter_dates_by_interval(dates, self.time_granularity, self.decision_interval)
        
        self.logger.info(f"筛选后剩余 {len(filtered_dates)} 个时间点")
        return filtered_dates
    
    def _create_initial_snapshot(self, start_date: datetime) -> None:
        """创建初始账户快照"""
        self.logger.info(f"创建初始账户快照: {start_date}")
        
        # 获取初始价格
        initial_price = self._get_price_at_date(start_date)
        
        # 创建初始快照
        trading_service.create_account_snapshot(
            self.account, start_date, self.task.task_id, session=self.session, price=initial_price
        )
        self.session.commit()
        
        self.logger.info(f"初始快照创建完成: price={initial_price}")
    
    def _execute_backtest(self, trading_dates: List[datetime]) -> None:
        """执行回测"""
        self.logger.info(f"开始执行回测: {len(trading_dates)} 个时间点")
        
        # 确定起始索引和原始状态
        original_status = self.task.status
        start_index = self.task.processed_items if original_status == "PAUSED" else 0
        
        # 更新任务状态
        updated = False
        if self.task.status != "RUNNING":
            self.task.status = "RUNNING"
            updated = True
        
        if original_status == "PAUSED":
            self.task.resumed_at = TimestampUtils.now_utc_naive()
            updated = True
        elif original_status not in ["RUNNING", "PAUSED"]:
            # 新任务或从失败状态恢复
            self.task.started_at = TimestampUtils.now_utc_naive()
            self.task.processed_items = 0
            updated = True
        
        # 清除错误信息
        if self.task.error_message:
            self.task.error_message = None
            updated = True
        
        # 只有在有更新时才提交
        if updated:
            self.session.add(self.task)
            self.session.commit()
        
        self.logger.info(f"回测执行配置完成: 起始索引={start_index}, 原始状态={original_status}, 新状态={self.task.status}")
        
        # 执行回测循环
        for i, dt in enumerate(trading_dates[start_index:], start=start_index):
            # 检查任务状态
            if not self._check_task_status():
                break
            
            # 执行单次决策
            self._execute_single_decision(dt)
            
            # 更新进度
            self.task.processed_items = i + 1
            self.session.add(self.task)
            self.session.commit()
            
            self.logger.info(f"回测进度: {self.task.processed_items}/{self.task.total_items}, 时间: {dt}")
    
    def _check_task_status(self) -> bool:
        """检查任务状态"""
        # 刷新任务状态
        self.session.expire(self.task)
        self.task = self.session.get(Task, self.task_id)
        
        # 同时刷新账户状态，确保使用最新的账户数据
        self.session.expire(self.account)
        self.account = self.session.get(VirtualAccount, self.account.account_id)
        
        if self.task.status == "CANCELLED":
            self.logger.info(f"任务已取消: {self.task_id}")
            return False
        if self.task.status == "PAUSED":
            self.logger.info(f"任务已暂停: {self.task_id}")
            return False
        
        return True
    
    def _execute_single_decision(self, decision_date: datetime) -> None:
        """执行单次决策"""
        self.logger.info(f"执行单次决策: {decision_date}")
        
        # 获取当前价格（从预加载的字典中获取）
        current_price = self.price_data.get(decision_date)
        if current_price is None:
            self.logger.warning(f"价格数据缺失，跳过决策: {decision_date}")
            return
        
        # 执行决策，添加重试机制
        max_retries = 3
        for retry in range(max_retries):
            try:
                # 执行决策
                from app.executor.local_decision_processor import make_decision_with_agent
                decision, decision_id = make_decision_with_agent(
                    session=self.session,
                    account=self.account,
                    analysis_date=decision_date,
                    price=current_price,
                    task_id=self.task.task_id,
                    user_prompt=self.user_prompt_content,
                    time_granularity=self.time_granularity,
                    ai_config_id=self.task.ai_config_id
                )
                
                if decision is not None and decision_id is not None:
                    self.logger.info(f"决策执行完成: action={decision.get('action') if decision else 'None'}, "
                                  f"confidence={decision.get('confidence') if decision else 0}")
                    return
                else:
                    self.logger.warning(f"决策执行失败，重试 {retry+1}/{max_retries}: {decision_date}")
            except Exception as e:
                self.logger.warning(f"决策执行异常，重试 {retry+1}/{max_retries}: {decision_date}, error: {e}")
        
        self.logger.error(f"决策执行最终失败，跳过: {decision_date}")
    
    def _get_price_at_date(self, date: datetime) -> Optional[Decimal]:
        """获取指定日期的价格"""
        from app.utils.backtest_utils import BacktestUtils
        
        return BacktestUtils.get_price_at_date(date, self.task.stock_symbol, self.time_granularity)
    
    def _get_user_prompt(self) -> Optional[str]:
        """获取用户策略提示词"""
        if settings.test_mode:
            self.logger.info("测试模式下，跳过用户策略检查")
            return None
        
        if not self.task.user_prompt_id:
            self.logger.info("未设置用户策略，使用默认提示词")
            return None
        
        from app.models.models import PromptTemplate
        prompt_template = self.session.get(PromptTemplate, self.task.user_prompt_id)
        if prompt_template:
            self.logger.info(f"使用用户策略: {self.task.user_prompt_id}")
            return prompt_template.content
        
        self.logger.warning(f"未找到用户策略: {self.task.user_prompt_id}")
        return None
    
    def _finalize_backtest(self) -> None:
        """结束回测"""
        self.logger.info(f"结束回测: task_id={self.task_id}")
        
        # 检查任务状态
        if self.task.status in ["CANCELLED", "PAUSED"]:
            self.logger.info(f"回测提前结束: status={self.task.status}")
            return
        
        # 创建最终快照
        end_date = self.task.end_date.replace(tzinfo=timezone.utc) if self.task.end_date.tzinfo is None else self.task.end_date
        self._create_final_snapshot(end_date)
        
        # 计算回测统计数据
        self._calculate_and_update_stats()
        
        # 更新任务状态
        self.task.status = "COMPLETED"
        self.task.completed_at = TimestampUtils.now_utc_naive()
        self.session.add(self.task)
        self.session.commit()
        
        self.logger.info(f"回测完成: task_id={self.task_id}")
    
    def _create_final_snapshot(self, end_date: datetime) -> None:
        """创建最终快照"""
        self.logger.info(f"创建最终快照: {end_date}")
        
        final_price = self._get_price_at_date(end_date)
        if final_price:
            trading_service.create_account_snapshot(
                self.account, end_date, self.task.task_id, session=self.session, price=final_price
            )
            self.session.commit()
            self.logger.info(f"最终快照创建完成: price={final_price}")
        else:
            self.logger.warning(f"无法获取最终价格，跳过最终快照: {end_date}")
    
    def _calculate_and_update_stats(self) -> None:
        """计算并更新回测统计数据"""
        self.logger.info(f"计算回测统计数据: task_id={self.task_id}")
        
        stats = BacktestUtils.calculate_backtest_stats(self.task.task_id, self.session)
        
        # 更新任务统计数据
        self.task.stats = stats
        self.session.add(self.task)
        self.session.commit()
        
        self.logger.info(f"回测统计数据计算完成: {json.dumps(stats, default=str)}")
    
    def _handle_execution_error(self, error: Exception) -> None:
        """处理执行错误"""
        self.logger.error(f"回测执行错误: {error}")
        
        # 更新任务状态
        if self.task:
            self.task.status = "FAILED"
            self.task.error_message = str(error)
            self.task.completed_at = TimestampUtils.now_utc_naive()
            self.session.add(self.task)
            self.session.commit()


def start_backtest_task(task_id: str, thread_logger=None) -> None:
    """启动回测任务的入口函数"""
    log = thread_logger if thread_logger else logger
    log.info(f"=== 调用新回测处理器 ===: task_id={task_id}")
    log.info(f"创建 BacktestProcessor 实例")
    processor = BacktestProcessor(task_id, thread_logger)
    log.info(f"调用 BacktestProcessor.execute() 方法")
    processor.execute()
    log.info(f"=== 回测处理器调用完成 ===: task_id={task_id}")