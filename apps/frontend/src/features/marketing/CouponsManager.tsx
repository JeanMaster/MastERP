import { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, DatePicker, InputNumber, Switch, Tag, Typography, Select, App, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PercentageOutlined, DollarOutlined } from '@ant-design/icons';
import { marketingApi } from '../../services/marketingApi';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { Grid, List, Card as AntdCard } from 'antd';

const { useBreakpoint } = Grid;

const { Title, Text } = Typography;
const { Option } = Select;

/**
 * CouponsManager Component
 * Management interface for promotional discount codes.
 * Allows defining global usage limits, expiration dates, minimum purchase requirements, and tier-based restrictions.
 */
export default function CouponsManager() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const screens = useBreakpoint();
  const isMobile = !screens.lg;
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();
  
  // F9 Keyboard Shortcut for quick actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'F9') {
            e.preventDefault();
            e.stopPropagation();
            if (isModalVisible) {
                form.submit();
            } else {
                handleAddNew();
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isModalVisible, form]);

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const data = await marketingApi.getCoupons();
      setCoupons(data);
    } catch (error) {
      console.error(error);
      message.error(t('marketing.coupons.messages.load_error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const handleAddNew = () => {
    setIsEditing(false);
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({
      discountType: 'PERCENTAGE',
      isActive: true,
      isSingleUsePerClient: false,
      applicableDepartments: [],
      applicableProducts: [],
      targetTiers: []
    });
    setIsModalVisible(true);
  };

  const handleEdit = (record: any) => {
    setIsEditing(true);
    setEditingId(record.id);
    form.resetFields();
    form.setFieldsValue({
      ...record,
      startDate: record.startDate ? dayjs(record.startDate) : undefined,
      endDate: record.endDate ? dayjs(record.endDate) : undefined,
    });
    setIsModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await marketingApi.deleteCoupon(id);
      message.success(t('marketing.coupons.messages.delete_success'));
      fetchCoupons();
    } catch (error) {
       message.error(t('marketing.coupons.messages.delete_error'));
    }
  };

  const handleSave = async (values: any) => {
    try {
      const payload = {
        ...values,
        startDate: values.startDate ? values.startDate.toISOString() : null,
        endDate: values.endDate ? values.endDate.toISOString() : null,
        code: values.code.toUpperCase()
      };

      if (isEditing && editingId) {
        await marketingApi.updateCoupon(editingId, payload);
        message.success(t('marketing.coupons.messages.update_success'));
      } else {
        await marketingApi.createCoupon(payload);
        message.success(t('marketing.coupons.messages.create_success'));
      }
      setIsModalVisible(false);
      fetchCoupons();
    } catch (error) {
      console.error(error);
      message.error(t('marketing.coupons.messages.save_error'));
    }
  };

  const columns = [
    {
      title: t('marketing.coupons.table.code'),
      dataIndex: 'code',
      key: 'code',
      render: (text: string) => <Text strong style={{ letterSpacing: '1px' }}>{text}</Text>
    },
    {
      title: t('marketing.coupons.table.discount_type'),
      dataIndex: 'discountType',
      key: 'discountType',
      render: (type: string, record: any) => (
        type === 'PERCENTAGE' 
          ? <Tag color="blue" icon={<PercentageOutlined />}> {record.discountValue}%</Tag>
          : <Tag color="green" icon={<DollarOutlined />}> ${record.discountValue}</Tag>
      )
    },
    {
      title: t('marketing.coupons.table.usage'),
      key: 'usage',
      render: (_: any, record: any) => (
        <Text>
          {t('marketing.coupons.usage_text', { 
            used: record.usedCount, 
            limit: record.usageLimit ? `/ ${record.usageLimit}` : '' 
          })}
        </Text>
      )
    },
    {
      title: t('marketing.coupons.table.applicable_tiers'),
      dataIndex: 'targetTiers',
      key: 'targetTiers',
      render: (tiers: string[]) => (
        tiers && tiers.length > 0 ? tiers.map(t => <Tag key={t}>{t}</Tag>) : <Tag color="default">{t('marketing.coupons.all_customers')}</Tag>
      )
    },
    {
      title: t('marketing.coupons.table.status'),
      dataIndex: 'isActive',
      key: 'isActive',
      align: 'center' as const,
      render: (active: boolean) => (
        <Tag color={active ? 'success' : 'default'}>{active ? t('users.active') : t('users.inactive')}</Tag>
      )
    },
    {
      title: t('marketing.coupons.table.actions'),
      key: 'actions',
      width: 100,
      render: (_: any, record: any) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} title={t('common.edit')} />
          <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} title={t('common.delete')} />
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: isMobile ? '12px' : '24px', maxWidth: '100vw', overflowX: 'hidden' }}>
      <div style={{ 
        display: 'flex', 
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between', 
        alignItems: isMobile ? 'flex-start' : 'center', 
        marginBottom: 24,
        gap: 16
      }}>
        <div>
          <Title level={isMobile ? 3 : 2} style={{ margin: 0 }}>🎟️ {t('marketing.coupons.title')}</Title>
          <Text type="secondary">{t('marketing.coupons.subtitle')}</Text>
        </div>
        <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={handleAddNew} 
            size="large"
            block={isMobile}
            style={{ borderRadius: '12px' }}
        >
          {t('marketing.coupons.new_button')}
        </Button>
      </div>

      <AntdCard variant="borderless" styles={{ body: { padding: isMobile ? 0 : 24 } }} style={{ borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        {!isMobile ? (
          <Table 
            columns={columns} 
            dataSource={coupons} 
            rowKey="id" 
            loading={loading}
            pagination={{ 
                pageSize: 10,
                showTotal: (total) => `${t('users.total')}: ${total}`
            }}
            bordered
          />
        ) : (
          <List
            loading={loading}
            dataSource={coupons}
            renderItem={(item: any) => (
              <AntdCard 
                size="small" 
                style={{ margin: '12px', borderRadius: '12px', border: '1px solid #f0f0f0' }}
                actions={[
                  <Button type="text" key="edit" icon={<EditOutlined />} onClick={() => handleEdit(item)}>{t('common.edit')}</Button>,
                  <Popconfirm
                    key="delete"
                    title={t('marketing.coupons.messages.delete_confirm')}
                    onConfirm={() => handleDelete(item.id)}
                    okText={t('common.yes')}
                    cancelText={t('common.no')}
                  >
                    <Button type="text" danger icon={<DeleteOutlined />}>{t('common.delete')}</Button>
                  </Popconfirm>
                ]}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text strong style={{ fontSize: '18px', letterSpacing: '1px' }}>{item.code}</Text>
                  <Tag color={item.isActive ? 'success' : 'default'}>{item.isActive ? t('users.active') : t('users.inactive')}</Tag>
                </div>
                
                <div style={{ marginBottom: 12 }}>
                  {item.discountType === 'PERCENTAGE' 
                    ? <Tag color="blue" icon={<PercentageOutlined />}> {item.discountValue}%</Tag>
                    : <Tag color="green" icon={<DollarOutlined />}> ${item.discountValue}</Tag>
                  }
                  <Text type="secondary" style={{ fontSize: '13px', marginLeft: 8 }}>
                    {t('marketing.coupons.usage_text', { 
                      used: item.usedCount, 
                      limit: item.usageLimit ? `/ ${item.usageLimit}` : '' 
                    })}
                  </Text>
                </div>

                {item.targetTiers && item.targetTiers.length > 0 ? (
                  <div style={{ marginTop: 8 }}>
                    {item.targetTiers.map((tier: string) => <Tag key={tier}>{tier}</Tag>)}
                  </div>
                ) : (
                  <Tag color="default">{t('marketing.coupons.all_customers')}</Tag>
                )}
              </AntdCard>
            )}
            pagination={{ pageSize: 5, simple: true, style: { textAlign: 'center', marginBottom: 16 } }}
          />
        )}
      </AntdCard>

      <Modal
        title={isEditing ? t('marketing.coupons.modal.edit_title') : t('marketing.coupons.modal.new_title')}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={() => form.submit()}
        okText={t('marketing.coupons.modal.save_button')}
        width={isMobile ? '95%' : 750}
        forceRender
      >
        <Form form={form} layout="vertical" onFinish={handleSave} style={{ marginTop: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
            <Form.Item label={t('marketing.coupons.modal.code_label')} name="code" rules={[{ required: true, message: t('marketing.coupons.modal.code_required') }]}>
              <Input placeholder={t('marketing.coupons.modal.code_placeholder')} style={{ textTransform: 'uppercase', fontWeight: 'bold' }} />
            </Form.Item>

            <Form.Item label={t('cash_register.status')} name="isActive" valuePropName="checked">
               <Switch checkedChildren={t('users.active')} unCheckedChildren={t('users.inactive')} />
            </Form.Item>
          </div>

          <Form.Item label={t('marketing.coupons.modal.description_label')} name="description">
            <Input.TextArea rows={2} placeholder={t('marketing.coupons.modal.description_placeholder')} />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
            <Form.Item label={t('marketing.coupons.modal.discount_calc')} name="discountType" rules={[{ required: true, message: t('common.required') }]}>
              <Select>
                <Option value="PERCENTAGE">{t('marketing.coupons.modal.percentage')}</Option>
                <Option value="FIXED_AMOUNT">{t('marketing.coupons.modal.fixed_amount')}</Option>
              </Select>
            </Form.Item>

            <Form.Item label={t('marketing.coupons.modal.discount_value')} name="discountValue" rules={[{ required: true, message: t('common.required') }]}>
              <InputNumber style={{ width: '100%' }} min={0.01} step={0.01} placeholder="0.00" />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
             <Form.Item label={t('marketing.coupons.modal.global_limit')} name="usageLimit" tooltip={t('marketing.coupons.modal.limit_tooltip')}>
               <InputNumber style={{ width: '100%' }} min={1} placeholder={t('marketing.coupons.unlimited')} />
             </Form.Item>
             <Form.Item label={t('marketing.coupons.modal.min_purchase')} name="minPurchaseAmount">
               <InputNumber style={{ width: '100%' }} min={0.01} step={1} placeholder="0.00" />
             </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
             <Form.Item label={t('marketing.coupons.modal.valid_from')} name="startDate">
               <DatePicker style={{ width: '100%' }} showTime format="MM/DD/YYYY HH:mm:ss" />
             </Form.Item>
             <Form.Item label={t('marketing.coupons.modal.expires_on')} name="endDate">
               <DatePicker style={{ width: '100%' }} showTime format="MM/DD/YYYY HH:mm:ss" />
             </Form.Item>
          </div>

          <Title level={5} style={{ marginTop: 24, marginBottom: 16 }}>{t('marketing.coupons.modal.constraints_title')}</Title>

          <div style={{ border: '1px solid #f0f0f0', padding: 20, borderRadius: 12, background: '#fafafa' }}>
            <Form.Item label={t('marketing.coupons.modal.single_use')} name="isSingleUsePerClient" valuePropName="checked" tooltip={t('marketing.coupons.modal.single_use_tooltip')}>
              <Switch />
            </Form.Item>

            <Form.Item label={t('marketing.coupons.modal.target_tiers')} name="targetTiers" tooltip={t('marketing.coupons.modal.target_tiers_tooltip')}>
               <Select mode="multiple" placeholder={t('common.select_placeholder', { defaultValue: 'Select...' })}>
                 <Option value="VIP">VIP</Option>
                 <Option value="GOLD">Gold</Option>
                 <Option value="SILVER">Silver</Option>
                 <Option value="BRONZE">Bronze</Option>
               </Select>
            </Form.Item>

            <Form.Item label={t('marketing.coupons.modal.department_restrict')} name="applicableDepartments" tooltip={t('marketing.coupons.modal.department_tooltip')}>
                <Select mode="tags" placeholder={t('marketing.coupons.all_customers')} disabled />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
