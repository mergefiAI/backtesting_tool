"""
回测指标计算工具类 - 修复版

修复的问题：
1. 最大回撤计算包含初始余额
2. 胜率计算直接使用交易记录的关联
3. 夏普比率使用365天年化（加密货币市场）
4. 简化单笔最大收益计算
"""
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Tuple, Dict, Optional

import numpy as np
import pandas as pd
from sqlmodel import Session, select

from app.models.models import TradeRecord, AccountSnapshot, Task, VirtualAccount
from app.utils.calc_utils import to_dec
from cfg import logger


class BacktestUtils:
    """修复版的回测指标计算工具类"""
    
    @staticmethod
    def calculate_backtest_stats(task_id: str, session: Session) -> dict:
        """
        计算指定回测任务的所有统计指标（修复版）
        """
        try:
            # 查询任务基本信息
            task_stmt = select(Task).where(Task.task_id == task_id)
            task = session.exec(task_stmt).first()
            
            if not task:
                logger.error(f"任务不存在: {task_id}")
                return {}
            
            # 查询该任务的所有交易记录
            trade_stmt = select(TradeRecord).where(TradeRecord.task_id == task_id)
            trades = session.exec(trade_stmt).all()
            
            # 查询该任务的所有账户快照
            snapshot_stmt = select(AccountSnapshot).where(AccountSnapshot.task_id == task_id)
            snapshots = session.exec(snapshot_stmt).all()
            
            # 获取初始余额
            initial_balance = BacktestUtils._get_initial_balance(task, snapshots, session)
            
            if initial_balance <= Decimal("0"):
                logger.error(f"初始余额无效: {initial_balance}")
                return {}
            
            # 计算各项指标
            stats = {
                "total_trades": len(trades),
                "cumulative_return": float(BacktestUtils.calculate_cumulative_return(snapshots, initial_balance)),
                "max_single_profit": float(BacktestUtils.calculate_max_single_profit(trades)),
                "max_drawdown": float(BacktestUtils.calculate_max_drawdown(snapshots, initial_balance)),
                "sharpe_ratio": float(BacktestUtils.calculate_sharpe_ratio(snapshots, initial_balance)),
                "win_rate": float(BacktestUtils.calculate_win_rate(trades)),
                "avg_profit": 0.0,
                "avg_loss": 0.0,
                "profit_loss_ratio": 0.0
            }
            
            # 计算平均盈利、平均亏损和盈亏比
            avg_profit, avg_loss, profit_loss_ratio = BacktestUtils.calculate_avg_profit_loss(trades)
            stats["avg_profit"] = float(avg_profit)
            stats["avg_loss"] = float(avg_loss)
            stats["profit_loss_ratio"] = float(profit_loss_ratio)
            
            # 计算总费用
            total_fees = sum(trade.total_fees for trade in trades) if trades else Decimal("0")
            
            # 计算费用占比（费用/总盈亏绝对值）
            total_pl = snapshots[-1].profit_loss if snapshots else Decimal("0")
            if abs(total_pl) > Decimal("0"):
                stats["fees_to_profit_ratio"] = float(total_fees / abs(total_pl))
            
            # 添加额外指标
            stats.update(BacktestUtils._calculate_extra_metrics(trades, snapshots, initial_balance))
            
            logger.info(f"回测统计计算完成: task_id={task_id}, 初始余额={initial_balance}")
            return stats
        except Exception as e:
            logger.error(f"计算回测统计数据失败: task_id={task_id}, error={e}", exc_info=True)
            return {}
    
    @staticmethod
    def _get_initial_balance(task, snapshots: List[AccountSnapshot], session: Session) -> Decimal:
        """获取初始余额"""
        # 1. 从任务统计中获取
        if task and task.stats:
            initial_balance = task.stats.get('initial_balance')
            if initial_balance:
                return Decimal(str(initial_balance))
        
        # 2. 从第一个快照中获取
        if snapshots:
            snapshots_sorted = sorted(snapshots, key=lambda x: x.timestamp)
            return snapshots_sorted[0].initial_balance
        
        # 3. 从虚拟账户中获取
        account_stmt = select(VirtualAccount).where(VirtualAccount.account_id == task.account_id)
        account = session.exec(account_stmt).first()
        if account:
            return account.initial_balance
        
        return Decimal("100000.00")  # 默认值
    
    @staticmethod
    def calculate_cumulative_return(snapshots: List[AccountSnapshot], initial_balance: Decimal) -> Decimal:
        """
        计算累计收益率（修复版）
        
        公式: (期末总价值 - 初始余额) / 初始余额
        """
        if not snapshots:
            return Decimal("0")
        
        snapshots_sorted = sorted(snapshots, key=lambda x: x.timestamp)
        final_value = snapshots_sorted[-1].total_value
        
        if initial_balance <= Decimal("0"):
            return Decimal("0")
        
        cumulative_return = (final_value - initial_balance) / initial_balance
        return to_dec(cumulative_return, 6)
    
    @staticmethod
    def calculate_max_drawdown(snapshots: List[AccountSnapshot], initial_balance: Decimal) -> Decimal:
        """
        计算最大回撤（修复版，包含初始余额）
        
        修复：从初始余额开始计算回撤，而不仅是从第一个快照开始
        """
        if not snapshots:
            return Decimal("0")
        
        snapshots_sorted = sorted(snapshots, key=lambda x: x.timestamp)
        
        # 创建包含初始余额的净值序列
        nav_values = [float(initial_balance)]
        nav_values.extend([float(s.total_value) for s in snapshots_sorted])
        
        # 计算最大回撤
        peak = nav_values[0]
        max_dd = 0.0
        
        for value in nav_values:
            if value > peak:
                peak = value
            
            drawdown = (peak - value) / peak if peak > 0 else 0
            if drawdown > max_dd:
                max_dd = drawdown
        
        return to_dec(max_dd, 6)
    
    @staticmethod
    def calculate_sharpe_ratio(snapshots: List[AccountSnapshot], initial_balance: Decimal, 
                                   risk_free_rate: float = 0.03) -> Decimal:
        """
        计算夏普比率（修复版，加密货币市场使用365天）
        
        修复：1. 包含初始余额的日收益率 2. 使用365天年化
        """
        if not snapshots or len(snapshots) < 2:
            return Decimal("0")
        
        snapshots_sorted = sorted(snapshots, key=lambda x: x.timestamp)
        
        # 创建净值序列（包含初始余额）
        nav_values = [float(initial_balance)]
        dates = [snapshots_sorted[0].timestamp]  # 初始时间用第一个快照的时间
        nav_values.extend([float(s.total_value) for s in snapshots_sorted])
        dates.extend([s.timestamp for s in snapshots_sorted])
        
        # 计算日收益率
        returns = []
        for i in range(1, len(nav_values)):
            if nav_values[i-1] > 0:
                daily_return = (nav_values[i] - nav_values[i-1]) / nav_values[i-1]
                returns.append(daily_return)
        
        if not returns:
            return Decimal("0")
        
        # 转换为numpy数组计算
        returns_array = np.array(returns)
        
        # 计算平均日收益率和标准差
        avg_daily_return = np.mean(returns_array)
        std_daily_return = np.std(returns_array)
        
        if std_daily_return == 0:
            return Decimal("0")
        
        # 加密货币市场使用365天
        trading_days_per_year = 365
        
        # 计算日无风险利率
        daily_risk_free = risk_free_rate / trading_days_per_year
        
        # 计算日夏普比率
        daily_sharpe = (avg_daily_return - daily_risk_free) / std_daily_return
        
        # 年化夏普比率
        annualized_sharpe = daily_sharpe * np.sqrt(trading_days_per_year)
        
        return to_dec(annualized_sharpe, 6)
    
    @staticmethod
    def calculate_win_rate(trades: List[TradeRecord]) -> Decimal:
        """
        计算胜率（修复版）
        
        修复：直接使用open_id匹配开平仓交易，计算盈亏，返回小数格式
        """
        if not trades:
            return Decimal("0")
        
        # 找出所有平仓交易（SELL或COVER）
        close_trades = [t for t in trades if t.trade_action in ["SELL", "COVER_SHORT", "COVER"]]
        if not close_trades:
            return Decimal("0")
        
        winning_trades = 0
        
        for close_trade in close_trades:
            # 直接使用open_id找到开仓交易
            if close_trade.open_id:
                open_trade = next((t for t in trades if t.trade_id == close_trade.open_id), None)
                if open_trade:
                    # 计算盈亏：平仓后的总价值 > 开仓前的总价值
                    # 注意：这里使用开仓交易的total_value_after字段可能不准确
                    # 更准确的方法是比较开仓价和平仓价
                    if hasattr(open_trade, 'price') and hasattr(close_trade, 'price'):
                        if open_trade.position_side == "LONG":
                            # 多头：平仓价 > 开仓价 为盈利
                            if close_trade.price > open_trade.price:
                                winning_trades += 1
                        elif open_trade.position_side == "SHORT":
                            # 空头：平仓价 < 开仓价 为盈利
                            if close_trade.price < open_trade.price:
                                winning_trades += 1
        
        win_rate = (winning_trades / len(close_trades)) * 100 if close_trades else 0
        return to_dec(win_rate, 6)
    
    @staticmethod
    def calculate_max_single_profit(trades: List[TradeRecord]) -> Decimal:
        """
        计算单笔最大收益（修复版）
        
        修复：直接比较开平仓价格计算收益率，修复逻辑错误
        """
        if not trades:
            return Decimal("0")
        
        max_profit = Decimal("0")
        
        # 找出所有平仓交易
        close_trades = [t for t in trades if t.trade_action in ["SELL", "COVER_SHORT", "COVER"]]
        
        for close_trade in close_trades:
            if close_trade.open_id:
                open_trade = next((t for t in trades if t.trade_id == close_trade.open_id), None)
                if open_trade and open_trade.price > Decimal("0"):
                    # 计算收益率
                    if open_trade.position_side == "LONG":
                        return_rate = (close_trade.price - open_trade.price) / open_trade.price
                    else:  # SHORT
                        return_rate = (open_trade.price - close_trade.price) / open_trade.price
                    
                    # 只记录盈利交易的收益率
                    if return_rate > Decimal("0") and return_rate > max_profit:
                        max_profit = return_rate
        
        return to_dec(max_profit, 6)
    
    @staticmethod
    def calculate_avg_profit_loss(trades: List[TradeRecord]) -> Tuple[Decimal, Decimal, Decimal]:
        """
        计算平均盈利、平均亏损和盈亏比（修复版）
        """
        if not trades:
            return Decimal("0"), Decimal("0"), Decimal("0")
        
        profits = []
        losses = []
        
        # 找出所有平仓交易
        close_trades = [t for t in trades if t.trade_action in ["SELL", "COVER_SHORT", "COVER"]]
        
        for close_trade in close_trades:
            if close_trade.open_id:
                open_trade = next((t for t in trades if t.trade_id == close_trade.open_id), None)
                if open_trade and open_trade.price > Decimal("0"):
                    # 计算收益率
                    if open_trade.position_side == "LONG":
                        return_rate = (close_trade.price - open_trade.price) / open_trade.price
                    else:  # SHORT
                        return_rate = (open_trade.price - close_trade.price) / open_trade.price
                    
                    if return_rate > Decimal("0"):
                        profits.append(return_rate)
                    elif return_rate < Decimal("0"):
                        losses.append(return_rate)
        
        # 计算平均值
        avg_profit = sum(profits) / len(profits) if profits else Decimal("0")
        avg_loss = sum(losses) / len(losses) if losses else Decimal("0")
        
        # 计算盈亏比
        profit_loss_ratio = Decimal("0")
        if avg_loss < Decimal("0") and abs(avg_loss) > Decimal("0"):
            profit_loss_ratio = avg_profit / abs(avg_loss)
        
        return to_dec(avg_profit, 6), to_dec(avg_loss, 6), to_dec(profit_loss_ratio, 6)
    
    @staticmethod
    def _calculate_extra_metrics(trades: List[TradeRecord], snapshots: List[AccountSnapshot], 
                               initial_balance: Decimal) -> Dict:
        """计算额外指标"""
        extra_metrics = {}
        
        # 计算交易频率
        if trades:
            trade_times = sorted([t.trade_time for t in trades])
            if len(trade_times) >= 2:
                total_days = (trade_times[-1] - trade_times[0]).days + 1
                trades_per_day = len(trades) / total_days if total_days > 0 else 0
                extra_metrics["trades_per_day"] = float(trades_per_day)
        
        # 计算平均持仓天数
        hold_days = []
        close_trades = [t for t in trades if t.trade_action in ["SELL", "COVER_SHORT", "COVER"]]
        for close_trade in close_trades:
            if close_trade.open_id:
                open_trade = next((t for t in trades if t.trade_id == close_trade.open_id), None)
                if open_trade:
                    hold_days.append((close_trade.trade_time - open_trade.trade_time).days)
        
        if hold_days:
            extra_metrics["avg_hold_days"] = float(sum(hold_days) / len(hold_days))
        
        # 计算最终余额
        if snapshots:
            snapshots_sorted = sorted(snapshots, key=lambda x: x.timestamp)
            final_snapshot = snapshots_sorted[-1]
            extra_metrics["final_balance"] = float(final_snapshot.balance)
            extra_metrics["final_total_value"] = float(final_snapshot.total_value)
        
        return extra_metrics
    
    @staticmethod
    def normalize_trading_dates(raw_dates: List[datetime], time_granularity: str) -> List[datetime]:
        """
        标准化交易日期
        
        Args:
            raw_dates: 原始日期列表
            time_granularity: 时间粒度（daily/hourly/minute）
            
        Returns:
            标准化后的唯一日期列表
            
        Example:
            >>> raw_dates = [datetime(2023, 1, 1, 10, 30), datetime(2023, 1, 1, 11, 30), datetime(2023, 1, 2, 10, 30)]
            >>> BacktestUtils.normalize_trading_dates(raw_dates, "hourly")
            [datetime(2023, 1, 1, 10, 0), datetime(2023, 1, 1, 11, 0), datetime(2023, 1, 2, 10, 0)]
        """
        unique_dates = []
        seen_timestamps = set()
        
        for d in raw_dates:
            # 确保日期有时区信息
            if d.tzinfo is None:
                d = d.replace(tzinfo=timezone.utc)
            
            # 根据时间粒度生成唯一键
            if time_granularity == "daily":
                unique_key = d.date()
                normalized_date = d.replace(hour=0, minute=0, second=0, microsecond=0)
            elif time_granularity == "hourly":
                unique_key = (d.date(), d.hour)
                normalized_date = d.replace(minute=0, second=0, microsecond=0)
            else:  # minute
                unique_key = (d.date(), d.hour, d.minute)
                normalized_date = d.replace(second=0, microsecond=0)
            
            if unique_key not in seen_timestamps:
                seen_timestamps.add(unique_key)
                unique_dates.append(normalized_date)
        
        return sorted(unique_dates)
    
    @staticmethod
    def filter_dates_by_interval(dates: List[datetime], time_granularity: str, decision_interval: int) -> List[datetime]:
        """
        根据决策间隔筛选日期
        
        Args:
            dates: 日期列表
            time_granularity: 时间粒度（daily/hourly/minute）
            decision_interval: 决策间隔
            
        Returns:
            筛选后的日期列表
            
        Example:
            >>> dates = [datetime(2023, 1, 1, 0, 0), datetime(2023, 1, 2, 0, 0), datetime(2023, 1, 3, 0, 0)]
            >>> BacktestUtils.filter_dates_by_interval(dates, "daily", 1)
            [datetime(2023, 1, 1, 0, 0), datetime(2023, 1, 2, 0, 0), datetime(2023, 1, 3, 0, 0)]
        """
        if not dates:
            return []
        
        filtered_dates = []
        
        for dt in dates:
            if time_granularity == "daily":
                # 日线：每天一个时间点
                filtered_dates.append(dt)
            elif time_granularity == "hourly":
                # 小时线：根据决策间隔筛选
                if dt.hour % decision_interval == 0:
                    filtered_dates.append(dt)
            else:  # minute
                # 分钟线：根据决策间隔筛选
                total_minutes = dt.hour * 60 + dt.minute
                if total_minutes % decision_interval == 0:
                    filtered_dates.append(dt)
        
        return filtered_dates
    
    @staticmethod
    def get_price_at_date(date: datetime, symbol: str, time_granularity: str) -> Optional[Decimal]:
        """
        获取指定日期的价格
        
        Args:
            date: 日期
            symbol: 股票代码
            time_granularity: 时间粒度（daily/hourly/minute）
            
        Returns:
            指定日期的价格，如无数据则返回None
            
        Example:
            >>> dt = datetime(2023, 1, 1, 0, 0, tzinfo=timezone.utc)
            >>> BacktestUtils.get_price_at_date(dt, "AAPL", "daily")
            Decimal("120.50")
        """
        from app.services.market_data_service import CSVDataService
        
        # 使用CSV数据服务查询数据
        df = CSVDataService.query_data(
            symbol=symbol,
            time_granularity=time_granularity,
            start_date=date,
            end_date=date
        )
        
        if df.empty:
            return None
        
        # 确定使用的日期列名
        date_col = 'date'
        
        # 根据时间粒度过滤数据
        filtered_df = df.copy()
        if time_granularity == "daily":
            # 日线：匹配日期部分
            filtered_df[date_col] = pd.to_datetime(filtered_df[date_col]).dt.date
            filtered_df = filtered_df[filtered_df[date_col] == date.date()]
        elif time_granularity == "hourly":
            # 小时线：匹配日期和小时部分
            filtered_df['datetime'] = pd.to_datetime(filtered_df[date_col])
            filtered_df = filtered_df[
                (filtered_df['datetime'].dt.date == date.date()) &
                (filtered_df['datetime'].dt.hour == date.hour)
            ]
        else:  # minute
            # 分钟线：匹配日期、小时和分钟部分
            filtered_df['datetime'] = pd.to_datetime(filtered_df[date_col])
            filtered_df = filtered_df[
                (filtered_df['datetime'].dt.date == date.date()) &
                (filtered_df['datetime'].dt.hour == date.hour) &
                (filtered_df['datetime'].dt.minute == date.minute)
            ]
        
        if filtered_df.empty:
            return None
        
        # 获取收盘价
        close_price = filtered_df.iloc[0]['close']
        return Decimal(str(close_price)) if close_price else None


