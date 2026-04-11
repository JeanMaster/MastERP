import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { payrollApi } from '../services/payrollApi';
import { Typography, Card, Table, Button, Descriptions, Divider, Spin } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export const PayrollDetailPage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const { data: period, isLoading } = useQuery({
        queryKey: ['payroll-period', id],
        queryFn: () => payrollApi.findOnePeriod(id!),
        enabled: !!id
    });

    if (isLoading) return <div style={{ padding: 50, textAlign: 'center' }}><Spin size="large" /></div>;
    if (!period) return <div>Periodo no encontrado</div>;

    const columns = [
        {
            title: 'Empleado',
            key: 'employee',
            render: (_: any, record: any) => (
                <Text strong>{record.employee.firstName} {record.employee.lastName}</Text>
            )
        },
        {
            title: 'Cargo',
            key: 'position',
            render: (_: any, record: any) => record.employee.position
        },
        {
            title: 'Sueldo Base',
            dataIndex: 'baseSalary',
            key: 'baseSalary',
            render: (val: any) => <span>{Number(val).toFixed(2)}</span>
        },
        {
            title: 'Asignaciones',
            dataIndex: 'totalIncome',
            key: 'totalIncome',
            render: (val: any) => <span style={{ color: 'green' }}>{Number(val).toFixed(2)}</span>
        },
        {
            title: 'Deducciones',
            dataIndex: 'totalDeductions',
            key: 'totalDeductions',
            render: (val: any) => <span style={{ color: 'red' }}>{Number(val).toFixed(2)}</span>
        },
        {
            title: 'Neto a Pagar',
            dataIndex: 'netAmount',
            key: 'netAmount',
            render: (val: any) => <Text strong>{Number(val).toFixed(2)}</Text>
        }
    ];

    return (
        <div style={{ padding: '24px' }}>
            <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate('/app/hr/payroll')}
                style={{ marginBottom: 16 }}
            >
                Volver
            </Button>

            <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <Title level={3}>{period.name}</Title>
                        <Descriptions size="small" column={2}>
                            <Descriptions.Item label="Desde">{dayjs(period.startDate).format('DD/MM/YYYY')}</Descriptions.Item>
                            <Descriptions.Item label="Hasta">{dayjs(period.endDate).format('DD/MM/YYYY')}</Descriptions.Item>
                            <Descriptions.Item label="Estado">
                                <span style={{ fontWeight: 'bold' }}>{period.status}</span>
                            </Descriptions.Item>
                            <Descriptions.Item label="Total Nómina">
                                <span style={{ fontSize: 18, fontWeight: 'bold' }}>{Number(period.totalAmount).toFixed(2)}</span>
                            </Descriptions.Item>
                        </Descriptions>
                    </div>
                    <Button icon={<PrinterOutlined />}>Imprimir Recibos</Button>
                </div>

                <Divider />

                <Title level={5}>Listado de Pagos</Title>
                <Table
                    columns={columns}
                    dataSource={period.payments || []}
                    rowKey="id"
                    pagination={false}
                />
            </Card>
        </div>
    );
};
