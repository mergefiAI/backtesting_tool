/**
 * 导入结果组件
 * 显示导入结果和报告
 */
import React from 'react';

interface ImportResultProps {
  result: any;
  onRestart: () => void;
  onBack: () => void;
}

const ImportResult: React.FC<ImportResultProps> = ({ result, onRestart, onBack }) => {
  return (
    <div className="import-result-container">
      <h3>步骤5：导入结果</h3>
      
      <div className={`result-card ${result.success ? 'success' : 'error'}`}>
        {result.success ? (
          <div className="success-content">
            <div className="result-icon">🎉</div>
            <h4>导入成功！</h4>
            <p className="result-message">{result.message}</p>
            <div className="result-stats">
              <div className="stat-item">
                <span className="stat-label">导入行数：</span>
                <span className="stat-value">{result.rows_imported}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="error-content">
            <div className="result-icon">❌</div>
            <h4>导入失败</h4>
            <p className="result-message">{result.message}</p>
          </div>
        )}
      </div>

      <div className="action-buttons">
        <button onClick={onBack} className="back-button">上一步</button>
        <button onClick={onRestart} className="restart-button">
          重新导入
        </button>
      </div>

      <style>{`
        .import-result-container {
          max-width: 800px;
          margin: 0 auto;
          text-align: center;
        }

        h3 {
          margin-bottom: 30px;
          color: #333;
        }

        .result-card {
          padding: 40px;
          border-radius: 8px;
          margin: 20px 0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .result-card.success {
          background-color: #f6ffed;
          border: 1px solid #b7eb8f;
        }

        .result-card.error {
          background-color: #fff2f0;
          border: 1px solid #ffccc7;
        }

        .result-icon {
          font-size: 64px;
          margin-bottom: 20px;
        }

        .result-card h4 {
          margin-bottom: 10px;
          color: #333;
        }

        .result-message {
          margin-bottom: 20px;
          color: #666;
        }

        .result-stats {
          display: flex;
          justify-content: center;
          gap: 30px;
          margin-top: 20px;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .stat-label {
          font-size: 14px;
          color: #666;
          margin-bottom: 5px;
        }

        .stat-value {
          font-size: 24px;
          font-weight: bold;
          color: #52c41a;
        }

        .action-buttons {
          display: flex;
          justify-content: center;
          gap: 20px;
          margin-top: 30px;
        }

        .back-button,
        .restart-button {
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

        .restart-button {
          background-color: #1890ff;
          color: white;
        }

        .restart-button:hover {
          background-color: #40a9ff;
        }
      `}</style>
    </div>
  );
};

export default ImportResult;