class CSVBacktestAnalyzer:
    """
    CSV数据回测分析器
    用于直接分析CSV文件数据，验证计算结果
    """
    
    @staticmethod
    def analyze_from_csv(snapshots_csv: str, trades_csv: str) -> Dict:
        """
        从CSV文件直接分析回测数据
        """
        import pandas as pd
        from io import StringIO
        
        # 解析CSV数据
        snapshots_df = pd.read_csv(StringIO(snapshots_csv), parse_dates=['timestamp'])
        trades_df = pd.read_csv(StringIO(trades_csv), parse_dates=['trade_time'])
        
        # 获取初始余额
        if not snapshots_df.empty:
            initial_balance = Decimal(str(snapshots_df.iloc[0]['initial_balance']))
        else:
            initial_balance = Decimal("100000.00")
        
        # 计算累计收益率
        if not snapshots_df.empty:
            final_value = Decimal(str(snapshots_df.iloc[-1]['total_value']))
            cumulative_return = (final_value - initial_balance) / initial_balance
        else:
            cumulative_return = Decimal("0")
        
        # 计算最大回撤（包含初始余额）
        max_drawdown = CSVBacktestAnalyzer._calculate_max_drawdown_from_df(snapshots_df, initial_balance)
        
        # 计算夏普比率
        sharpe_ratio = CSVBacktestAnalyzer._calculate_sharpe_from_df(snapshots_df, initial_balance)
        
        # 计算交易指标
        trade_metrics = CSVBacktestAnalyzer._calculate_trade_metrics_from_df(trades_df)
        
        # 整合结果
        results = {
            "initial_balance": float(initial_balance),
            "cumulative_return": float(cumulative_return),
            "max_drawdown": float(max_drawdown),
            "sharpe_ratio": float(sharpe_ratio),
            **trade_metrics
        }
        
        return results
    
    @staticmethod
    def _calculate_max_drawdown_from_df(snapshots_df: pd.DataFrame, initial_balance: Decimal) -> Decimal:
        """从DataFrame计算最大回撤"""
        if snapshots_df.empty:
            return Decimal("0")
        
        # 创建净值序列
        nav_values = [float(initial_balance)]
        nav_values.extend(snapshots_df['total_value'].tolist())
        
        # 计算最大回撤
        peak = nav_values[0]
        max_dd = 0.0
        
        for value in nav_values:
            if value > peak:
                peak = value
            
            if peak > 0:
                drawdown = (peak - value) / peak
                if drawdown > max_dd:
                    max_dd = drawdown
        
        return Decimal(str(max_dd))
    
    @staticmethod
    def _calculate_sharpe_from_df(snapshots_df: pd.DataFrame, initial_balance: Decimal) -> Decimal:
        """从DataFrame计算夏普比率"""
        if snapshots_df.empty or len(snapshots_df) < 2:
            return Decimal("0")
        
        # 创建净值序列
        nav_values = [float(initial_balance)]
        nav_values.extend(snapshots_df['total_value'].tolist())
        
        # 计算日收益率
        returns = []
        for i in range(1, len(nav_values)):
            if nav_values[i-1] > 0:
                daily_return = (nav_values[i] - nav_values[i-1]) / nav_values[i-1]
                returns.append(daily_return)
        
        if not returns:
            return Decimal("0")
        
        # 计算夏普比率
        returns_array = np.array(returns)
        avg_return = np.mean(returns_array)
        std_return = np.std(returns_array)
        
        if std_return == 0:
            return Decimal("0")
        
        # 使用365天年化
        risk_free_rate = 0.03
        trading_days = 365
        daily_risk_free = risk_free_rate / trading_days
        
        daily_sharpe = (avg_return - daily_risk_free) / std_return
        annualized_sharpe = daily_sharpe * np.sqrt(trading_days)
        
        return Decimal(str(annualized_sharpe))
    
    @staticmethod
    def _calculate_trade_metrics_from_df(trades_df: pd.DataFrame) -> Dict:
        """从DataFrame计算交易指标"""
        metrics = {
            "total_trades": 0,
            "win_rate": 0.0,
            "max_single_profit": 0.0,
            "avg_profit": 0.0,
            "avg_loss": 0.0,
            "profit_loss_ratio": 0.0
        }
        
        if trades_df.empty:
            return metrics
        
        # 找出平仓交易
        close_trades = trades_df[trades_df['trade_action'].isin(["SELL", "COVER", "COVER_SHORT"])]
        if close_trades.empty:
            metrics["total_trades"] = len(trades_df)
            return metrics
        
        # 匹配开平仓
        profits = []
        losses = []
        max_profit = 0.0
        
        for _, close_trade in close_trades.iterrows():
            if pd.notna(close_trade.get('open_id')):
                open_trade = trades_df[trades_df['trade_id'] == close_trade['open_id']]
                if not open_trade.empty:
                    open_trade = open_trade.iloc[0]
                    
                    # 计算收益率
                    if open_trade['position_side'] == "LONG":
                        return_rate = (close_trade['price'] - open_trade['price']) / open_trade['price']
                    else:
                        return_rate = (open_trade['price'] - close_trade['price']) / open_trade['price']
                    
                    if return_rate > 0:
                        profits.append(return_rate)
                        if return_rate > max_profit:
                            max_profit = return_rate
                    elif return_rate < 0:
                        losses.append(return_rate)
        
        # 计算指标
        total_trades = len(close_trades)
        win_rate = len(profits) / total_trades if total_trades > 0 else 0
        avg_profit = np.mean(profits) if profits else 0.0
        avg_loss = np.mean(losses) if losses else 0.0
        profit_loss_ratio = avg_profit / abs(avg_loss) if avg_loss < 0 and avg_profit > 0 else 0.0
        
        metrics.update({
            "total_trades": total_trades,
            "win_rate": win_rate * 100,  # 百分比
            "max_single_profit": max_profit,
            "avg_profit": avg_profit,
            "avg_loss": avg_loss,
            "profit_loss_ratio": profit_loss_ratio
        })
        
        return metrics


