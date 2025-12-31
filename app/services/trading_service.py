"""
交易服务模块
"""
import traceback
from datetime import datetime
from decimal import ROUND_DOWN, ROUND_UP, Decimal, ROUND_HALF_UP
from typing import Dict, Any

from sqlmodel import Session

from app.models.enums import TradeAction
from app.models.models import VirtualAccount, AccountSnapshot, TradeRecord
from app.utils.calc_utils import to_dec
from app.utils.timestamp_utils import TimestampUtils
from cfg import logger

PRECISION_8 = Decimal('0.00000001')


def calculate_trading_fees(action: TradeAction, quantity: Decimal, price: Decimal, fee_config: Any) -> Dict[str, Decimal]:
    """
    计算交易费用
    
    Args:
        action: 交易动作
        quantity: 交易数量
        price: 交易价格
        fee_config: 费用配置对象（Task对象或字典）
        
    Returns:
        包含佣金、税费和总费用的字典
    """
    # 计算交易金额
    trade_amount = (quantity * price).quantize(Decimal('0.00000001'), rounding=ROUND_HALF_UP)
    
    # 获取费用参数并转换为Decimal类型
    commission_rate_buy = Decimal(str(fee_config.commission_rate_buy))
    commission_rate_sell = Decimal(str(fee_config.commission_rate_sell))
    tax_rate = Decimal(str(fee_config.tax_rate))
    min_commission = Decimal(str(fee_config.min_commission))
    
    # 根据交易类型选择佣金率
    if action in [TradeAction.BUY, TradeAction.COVER_SHORT]:  # 买入操作
        commission_rate = commission_rate_buy
        # 买入不收取印花税
        current_tax_rate = Decimal('0')
    else:  # 卖出操作 (SELL, SHORT_SELL)
        commission_rate = commission_rate_sell
        current_tax_rate = tax_rate
    
    # 计算佣金
    commission = (trade_amount * commission_rate).quantize(Decimal('0.00000001'), rounding=ROUND_HALF_UP)
    commission = max(commission, min_commission)
    
    # 计算税费（仅卖出时收取）
    # 注意：做空卖出也可能收取税费，取决于市场规则，这里默认收取
    tax = Decimal('0')
    if action in [TradeAction.SELL, TradeAction.SHORT_SELL]:
        tax = (trade_amount * current_tax_rate).quantize(Decimal('0.00000001'), rounding=ROUND_HALF_UP)
    
    # 计算总费用
    total_fees = commission + tax
    
    # 量化结果
    return {
        'commission': commission,
        'tax': tax,
        'total_fees': total_fees
    }

