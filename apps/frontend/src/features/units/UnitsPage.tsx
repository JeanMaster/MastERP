import { useState } from 'react';
import { Card, Table, Button, Space, Input, message, Popconfirm, Tag, Grid } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { unitsApi } from '../../services/unitsApi';
import type { Unit } from '../../services/unitsApi';
import { UnitFormModal } from './UnitFormModal';

const { useBreakpoint } = Grid;

export const UnitsPage = () => {
    const screens = useBreakpoint();
    const isMobile = !screens.lg;
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const queryClient = useQueryClient();

    // Fetch units
    const { data: units = [], isLoading } = useQuery({
        queryKey: ['units'],
        queryFn: unitsApi.getAll,
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: unitsApi.delete,
        onSuccess: () => {
            message.success('Unidad eliminada exitosamente');
            queryClient.invalidateQueries({ queryKey: ['units'] });
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Error al eliminar unidad');
        },
    });

    const handleAdd = () => {
        setEditingUnit(null);
        setIsModalOpen(true);
    };

    const handleEdit = (unit: Unit) => {
        setEditingUnit(unit);
        setIsModalOpen(true);
    };

    const handleDelete = (id: string) => {
        deleteMutation.mutate(id);
    };

    const handleModalClose = () => {
        setIsModalOpen(false);
        setEditingUnit(null);
    };

    // Filter units
    const filteredData = units.filter((unit) =>
        unit.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        unit.abbreviation.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const columns = [
        {
            title: 'Nombre',
            dataIndex: 'name',
            key: 'name',
            width: '40%',
        },
        {
            title: 'Abreviación',
            dataIndex: 'abbreviation',
            key: 'abbreviation',
            width: '30%',
            render: (text: string) => <Tag color="blue">{text}</Tag>,
        },
        {
            title: 'Acciones',
            key: 'actions',
            width: '30%',
            render: (_: any, record: Unit) => (
                <Space>
                    <Button
                        type="link"
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                    >
                        Editar
                    </Button>
                    <Popconfirm
                        title="¿Eliminar unidad?"
                        description="Esta acción no se puede deshacer"
                        onConfirm={() => handleDelete(record.id)}
                        okText="Eliminar"
                        cancelText="Cancelar"
                    >
                        <Button type="link" danger icon={<DeleteOutlined />}>
                            Eliminar
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <Card
            title="Unidades de Medida"
            extra={
                <Space direction={isMobile ? 'vertical' : 'horizontal'} style={{ width: isMobile ? '100%' : 'auto' }} align={isMobile ? 'end' : 'center'}>
                    <Input
                        placeholder="Buscar unidad..."
                        prefix={<SearchOutlined />}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: isMobile ? '100%' : 250 }}
                    />
                    <Space>
                        <Button icon={<ReloadOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['units'] })} />
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                            {isMobile ? 'Nueva' : 'Nueva Unidad'}
                        </Button>
                    </Space>
                </Space>
            }
        >
            <Table
                columns={columns}
                dataSource={filteredData}
                rowKey="id"
                loading={isLoading}
                pagination={{ pageSize: 20 }}
                scroll={{ x: 'max-content' }}
            />

            <UnitFormModal
                open={isModalOpen}
                unit={editingUnit}
                onClose={handleModalClose}
            />
        </Card>
    );
};
