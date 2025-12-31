"""
交易数量计算服务
负责计算各种交易类型的最大可交易数量
"""

from decimal import ROUND_UP, Decimal, ROUND_DOWN
from typing import Optional
from app.models.enums import TradeAction
from app.models.models import VirtualAccount
from cfg import logger

# 定义精度常量
PRECISION_8 = Decimal('0.00000001')


class TradeQuantityCalculator:
    """
    交易数量计算类，负责计算各种交易类型的最大可交易数量
    """
    
    def __init__(self, account: VirtualAccount, price: Decimal):
        self.account = account
        self.price = price
        logger.info(f"初始化交易数量计算器: 账户ID={account.account_id}, 股票代码={account.stock_symbol}, 当前价格={price}")
    
    def calculate_max_trade_quantity(self, base_action: TradeAction, opposite_action: TradeAction = None, 
                                    include_opposite_position: bool = False) -> Decimal:
        """
        计算最大交易数量的核心方法
        
        Args:
            base_action: 基础交易动作（如SHORT_SELL, BUY等）
            opposite_action: 相反方向的交易动作（用于反手交易，如SELL用于平仓多头）
            include_opposite_position: 是否包含相反方向的持仓数量
            
        Returns:
            最大可交易数量，精确到小数点8位
        """
        # 反手交易情况
        if base_action in [TradeAction.SHORT_SELL, TradeAction.SELL]:
            # 反手做空或平仓多头
            return self.calculate_max_reverse_short_quantity()
        elif base_action in [TradeAction.BUY, TradeAction.COVER_SHORT]:
            # 反手做多或平仓空头
            return self.calculate_max_reverse_buy_quantity()
    
    def calculate_max_direct_buy_quantity(self, available_funds: Optional[Decimal] = None) -> Decimal:
        """
        计算直接买入的最大可交易数量
        
        Returns:
            最大可买入数量，精确到小数点8位
        """
        from app.services.trading_service import calculate_trading_fees
        
        logger.info(f"开始计算直接买入最大数量: 账户ID={self.account.account_id}, 股票代码={self.account.stock_symbol}, 当前价格={self.price}")
        
        # 直接使用 available_balance 字段
        current_available_funds = available_funds if available_funds is not None else self.account.available_balance
        
        # 1. 预估最大交易数量（不考虑费用）
        estimated_max_qty = (current_available_funds / self.price).quantize(PRECISION_8, rounding=ROUND_UP)
        logger.info(f"步骤1: 预估最大买入数量（不考虑费用）={estimated_max_qty}, 当前可用资金={current_available_funds}")
        
        # 2. 计算买入交易的预估费用
        estimated_fees = calculate_trading_fees(TradeAction.BUY, estimated_max_qty, self.price, self.account)
        estimated_total_fees = estimated_fees['total_fees']
        logger.info(f"步骤2: 预估买入交易费用={estimated_total_fees}, 佣金={estimated_fees['commission']}, 税费={estimated_fees['tax']}")
        
        # 3. 计算需要预留的总费用
        # 预留费用 = 买入费用 + 最低佣金（作为安全缓冲）
        total_reserve_fees = estimated_total_fees + self.account.min_commission
        logger.info(f"步骤3: 计算预留总费用={total_reserve_fees}, 其中预估费用={estimated_total_fees}, 最低佣金={self.account.min_commission}")
        
        # 4. 计算最终可用资金
        final_usable_funds = current_available_funds - total_reserve_fees
        logger.info(f"步骤4: 计算最终可用资金={final_usable_funds}, 当前可用资金={current_available_funds}")
        
        # 5. 计算最终的最大买入数量，精确到小数点8位，使用舍弃法
        max_buy_qty = (final_usable_funds / self.price).quantize(PRECISION_8, rounding=ROUND_DOWN)
        logger.info(f"步骤5: 计算最终最大买入数量={max_buy_qty}")
        
        # 确保数量为正数
        result = max(Decimal('0'), max_buy_qty)
        logger.info(f"直接买入最大数量计算完成: 结果={result}")
        return result
    
    def calculate_max_direct_sell_quantity(self) -> Decimal:
        """
        计算直接卖出的最大可交易数量
        
        Returns:
            最大可卖出数量，精确到小数点8位
        """
        logger.info(f"开始计算直接卖出最大数量: 账户ID={self.account.account_id}, 股票代码={self.account.stock_symbol}, 当前价格={self.price}")
        
        max_sell_qty = self.account.stock_quantity
        logger.info(f"当前持仓数量={max_sell_qty}")
        
        if max_sell_qty <= Decimal('0'):
            logger.info("当前无多头持仓，直接返回0")
            return Decimal('0')
        
        logger.info(f"直接卖出最大数量计算完成: 结果={max_sell_qty}")
        return max_sell_qty
    
    def calculate_max_direct_short_sell_quantity(self) -> Decimal:
        """
        计算直接卖空的最大可交易数量
        支持一次做空和二次做空（追加做空）
        
        Returns:
            最大可卖空数量，精确到小数点8位
        """
        from app.services.trading_service import calculate_trading_fees
        
        logger.info(f"开始计算直接卖空最大数量: 账户ID={self.account.account_id}, 股票代码={self.account.stock_symbol}, 当前价格={self.price}")
        logger.info(f"当前账户状态: current_balance={self.account.current_balance}, available_balance={self.account.available_balance}, margin_used={self.account.margin_used}, stock_quantity={self.account.stock_quantity}")
        
        # 100%保证金模式：做空时可用资金 = available_balance - margin_used
        current_available_funds = self.account.available_balance - self.account.margin_used
        logger.info(f"做空: 当前可用资金 = {self.account.available_balance} - {self.account.margin_used} = {current_available_funds}")
        
        # 1. 预估最大交易数量（不考虑费用）
        # 100%保证金模式：最大可用资金 = 当前可用余额
        estimated_max_qty = (current_available_funds / self.price).quantize(PRECISION_8, rounding=ROUND_UP)
        logger.info(f"步骤1: 预估最大卖空数量（不考虑费用）={estimated_max_qty}, 当前可用资金={current_available_funds}")
        
        # 2. 计算卖空交易的预估费用
        estimated_fees = calculate_trading_fees(TradeAction.SHORT_SELL, estimated_max_qty, self.price, self.account)
        estimated_total_fees = estimated_fees['total_fees']
        logger.info(f"步骤2: 预估卖空交易费用={estimated_total_fees}, 佣金={estimated_fees['commission']}, 税费={estimated_fees['tax']}")
        
        # 3. 计算需要预留的总费用
        # 预留费用 = 卖空费用 + 最低佣金（作为安全缓冲）
        total_reserve_fees = estimated_total_fees + self.account.min_commission
        logger.info(f"步骤3: 计算预留总费用={total_reserve_fees}, 其中预估费用={estimated_total_fees}, 最低佣金={self.account.min_commission}")
        
        # 4. 计算最终可用资金
        final_usable_funds = current_available_funds - total_reserve_fees
        logger.info(f"步骤4: 计算最终可用资金={final_usable_funds}, 当前可用资金={current_available_funds}")
        
        # 5. 计算最终的最大卖空数量，精确到小数点8位，使用舍弃法
        max_short_qty = (final_usable_funds / self.price).quantize(PRECISION_8, rounding=ROUND_DOWN)
        logger.info(f"步骤5: 计算最终最大卖空数量={max_short_qty}")
        
        # 确保数量为正数
        result = max(Decimal('0'), max_short_qty)
        logger.info(f"直接卖空最大数量计算完成: 结果={result}")
        return result
    
    def calculate_max_direct_cover_short_quantity(self) -> Decimal:
        """
        计算直接平空的最大可交易数量
        
        Returns:
            最大可平仓空头数量，精确到小数点8位
        """
        logger.info(f"开始计算直接平仓空头最大数量: 账户ID={self.account.account_id}, 股票代码={self.account.stock_symbol}, 当前价格={self.price}")
        
        # 直接平空的最大数量受限于当前空头持仓数量
        logger.info(f"当前空头持仓数量={self.account.stock_quantity}")
        
        return abs(self.account.stock_quantity) if self.account.stock_quantity < Decimal('0') else Decimal('0')
        
    
    def calculate_max_reverse_short_quantity(self) -> Decimal:
        """
        计算反手做空的最大可交易数量
        流程：先平仓所有多头，再建立空头
        
        Returns:
            最大可反手做空数量，精确到小数点8位
        """
        from app.services.trading_service import calculate_trading_fees
        
        logger.info(f"开始计算反手做空最大数量: 账户ID={self.account.account_id}, 股票代码={self.account.stock_symbol}, 当前价格={self.price}")
        
        # 只有多头持仓才能反手做空
        if self.account.stock_quantity <= Decimal('0'):
            logger.info("没有多头持仓，直接计算做空数量")
            return self.calculate_max_direct_short_sell_quantity()
        
        # 当前多头持仓数量
        long_quantity = self.account.stock_quantity
        logger.info(f"当前多头持仓数量={long_quantity}")
        
        logger.info("步骤1: 计算平仓多头的交易费用")
        # 1. 计算平仓多头的交易费用
        close_long_fees = calculate_trading_fees(TradeAction.SELL, long_quantity, self.price, self.account)
        close_long_total_fees = close_long_fees['total_fees']
        logger.info(f"平仓多头总费用={close_long_total_fees}, 佣金={close_long_fees['commission']}, 税费={close_long_fees['tax']}")
        
        # 2. 平仓多头获得资金 = 持仓数量 × 当前价格 - 费用
        close_long_proceeds = ((long_quantity * self.price) - close_long_total_fees).quantize(PRECISION_8, rounding=ROUND_DOWN)
        logger.info(f"平仓多头获得资金={close_long_proceeds}, 持仓数量={long_quantity}, 当前价格={self.price}")
        
        # 3. 平仓后计算可用资金
        # 平仓后现金增加，但持仓变为0，可用资金 = current_balance + 平仓获得资金
        # 保证金变为0
        available_after_close = self.account.available_balance + close_long_proceeds
        logger.info(f"平仓后可用资金={available_after_close}, 平仓前现金={self.account.available_balance}")
        
        # 4. 计算剩余资金用于做空
        # 做空需要100%保证金
        usable_for_short = available_after_close
        logger.info(f"可用于做空的资金={usable_for_short}")
        
        # 5. 计算最大做空数量（保留费用）
        # 预留做空费用

        estimated_short_max_qty = (usable_for_short / self.price).quantize(PRECISION_8, rounding=ROUND_UP)
        logger.info(f"步骤5.1: 预估最大卖空数量（不考虑费用）={estimated_short_max_qty}, 当前可用资金={usable_for_short}")

        estimated_short_fees = calculate_trading_fees(TradeAction.SHORT_SELL, estimated_short_max_qty, self.price, self.account)
        total_reserve_fees = estimated_short_fees['total_fees'] + self.account.min_commission
        final_usable_funds = usable_for_short - total_reserve_fees
        logger.info(f"预留做空总费用={total_reserve_fees}, 最终可用做空资金={final_usable_funds}")
        
        # 6. 计算最终最大反手做空数量
        max_reverse_short_qty = (final_usable_funds / self.price).quantize(PRECISION_8, rounding=ROUND_DOWN) + self.account.stock_quantity
        logger.info(f"最终最大反手做空数量={max_reverse_short_qty}")
        
        result = max(Decimal('0'), max_reverse_short_qty)
        logger.info(f"反手做空最大数量计算完成: 结果={result}")
        return result
    
    def calculate_max_reverse_buy_quantity(self) -> Decimal:
        """
        计算反手做多的最大可交易数量
        流程：先平仓所有空头，再建立多头
        
        Returns:
            最大可反手做多数量，精确到小数点8位
        """
        from app.services.trading_service import calculate_trading_fees
        
        logger.info(f"开始计算反手做多最大数量: 账户ID={self.account.account_id}, 股票代码={self.account.stock_symbol}, 当前价格={self.price}")
        
        # 只有空头持仓才能反手做多
        if self.account.stock_quantity >= Decimal('0'):
            logger.info("没有空头持仓，直接计算做多数量")
            return self.calculate_max_direct_buy_quantity()
        
        # 当前空头持仓数量的绝对值
        short_quantity = abs(self.account.stock_quantity)
        logger.info(f"当前空头持仓数量={short_quantity}")
        
        logger.info("步骤1: 计算平仓空头的交易费用")
        # 1. 计算平仓空头的交易费用
        close_short_fees = calculate_trading_fees(TradeAction.COVER_SHORT, short_quantity, self.price, self.account)
        close_short_total_fees = close_short_fees['total_fees']
        logger.info(f"平仓空头总费用={close_short_total_fees}, 佣金={close_short_fees['commission']}, 税费={close_short_fees['tax']}")
        
        # 2. 平仓空头需要支付资金 = 持仓数量 × 当前价格 + 费用
        close_short_cost = ((short_quantity * self.price) + close_short_total_fees).quantize(PRECISION_8, rounding=ROUND_UP)
        logger.info(f"平仓空头需要资金={close_short_cost}, 持仓数量={short_quantity}, 当前价格={self.price}")
        
        # 3. 平仓后计算可用资金
        # 平仓后现金减少，但持仓变为0，可用资金 = current_balance - 平仓成本
        # 保证金释放
        available_after_close = (self.account.current_balance - close_short_cost).quantize(PRECISION_8, rounding=ROUND_DOWN)
        logger.info(f"平仓后可用资金={available_after_close}, 平仓前现金={self.account.current_balance}")
        
        # 4. 检查是否有足够资金平仓
        if self.account.current_balance < close_short_cost:
            logger.warning(f"资金不足，无法平仓空头，需要={close_short_cost}, 可用={self.account.current_balance}, 返回0")
            return Decimal('0')
        
        # 5. 计算剩余资金用于做多
        # 做多可用资金 = 平仓后可用资金 - 最低佣金预留
        usable_for_buy = (available_after_close - self.account.min_commission).quantize(PRECISION_8, rounding=ROUND_DOWN)
        logger.info(f"可用于做多的资金={usable_for_buy}")
        
        # 6. 计算最终最大反手做多数量
        max_direct_buy_qty = self.calculate_max_direct_buy_quantity(usable_for_buy)
        max_reverse_buy_qty = short_quantity + max_direct_buy_qty
        logger.info(f"最终最大反手做多数量={max_reverse_buy_qty}, 平仓空头数量={short_quantity}, 直接做多数量={max_direct_buy_qty}")
        
        result = max(Decimal('0'), max_reverse_buy_qty)
        logger.info(f"反手做多最大数量计算完成: 结果={result}")
        return result
    