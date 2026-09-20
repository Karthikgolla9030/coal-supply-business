import { useNavigate } from 'react-router-dom';
import { 
  ShoppingCart, Tag, Package, Receipt, Users, Truck, TrendingUp, BarChart2, ArrowRight
} from 'lucide-react';

const REPORT_CARDS = [
  {
    title: 'PURCHASE REPORT',
    description: 'See what you purchased, from whom, and at what cost.',
    icon: <ShoppingCart size={24} color="var(--color-primary)" />,
    path: '/reports/purchase',
  },
  {
    title: 'SALES REPORT',
    description: 'See what you sold, to whom, and at what value.',
    icon: <Tag size={24} color="var(--color-primary)" />,
    path: '/reports/sales',
  },
  {
    title: 'STOCK REPORT',
    description: 'See purchased, sold, and available coal.',
    icon: <Package size={24} color="var(--color-primary)" />,
    path: '/reports/stock',
  },
  {
    title: 'EXPENSE REPORT',
    description: 'See where your business expenses are going.',
    icon: <Receipt size={24} color="var(--color-primary)" />,
    path: '/reports/expense',
  },
  {
    title: 'CUSTOMER REPORT',
    description: 'See sales activity by customer.',
    icon: <Users size={24} color="var(--color-primary)" />,
    path: '/reports/customer',
  },
  {
    title: 'SUPPLIER REPORT',
    description: 'See purchase activity by supplier.',
    icon: <Truck size={24} color="var(--color-primary)" />,
    path: '/reports/supplier',
  },
  {
    title: 'PROFIT & LOSS',
    description: 'See estimated business profitability.',
    icon: <TrendingUp size={24} color="var(--color-primary)" />,
    path: '/profit-loss',
  },
];

export default function Reports() {
  const navigate = useNavigate();

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">View and analyze detailed business activity.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem', marginTop: '1rem' }}>
        {REPORT_CARDS.map((card, i) => (
          <div key={i} className="card" style={{ padding: '1.5rem', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s', display: 'flex', flexDirection: 'column', height: '100%' }} onClick={() => navigate(card.path)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-primary-light)', borderRadius: '8px' }}>
                {card.icon}
              </div>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)' }}>
                {card.title}
              </div>
            </div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', flex: 1, marginBottom: '1.5rem' }}>
              {card.description}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', color: 'var(--color-primary)', fontWeight: 600, alignItems: 'center', gap: '0.5rem' }}>
              View Report <ArrowRight size={16} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
