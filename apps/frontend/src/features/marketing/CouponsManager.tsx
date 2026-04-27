import { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, DatePicker, InputNumber, Switch, message, Tag, Typography, Select } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PercentageOutlined, DollarOutlined } from '@ant-design/icons';
import { marketingApi } from '../../services/marketingApi';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

/**
 * CouponsManager Component
 * Management interface for promotional discount codes.
 * Allows defining global usage limits, expiration dates, minimum purchase requirements, and tier-based restrictions.
 */
export default function CouponsManager() {
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
      message.error('Error loading coupon codes');
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
      message.success('Coupon deleted successfully');
      fetchCoupons();
    } catch (error) {
       message.error('Error deleting coupon. It may have historical usage data.');
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
        message.success('Coupon updated successfully');
      } else {
        await marketingApi.createCoupon(payload);
        message.success('Coupon created successfully');
      }
      setIsModalVisible(false);
      fetchCoupons();
    } catch (error) {
      console.error(error);
      message.error('Error saving the coupon code');
    }
  };

  const columns = [
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      render: (text: string) => <Text strong style={{ letterSpacing: '1px' }}>{text}</Text>
    },
    {
      title: 'Discount Type',
      dataIndex: 'discountType',
      key: 'discountType',
      render: (type: string, record: any) => (
        type === 'PERCENTAGE' 
          ? <Tag color="blue" icon={<PercentageOutlined />}> {record.discountValue}%</Tag>
          : <Tag color="green" icon={<DollarOutlined />}> ${record.discountValue}</Tag>
      )
    },
    {
      title: 'Usage',
      key: 'usage',
      render: (_: any, record: any) => (
        <Text>
          {record.usedCount} {record.usageLimit ? `/ ${record.usageLimit}` : ''} redemptions
        </Text>
      )
    },
    {
      title: 'Applicable Tiers',
      dataIndex: 'targetTiers',
      key: 'targetTiers',
      render: (tiers: string[]) => (
        tiers && tiers.length > 0 ? tiers.map(t => <Tag key={t}>{t}</Tag>) : <Tag color="default">All Customers</Tag>
      )
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      align: 'center' as const,
      render: (active: boolean) => (
        <Tag color={active ? 'success' : 'default'}>{active ? 'Active' : 'Inactive'}</Tag>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_: any, record: any) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} title="Edit coupon" />
          <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} title="Delete coupon" />
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>🎟️ Promotional Coupon Codes</Title>
          <Text type="secondary">Manage marketing campaigns and discount codes.</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddNew} size="large">
          Create New Coupon (F9)
        </Button>
      </div>

      <Table 
        columns={columns} 
        dataSource={coupons} 
        rowKey="id" 
        loading={loading}
        pagination={{ 
            pageSize: 10,
            showTotal: (total) => `Total: ${total} coupons`
        }}
        bordered
      />

      <Modal
        title={isEditing ? 'Edit Coupon Code' : 'Generate New Coupon Code'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={() => form.submit()}
        okText="Save Coupon (F9)"
        width={750}
      >
        <Form form={form} layout="vertical" onFinish={handleSave} style={{ marginTop: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item label="Promotional Code" name="code" rules={[{ required: true, message: 'Please enter a code' }]}>
              <Input placeholder="e.g., XMAS2025" style={{ textTransform: 'uppercase', fontWeight: 'bold' }} />
            </Form.Item>

            <Form.Item label="Status" name="isActive" valuePropName="checked">
               <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
            </Form.Item>
          </div>

          <Form.Item label="Campaign Description (Optional)" name="description">
            <Input.TextArea rows={2} placeholder="Example: Holiday season flash sale promotion." />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item label="Discount Calculation" name="discountType" rules={[{ required: true, message: 'Required' }]}>
              <Select>
                <Option value="PERCENTAGE">Percentage (%)</Option>
                <Option value="FIXED_AMOUNT">Fixed Dollar Amount ($)</Option>
              </Select>
            </Form.Item>

            <Form.Item label="Discount Value" name="discountValue" rules={[{ required: true, message: 'Required' }]}>
              <InputNumber style={{ width: '100%' }} min={0.01} step={0.01} placeholder="0.00" />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
             <Form.Item label="Global Usage Limit" name="usageLimit" tooltip="Leave empty for unlimited redemptions">
               <InputNumber style={{ width: '100%' }} min={1} placeholder="Unlimited" />
             </Form.Item>
             <Form.Item label="Minimum Purchase Required ($)" name="minPurchaseAmount">
               <InputNumber style={{ width: '100%' }} min={0.01} step={1} placeholder="0.00" />
             </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
             <Form.Item label="Valid From (Start Date)" name="startDate">
               <DatePicker style={{ width: '100%' }} showTime format="MM/DD/YYYY HH:mm:ss" />
             </Form.Item>
             <Form.Item label="Expires On (End Date)" name="endDate">
               <DatePicker style={{ width: '100%' }} showTime format="MM/DD/YYYY HH:mm:ss" />
             </Form.Item>
          </div>

          <Title level={5} style={{ marginTop: 24, marginBottom: 16 }}>Usage Constraints</Title>

          <div style={{ border: '1px solid #f0f0f0', padding: 20, borderRadius: 12, background: '#fafafa' }}>
            <Form.Item label="Limit to 1 usage per Customer" name="isSingleUsePerClient" valuePropName="checked" tooltip="Prevents a single customer from using this code multiple times.">
              <Switch />
            </Form.Item>

            <Form.Item label="Target Customer Tiers" name="targetTiers" tooltip="If empty, the coupon applies to all customer tiers.">
               <Select mode="multiple" placeholder="Select applicable tiers">
                 <Option value="VIP">VIP</Option>
                 <Option value="GOLD">Gold</Option>
                 <Option value="SILVER">Silver</Option>
                 <Option value="BRONZE">Bronze</Option>
               </Select>
            </Form.Item>

            <Form.Item label="Restrict by Department (Optional)" name="applicableDepartments" tooltip="If empty, it applies to the entire store inventory.">
                <Select mode="tags" placeholder="Apply to all departments" disabled />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