def update_account_for_trade(
    account: VirtualAccount, 
    action: TradeAction, 
    quantity: Decimal, 
    price: Decimal,
    fees: Dict[str, Decimal] = None,
    session: Session = None
):
    """
    交易后更新账户信息
    
    Args:
        account: 虚拟账户   
        action: 交易动作
        quantity: 交易数量（Decimal）
        price: 交易价格（Decimal）
        fees: 交易费用字典 {'total_fees': Decimal, ...}
        session: 数据库会话对象，如果提供则自动保存并刷新账户
    """
    # 如果没有提供费用，默认为0
    total_fees = fees.get('total_fees', Decimal('0')) if fees else Decimal('0')
    
    # 使用高精度进行中间计算，避免多次量化造成的精度损失
    dec_qty = quantity
    dec_price = price
    trade_amount = (dec_qty * dec_price).quantize(Decimal('0.00000001'), rounding=ROUND_HALF_UP)
    logger.info(f"交易前账户状态: 现金={account.current_balance}, 持仓={account.stock_quantity}, 保证金={account.margin_used}")
    logger.info(f"交易参数: 动作={action}, 数量={quantity}, 价格={price}, 金额={trade_amount}")

    new_balance = account.current_balance
    new_quantity = account.stock_quantity
    # 初始化new_margin_used为当前账户的保证金占用，确保所有交易动作都能在此基础上正确更新
    new_margin_used = account.margin_used

    # 更新累计交易费用
    if fees:
        account.total_fees += total_fees

    if action == TradeAction.BUY:
        # 买入：减少现金，增加持仓
        # 检查资金是否足够（无交易费用，直接检查） # 检查资金是否足够（添加安全边际）
        required_amount = trade_amount + total_fees
        if account.current_balance < required_amount:
            raise ValueError(f"资金不足：需要 {required_amount} (含费用 {total_fees})，可用 {account.current_balance}")
            
        # 先进行精确计算，最后才量化
        # 扣除交易金额和费用
        new_balance = account.current_balance - trade_amount - total_fees

        new_quantity = account.stock_quantity + dec_qty
        
        # 只有空头持仓才需要保证金，多头持仓保证金占用=0
        new_margin_used = Decimal('0')
        
        # 记录新的多头持仓批次
        if not account.long_positions:
            account.long_positions = []
        account.long_positions.append({
            "price": str(price),
            "quantity": str(dec_qty),
            "total_amount": str(trade_amount),
            "open_time": TimestampUtils.to_utc_iso(TimestampUtils.now_utc())
        })
        
    elif action == TradeAction.SELL:
        # 卖出：增加现金，减少持仓
        # 增加交易金额，扣除费用
        new_balance = account.current_balance + trade_amount - total_fees

        new_quantity = account.stock_quantity - dec_qty
        
        # 确保卖出后持仓不为负（普通卖出不能变成空头）
        if new_quantity < Decimal('0'):
            raise ValueError(f"卖出数量超过持仓：持仓={account.stock_quantity}，卖出={dec_qty}")
        
        # 只有空头持仓才需要保证金，多头持仓或无持仓时保证金占用=0
        new_margin_used = Decimal('0')
        
        # 按FIFO规则平仓多头持仓
        remaining_quantity = dec_qty
        closed_positions = []
        
        if account.long_positions:
            # 创建副本进行遍历和修改
            positions = account.long_positions.copy()
            account.long_positions = []
            
            for pos in positions:
                if remaining_quantity <= Decimal('0'):
                    # 还有剩余仓位，添加回列表
                    account.long_positions.append(pos)
                    continue
                
                pos_quantity = Decimal(pos["quantity"])
                pos_price = Decimal(pos["price"])
                
                if remaining_quantity >= pos_quantity:
                    # 平仓整个仓位
                    remaining_quantity -= pos_quantity
                    closed_positions.append(pos)
                else:
                    # 平仓部分仓位
                    remaining_pos_quantity = pos_quantity - remaining_quantity
                    closed_positions.append({
                        "price": str(pos_price),
                        "quantity": str(remaining_quantity),
                        "total_amount": str(pos_price * remaining_quantity),
                        "open_time": pos["open_time"]
                    })
                    
                    # 更新剩余仓位
                    pos["quantity"] = str(remaining_pos_quantity)
                    pos["total_amount"] = str(pos_price * remaining_pos_quantity)
                    account.long_positions.append(pos)
                    
                    remaining_quantity = Decimal('0')
    
    elif action == TradeAction.SHORT_SELL:
        # 做空卖出：减少持仓（变为负数），冻结保证金
        # 100%保证金模式：保证金要求=标的市值×100%，无安全边际
        
        # 首先，根据当前股价更新保证金，确保计算准确
        # 这是修复多次做空时保证金计算错误的关键
        if account.stock_quantity < Decimal('0'):
            # 如果已经有空头持仓，先根据当前股价更新保证金
            current_market_value = account.stock_quantity * dec_price
            current_margin_used = abs(current_market_value).quantize(Decimal('0.00000001'), rounding=ROUND_UP)
            account.margin_used = current_margin_used
        
        margin_requirement = trade_amount  # 无安全边际，100%保证金下=标的市值
        
        # 100%保证金模式的核心逻辑：
        # 1. 当前可用资金 = 当前现金余额 - 当前已用保证金
        # 2. 每次做空时，新的保证金要求必须由当前可用资金支付
        # 3. 这个逻辑确保了总保证金永远不会超过当前可用资金
        # 4. 做空获得的资金会增加现金余额，但不会立即增加可用资金
        
        # 计算当前可用资金
        available_funds = account.available_balance - account.margin_used
        
        # 检查可用资金是否足够支付新的保证金要求和交易费用
        required_funds = margin_requirement + total_fees
        if available_funds < required_funds:
            raise ValueError(f"可用资金不足：需要 {required_funds} (含费用 {total_fees})，可用 {available_funds}")
        
        # 账户余额增加：获得卖出股票的资金，但要扣除费用
        new_balance = account.current_balance + trade_amount - total_fees
        # 持仓数量减少（变为负数）
        new_quantity = account.stock_quantity - dec_qty
        # 100%保证金模式：新的总保证金 = 当前保证金 + 新的保证金要求
        new_margin_used = account.margin_used + margin_requirement
        
        # 更新空头持仓信息
        new_total_cost, new_avg_price, released_margin = _update_short_positions(account, dec_price, dec_qty, action)
        account.short_total_cost = new_total_cost
        account.short_avg_price = new_avg_price
        
        # 立即更新保证金占用，而不是依赖后续的动态计算
        # 这确保了二次做空时可用资金计算正确
        account.margin_used = new_margin_used
    
    elif action == TradeAction.COVER_SHORT:
        # 买入平仓：减少现金，增加持仓（向0靠近），释放保证金
        # 检查空头持仓是否足够
        if account.stock_quantity + dec_qty > Decimal('0'):
            raise ValueError(f"平仓数量超过空头持仓：空头持仓={account.stock_quantity}，平仓={dec_qty}")
        
        # 实际市场中，平仓时需要支付现金买入股票归还，并支付费用
        # 账户余额减少：支付买入股票的资金和费用
        new_balance = account.current_balance - trade_amount - total_fees
        # 减少空头仓位（增加持仓数量）
        new_quantity = account.stock_quantity + dec_qty
        
        # 更新空头持仓信息，获取释放的保证金
        new_total_cost, new_avg_price, released_margin = _update_short_positions(account, dec_price, dec_qty, action)
        account.short_total_cost = new_total_cost
        account.short_avg_price = new_avg_price
        
        # 释放相应的保证金
        new_margin_used = account.margin_used - released_margin
        # 确保保证金不小于0
        new_margin_used = max(Decimal('0'), new_margin_used)
        
        # 盈利或亏损自动计算：
        # 做空盈利 = (卖出价格 - 买入价格) × 股数
        # 这个盈亏已经通过账户余额的变化反映出来了
        # 因为做空卖出时获得了资金（卖出价格 × 股数）
        # 平仓时支付了资金（买入价格 × 股数）
        # 所以账户余额的变化就是盈亏
    
    elif action == TradeAction.HOLD:
        # 持有：不更新现金总额，只更新持仓市值和账户状态
        # 持仓市值和账户总值会在后续统一计算
        # 保持持仓数量不变
        logger.info(f"执行HOLD动作 - 账户: {account.account_id}, 当前股价: {price}, 持仓数量: {account.stock_quantity}")
        new_quantity = account.stock_quantity
        
        # 100%保证金模式：HOLD动作时也需要根据当前股价更新保证金占用
        if new_quantity < Decimal('0'):
            # 只有空头持仓才需要保证金，保证金占用=当前标的市值（取绝对值）
            new_margin_used = abs(new_quantity * dec_price).quantize(Decimal('0.00000001'), rounding=ROUND_HALF_UP)
        else:
            # 多头持仓或无持仓：保证金占用=0
            new_margin_used = Decimal('0').quantize(Decimal('0.00000001'), rounding=ROUND_HALF_UP)
    
    # 统一在最后进行量化，允许负值持仓（空头）
    # 即使是HOLD动作，也重新赋值一次，确保数值格式正确
    account.stock_quantity = new_quantity.quantize(Decimal('0.00000001'), rounding=ROUND_HALF_UP)
    
    # 手动更新持仓方向，因为直接修改属性不会触发field_validator
    # 确保在所有情况下，position_side都与stock_quantity保持一致
    account.position_side = "LONG"  # 空仓时默认多头方向
    if account.stock_quantity < Decimal('0'):
        account.position_side = "SHORT"
    
    # 更新现金余额（仅在非HOLD动作时更新）
    if action != TradeAction.HOLD:
        # 计算账户余额：实际现金余额
        account.current_balance = max(Decimal('0'), new_balance.quantize(Decimal('0.00000001'), rounding=ROUND_HALF_UP))
    
    # 更新时间戳
    account.updated_at = TimestampUtils.now_utc_naive()
    
    # 保存原始成本价用于计算浮动盈亏
    original_stock_price = account.stock_price
    # stock_price表示当前股价，不是成本价，需要每次更新
    account.stock_price = dec_price.quantize(Decimal('0.00000001'), rounding=ROUND_HALF_UP)
    
    # 计算持仓市值（统一处理多头和空头）
    # 多头：positive quantity * price = positive market value
    # 空头：negative quantity * price = negative market value
    account.stock_market_value = (account.stock_quantity * dec_price).quantize(Decimal('0.00000001'), rounding=ROUND_HALF_UP)
    
    # 计算浮动盈亏（统一处理多头和空头）
    floating_pl = Decimal('0')
    if account.stock_quantity != Decimal('0'):
        if account.position_side == "SHORT":
            # 做空浮动盈亏 = (做空均价 - 当前价格) × 做空数量（取绝对值）
            short_quantity = abs(account.stock_quantity)
            floating_pl = (account.short_avg_price - dec_price) * short_quantity
        else:
            # 多头浮动盈亏 = (当前价格 - 平均持仓成本) × 持仓数量
            # 计算多头平均持仓成本
            if account.long_positions:
                total_cost = Decimal('0')
                total_quantity = Decimal('0')
                for pos in account.long_positions:
                    total_cost += Decimal(pos["total_amount"])
                    total_quantity += Decimal(pos["quantity"])
                if total_quantity > Decimal('0'):
                    avg_cost = total_cost / total_quantity
                    floating_pl = (dec_price - avg_cost) * account.stock_quantity
            else:
                # 使用更新前的原始成本价作为备选
                floating_pl = (dec_price - original_stock_price) * account.stock_quantity
    
    # 100%保证金模式：动态计算保证金占用
    if account.stock_quantity < Decimal('0'):
        # 空头持仓：保证金占用=当前标的市值（取绝对值）
        account.margin_used = abs(account.stock_market_value).quantize(Decimal('0.00000001'), rounding=ROUND_HALF_UP)
    else:
        # 多头持仓或无持仓：保证金占用=0
        account.margin_used = Decimal('0').quantize(Decimal('0.00000001'), rounding=ROUND_HALF_UP)
    
    # 统一计算账户总资产：总资产 = 现金 + 持仓市值
    # 对于空头：持仓市值为负数，已经反映了空头盈亏
    # 浮动盈亏已经包含在持仓市值中，不需要单独添加
    account.total_value = (account.current_balance + account.stock_market_value).quantize(Decimal('0.00000001'), rounding=ROUND_HALF_UP)
    
    # 100%保证金模式：可用资金计算
    # 做空状态下：可用资金 = 现金余额 - 持仓市值（冻结保证金）
    # 多头/无持仓：可用资金 = 现金余额
    if account.stock_quantity < Decimal('0'):
        account.available_balance = (account.current_balance - abs(account.stock_market_value)).quantize(PRECISION_8, rounding=ROUND_DOWN)
    else:
        account.available_balance = account.current_balance.quantize(PRECISION_8, rounding=ROUND_DOWN)
    
    if account.available_balance < Decimal('0'):
        account.available_balance = Decimal('0')
    
    logger.info(f"账户 {account.account_id} 交易后更新: 可用现金={account.current_balance:.8f}, 持仓={account.stock_quantity:.8f}, 保证金占用={account.margin_used:.8f}, 可用资金={account.available_balance:.8f}, 浮动盈亏={floating_pl:.8f}, 总价值={account.total_value:.8f}")
    logger.info(f"空头持仓信息: 总成本={account.short_total_cost:.8f}, 均价={account.short_avg_price:.8f}, 持仓明细={account.short_positions}")
    
    # 如果提供了会话对象，保存并刷新账户
    if session:
        session.add(account)
        session.commit()
        session.refresh(account)
        logger.info(f"账户 {account.account_id} 已保存并刷新")

