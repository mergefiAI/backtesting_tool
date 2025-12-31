from datetime import datetime
from decimal import Decimal
import pandas as pd
from app.services.custom.custom_zp_decision_agent import trading_decision


def test_trading_decision():
    # 创建测试数据
    data = {
        'date': pd.date_range(start='2023-01-01', periods=20, freq='D'),
        'open': [100 + i*2 for i in range(20)],
        'high': [105 + i*2 for i in range(20)],
        'low': [95 + i*2 for i in range(20)],
        'close': [102 + i*2 for i in range(20)],
        'close_5_sma': [100 + i*2 + 0.5 for i in range(20)]  # 模拟MA5数据
    }
    df = pd.DataFrame(data)

    # 模拟上下文数据
    cdata = {
        'market_data_df': df,
        'account': {
            'position_quantity': 0,
            'long_positions': [],
            'short_positions': []
        },
        'max_direct_buy': 100,
        'max_direct_sell': 100,
        'max_direct_short': 100,
        'max_direct_cover': 100,
        'max_reverse_buy': 100,
        'max_reverse_short': 100
    }

    # 测试决策函数
    result = trading_decision(cdata, Decimal('150'), datetime(2023, 1, 20))
    print(result)


if __name__ == "__main__":
    test_trading_decision()