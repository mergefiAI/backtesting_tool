import type {ReactNode} from 'react';
import React from 'react';
import {Divider, Typography} from 'antd';

const { Text } = Typography;

interface DetailItemProps {
  /** 字段标题 */
  label: string;
  /** 字段内容 */
  value?: ReactNode | string | number | null | undefined;
  /** 是否显示分割线 */
  showDivider?: boolean;
  /** 内容最大宽度 */
  maxWidth?: string;
  /** 内容自定义样式 */
  valueStyle?: React.CSSProperties;
  /** 标题自定义样式 */
  labelStyle?: React.CSSProperties;
  /** 是否为必填字段 */
  required?: boolean;
  /** 空值显示文本 */
  emptyText?: string;
}

/**
 * 详情页中的字段项组件
 * 用于统一展示详情页面的各项信息
 */
const DetailItem: React.FC<DetailItemProps> = ({
  label,
  value,
  showDivider = true,
  maxWidth,
  valueStyle,
  labelStyle,
  required = false,
  emptyText = '-',
}) => {
  // 判断值是否为空 - 增强判断逻辑
  const isEmpty = 
    value === undefined || 
    value === null || 
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0);
  
  // 打印调试信息以查看传递的值
  // console.log(`DetailItem ${label} value:`, value, 'isEmpty:', isEmpty);
  
  return (
    <div style={{ marginBottom: showDivider ? '16px' : 0 }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'flex-start',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <Text 
          strong 
          style={{ 
            flexShrink: 0,
            marginRight: '12px',
            minWidth: '80px',
            maxWidth: '120px',
            color: '#262626',
            lineHeight: '1.5',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            ...labelStyle
          }}
        >
          {label}{required && <span style={{ color: '#ff4d4f' }}>*</span>}：
        </Text>
        <div 
          style={{
            flex: 1,
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            maxWidth: maxWidth || 'calc(100% - 120px)',
            minWidth: 0,
            lineHeight: '1.5',
            ...valueStyle,
          }}
        >
          {/* 明确显示数据处理结果 */}
          {!isEmpty ? (
            value
          ) : (
            <Text type="secondary">{emptyText}</Text>
          )}
        </div>
      </div>
      {showDivider && <Divider style={{ marginTop: '8px', marginBottom: 0 }} />}
    </div>
  );
};

export default DetailItem;