def create_account_snapshot(account: VirtualAccount, current_time: datetime = datetime.now(), task_id: str | None = None, session: Session = None, price: Decimal = None):
    """
    创建账户快照
    
    Args:
        account: 虚拟账户
        current_time: 快照时间
        task_id: 回测ID
        session: 数据库会话对象
        price: 当前股价
    """
    # 保存旧值用于记录变化
    old_market_value = account.stock_market_value
    old_total_value = account.total_value

    # 生成快照ID
    naive_current = TimestampUtils.ensure_utc_naive(current_time)
    snapshot_id = f"snapshot_{naive_current.strftime('%Y%m%d%H%M%S%f')}_{account.account_id}"
    
    # 在创建新快照前，先删除已存在的相同snapshot_id记录
    from sqlmodel import delete
    delete_stmt = delete(AccountSnapshot).where(AccountSnapshot.snapshot_id == snapshot_id)
    session.exec(delete_stmt)

    # 使用传入的price参数作为当前股价，如果没有传入则使用账户的stock_price
    snapshot_stock_price = price if price is not None else account.stock_price
    
    # 根据新的股价重新计算持仓市值和总价值
    # 这是修复的核心：确保快照中的市值和总值基于最新股价
    # 基于新股价计算新的持仓市值
    new_stock_market_value = (account.stock_quantity * snapshot_stock_price).quantize(Decimal('0.00000001'), rounding=ROUND_HALF_UP)
    # 基于新持仓市值计算新的总价值
    new_total_value = (account.current_balance + new_stock_market_value).quantize(Decimal('0.00000001'), rounding=ROUND_HALF_UP)
    # 计算盈亏
    profit_loss = new_total_value - account.initial_balance
    profit_loss_percent = (profit_loss / account.initial_balance * Decimal('100')) if account.initial_balance > Decimal('0') else Decimal('0')
    
    # 直接使用账户当前状态创建快照，不进行额外计算
    # 所有计算逻辑已在update_account_after_trade中完成
    snapshot = AccountSnapshot(
        snapshot_id=snapshot_id,
        task_id=task_id,
        account_id=account.account_id,
        market_type=account.market_type,
        initial_balance=account.initial_balance,
        current_balance=account.current_balance,
        balance=account.current_balance,
        stock_symbol=account.stock_symbol,
        stock_quantity=account.stock_quantity,
        stock_price=snapshot_stock_price,
        stock_market_value=new_stock_market_value,
        total_value=new_total_value,
        profit_loss=profit_loss,
        profit_loss_percent=profit_loss_percent,
        timestamp=naive_current,
        margin_used=account.margin_used,
        position_side=account.position_side,
        short_avg_price=account.short_avg_price,
        short_total_cost=account.short_total_cost,
        short_positions=account.short_positions,
        long_positions=account.long_positions,
        available_balance=account.available_balance,
        total_fees=account.total_fees
    )
    session.add(snapshot)
    
    # 更新账户时间戳
    account.updated_at = naive_current
    session.add(account)
    
    # 记录更新信息
    market_value_change = account.stock_market_value - old_market_value
    total_value_change = account.total_value - old_total_value
        
    logger.info(
        f"账户 {account.account_id} 快照创建完成: "
        f"股价={account.stock_price}, "
        f"持仓={account.stock_quantity}, "
        f"保证金占用={float(account.margin_used):.2f}, "
        f"可用资金={float(account.available_balance):.2f}, "
        f"市值={float(account.stock_market_value):.2f}, "
        f"市值变化={market_value_change:+.2f}, "
        f"总价值变化={total_value_change:+.2f}, "
        f"总资产={float(account.total_value):.2f}"
    )

