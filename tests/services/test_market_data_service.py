from app.services.market_data_service import CSVDataService
from datetime import datetime, timezone
from cfg import logger

def test_query_data():
    start_date = datetime.strptime("2023-01-01", "%Y-%m-%d").replace(tzinfo=timezone.utc)
    end_date = datetime.strptime("2023-01-05", "%Y-%m-%d").replace(tzinfo=timezone.utc)
    df = CSVDataService.query_data(
        symbol="BTC",
        time_granularity="daily",
        start_date=start_date,
        end_date=end_date
    )
    # assert not df.empty
    if df is not None and not df.empty:
        logger.info(f"数据行数: {len(df)}")
        logger.info(f"Top 5 数据: \n{df.head(5).to_markdown(index=False)}")
        logger.info(f"完整数据: \n{df.to_markdown(index=False)}")
