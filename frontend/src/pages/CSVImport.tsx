/**
 * CSV数据导入页面
 */
import React from 'react';
import CSVImportComponent from '../components/CSVImport';

const CSVImport: React.FC = () => {
  return (
    <div className="csv-import-page">
      <CSVImportComponent />
    </div>
  );
};

export default CSVImport;