def _update_short_positions(account: VirtualAccount, price: Decimal, quantity: Decimal, action: TradeAction) -> tuple[Decimal, Decimal, Decimal]:
    """
    更新空头持仓信息

    Args:
        account: 虚拟账户
        price: 交易价格
        quantity: 交易数量
        action: 交易动作

    Returns:
        (新的总成本, 新的均价, 释放的保证金)
    """
    short_quantity = abs(account.stock_quantity)
    current_total_cost = account.short_total_cost
    current_avg_price = account.short_avg_price
    released_margin = Decimal('0')
    
    if action == TradeAction.SHORT_SELL:
        # 做空卖出：新增空头持仓
        new_total_cost = current_total_cost + (price * quantity)
        new_total_quantity = short_quantity + quantity
        new_avg_price = new_total_cost / new_total_quantity if new_total_quantity > Decimal('0') else Decimal('0')
        
        # 更新空头持仓明细
        if not account.short_positions:
            account.short_positions = []
        
        # 添加新的空头持仓记录
        # 100%保证金模式：保证金占用=开仓市值
        account.short_positions.append({
            "price": str(price),
            "quantity": str(quantity),
            "total_amount": str(price * quantity),
            "margin_used": str(price * quantity),  # 100%保证金下，开仓保证金=开仓市值
            "open_time": TimestampUtils.to_utc_iso(TimestampUtils.now_utc())
        })
        
        return new_total_cost, new_avg_price, released_margin
    elif action == TradeAction.COVER_SHORT:
        # 买入平仓：减少空头持仓（FIFO规则）
        remaining_quantity = quantity
        new_total_cost = current_total_cost
        closed_positions = []
        
        # 按FIFO规则平仓
        if account.short_positions:
            # 创建副本进行遍历和修改
            positions = account.short_positions.copy()
            account.short_positions = []
            
            for pos in positions:
                if remaining_quantity <= Decimal('0'):
                    # 还有剩余仓位，添加回列表
                    account.short_positions.append(pos)
                    continue
                
                pos_quantity = Decimal(pos["quantity"])
                pos_price = Decimal(pos["price"])
                pos_margin = Decimal(pos["margin_used"])
                
                if remaining_quantity >= pos_quantity:
                    # 平仓整个仓位
                    remaining_quantity -= pos_quantity
                    new_total_cost -= (pos_price * pos_quantity)
                    released_margin += pos_margin
                    closed_positions.append(pos)
                else:
                    # 平仓部分仓位
                    remaining_pos_quantity = pos_quantity - remaining_quantity
                    new_total_cost -= (pos_price * remaining_quantity)
                    released_margin += (pos_margin * remaining_quantity / pos_quantity)
                    
                    # 更新剩余仓位
                    pos["quantity"] = str(remaining_pos_quantity)
                    pos["total_amount"] = str(pos_price * remaining_pos_quantity)
                    pos["margin_used"] = str(pos_price * remaining_pos_quantity)  # 100%保证金下，剩余仓位保证金=剩余市值
                    account.short_positions.append(pos)
                    
                    remaining_quantity = Decimal('0')
        
        # 计算新的均价
        new_total_quantity = short_quantity - quantity
        new_avg_price = new_total_cost / new_total_quantity if new_total_quantity > Decimal('0') else Decimal('0')
        
        return new_total_cost, new_avg_price, released_margin
    
    return current_total_cost, current_avg_price, released_margin

