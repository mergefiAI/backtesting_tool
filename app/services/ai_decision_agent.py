"""
基于LangChain Agent的AI决策服务
集成交易费用计算功能
"""

import json
import traceback
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_DOWN
from typing import Any, Dict, Optional, List, Tuple

from langchain.agents import create_agent
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import StructuredTool
from langchain_openai import ChatOpenAI
from pydantic import SecretStr
from sqlmodel import Session

import app.services.trading_service as trading_service
from app.models.enums import TradeAction
from app.models.models import VirtualAccount
# from app.services.market_data_service import get_stock_market_data_unified
# from app.services.trend_data_service import get_trend_by_date
# from app.services.trade_quantity_calculator import TradeQuantityCalculator
from app.services.context_data_util import get_decision_context_data
# 移除路径修改，避免重复导入
from cfg import logger

# 定义精度常量
PRECISION_8 = Decimal('0.00000001')



def _init_llm(ai_config_id: Optional[str] = None):
    """初始化LLM客户端"""
    from sqlmodel import Session, select
    from app.database import engine
    from app.models.models import AIConfig
    
    base_url = None
    api_key = None
    model_name = None
    
    try:
        with Session(engine) as session:
            ai_config = None
            
            # 如果提供了ai_config_id，从数据库获取对应的配置
            if ai_config_id:
                ai_config = session.get(AIConfig, ai_config_id)
                if ai_config:
                    logger.info(f"使用AI配置ID: {ai_config_id}, 模型: {ai_config.local_ai_model_name}")
            
            # 如果没有提供ai_config_id或者配置不存在，获取第一个可用配置
            if not ai_config:
                ai_config = session.exec(select(AIConfig)).first()
                if ai_config:
                    logger.info(f"使用默认AI配置: {ai_config.config_id}, 模型: {ai_config.local_ai_model_name}")
            
            # 如果找到了配置，使用配置值
            if ai_config:
                base_url = ai_config.local_ai_base_url
                api_key = ai_config.local_ai_api_key
                model_name = ai_config.local_ai_model_name
    except Exception as e:
        logger.error(f"获取AI配置失败: {e}")
    
    if not base_url or not api_key:
        raise ValueError("本地AI服务配置不完整，请先在系统中创建AI配置")
    
    return ChatOpenAI(
        base_url=base_url,
        api_key=SecretStr(api_key),
        model=model_name,
        temperature=0.0
    )


def _get_decision_id(analysis_date: datetime, task_id: str | None) -> str:
    """获取决策ID"""
    decision_id = f"decision_{analysis_date.strftime('%Y%m%d%H%M%S%f')}_{task_id}"
    return decision_id


def _get_decision_context_data(price: Decimal, account: VirtualAccount, analysis_date: datetime,
                               time_granularity: str) -> str:
    """
    获取决策所需的上下文数据，直接返回格式化文本
    """
    cdata = get_decision_context_data(price, account, analysis_date, time_granularity)
    account = cdata.get("account", {})
    # 直接返回格式化文本
    result = f"""
    ** 上下文信息 **
 *** [分析日期]: {analysis_date} ***
 *** [交易对]: {cdata.get("trading_pair")+"/USDT"} ***
 *** [当前价格]: {cdata.get("current_price")} ***
 *** [昨日趋势]: {cdata.get("lastday_trend")} ***
 *** [账户当前余额]: {account.get("current_balance")} ***
 *** [账户可用余额]: {account.get("available_balance")} ***
 *** [账户持仓数量]: {account.get("stock_quantity")} ***
 *** [账户持仓方向]: {account.get("position_side")} ***
 *** [账户保证金占用]: {account.get("margin_used")} ***
 *** [账户持仓均价]: {account.get("short_avg_price")} ***
 *** [账户多头持仓明细]: {account.get("long_positions")} ***
 *** [账户空头持仓明细]: {account.get("short_positions")} ***
 *** [直接做多最大可交易数量]: {cdata.get("max_direct_buy")} ***
 *** [直接做空最大可交易数量]: {cdata.get("max_direct_sell")} ***
 *** [直接卖空最大可交易数量]: {cdata.get("max_direct_short")} ***
 *** [直接平仓空头最大可交易数量]: {cdata.get("max_direct_cover")} ***
 *** [反手做多最大可交易数量]: {cdata.get("max_reverse_buy")} ***
 *** [反手做空最大可交易数量]: {cdata.get("max_reverse_short")} ***
{cdata.get("market_data")}"""
    logger.info(result)
    return result


