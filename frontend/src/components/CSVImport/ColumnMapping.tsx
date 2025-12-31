/**
 * 列映射组件
 * 处理CSV列与数据库表列之间的映射
 */
import React, {useState} from 'react';

// 必需的映射字段（对应数据库表中的实际列名）
// symbol不需要用户映射，由系统自动处理
const REQUIRED_FIELDS = ['open', 'close', 'high', 'low', 'volume', 'date'];

interface ColumnMappingProps {
  csvData: any;
  timeGranularity: string;
  onMappingCompleted: (mapping: Record<string, string>) => void;
  onBack: () => void;
}

const ColumnMapping: React.FC<ColumnMappingProps> = ({ 
  csvData, 
  timeGranularity, 
  onMappingCompleted, 
  onBack 
}) => {
  // 映射状态
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 自动生成初始映射：将指定列直接映射到数据库列，忽略不需要的列
  React.useEffect(() => {
    if (csvData?.columns) {
      const autoMapping: Record<string, string> = {};
      
      csvData.columns.forEach((csvColumn: string) => {
        // 将CSV列名转为小写
        const csvColumnLower = csvColumn.toLowerCase();
        
        // 忽略不需要导入的列
        if (csvColumnLower === 'unix' || csvColumnLower.includes('symbol') || csvColumnLower.includes('tradecount')) {
          return; // 跳过这些列，不进行映射
        }
        
        // 简化的自动映射逻辑，直接映射指定列
        if (csvColumnLower === 'date' || csvColumnLower.includes('time') || csvColumnLower.includes('datetime')) {
          autoMapping[csvColumn] = 'date';
        } else if (csvColumnLower === 'open') {
          autoMapping[csvColumn] = 'open';
        } else if (csvColumnLower === 'high') {
          autoMapping[csvColumn] = 'high';
        } else if (csvColumnLower === 'low') {
          autoMapping[csvColumn] = 'low';
        } else if (csvColumnLower === 'close') {
          autoMapping[csvColumn] = 'close';
        } else if (csvColumnLower === 'volume usdt' || csvColumnLower === 'volume') {
          autoMapping[csvColumn] = 'volume';
        }
      });
      
      setMapping(autoMapping);
    }
  }, [csvData]);

  // 处理映射变化
  const handleMappingChange = (csvColumn: string, tableColumn: string) => {
    setMapping(prev => ({
      ...prev,
      [csvColumn]: tableColumn
    }));
  };

  // 验证映射
  const validateMapping = () => {
    // 检查是否所有必需字段都已映射
    const mappedFields = Object.values(mapping);
    const missingFields = REQUIRED_FIELDS.filter(field => !mappedFields.includes(field));
    
    if (missingFields.length > 0) {
      setError(`请映射所有必需字段：${missingFields.join(', ')}`);
      return false;
    }
    
    setError(null);
    return true;
  };

  // 处理下一步
  const handleNext = () => {
    const isValid = validateMapping();
    if (isValid) {
      onMappingCompleted(mapping);
    }
  };

  // 获取数据库列列表（显示所有支持的字段）
  const getTableColumns = () => {
    // 所有支持的字段，包括必需字段
    const ALL_FIELDS = [...REQUIRED_FIELDS];
    return ['', ...ALL_FIELDS];
  };

  return (
    <div className="column-mapping-container">
      <h3>步骤3：列映射</h3>
      
      <div className="mapping-info">
        <p>📋 映射信息：</p>
        <ul>
          <li>CSV列数：{csvData?.columns?.length || 0}</li>
          <li>时间粒度：{timeGranularity}</li>
          <li>必需映射字段：{REQUIRED_FIELDS.join(', ')}</li>
        </ul>
      </div>

      {error && <div className="error-message">❌ {error}</div>}

      <div className="mapping-table-container">
        <table className="mapping-table">
          <thead>
            <tr>
              <th>CSV列</th>
              <th>映射到表列</th>
            </tr>
          </thead>
          <tbody>
            {csvData?.columns?.map((csvColumn: string) => (
              <tr key={csvColumn}>
                <td className="csv-column">{csvColumn}</td>
                <td>
                  <select
                    value={mapping[csvColumn] || ''}
                    onChange={(e) => handleMappingChange(csvColumn, e.target.value)}
                  >
                    {getTableColumns().map((tableColumn) => (
                      <option key={tableColumn} value={tableColumn}>
                        {tableColumn || '不映射'}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="required-fields-info">
        <h4>映射规则说明：</h4>
        <ul>
          <li><strong>Date/Time/DateTime</strong> → <strong>date</strong>：交易时间（必填）</li>
          <li><strong>Open</strong> → <strong>open</strong>：开盘价</li>
          <li><strong>Close</strong> → <strong>close</strong>：收盘价</li>
          <li><strong>High</strong> → <strong>high</strong>：最高价</li>
          <li><strong>Low</strong> → <strong>low</strong>：最低价</li>
          <li><strong>Volume USDT/Volume</strong> → <strong>volume</strong>：成交量</li>
          <li><strong>Unix/Symbol/Tradecount</strong> → <strong>忽略</strong>：这些列将被跳过，不导入</li>
        </ul>
        <p><strong>symbol</strong> 字段不需要映射，由系统自动处理。</p>
        <p>系统会自动将CSV列映射到对应的标准列，您也可以手动调整。</p>
        <p>注意：<strong>Unix</strong>、<strong>Symbol</strong> 和 <strong>Tradecount</strong> 列将被自动忽略，不会导入到CSV文件中。</p>
      </div>

      <div className="action-buttons">
        <button onClick={onBack} className="back-button">上一步</button>
        <button 
          onClick={handleNext} 
          className="next-button"
          disabled={isLoading}
        >
          下一步
        </button>
      </div>

      <style>{`
        .column-mapping-container {
          max-width: 900px;
          margin: 0 auto;
        }

        h3 {
          margin-bottom: 20px;
          color: #333;
          text-align: center;
        }

        .mapping-info {
          background-color: #f0f2f5;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .mapping-info ul {
          margin: 10px 0 0 20px;
          padding: 0;
        }

        .mapping-table-container {
          margin: 20px 0;
          overflow-x: auto;
        }

        .mapping-table {
          width: 100%;
          border-collapse: collapse;
          background-color: white;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .mapping-table th,
        .mapping-table td {
          padding: 12px;
          text-align: left;
          border: 1px solid #e8e8e8;
        }

        .mapping-table th {
          background-color: #fafafa;
          font-weight: bold;
          color: #333;
        }

        .mapping-table tr:hover {
          background-color: #f5f5f5;
        }

        .csv-column {
          font-weight: bold;
        }

        .mapping-table select {
          padding: 6px 10px;
          border: 1px solid #d9d9d9;
          border-radius: 4px;
          font-size: 14px;
          width: 100%;
        }

        .required-fields-info {
          margin: 20px 0;
          padding: 15px;
          background-color: #fafafa;
          border-radius: 8px;
        }

        .required-fields-info h4 {
          margin-bottom: 10px;
          color: #333;
        }

        .required-fields-info ul {
          margin: 0 0 10px 20px;
          padding: 0;
        }

        .required-fields-info li {
          margin: 5px 0;
        }

        .required-fields-info strong {
          color: #1890ff;
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

export default ColumnMapping;