def calculate_profit_loss(account: VirtualAccount, current_price: Decimal) -> tuple[Decimal, Decimal]:
    """
    计算盈亏金额和百分比
    
    Args:
        account: 虚拟账户
        current_price: 当前价格
        
    Returns:
        (盈亏金额, 盈亏百分比)
    """
    q8 = Decimal('0.00000001')
    initial_balance = account.initial_balance
    if initial_balance == Decimal('0'):
        return Decimal('0').quantize(q8), Decimal('0').quantize(q8)
    
    # 计算当前总价值（与update_account_after_trade函数保持一致）
    # 统一逻辑：当前总价值 = 现金 + 持仓市值
    # 持仓市值 = 持仓数量 × 当前价格
    # 多头：positive quantity * price = positive market value
    # 空头：negative quantity * price = negative market value
    current_market_value = (account.stock_quantity * current_price).quantize(q8, rounding=ROUND_HALF_UP)
    current_total = (account.current_balance + current_market_value).quantize(q8, rounding=ROUND_HALF_UP)
    
    # 计算盈亏金额和百分比
    profit_loss = (current_total - initial_balance).quantize(q8, rounding=ROUND_HALF_UP)
    profit_loss_percent = ((profit_loss / initial_balance) * Decimal('100')).quantize(q8, rounding=ROUND_HALF_UP)
    return profit_loss, profit_loss_percent

