/**
 * 时间粒度选择组件
 * 用于选择数据的时间粒度和标的
 */
import React, {useState} from 'react';
import { SYMBOLS, TIME_GRANULARITY_OPTIONS } from '../../constants/symbols'
interface TableSelectProps {
  csvData: any;
  onTableSelected: (timeGranularity: string, symbol: string) => void;
  onBack: () => void;
}

const TableSelect: React.FC<TableSelectProps> = ({ csvData, onTableSelected, onBack }) => {
  // 状态
  const [selectedTimeGranularity, setSelectedTimeGranularity] = useState<string>('');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTC');
  
  const symbols = SYMBOLS;
  
  // 支持的时间粒度列表
  const timeGranularities = TIME_GRANULARITY_OPTIONS;

  // 处理时间粒度选择变化
  const handleTimeGranularityChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const timeGranularity = event.target.value;
    setSelectedTimeGranularity(timeGranularity);
  };

  // 处理标的选择变化
  const handleSymbolChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSymbol(event.target.value);
  };

  // 处理下一步
  const handleNext = () => {
    if (selectedTimeGranularity) {
      onTableSelected(selectedTimeGranularity, selectedSymbol);
    }
  };

  return (
    <div className="table-select-container">
      <h3>步骤2：选择时间粒度</h3>
      
      <div className="csv-info">
        <p>📋 CSV文件信息：</p>
        <ul>
          <li>列数：{csvData?.columns?.length || 0}</li>
          <li>行数：{csvData?.total_rows || 0}</li>
        </ul>
      </div>

      <div className="select-container">
        <label htmlFor="time-granularity-select">选择时间粒度：</label>
        <select
          id="time-granularity-select"
          value={selectedTimeGranularity}
          onChange={handleTimeGranularityChange}
        >
          <option value="">请选择时间粒度</option>
          {timeGranularities.map((granularity) => (
            <option key={granularity.value} value={granularity.value}>{granularity.label}</option>
          ))}
        </select>
      </div>
      
      <div className="select-container">
        <label htmlFor="symbol-select">选择交易标的：</label>
        <select
          id="symbol-select"
          value={selectedSymbol}
          onChange={handleSymbolChange}
        >
          {symbols.map((symbol) => (
            <option key={symbol} value={symbol}>{symbol}</option>
          ))}
        </select>
      </div>

      <div className="action-buttons">
        <button onClick={onBack} className="back-button">上一步</button>
        <button 
          onClick={handleNext} 
          className="next-button"
          disabled={!selectedTimeGranularity}
        >
          下一步
        </button>
      </div>

      <style>{`
        .table-select-container {
          max-width: 800px;
          margin: 0 auto;
        }

        h3 {
          margin-bottom: 20px;
          color: #333;
          text-align: center;
        }

        .csv-info {
          background-color: #f0f2f5;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .csv-info ul {
          margin: 10px 0 0 20px;
          padding: 0;
        }

        .select-container {
          margin: 20px 0;
          display: flex;
          align-items: center;
        }

        .select-container label {
          margin-right: 10px;
          font-weight: bold;
        }

        .select-container select {
          padding: 8px 12px;
          border: 1px solid #d9d9d9;
          border-radius: 4px;
          font-size: 14px;
          width: 300px;
        }

        .action-buttons {
          display: flex;
          justify-content: space-between;
          margin-top: 30px;
        }

        .back-button,
        .next-button {
          padding: 10px 20px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-weight: bold;
        }

        .back-button {
          background-color: #f0f0f0;
          color: #333;
        }

        .back-button:hover {
          background-color: #e0e0e0;
        }

        .next-button {
          background-color: #1890ff;
          color: white;
        }

        .next-button:hover {
          background-color: #40a9ff;
        }

        .next-button:disabled {
          background-color: #d9d9d9;
          color: #bfbfbf;
          cursor: not-allowed;
        }

        .error-message {
          color: #ff4d4f;
          margin: 20px 0;
          padding: 10px;
          background-color: #fff2f0;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
};

export default TableSelect;