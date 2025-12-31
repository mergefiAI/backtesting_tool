from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Dict

from app.models.models import VirtualAccount
from app.services.market_data_service import get_stock_market_data_unified, CSVDataService
from app.services.trade_quantity_calculator import TradeQuantityCalculator
from app.services.trend_data_service import get_trend_by_date
from cfg import logger


def get_decision_context_data(price: Decimal, account: VirtualAccount, analysis_date: datetime,
                              time_granularity: str) -> Dict[str, Any]:
    """
    获取决策所需的上下文数据
    """
    start_date_days = 30 if time_granularity == 'daily' else 2
    market_data = get_stock_market_data_unified(
        market_type='加密货币',
        ticker=account.stock_symbol,
        start_date=(analysis_date - timedelta(days=start_date_days)).strftime("%Y-%m-%d"),
        end_date=analysis_date.strftime("%Y-%m-%d"),
        time_granularity=time_granularity
    )
    # 补充获取df格式数据, 【注】测试结果，数据包含开始和结束日期
    market_data_df = CSVDataService.query_data(
        symbol=account.stock_symbol,
        time_granularity=time_granularity,
        start_date=analysis_date - timedelta(days=start_date_days),
        end_date=analysis_date
    )
    # 计算昨日日期
    lastday_date = analysis_date - timedelta(days=1)
    # 获取昨日趋势数据
    lastday_trend_data = get_trend_by_date(lastday_date, symbol=account.stock_symbol)
    lastday_trend = lastday_trend_data['trend'] if lastday_trend_data else "未知"
    logger.info(f"昨日趋势: {lastday_trend}")

    # 初始化交易数量计算器
    calculator = TradeQuantityCalculator(account, price)

    # 计算各种最大交易数量
    max_direct_buy = calculator.calculate_max_direct_buy_quantity()
    max_direct_sell = calculator.calculate_max_direct_sell_quantity()
    max_direct_short = calculator.calculate_max_direct_short_sell_quantity()
    max_direct_cover = calculator.calculate_max_direct_cover_short_quantity()
    max_reverse_buy = calculator.calculate_max_reverse_buy_quantity()
    max_reverse_short = calculator.calculate_max_reverse_short_quantity()

    # 构建上下文数据字典
    result = {
        # 分析日期
        "analysis_date": analysis_date,
        # 交易对
        "trading_pair": account.stock_symbol,
        # 当前价格
        "current_price": price,
        # 昨日趋势
        "lastday_trend": lastday_trend,
        # 账户信息
        "account": {
            # 币种代码，冗余，与trading_pair相同
            "stock_symbol": account.stock_symbol,
            # 当前余额
            "current_balance": account.current_balance,
            # 可用余额
            "available_balance": account.available_balance,
            # 持仓数量
            "position_quantity": account.stock_quantity,
            # 持仓方向
            "position_side": account.position_side,
            # 保证金占用
            "margin_used": account.margin_used,
            # 持仓均价
            "short_avg_price": account.short_avg_price,
            # 多头持仓明细
            "long_positions": account.long_positions,
            # 空头持仓明细
            "short_positions": account.short_positions,
        },

        # 最大可交易数量:直接做多
        "max_direct_buy": max_direct_buy,
        # 最大可交易数量:直接做空
        "max_direct_sell": max_direct_sell,
        # 最大可交易数量:直接卖空
        "max_direct_short": max_direct_short,
        # 最大可交易数量:直接平仓空头
        "max_direct_cover": max_direct_cover,
        # 最大可交易数量:反手做多
        "max_reverse_buy": max_reverse_buy,
        # 最大可交易数量:反手做空
        "max_reverse_short": max_reverse_short,

        # 市场数据
        "market_data": market_data,
        # 市场数据DataFrame格式
        "market_data_df": market_data_df,
    }
    # logger.info(result)
    return result