def validate_trade(account: VirtualAccount, action: TradeAction, quantity: Decimal, price: Decimal) -> bool:
    """
    验证交易是否可执行

    Args:
        account: 虚拟账户
        action: 交易动作
        quantity: 交易数量（Decimal）
        price: 交易价格（Decimal）  
        
    Returns:
        是否可执行
    """
    from app.services.trade_quantity_calculator import TradeQuantityCalculator
    
    logger.info(f"开始交易验证: 动作={action}, 数量={quantity}, 价格={price}")
    logger.info(f"当前账户状态: 余额={account.current_balance}, 持仓={account.stock_quantity}, 保证金={account.margin_used}, 可用余额={account.available_balance}")
    if action == TradeAction.HOLD:
        # HOLD动作：无需验证
        logger.info("HOLD动作验证通过")
        return True
    
    # 通用验证：价格必须大于0
    if price <= Decimal('0'):
        logger.warning(f"账户 {account.account_id} 交易价格必须大于0: {price}")
        return False
    
    # 通用验证：数量必须大于0（除了HOLD动作）
    if action != TradeAction.HOLD and quantity <= Decimal('0'):
        logger.warning(f"账户 {account.account_id} 交易数量必须大于0: {quantity}")
        return False
    
    
    # 使用TradeQuantityCalculator计算最大可交易数量
    calculator = TradeQuantityCalculator(account, price)
    max_trade_qty = calculator.calculate_max_trade_quantity(action)
    
    logger.info(f"交易验证: 动作={action}, 请求数量={quantity}, 最大可交易数量={max_trade_qty}")
    
    # 比较请求数量与最大可交易数量
    if quantity <= max_trade_qty:
        logger.info(f"交易验证通过: 请求数量({quantity}) <= 最大可交易数量({max_trade_qty})")
        return True
    else:
        logger.warning(f"账户 {account.account_id} 交易数量超过最大可交易数量: 请求={quantity}, 最大={max_trade_qty}")
        return False

