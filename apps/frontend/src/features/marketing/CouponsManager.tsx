import { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, DatePicker, InputNumber, Switch, message, Tag, Typography, Select } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PercentageOutlined, DollarOutlined } from '@ant-design/icons';
import { marketingApi } from '../../services/marketingApi';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

export default function CouponsManager() {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();
  
  // F9 Keyboard Shortcut
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
      message.error('Error al cargar cupones');
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
      message.success('Cupón eliminado con éxito');
      fetchCoupons();
    } catch (error) {
       message.error('Error al eliminar cupón. Es posible que ya tenga uso histórico.');
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
        message.success('Cupón actualizado');
      } else {
        await marketingApi.createCoupon(payload);
        message.success('Cupón creado');
      }
      setIsModalVisible(false);
      fetchCoupons();
    } catch (error) {
      console.error(error);
      message.error('Error al guardar el cupón');
    }
  };

  const columns = [
    {
      title: 'Código',
      dataIndex: 'code',
      key: 'code',
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: 'Tipo',
      dataIndex: 'discountType',
      key: 'discountType',
      render: (type: string, record: any) => (
        type === 'PERCENTAGE' 
          ? <Tag color="blue" icon={<PercentageOutlined />}> {record.discountValue}%</Tag>
          : <Tag color="green" icon={<DollarOutlined />}> ${record.discountValue}</Tag>
      )
    },
    {
      title: 'Uso',
      key: 'usage',
      render: (_: any, record: any) => (
        <Text>
          {record.usedCount} {record.usageLimit ? `/ ${record.usageLimit}` : ''} usos
        </Text>
      )
    },
    {
      title: 'Tiers',
      dataIndex: 'targetTiers',
      key: 'targetTiers',
      render: (tiers: string[]) => (
        tiers && tiers.length > 0 ? tiers.map(t => <Tag key={t}>{t}</Tag>) : <Tag>Todos</Tag>
      )
    },
    {
      title: 'Estado',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (active: boolean) => (
        <Tag color={active ? 'success' : 'default'}>{active ? 'Activo' : 'Inactivo'}</Tag>
      )
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Códigos de Cupones</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddNew}>
          Nuevo Cupón (F9)
        </Button>
      </div>

      <Table 
        columns={columns} 
        dataSource={coupons} 
        rowKey="id" 
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={isEditing ? 'Editar Cupón' : 'Nuevo Cupón'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={() => form.submit()}
        okText="Guardar (F9)"
        width={700}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item label="Código Promocional" name="code" rules={[{ required: true, message: 'Requerido' }]}>
              <Input placeholder="Ej: XMAS20" style={{ textTransform: 'uppercase' }} />
            </Form.Item>

            <Form.Item label="Estado" name="isActive" valuePropName="checked">
               <Switch checkedChildren="Activo" unCheckedChildren="Inactivo" />
            </Form.Item>
          </div>

          <Form.Item label="Descripción" name="description">
            <Input.TextArea rows={2} placeholder="Opcional. Ej: Promoción navideña." />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item label="Tipo de Descuento" name="discountType" rules={[{ required: true, message: 'Requerido' }]}>
              <Select>
                <Option value="PERCENTAGE">Porcentaje (%)</Option>
                <Option value="FIXED_AMOUNT">Monto Fijo ($)</Option>
              </Select>
            </Form.Item>

            <Form.Item label="Valor del Descuento" name="discountValue" rules={[{ required: true, message: 'Requerido' }]}>
              <InputNumber style={{ width: '100%' }} min={0.01} step={0.01} />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
             <Form.Item label="Límite Global de Usos" name="usageLimit" tooltip="Dejar en blanco para ilimitado">
               <InputNumber style={{ width: '100%' }} min={1} placeholder="Ilimitado" />
             </Form.Item>
             <Form.Item label="Compra Mínima Requerida ($)" name="minPurchaseAmount">
               <InputNumber style={{ width: '100%' }} min={0.01} step={1} placeholder="Monto mínimo" />
             </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
             <Form.Item label="Fecha de Inicio" name="startDate">
               <DatePicker style={{ width: '100%' }} showTime format="YYYY-MM-DD HH:mm:ss" />
             </Form.Item>
             <Form.Item label="Fecha Fin" name="endDate">
               <DatePicker style={{ width: '100%' }} showTime format="YYYY-MM-DD HH:mm:ss" />
             </Form.Item>
          </div>

          <Title level={5} style={{ marginTop: 16 }}>Restricciones de Uso</Title>

          <div style={{ border: '1px solid #f0f0f0', padding: 16, borderRadius: 8, background: '#fafafa' }}>
            <Form.Item label="Single Use (1 por cliente)" name="isSingleUsePerClient" valuePropName="checked" tooltip="Evita que un mismo cliente use este código más de 1 vez.">
              <Switch />
            </Form.Item>

            <Form.Item label="Exclusivo para Tiers" name="targetTiers" tooltip="Si se deja vacío, aplica para cualquier cliente local">
               <Select mode="multiple" placeholder="Seleccione Tiers">
                 <Option value="VIP">VIP</Option>
                 <Option value="GOLD">Oro</Option>
                 <Option value="SILVER">Plata</Option>
                 <Option value="BRONZE">Bronce</Option>
               </Select>
            </Form.Item>

            {/* In a fuller implementation, applicableDepartments and Products could be populated remotely */}
            <Form.Item label="Restringir por Departamentos (Opcional)" name="applicableDepartments" tooltip="Pronto disponible. Si está vacío aplica a toda la tienda.">
                <Select mode="tags" disabled placeholder="Dejar vacío (Aplica a todo)" />
            </Form.Item>
          </div>

        </Form>
      </Modal>
    </div>
  );
}
