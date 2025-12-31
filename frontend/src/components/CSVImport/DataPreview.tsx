/**
 * 数据预览组件
 * 在导入前预览映射后的数据
 */
import React, {useState} from 'react';
import {api} from '../../api/client';

interface DataPreviewProps {
  csvData: any;
  timeGranularity: string;
  selectedSymbol: string;
  mapping: Record<string, string>;
  onImportCompleted: (result: any) => void;
  onBack: () => void;
}

const DataPreview: React.FC<DataPreviewProps> = ({ 
  csvData, 
  timeGranularity, 
  selectedSymbol,
  mapping, 
  onImportCompleted, 
  onBack 
}) => {
  // 导入状态
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFullPreview, setShowFullPreview] = useState(false);

  // 处理导入
  const handleImport = async () => {
    try {
      setIsImporting(true);
      setError(null);

      // 创建FormData
      const formData = new FormData();
      
      // 使用原始文件对象（从上传组件传递）
      if (csvData.file) {
        // 使用原始文件
        formData.append('file', csvData.file);
      } else {
        // 降级方案：使用完整数据构建文件
        // 注意：这只是为了兼容旧版本，实际应该始终使用原始文件
        const csvContent = csvData.columns.join(',') + '\n' + 
                          csvData.preview.map((row: any) => 
                            csvData.columns.map((col: string) => row[col]).join(',')
                          ).join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const file = new File([blob], 'preview.csv', { type: 'text/csv' });
        formData.append('file', file);
      }
      
      formData.append('time_granularity', timeGranularity);
      formData.append('mapping', JSON.stringify(mapping));
      formData.append('symbol', selectedSymbol);

      // 发送导入请求
      const response = await api.post('/api/data-import/execute-import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        onImportCompleted(response.data);
      } else {
        setError(response.data.message || '导入失败');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || '导入失败');
      console.error('导入失败:', err);
    } finally {
      setIsImporting(false);
    }
  };

  // 生成映射后的预览数据
  const generateMappedPreview = () => {
    // 只保留映射的列
    const mappedColumns = Object.values(mapping).filter(col => col);
    
    // 转换预览数据
    const mappedPreview = csvData.preview.map((row: any) => {
      const mappedRow: any = {};
      
      // 应用映射
      Object.entries(mapping).forEach(([csvCol, tableCol]) => {
        if (tableCol && row[csvCol] !== undefined) {
          mappedRow[tableCol] = row[csvCol];
        }
      });
      
      return mappedRow;
    });
    
    return { columns: mappedColumns, data: mappedPreview };
  };

  // 获取映射后的预览数据
  const { columns, data } = generateMappedPreview();

  // 获取要显示的预览行数
  const previewRows = showFullPreview ? data : data.slice(0, 5);

  return (
    <div className="data-preview-container">
      <h3>步骤4：数据预览</h3>
      
      <div className="preview-info">
        <p>📋 预览信息：</p>
        <ul>
          <li>时间粒度：{timeGranularity}</li>
          <li>映射列数：{Object.keys(mapping).filter(key => mapping[key]).length}</li>
          <li>总数据行数：{csvData.total_rows}</li>
        </ul>
      </div>

      {error && <div className="error-message">❌ {error}</div>}

      <div className="preview-table-container">
        <h4>映射后的数据预览：</h4>
        <table className="preview-table">
          <thead>
            <tr>
              {columns.map((column: string) => (
                <th key={column}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row: any, index: number) => (
              <tr key={`row-${index}`}>
                {columns.map((column: string) => (
                  <td key={`cell-${column}-${index}`}>{row[column] !== undefined ? row[column] : '-'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        
        {data.length > 5 && (
          <button 
            className="toggle-preview-btn"
            onClick={() => setShowFullPreview(!showFullPreview)}
          >
            {showFullPreview ? '显示更少' : `显示全部 ${data.length} 行`}
          </button>
        )}
      </div>

      <div className="mapping-summary">
        <h4>映射关系汇总：</h4>
        <ul>
          {Object.entries(mapping).map(([csvCol, tableCol]) => {
            if (tableCol) {
              return (
                <li key={csvCol}>
                  <strong>{csvCol}</strong> → {tableCol}
                </li>
              );
            }
            return null;
          }).filter(Boolean)}
        </ul>
      </div>

      <div className="action-buttons">
        <button onClick={onBack} className="back-button" disabled={isImporting}>上一步</button>
        <button 
          onClick={handleImport} 
          className="import-button"
          disabled={isImporting}
        >
          {isImporting ? (
            <div className="importing">
              <div className="spinner"></div>
              <span>导入中... 请耐心等待，大数据量导入可能需要几分钟</span>
            </div>
          ) : (
            '开始导入'
          )}
        </button>
      </div>
      
      {isImporting && (
        <div className="importing-info">
          <p>📊 导入进度信息：</p>
          <ul>
            <li>正在导入 {csvData.total_rows} 行数据</li>
            <li>时间粒度：{timeGranularity}</li>
            <li>系统正在高效处理中...</li>
          </ul>
        </div>
      )}

      <style>{`
        .data-preview-container {
          max-width: 900px;
          margin: 0 auto;
        }

        h3 {
          margin-bottom: 20px;
          color: #333;
          text-align: center;
        }

        .preview-info {
          background-color: #f0f2f5;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .preview-info ul {
          margin: 10px 0 0 20px;
          padding: 0;
        }

        .preview-table-container {
          margin: 20px 0;
          overflow-x: auto;
        }

        .preview-table-container h4 {
          margin-bottom: 10px;
          color: #333;
        }

        .preview-table {
          width: 100%;
          border-collapse: collapse;
          background-color: white;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .preview-table th,
        .preview-table td {
          padding: 10px;
          text-align: left;
          border: 1px solid #e8e8e8;
        }

        .preview-table th {
          background-color: #fafafa;
          font-weight: bold;
          color: #333;
          white-space: nowrap;
        }

        .column-type {
          display: block;
          font-size: 12px;
          color: #666;
          font-weight: normal;
          margin-top: 2px;
        }

        .preview-table tr:hover {
          background-color: #f5f5f5;
        }

        .toggle-preview-btn {
          margin-top: 10px;
          padding: 6px 12px;
          border: 1px solid #d9d9d9;
          border-radius: 4px;
          background-color: white;
          cursor: pointer;
          font-size: 14px;
          color: #1890ff;
        }

        .toggle-preview-btn:hover {
          border-color: #1890ff;
          background-color: #e6f7ff;
        }

        .mapping-summary {
          margin: 20px 0;
          padding: 15px;
          background-color: #fafafa;
          border-radius: 8px;
        }

        .mapping-summary h4 {
          margin-bottom: 10px;
          color: #333;
        }

        .mapping-summary ul {
          margin: 0 0 0 20px;
          padding: 0;
        }

        .mapping-summary li {
          margin: 5px 0;
        }

        .action-buttons {
          display: flex;
          justify-content: space-between;
          margin-top: 30px;
        }

        .back-button,
        .import-button {
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

        .import-button {
          background-color: #52c41a;
          color: white;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .import-button:hover {
          background-color: #73d13d;
        }

        .import-button:disabled {
          background-color: #d9d9d9;
          color: #bfbfbf;
          cursor: not-allowed;
        }

        .importing {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .spinner {
          border: 3px solid rgba(255, 255, 255, 0.3);
          border-left-color: white;
          border-radius: 50%;
          width: 16px;
          height: 16px;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .error-message {
          color: #ff4d4f;
          margin: 20px 0;
          padding: 10px;
          background-color: #fff2f0;
          border-radius: 4px;
        }
        
        .importing-info {
          margin: 20px 0;
          padding: 15px;
          background-color: #e6f7ff;
          border-radius: 8px;
          border-left: 4px solid #1890ff;
        }
        
        .importing-info p {
          margin: 0 0 10px 0;
          font-weight: bold;
          color: #1890ff;
        }
        
        .importing-info ul {
          margin: 0 0 0 20px;
          padding: 0;
        }
        
        .importing-info li {
          margin: 5px 0;
          color: #333;
        }
      `}</style>
    </div>
  );
};

export default DataPreview;