def execute_trade(account: VirtualAccount, action: str, quantity: Decimal, decision_id: str, 
                   task_id: str | None = None, analysis_date: datetime | None = None, session: Session = None, price: Decimal = None) -> Dict[str, Any]:
    """
    执行完整交易流程
    
    Args:
        account: 虚拟账户
        action: 交易动作，buy/sell/short_sell/cover_short
        quantity: 交易数量
        decision_id: 决策ID
        task_id: 回测ID
        analysis_date: 分析日期
        session: 数据库会话对象
        price: 当前股价
        
    Returns:
        交易结果字典
    """
    logger.info(f"开始执行交易: action={action}, quantity={quantity}, price={price}, decision_id={decision_id}")
    try:
        # 归一化动作
        action = action.lower()
        logger.info(f"归一化交易动作: {action}")
        if action not in ["buy", "sell", "short_sell", "cover_short"]:
            error_msg = f"非法交易动作: {action}"
            logger.error(error_msg)
            return {"success": False, "error": error_msg}
        
        # 转换为枚举
        action_enum = TradeAction[action.upper()]
        logger.info(f"转换为交易枚举: {action_enum}")
        
        # 计算交易金额
        trade_amount = (quantity * price).quantize(Decimal('0.00000001'), rounding=ROUND_HALF_UP)
        logger.info(f"计算交易金额: {trade_amount}")
        
        # 计算交易费用
        logger.info("计算交易费用")
        fees = calculate_trading_fees(action_enum, quantity, price, account)
        logger.info(f"交易费用计算完成: {fees}")
        
        # 执行交易，传递费用信息
        logger.info("开始更新账户信息")
        update_account_for_trade(account, action_enum, quantity, price, fees)
        logger.info("账户信息更新完成")
        
        # 保存交易记录，传递费用信息
        trade_id = f"trade_{TimestampUtils.now_utc().strftime('%Y%m%d%H%M%S%f')}"
        logger.info(f"保存交易记录: trade_id={trade_id}")
        save_trade_record(
            account=account,
            symbol=account.stock_symbol,
            action=action_enum,
            quantity=quantity,
            price=price,
            trade_amount=trade_amount,
            order_id=trade_id,
            decision_id=decision_id,
            task_id=task_id,
            analysis_date=analysis_date,
            session=session,
            fees=fees
        )
        
        logger.info("提交数据库会话")
        session.commit()
        
        logger.info(f"交易执行成功: {action.upper()} {quantity} {account.stock_symbol} @ {price}")
        
        return {
            "success": True,
            "trade_id": trade_id,
            "action": action,
            "quantity": float(quantity),
            "price": float(price),
            "post_balance": float(account.current_balance),
            "post_quantity": float(account.stock_quantity)
        }
    except Exception as e:
        logger.error(f"交易执行失败: {e}")
        logger.error(f"异常详情: {traceback.format_exc()}")
        if session:
            logger.info("回滚数据库会话")
            session.rollback()
        return {"success": False, "error": str(e)}

