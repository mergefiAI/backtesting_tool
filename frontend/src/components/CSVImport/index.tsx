/**
 * CSV数据导入主组件
 * 整合所有导入步骤
 */
import React, {useState} from 'react';
import FileUpload from './FileUpload';
import TableSelect from './TableSelect';
import ColumnMapping from './ColumnMapping';
import DataPreview from './DataPreview';
import ImportResult from './ImportResult';

// 导入步骤枚举
type ImportStep = 'upload' | 'select_table' | 'mapping' | 'preview' | 'result';

// 单个文件的导入状态接口
interface FileImportState {
  id: string;
  fileName: string;
  file: File;
  step: ImportStep;
  csvData: any;
  selectedTable: string;
  timeGranularity: string;
  selectedInstrument: string;
  mapping: Record<string, string>;
  importResult: any;
  status: 'selected' | 'pending' | 'processing' | 'completed' | 'error';
}

// 文件上传组件属性接口


// 导入状态接口
interface ImportState {
  files: FileImportState[];
  currentFileId: string | null;
}

const CSVImport: React.FC = () => {
  // 导入状态
  const [state, setState] = useState<ImportState>({
    files: [],
    currentFileId: null
  });

  // 文件上传组件文件数量状态
  const [uploadComponentFileCount, setUploadComponentFileCount] = useState(0);

  // 处理文件上传组件文件数量变化
  const handleUploadComponentFileCountChange = (count: number) => {
    setUploadComponentFileCount(count);
  };

  // 处理文件删除
  const handleFileRemoved = (fileName: string) => {
    setState(prev => {
      const fileToRemove = prev.files.find(f => f.fileName === fileName);
      let newState = { ...prev };
      
      if (fileToRemove) {
        // 移除文件
        newState.files = prev.files.filter(f => f.fileName !== fileName);
        
        // 如果删除的是当前显示的文件，需要处理当前文件状态
        if (fileToRemove.id === prev.currentFileId) {
          if (newState.files.length > 0) {
            // 如果还有其他文件，显示第一个文件
            newState.currentFileId = newState.files[0].id;
          } else {
            // 如果没有文件了，清空当前文件状态
            newState.currentFileId = null;
          }
        }
      }
      
      return newState;
    });
  };

  // 处理文件上传完成
  const handleFileUploaded = (data: any) => {
    const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newFileState: FileImportState = {
      id: fileId,
      fileName: data.file.name,
      file: data.file,
      step: 'select_table',
      csvData: data,
      selectedTable: '',
      timeGranularity: '1d',
      selectedInstrument: 'BTC',
      mapping: {},
      importResult: null,
      status: 'processing'
    };

    setState(prev => ({
      files: [...prev.files, newFileState],
      currentFileId: fileId
    }));
  };

  // 获取当前文件状态
  const getCurrentFileState = (): FileImportState | undefined => {
    if (!state.currentFileId) return undefined;
    return state.files.find(file => file.id === state.currentFileId);
  };

  // 更新当前文件状态
  const updateCurrentFileState = (updates: Partial<FileImportState>) => {
    setState(prev => {
      if (!prev.currentFileId) return prev;
      return {
        ...prev,
        files: prev.files.map(file => 
          file.id === prev.currentFileId ? { ...file, ...updates } : file
        )
      };
    });
  };

  // 处理数据表选择
  const handleTableSelected = (timeGranularity: string, symbol: string) => {
    updateCurrentFileState({
      step: 'mapping',
      selectedTable: 'kline',
      timeGranularity,
      selectedInstrument: symbol
    });
  };

  // 处理列映射完成
  const handleMappingCompleted = (mapping: Record<string, string>) => {
    updateCurrentFileState({
      step: 'preview',
      mapping
    });
  };

  // 处理导入完成
  const handleImportCompleted = (result: any) => {
    updateCurrentFileState({
      step: 'result',
      importResult: result,
      status: 'completed'
    });
  };

  // 返回上一步
  const handleBack = () => {
    const currentFile = getCurrentFileState();
    if (!currentFile) return;

    let previousStep: ImportStep = 'upload';
    switch (currentFile.step) {
      case 'select_table':
        previousStep = 'upload';
        break;
      case 'mapping':
        previousStep = 'select_table';
        break;
      case 'preview':
        previousStep = 'mapping';
        break;
      case 'result':
        previousStep = 'preview';
        break;
      default:
        previousStep = 'upload';
    }

    updateCurrentFileState({
      step: previousStep
    });
  };

  // 切换当前处理的文件
  const handleSwitchFile = (fileId: string) => {
    setState(prev => ({
      ...prev,
      currentFileId: fileId
    }));
  };

  // 重新开始导入
  const handleRestart = () => {
    setState({
      files: [],
      currentFileId: null
    });
  };

  const currentFile = getCurrentFileState();

  return (
    <div className="csv-import-container">
      <h2>CSV数据导入</h2>
      
      {/* 上下两部分布局 */}
      <div className="two-part-layout">
        {/* 上部分：文件上传和文件列表 */}
        <div className="top-part">
          {/* 文件上传区域 */}
          <FileUpload 
            onFileUploaded={handleFileUploaded}
            onFileCountChange={handleUploadComponentFileCountChange}
            onFileRemoved={handleFileRemoved}
          />
        </div>

        {/* 下部分：详细导入流程 */}
        <div className="bottom-part">
          {currentFile ? (
            <div className="detailed-import-process">
              <div className="section-header">
                <h3>详细导入流程</h3>
                <div className="current-file-info">
                  当前文件: {currentFile.fileName}
                </div>
              </div>

              {/* 导入步骤指示器 */}
              <div className="import-steps">
                <div className={`step-item ${currentFile.step === 'upload' ? 'active' : currentFile.step === 'select_table' || currentFile.step === 'mapping' || currentFile.step === 'preview' || currentFile.step === 'result' ? 'completed' : ''}`}>
                  1. 文件上传
                </div>
                <div className={`step-item ${currentFile.step === 'select_table' ? 'active' : currentFile.step === 'mapping' || currentFile.step === 'preview' || currentFile.step === 'result' ? 'completed' : ''}`}>
                  2. 选择表
                </div>
                <div className={`step-item ${currentFile.step === 'mapping' ? 'active' : currentFile.step === 'preview' || currentFile.step === 'result' ? 'completed' : ''}`}>
                  3. 列映射
                </div>
                <div className={`step-item ${currentFile.step === 'preview' ? 'active' : currentFile.step === 'result' ? 'completed' : ''}`}>
                  4. 数据预览
                </div>
                <div className={`step-item ${currentFile.step === 'result' ? 'active' : ''}`}>
                  5. 导入结果
                </div>
              </div>

              {/* 根据步骤显示不同组件 */}
              {currentFile.step === 'select_table' && (
                <div className="step-content">
                  <h4>选择目标表和标的</h4>
                  <TableSelect 
                    csvData={currentFile.csvData}
                    onTableSelected={handleTableSelected}
                    onBack={handleBack}
                  />
                </div>
              )}

              {currentFile.step === 'mapping' && (
                <div className="step-content">
                  <h4>列映射</h4>
                  <ColumnMapping 
                    csvData={currentFile.csvData}
                    timeGranularity={currentFile.timeGranularity}
                    onMappingCompleted={handleMappingCompleted}
                    onBack={handleBack}
                  />
                </div>
              )}

              {currentFile.step === 'preview' && (
                <div className="step-content">
                  <h4>数据预览</h4>
                  <DataPreview 
                    csvData={currentFile.csvData}
                    timeGranularity={currentFile.timeGranularity}
                    selectedSymbol={currentFile.selectedInstrument}
                    mapping={currentFile.mapping}
                    onImportCompleted={handleImportCompleted}
                    onBack={handleBack}
                  />
                </div>
              )}

              {currentFile.step === 'result' && (
                <div className="step-content">
                  <h4>导入结果</h4>
                  <ImportResult 
                    result={currentFile.importResult}
                    onRestart={handleRestart}
                    onBack={handleBack}
                  />
                </div>
              )}
            </div>
          ) : uploadComponentFileCount === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📁</div>
              <div className="empty-title">还没有选择任何文件</div>
              <div className="empty-description">
                使用上方的文件上传功能添加CSV文件
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">⏳</div>
              <div className="empty-title">请先上传文件</div>
              <div className="empty-description">
                文件已选择，请点击"开始上传"按钮上传文件
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        /* 重置默认样式 */
        * {
          box-sizing: border-box;
        }

        /* 主容器样式 */
        .csv-import-container {
          max-width: 1600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f0f2f5;
          min-height: 100vh;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;      
        }

        h2 {
          margin-bottom: 24px;
          color: #262626;
          font-size: 24px;
          font-weight: 600;
        }

        h3 {
          margin-bottom: 16px;
          color: #262626;
          font-size: 18px;
          font-weight: 600;
        }

        h4 {
          margin-bottom: 16px;
          color: #262626;
          font-size: 16px;
          font-weight: 500;
        }

        /* 上下两部分布局 */
        .two-part-layout {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* 上部分：文件上传和列表 */
        .top-part {
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        /* 下部分：详细导入流程 */
        .bottom-part {
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          padding: 20px;
        }
        
        /* 自定义滚动条样式 */
        .top-part::-webkit-scrollbar,
        .bottom-part::-webkit-scrollbar {
          width: 6px;
        }
        
        .top-part::-webkit-scrollbar-track,
        .bottom-part::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 3px;
        }
        
        .top-part::-webkit-scrollbar-thumb,
        .bottom-part::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 3px;
        }
        
        .top-part::-webkit-scrollbar-thumb:hover,
        .bottom-part::-webkit-scrollbar-thumb:hover {
          background: #a8a8a8;
        }

        /* 面板样式 */
        .panel {
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          display: flex;
          flex-direction: column;
          margin-bottom: 20px;
        }

        .panel-header {
          padding: 16px 20px;
          border-bottom: 1px solid #f0f0f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .panel-body {
          padding: 20px;
          flex: 1;
        }

        .panel-footer {
          padding: 16px 20px;
          border-top: 1px solid #f0f0f0;
        }

        /* 文件列表区域 */
        .file-count {
          font-size: 14px;
          color: #8c8c8c;
        }

        .upload-section {
          margin-bottom: 20px;
        }

        .selected-files-section {
          margin-top: 20px;
        }

        .section-title {
          font-size: 14px;
          font-weight: 500;
          color: #595959;
          margin-bottom: 12px;
        }

        /* 文件项样式 */
        .file-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .file-item {
          padding: 12px;
          border: 1px solid #f0f0f0;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.3s ease;
          background: white;
        }

        .file-item:hover {
          border-color: #1890ff;
          box-shadow: 0 2px 8px rgba(24, 144, 255, 0.15);
        }

        .file-item.active {
          border-color: #1890ff;
          background: #e6f7ff;
          box-shadow: 0 2px 8px rgba(24, 144, 255, 0.15);
        }

        .file-header {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .file-icon {
          font-size: 20px;
          margin-top: 2px;
        }

        .file-main-info {
          flex: 1;
        }

        .file-name {
          font-weight: 500;
          color: #262626;
          font-size: 14px;
          margin-bottom: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .file-meta {
          font-size: 12px;
          color: #8c8c8c;
        }

        .status-badge {
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 500;
        }

        .status-pending {
          background: #fff7e6;
          color: #fa8c16;
        }

        .status-processing {
          background: #e6f7ff;
          color: #1890ff;
        }

        .status-completed {
          background: #f6ffed;
          color: #52c41a;
        }

        .status-error {
          background: #fff2f0;
          color: #ff4d4f;
        }

        .file-result {
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px dashed #f0f0f0;
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }

        .result-icon {
          font-size: 16px;
          margin-top: 2px;
        }

        .result-info {
          flex: 1;
        }

        .result-message {
          font-size: 13px;
          color: #595959;
          margin-bottom: 4px;
        }

        .result-stats {
          font-size: 12px;
          color: #8c8c8c;
        }

        /* 按钮样式 */
        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.3s ease;
        }

        .btn-primary {
          background: #1890ff;
          color: white;
        }

        .btn-primary:hover {
          background: #40a9ff;
        }

        .btn-block {
          width: 100%;
        }

        /* 导入结果概览 */
        .import-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 12px;
          margin-bottom: 24px;
        }

        .stat-item {
          background: #fafafa;
          padding: 16px;
          border-radius: 6px;
          text-align: center;
        }

        .stat-label {
          font-size: 14px;
          color: #8c8c8c;
          margin-bottom: 8px;
        }

        .stat-value {
          font-size: 20px;
          font-weight: 600;
          color: #262626;
        }

        .stat-success {
          color: #52c41a;
        }

        .stat-processing {
          color: #1890ff;
        }

        .stat-pending {
          color: #fa8c16;
        }

        .stat-error {
          color: #ff4d4f;
        }

        /* 导入结果卡片 */
        .import-results {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .result-card {
          background: white;
          border: 1px solid #f0f0f0;
          border-radius: 6px;
          padding: 16px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .result-card:hover {
          border-color: #1890ff;
          box-shadow: 0 2px 8px rgba(24, 144, 255, 0.15);
        }

        .result-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 10px;
        }

        .result-file-info {
          flex: 1;
        }

        .result-file-name {
          font-weight: 500;
          color: #262626;
          font-size: 14px;
          margin-bottom: 4px;
        }

        .result-file-meta {
          font-size: 12px;
          color: #8c8c8c;
        }

        .result-status {
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 500;
        }

        .result-content {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px dashed #f0f0f0;
        }

        /* 导入步骤样式 */
        .import-steps {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }

        .step-item {
          padding: 8px 12px;
          background: #fafafa;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 500;
          color: #8c8c8c;
          border: 1px solid #e8e8e8;
        }

        .step-item.active {
          background: #1890ff;
          color: white;
          border-color: #1890ff;
        }

        .step-item.completed {
          background: #f6ffed;
          color: #52c41a;
          border-color: #b7eb8f;
        }

        /* 当前文件信息 */
        .current-file-info {
          font-size: 12px;
          color: #8c8c8c;
        }

        .step-content {
          margin-top: 20px;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 12px;
          border-bottom: 1px solid #f0f0f0;
        }

        /* 详细导入流程样式 */
        .detailed-import-process {
          width: 100%;
        }

        /* 空状态样式 */
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          text-align: center;
          color: #8c8c8c;
        }

        .empty-state .empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
          color: #bfbfbf;
        }

        .empty-state .empty-title {
          font-size: 16px;
          font-weight: 500;
          color: #595959;
          margin-bottom: 8px;
        }

        .empty-state .empty-description {
          font-size: 14px;
          color: #8c8c8c;
        }

        /* 响应式设计 */
        @media (max-width: 768px) {
          .two-part-layout {
            height: auto;
            max-height: none;
          }

          .top-part,
          .bottom-part {
            height: auto;
            overflow-y: visible;
            margin-bottom: 20px;
          }
        }
      `}</style>
    </div>
  );
};

export default CSVImport;