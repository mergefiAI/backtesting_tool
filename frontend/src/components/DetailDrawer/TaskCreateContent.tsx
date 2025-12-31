import React, {useEffect, useState} from 'react';
import {Alert, Button, Card, Col, DatePicker, Form, Input, InputNumber, message, Row, Select, Space, Spin} from 'antd';
import {
    createTask,
    fetchAIConfigs,
    fetchBTCDailyBars,
    fetchBTCHourlyBars,
    fetchBTCMinutelyBars,
    getPromptTemplates
} from '@/api/endpoints';
import type {Dayjs} from 'dayjs';
import dayjs from 'dayjs';
import { SYMBOLS } from '@/constants/symbols';


interface TaskForm {
  account_id: string;
  stock_symbol: string;
  start_date: string;
  end_date: string;
  market_type: string;
  initial_balance: number;
  user_prompt_id?: string;
  ai_config_id?: string;
  time_granularity: string;
  decision_interval: number;
}

interface TaskCreateContentProps {
  onClose: () => void;
  onSuccess?: () => void;
}

const { Option } = Select;
const { RangePicker } = DatePicker;

const TaskCreateContent: React.FC<TaskCreateContentProps> = ({ onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const [userTemplates, setUserTemplates] = useState<any[]>([]);
  const [aiConfigs, setAiConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stockDateRange, setStockDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [isDateRangeEditable, setIsDateRangeEditable] = useState(false);
  const timeGranularity = Form.useWatch<string>('time_granularity', form);
  const stockSymbol = Form.useWatch<string>('stock_symbol', form);

  // 市场类型选项 - 默认为加密货币，注释掉美股
  const marketTypeOptions = [
    // { value: 'US', label: '美股' }, // 暂时注释掉美股选项
    { value: 'COIN', label: '加密货币' }
  ];

  // 加载策略数据
  const loadPromptTemplates = async () => {
    try {
      const userRes = await getPromptTemplates({ status: 'AVAILABLE', page: 1, page_size: 100 });
      const userList = (userRes as any)?.data?.items || (userRes as any)?.items || [];
      setUserTemplates(userList);
    } catch (error) {
      console.error('加载策略数据失败:', error);
    }
  };

  // 加载AI配置数据
  const loadAIConfigs = async () => {
    try {
      const aiRes = await fetchAIConfigs({ page: 1, page_size: 100 });
      const aiList = (aiRes as any)?.items || [];
      setAiConfigs(aiList);
    } catch (error) {
      console.error('加载AI配置数据失败:', error);
    }
  };

  // 获取标的的可用日期范围（最小/最大）
  const fetchStockDateRange = async (stockSymbol: string, timeGranularity: string) => {
    setStockDateRange(null);
    setIsDateRangeEditable(false); // 开始加载，设置日期选择器不可编辑
    if (!stockSymbol) {
      setIsDateRangeEditable(true); // 如果没有标的，允许编辑（虽然实际会验证）
      return;
    }
    
    try {
      // 根据时间粒度选择不同的API端点
      let fetchFunction: any;
      switch (timeGranularity) {
        case 'hourly':
          fetchFunction = fetchBTCHourlyBars;
          break;
        case 'minute':
          fetchFunction = fetchBTCMinutelyBars;
          break;
        case 'daily':
        default:
          fetchFunction = fetchBTCDailyBars;
          break;
      }
      
      const first = await fetchFunction({ symbol: stockSymbol, page: 1, page_size: 1 });
      const totalPages = first?.total_pages || 0;
      const minDateStr = first?.items?.[0]?.date || first?.items?.[0]?.trade_date || null;
      let maxDateStr: string | null = null;
      if (totalPages > 0) {
        const last = await fetchFunction({ symbol: stockSymbol, page: totalPages, page_size: 1 });
        maxDateStr = last?.items?.[last?.items?.length - 1]?.date || last?.items?.[last?.items?.length - 1]?.trade_date || null;
      }
      if (minDateStr && maxDateStr) {
        const minDate = dayjs(minDateStr);
        const maxDate = dayjs(maxDateStr);
        setStockDateRange([minDate, maxDate]);
        // 设置默认日期范围为最近30天或可用范围（取较小者）
        const defaultEndDate = maxDate;
        const defaultStartDate = maxDate.subtract(30, 'day').isAfter(minDate) ? maxDate.subtract(30, 'day') : minDate;
        form.setFieldValue('date_range', [defaultStartDate, defaultEndDate]);
      }
    } catch (error) {
      console.error('获取日期范围失败:', error);
      setStockDateRange(null);
    } finally {
      setIsDateRangeEditable(true); // 加载完成，设置日期选择器可编辑
    }
  };

  // 初始化数据
  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadPromptTemplates(),
      loadAIConfigs()
    ]).finally(() => {
      setLoading(false);
    });
  }, []);

  // 设置默认选择项
  useEffect(() => {
    if (userTemplates.length > 0) {
      form.setFieldValue('user_prompt_id', userTemplates[0].prompt_id);
    }
  }, [userTemplates, form]);

  useEffect(() => {
    if (aiConfigs.length > 0) {
      form.setFieldValue('ai_config_id', aiConfigs[0].config_id);
    }
  }, [aiConfigs, form]);

  // 当stock_symbol变化时，自动生成account_id
  useEffect(() => {
    if (stockSymbol) {
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '').slice(0, -1);
      form.setFieldValue('account_id', `${stockSymbol}_${timestamp}`);
      // 加载日期范围
      fetchStockDateRange(stockSymbol, timeGranularity || 'daily');
    } else {
      setIsDateRangeEditable(true); // 没有标的时允许编辑（虽然实际会验证）
    }
  }, [stockSymbol, timeGranularity, form]);

  // 初始化时，如果有默认stock_symbol，加载日期范围
  useEffect(() => {
    if (form.getFieldValue('stock_symbol')) {
      fetchStockDateRange(form.getFieldValue('stock_symbol'), form.getFieldValue('time_granularity') || 'daily');
    }
  }, []);

  // 自定义日期验证函数
  const validateDateRange = (rule: any, value: any) => {
    if (!value || value.length === 0) {
      return Promise.reject(new Error('请选择日期范围'));
    }
    if (!Array.isArray(value) || value.length !== 2) {
      return Promise.reject(new Error('请选择有效的日期范围'));
    }
    const [startDate, endDate] = value;
    if (!startDate || !endDate) {
      return Promise.reject(new Error('请选择完整的日期范围'));
    }
    return Promise.resolve();
  };

  // 提交表单
  const onFinish = async (values: any) => {
    setSubmitting(true);
    try {
      const payload: any = { ...values };
      if (!values.date_range || !Array.isArray(values.date_range) || values.date_range.length !== 2) {
        form.setFields([{ name: 'date_range', errors: ['请选择日期范围'] }]);
        return;
      }
      const [startDate, endDate] = values.date_range;
      console.log('选择的日期范围:', startDate, endDate);
      if (!startDate || !endDate) {
        form.setFields([{ name: 'date_range', errors: ['请选择完整的日期范围'] }]);
        return;
      }
      payload.start_date = values.date_range[0].format('YYYY-MM-DD');
      payload.end_date = values.date_range[1].format('YYYY-MM-DD');
      delete payload.date_range;
      
      // 确保account_id存在
      if (!payload.account_id) {
        message.error('账户ID未生成，请检查标的输入');
        return;
      }
      console.log('创建任务参数:', payload);
      const rs = await createTask(payload);
      if (rs?.task_id) {
        message.success('任务创建成功（账户已自动创建）');
        onSuccess?.();
        onClose();
        form.resetFields();
      }
    } catch (error: any) {
      console.error('创建策略回测失败:', error);
      if (error.message) {
        message.error(`创建策略回测失败: ${error.message}`);
      } else {
        message.error('创建策略回测失败，请检查输入数据');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <Spin size="large" tip="加载基础数据中...">
            <div style={{ height: 50 }} />
          </Spin>
        </div>
      ) : (
        <Card bordered={false} styles={{ body: { padding: 0 } }}>
          <Alert message="任务创建指南" description="填写账户信息与标的，系统将自动创建账户并执行本地决策任务。" type="info" showIcon style={{ marginBottom: 24 }} />

          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            initialValues={{ 
              initial_balance: 100000,
              market_type: 'COIN', // 默认为加密货币
              stock_symbol: 'BTC', // 默认为BTC
              time_granularity: 'daily', // 默认为日线粒度
              decision_interval: 1, // 默认为24小时（1440分钟）
              commission_rate_buy: 0.0001, // 默认为0.03%
              commission_rate_sell: 0.0001, // 默认为0.03%
              tax_rate: 0, // 默认为0.1%
              min_commission: 0, // 默认为0美元

            }}
            // 移除 onValuesChange 回调，避免循环引用
            // 相关逻辑已在 useEffect 钩子中处理
          >
            {/* 隐藏的账户ID字段 */}
            <Form.Item
              name="account_id"
              rules={[{ required: true, message: '账户ID将自动生成' }]}
              hidden
            >
              <Input />
            </Form.Item>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="market_type"
                  label="市场类型"
                  rules={[{ required: true, message: '请选择市场类型' }]}
                >
                  <Select options={marketTypeOptions} placeholder="请选择市场类型" />
                </Form.Item>
              </Col>

              <Col span={12}>
                <Form.Item
                  name="stock_symbol"
                  label="标的"
                  rules={[{ required: true, message: '请选择标的' }]}
                >
                  <Select placeholder="请选择标的" showSearch>
                    {SYMBOLS.map((symbol) => (
                      <Select.Option key={symbol} value={symbol}>
                        {symbol}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>

              <Col span={12}>
                <Form.Item
                  name="initial_balance"
                  label="初始余额"
                  rules={[{ required: true, message: '请输入初始余额' }]}
                >
                  <InputNumber<number>
                    style={{ width: '100%' }}
                    placeholder="请输入初始余额"
                    min={0}
                    step={0.01}
                    formatter={(value) => {
                      if (value === null || value === undefined) return '';
                      const num = Number(value);
                      if (isNaN(num)) return String(value);
                      if (Math.abs(num) < 0.00000001) return '0';
                      return num.toLocaleString('zh-CN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 8
                      });
                    }}
                    parser={(value) => {
                      if (typeof value === 'string') {
                        const parsed = parseFloat(value.replace(/,/g, ''));
                        return isNaN(parsed) ? 0 : parsed;
                      }
                      return 0;
                    }}
                  />
                </Form.Item>
              </Col>
              
              <Col span={12}>
                <Form.Item
                  name="time_granularity"
                  label="时间粒度"
                  rules={[{ required: true, message: '请选择时间粒度' }]}
                >
                  <Select placeholder="请选择时间粒度">
                    <Option value="daily">日线</Option>
                    <Option value="hourly">小时线</Option>
                    {/* <Option value="minute">分钟线</Option> */}
                  </Select>
                </Form.Item>
              </Col>
              
              <Col span={12}>
                <Form.Item
                  name="decision_interval"
                  label="决策间隔单位数"
                  rules={[{ required: true, message: '请输入决策间隔单位数' }]}
                  extra={(() => {
                    const intervalUnit = {
                      daily: '天',
                      hourly: '小时',
                      minute: '分钟'
                    }[timeGranularity] || '分钟';
                    return `从0点整开始计算决策时间点，每${intervalUnit}执行一次决策`;
                  })()}
                >
                  <InputNumber<number>
                    style={{ width: '100%' }}
                    placeholder="请输入决策间隔单位数"
                    min={1}
                    max={(() => {
                      return timeGranularity === 'daily' ? 1 : timeGranularity === 'hourly' ? 1 : 30;
                    })()}
                    step={1}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              name="date_range"
              label="日期范围"
              rules={[{ validator: validateDateRange }]}
              extra={stockDateRange ? `可用数据范围: ${stockDateRange[0].format('YYYY-MM-DD')} ~ ${stockDateRange[1].format('YYYY-MM-DD')}` : '请输入标的以加载可用日期'}
            >
              <RangePicker
                style={{ width: '100%' }}
                disabled={!isDateRangeEditable}
                disabledDate={(current) => {
                  if (!stockDateRange || !current) return false;
                  const [minDate, maxDate] = stockDateRange;
                  return current.isBefore(minDate) || current.isAfter(maxDate);
                }}
                placeholder={['开始日期', '结束日期']}
              />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="user_prompt_id"
                  label="用户提示词 (User Prompt)"
                  rules={[{ required: true, message: '请选择用户提示词' }]}
                >
                  <Select placeholder="选择具体指令..." showSearch optionFilterProp="children">
                    {userTemplates.map((tpl: any) => (
                      <Option key={tpl.prompt_id} value={tpl.prompt_id}>
                        {tpl.name || tpl.description || (tpl.content || '').slice(0, 20)}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="ai_config_id"
                  label="AI配置"
                  rules={[{ required: true, message: '请选择AI配置' }]}
                >
                  <Select placeholder="选择AI配置..." showSearch optionFilterProp="children">
                    {aiConfigs.map((config: any) => (
                      <Option key={config.config_id} value={config.config_id}>
                        {config.name || `AI配置 ${config.config_id.slice(0, 8)}`}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <div style={{ marginBottom: 16, marginTop: 8 }}>
              <span style={{ fontWeight: 500 }}>交易费用设置</span>
              <div style={{ borderTop: '1px solid #f0f0f0', marginTop: 8, paddingTop: 16 }}>
                <Row gutter={16}>
                  <Col span={6}>
                    <Form.Item
                      name="commission_rate_buy"
                      label="买入佣金率"
                      rules={[{ required: true, message: '请输入买入佣金率' }]}
                      tooltip="例如 0.001 表示 0.1%"
                    >
                      <InputNumber<number>
                        style={{ width: '100%' }}
                        min={0}
                        max={1}
                        step={0.0001}
                        precision={6}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item
                      name="commission_rate_sell"
                      label="卖出佣金率"
                      rules={[{ required: true, message: '请输入卖出佣金率' }]}
                      tooltip="例如 0.001 表示 0.1%"
                    >
                      <InputNumber<number>
                        style={{ width: '100%' }}
                        min={0}
                        max={1}
                        step={0.0001}
                        precision={6}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item
                      name="tax_rate"
                      label="印花税率"
                      rules={[{ required: true, message: '请输入印花税率' }]}
                      tooltip="仅卖出时收取，例如 0.001 表示 0.1%"
                    >
                      <InputNumber<number>
                        style={{ width: '100%' }}
                        min={0}
                        max={1}
                        step={0.0001}
                        precision={6}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item
                      name="min_commission"
                      label="最低佣金"
                      rules={[{ required: true, message: '请输入最低佣金' }]}
                      tooltip="单笔交易最低收取的佣金金额"
                    >
                      <InputNumber<number>
                        style={{ width: '100%' }}
                        min={0}
                        step={1}
                        precision={2}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </div>
            </div>

            <div style={{ marginTop: 24, textAlign: 'right' }}>
              <Space>
                <Button onClick={onClose}>取消</Button>
                <Button type="primary" htmlType="submit" loading={submitting}>
                  创建策略回测
                </Button>
              </Space>
            </div>
          </Form>
        </Card>
      )}
    </div>
  );
};

export default TaskCreateContent;