def save_trade_record(account: VirtualAccount, symbol: str, action: TradeAction, quantity: Decimal, 
                    price: Decimal, trade_amount: Decimal, order_id: str, decision_id: str, 
                    task_id: str | None = None, analysis_date: datetime | None = None, session: Session = None, fees: Dict[str, Decimal] = None) -> None:
    """
    保存交易记录到数据库
    
    Args:
        account: 虚拟账户
        symbol: 股票代码
        action: 交易动作
        quantity: 交易数量
        price: 交易价格
        trade_amount: 交易金额
        order_id: 订单ID
        decision_id: 决策ID
        task_id: 回测ID
        analysis_date: 分析日期
        session: 数据库会话对象
        fees: 交易费用字典
    """
    try:
        # 使用与交易流程一致的同一会话，保障事务原子性
        q8 = Decimal(10) ** -8
        dec_qty = Decimal(str(quantity)).quantize(q8, rounding=ROUND_HALF_UP)
        dec_price = Decimal(str(price)).quantize(q8, rounding=ROUND_HALF_UP)
        dec_amount = Decimal(str(trade_amount)).quantize(q8, rounding=ROUND_HALF_UP)
        
        # 处理费用
        fees = fees or {}
        commission = fees.get('commission', Decimal('0')).quantize(q8, rounding=ROUND_HALF_UP)
        tax = fees.get('tax', Decimal('0')).quantize(q8, rounding=ROUND_HALF_UP)
        total_fees = fees.get('total_fees', Decimal('0')).quantize(q8, rounding=ROUND_HALF_UP)

        # 统一处理analysis_date，确保trade_time格式一致且为UTC时间
        unified_trade_time = TimestampUtils.ensure_utc_naive(analysis_date) if analysis_date else TimestampUtils.now_utc_naive()
        
        # 确定持仓方向
        if action in [TradeAction.BUY, TradeAction.SELL]:
            position_side = 'LONG'
        elif action in [TradeAction.SHORT_SELL, TradeAction.COVER_SHORT]:
            position_side = 'SHORT'
        else:
            position_side = 'LONG'  # 默认多头
        
        # 查找对应的开仓交易ID（仅针对平仓交易）
        open_id = None
        if action in [TradeAction.SELL, TradeAction.COVER_SHORT]:
            from sqlmodel import select
            # 根据持仓方向查找对应的开仓交易
            if action == TradeAction.SELL:  # 多头平仓
                # 查找最近的未平仓的买入交易
                stmt = select(TradeRecord).where(
                    TradeRecord.account_id == account.account_id,
                    TradeRecord.stock_symbol == symbol,
                    TradeRecord.trade_action == TradeAction.BUY.value,
                    TradeRecord.open_id == None  # 未被平仓的开仓交易
                ).order_by(TradeRecord.trade_time.desc())
            else:  # 空头平仓
                # 查找最近的未平仓的做空卖出交易
                stmt = select(TradeRecord).where(
                    TradeRecord.account_id == account.account_id,
                    TradeRecord.stock_symbol == symbol,
                    TradeRecord.trade_action == TradeAction.SHORT_SELL.value,
                    TradeRecord.open_id == None  # 未被平仓的开仓交易
                ).order_by(TradeRecord.trade_time.desc())
            
            result = session.exec(stmt)
            open_trade = result.first()
            if open_trade:
                open_id = open_trade.trade_id
        
        record = TradeRecord(
            trade_id=str(order_id) if order_id else f"trade_{TimestampUtils.now_utc().strftime('%Y%m%d%H%M%S%f')}",
            account_id=str(account.account_id),
            stock_symbol=str(symbol),
            trade_action=str(action.value),
            quantity=dec_qty,
            price=dec_price,
            total_amount=dec_amount,
            status="COMPLETED",
            trade_time=unified_trade_time,
            decision_id=str(decision_id) if decision_id else None,
            task_id=task_id,
            position_side=position_side,
            open_id=open_id,
            # 费用信息
            commission=commission,
            tax=tax,
            total_fees=total_fees,
            # 交易后的账户状态字段
            stock_market_value_after=account.stock_market_value,
            total_value_after=account.total_value,
            margin_used_after=account.margin_used,
            remaining_quantity_after=account.stock_quantity,
            avg_price_after=account.short_avg_price if position_side == 'SHORT' else account.stock_price
        )
        session.add(record)
        session.commit()
        logger.info(f"💾 交易记录: {symbol} {action.value} {dec_qty}@{dec_price} ({position_side})")
    except Exception as e:
        if session:
            try:
                session.rollback()
            except Exception:
                pass
        logger.error(f"❌ 保存交易记录失败: {symbol} - {e}")
        