def execute_decision(account: VirtualAccount, price: Decimal, session: Session, task_id: str | None = None,
                     user_prompt: str | None = None, analysis_date: datetime | None = None,
                     time_granularity: str = "daily", ai_config_id: Optional[str] = None) -> tuple[Dict[str, Any], str]:
    """执行决策"""
    try:
        logger.info(f"AI决策开始: {account.stock_symbol} @ {price}")
        decision_id = _get_decision_id(analysis_date, task_id)
        logger.info(f"决策ID: {decision_id}")
        
        # 初始化LLM客户端
        llm = _init_llm(ai_config_id)
        
        # 定义验证工具
        def validate_trade_wrapper(action: str, quantity: float, trade_price: Optional[float] = None) -> str:
            """
            验证拟议的交易是否可行。
            Args:
                action: 交易动作 (BUY, SELL, SHORT_SELL, COVER_SHORT)。
                quantity: 交易数量。
                trade_price: 可选价格。如果未提供，则使用当前市场价格。
            """
            try:
                # 转换输入
                action_enum = TradeAction[action.upper()]
                qty_dec = Decimal(str(quantity))
                price_dec = Decimal(str(trade_price)) if trade_price is not None else price
                
                is_valid = trading_service.validate_trade(account, action_enum, qty_dec, price_dec)
                return "Valid" if is_valid else "Invalid: Check logs for details (likely insufficient funds or positions)"
            except Exception as e:
                return f"Validation Error: {str(e)}"

        validate_tool = StructuredTool.from_function(
            func=validate_trade_wrapper,
            name="validate_trade",
            description="Validate if a trade action is feasible given the current account balance and positions."
        )
        
        # 定义上下文获取工具
        def get_market_context_wrapper() -> str:
            """
            获取当前市场和账户的上下文信息。
            Returns:
                包含市场数据、账户状态等信息的格式化字符串。
            """
            logger.info(f"获取市场上下文: {account.stock_symbol} @ {price}")
            try:
                # 直接调用_get_decision_context_data获取格式化文本
                return _get_decision_context_data(price, account, analysis_date, time_granularity)
            except Exception as e:
                return f"Error getting market context: {str(e)}"

        context_tool = StructuredTool.from_function(
            func=get_market_context_wrapper,
            name="get_market_context",
            description="Get current market context including price, account status, and market data."
        )
        
        # 设置输入提示词
        input_prompt = user_prompt
        logger.debug(f"输入提示: {input_prompt}")
        # 创建配置对象来设置递归限制
        config = RunnableConfig(recursion_limit=50)
        logger.info(f"决策开始-----------------------: {decision_id}")
        
        # 初始化Agent，只添加必要的工具
        agent_executor = create_agent(model=llm, tools=[
            validate_tool, 
            context_tool, 
        ])
        
        # 使用配置对象调用agent
        executor_response = agent_executor.invoke(
            {"messages": [{"role": "user", "content": input_prompt}]},
            config=config
        )
        logger.info(f"决策结束-----------------------: {decision_id}")
        
        logger.debug(f"LLM响应类型: {type(executor_response)}")
        logger.debug(f"LLM响应: {executor_response['messages'][-1]}")
        
        content = executor_response["messages"][-1].content
        if content.startswith('```json'):
            content = content[7:]  # 去掉开头的```json
        elif content.startswith('```'):
            content = content[3:]
        if content.endswith('```'):
            content = content[:-3]
        
        # 去掉前后空白字符
        content = content.strip()
        response = json.loads(content)
        
        # {'action': 'BUY', 'quantity': 0.27315489, 'price': 109686.515398019, 'confidence': 0.8,
        # 'risk_level': 'HIGH', 'reasoning': '牛市趋势+信号强度高+MACD金叉且成交量放大'}
        logger.info(f"LLM响应内容: {response}")
        
        # 解析LLM返回的交易动作
        llm_action = response.get('action', 'HOLD').upper()
        quantity = Decimal(str(response.get('quantity', 0)))
        confidence = response.get('confidence', 0.0)
        risk_level = response.get('risk_level', 'UNKNOWN')
        reasoning = response.get('reasoning', '')

        logger.info(f"AI决策动作: {llm_action} 数量: {quantity} 置信度: {confidence}")

        # 获取当前持仓情况
        current_quantity = account.stock_quantity
        logger.info(f"当前持仓: {current_quantity} {account.stock_symbol}")

        # 验证交易
        logger.info(f"执行交易验证: llm_action={llm_action}, quantity={quantity}, price={price}")
        if not trading_service.validate_trade(account, llm_action, quantity, price):
            error_msg = f"交易验证失败: action={llm_action}, quantity={quantity}, price={price}"
            logger.error(error_msg)
            return {"success": False, "error": error_msg}
        logger.info("交易验证通过")

        def _map_decision_to_actions(current_qty: Decimal, llm_act: str,
                                     qty: Decimal) -> list[tuple[TradeAction, Decimal]]:
            """将AI决策映射为实际交易动作
            
            Args:
                current_qty: 当前持仓数量
                llm_act: AI返回的动作
                qty: AI建议的交易数量
                
            Returns:
                实际交易动作列表，每个元素为(动作类型, 交易数量)
            """
            actions = []
            llm_act = llm_act.upper()
            
            if llm_act == 'HOLD':
                # HOLD动作：不执行任何交易
                actions.append((TradeAction.HOLD, Decimal('0')))
                return actions
            
            if current_qty > 0:  # 当前持有多头
                if llm_act in ['BUY', 'COVER_SHORT']:
                    # 增加多头头寸
                    actions.append((TradeAction.BUY, qty))
                elif llm_act in ['SELL', 'SHORT_SELL']:
                    # 反向做空：先卖出多头，再建立空头
                    # qty是卖出多头和做空卖出的总和
                    # 1. 先卖出现有多头头寸
                    sell_qty = min(qty, current_qty)
                    actions.append((TradeAction.SELL, sell_qty))
                    # 2. 计算剩余可做空数量
                    short_qty = qty - sell_qty
                    if short_qty > 0:
                        actions.append((TradeAction.SHORT_SELL, short_qty))
            elif current_qty < 0:  # 当前持有空头
                if llm_act in ['BUY', 'COVER_SHORT']:
                    # 反向做多：先平仓空头，再建立多头
                    # qty是平仓空头和买入多头的总和
                    # 1. 先平仓当前空头头寸
                    cover_qty = min(qty, abs(current_qty))
                    actions.append((TradeAction.COVER_SHORT, cover_qty))
                    # 2. 计算剩余可买入数量
                    buy_qty = qty - cover_qty
                    if buy_qty > 0:
                        actions.append((TradeAction.BUY, buy_qty))
                elif llm_act in ['SELL', 'SHORT_SELL']:
                    # 增加空头头寸
                    actions.append((TradeAction.SHORT_SELL, qty))
            else:  # 当前无持仓
                if llm_act == 'BUY':
                    # 建立多头头寸
                    actions.append((TradeAction.BUY, qty))
                elif llm_act == 'SELL':
                    # 无持仓无法卖出，改为HOLD
                    actions.append((TradeAction.HOLD, Decimal('0')))
                elif llm_act == 'SHORT_SELL':
                    # 建立空头头寸
                    actions.append((TradeAction.SHORT_SELL, qty))
                elif llm_act == 'COVER_SHORT':
                    # 无空头无法平仓，改为HOLD
                    actions.append((TradeAction.HOLD, Decimal('0')))
            
            return actions
        
        # 根据当前持仓和LLM返回动作，确定实际执行的动作
        actual_actions = _map_decision_to_actions(current_quantity, llm_action, quantity)

        logger.info(f"实际执行动作: {[(action.name, qty) for action, qty in actual_actions]}")

        # 执行实际交易动作
        tool_result = {"success": True, "action": llm_action, "reasoning": reasoning,
                       "actual_actions": [action.name for action, _ in actual_actions]}
        try:
            for action_enum, action_quantity in actual_actions:
                if action_enum == TradeAction.HOLD:
                    # HOLD动作：更新账户信息但不执行交易
                    logger.info(f"执行HOLD动作，更新账户信息 - 股价: {price}, 账户: {account.account_id}")
                    trading_service.update_account_for_trade(
                        account=account,
                        action=TradeAction.HOLD,
                        quantity=Decimal('0'),
                        price=price,
                        session=session
                    )
                    logger.info(f"HOLD动作账户更新完成 - 股价: {account.stock_price}, "
                                f"持仓市值: {account.stock_market_value}, 总价值: {account.total_value}, "
                                f"保证金: {account.margin_used}")
                else:
                    # 调用交易服务执行交易
                    tool_result = trading_service.execute_trade(
                        account=account,
                        action=action_enum.name.lower(),
                        quantity=action_quantity,
                        decision_id=decision_id,
                        task_id=task_id,
                        analysis_date=analysis_date,
                        session=session,
                        price=price
                    )
                    
                    # 检查交易是否成功
                    if not tool_result.get('success', True):
                        logger.error(f"交易执行失败: {tool_result.get('error', '未知错误')}")
                        raise Exception(tool_result.get('error', '交易执行失败'))
            
            # 提交数据库会话以保存所有更新
            session.commit()
        except Exception as e:
            # 发生错误时回滚事务
            session.rollback()
            logger.error(f"交易执行失败: {e}")
            tool_result = {"success": False, "action": llm_action, "reasoning": reasoning, "error": str(e)}
        
        # 组装最终返回
        final_response = {
            "success": tool_result.get("success", True),
            "action": llm_action,
            "quantity": float(quantity),
            "price": float(price),
            "confidence": confidence,
            "risk_level": risk_level,
            "reasoning": reasoning,
            "tool_result": tool_result
        }
        
        logger.info(f"AI决策完成: {llm_action} (置信度: {confidence:.2f})")
        
        final_response["agent_response"] = {
            "input": input_prompt,
            "output": response
        }
        
        return final_response, decision_id
    except Exception as e:
        logger.error(f"AI决策失败: {account.stock_symbol} - {e}")
        logger.debug(f"异常详情: {traceback.format_exc()}")
        
        # 如果是在获取decision_id之前发生的错误，生成一个默认的
        if 'decision_id' not in locals():
            decision_id = f"decision_error_{datetime.now().strftime('%Y%m%d%H%M%S%f')}_error"
        
        return {
            "success": False,
            "action": "HOLD",
            "error": str(e),
            "confidence": 0.0,
            "reasoning": str(e)
        }, decision_id
    finally:
        # 确保无论是否发生异常，都会更新账户信息
        trading_service.update_account_for_trade(
            account=account,
            action=TradeAction.HOLD,
            quantity=Decimal('0'),
            price=price,
            session=session
        )