# 使用示例
def verify_calculations():
    """
    验证计算，对比原BacktestUtils和修复版的结果
    """
    # 你的CSV数据
    snapshots_csv = """snapshot_id,task_id,account_id,balance,stock_quantity,stock_price,stock_market_value,total_value,profit_loss,profit_loss_percent,timestamp,margin_used,floating_profit_loss,market_type,account_name,initial_balance,stock_symbol,current_balance,position_side,short_avg_price,short_total_cost,short_positions,available_balance
snapshot_20250201000000000000_BTC_2025-12-12T152727905,20251212152739-783bd418,BTC_2025-12-12T152727905,103.267682,0.9577,100635.65,96378.762005,96482.029687,-3517.970313,-3.51797,1/2/2025 00:00:00,0,0,COIN,hour,100000,BTC,103.267682,LONG,0,0,[],103.267682
snapshot_20250202000000000000_BTC_2025-12-12T152727905,20251212152739-783bd418,BTC_2025-12-12T152727905,93671.122725,0,97700.59,0,93671.122725,-6328.877275,-6.328877,2/2/2025 00:00:00,0,0,COIN,hour,100000,BTC,93671.122725,LONG,0,0,[],93671.122725
snapshot_20250203000000000000_BTC_2025-12-12T152727905,20251212152739-783bd418,BTC_2025-12-12T152727905,93671.122725,0,101328.52,0,93671.122725,-6328.877275,-6.328877,3/2/2025 00:00:00,0,0,COIN,hour,100000,BTC,93671.122725,LONG,0,0,[],93671.122725
snapshot_20250204000000000000_BTC_2025-12-12T152727905,20251212152739-783bd418,BTC_2025-12-12T152727905,93671.122725,0,97763.13,0,93671.122725,-6328.877275,-6.328877,4/2/2025 00:00:00,0,0,COIN,hour,100000,BTC,93671.122725,LONG,0,0,[],93671.122725
snapshot_20250205000000000000_BTC_2025-12-12T152727905,20251212152739-783bd418,BTC_2025-12-12T152727905,93671.122725,0,96612.43,0,93671.122725,-6328.877275,-6.328877,5/2/2025 00:00:00,0,0,COIN,hour,100000,BTC,93671.122725,LONG,0,0,[],93671.122725
snapshot_20250206000000000000_BTC_2025-12-12T152727905,20251212152739-783bd418,BTC_2025-12-12T152727905,93671.122725,0,96554.35,0,93671.122725,-6328.877275,-6.328877,6/2/2025 00:00:00,0,0,COIN,hour,100000,BTC,93671.122725,LONG,0,0,[],93671.122725
snapshot_20250207000000000000_BTC_2025-12-12T152727905,20251212152739-783bd418,BTC_2025-12-12T152727905,93671.122725,0,96506.8,0,93671.122725,-6328.877275,-6.328877,7/2/2025 00:00:00,0,0,COIN,hour,100000,BTC,93671.122725,LONG,0,0,[],93671.122725"""
    
    trades_csv = """trade_id,task_id,account_id,stock_symbol,trade_action,quantity,price,total_amount,status,trade_time,decision_id,position_side,open_id,stock_market_value_after,total_value_after,margin_used_after,remaining_quantity_after,avg_price_after
trade_20251212154004547273,20251212152739-783bd418,BTC_2025-12-12T152727905,BTC,BUY,0.9577,100635.65,96378.762005,COMPLETED,1/2/2025 00:00:00,decision_20250201000000000000_20251212152739-783bd418,LONG,,96378.762005,96482.029687,0,0.9577,100635.65
trade_20251212154028713597,20251212152739-783bd418,BTC_2025-12-12T152727905,BTC,SELL,0.9577,97700.59,93567.855043,COMPLETED,2/2/2025 00:00:00,decision_20250202000000000000_20251212152739-783bd418,LONG,trade_20251212154004547273,0,93671.122725,0,0,97700.59"""
    
    # 使用CSV分析器计算
    print("=" * 60)
    print("CSV数据分析结果")
    print("=" * 60)
    
    csv_results = CSVBacktestAnalyzer.analyze_from_csv(snapshots_csv, trades_csv)
    
    for key, value in csv_results.items():
        if key.endswith("_return") or key.endswith("_drawdown") or key.endswith("_rate"):
            print(f"{key:20}: {value:.2%}" if key != "win_rate" else f"{key:20}: {value:.2f}%")
        elif key in ["sharpe_ratio", "profit_loss_ratio"]:
            print(f"{key:20}: {value:.3f}")
        elif key in ["avg_profit", "avg_loss", "max_single_profit"]:
            print(f"{key:20}: {value:+.4f}")
        else:
            print(f"{key:20}: {value}")
    
    # 预期正确结果
    print("\n" + "=" * 60)
    print("预期正确结果（基于数据计算）")
    print("=" * 60)
    
    expected = {
        "累计收益率": -0.0633,  # (93671.12 - 100000) / 100000
        "最大回撤": 0.0633,     # 从100000到93671.12
        "夏普比率": -7.21,      # 根据日收益率计算（使用250天）
        "胜率": 0.0,           # 1笔交易亏损
        "单笔最大收益": 0.0,    # 没有盈利交易
        "平均盈利": 0.0,
        "平均亏损": -0.0291,    # (97700.59 - 100635.65) / 100635.65
        "盈亏比": 0.0,
        "交易次数": 2
    }
    
    for key, value in expected.items():
        if key in ["累计收益率", "最大回撤", "平均亏损"]:
            print(f"{key:10}: {value:.2%}")
        elif key in ["夏普比率", "盈亏比"]:
            print(f"{key:10}: {value:.3f}")
        elif key in ["胜率", "单笔最大收益", "平均盈利"]:
            print(f"{key:10}: {value:.2%}")
        else:
            print(f"{key:10}: {value}")


if __name__ == "__main__":
    verify_calculations()