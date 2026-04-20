export interface BusinessContext {
  timestamp: string;
  period: 'today' | 'week' | 'month';
  currency?: string;
  exchangeRateUsed?: number;
  sales: {
    today: number;
    yesterday: number;
    thisMonth: number;
    lastMonth: number;
    trend: 'up' | 'down' | 'stable';
    percentChange: number;
  };
  inventory: {
    totalValue: number;
    totalProducts: number;
    criticalStock: Array<{
      name: string;
      sku: string;
      stock: number;
      minStock: number;
    }>;
    topProducts: Array<{
      name: string;
      revenue: number;
      units: number;
    }>;
  };
  finances: {
    cashBalance: number;
    accountsReceivable: number;
    accountsPayable: number;
    totalExpenses: number;
    totalPurchases: number;
    profit: number;
    profitMargin: number;
  };
  alerts: Array<{
    type: 'stock' | 'payment' | 'sales' | 'expense';
    message: string;
    severity: 'high' | 'medium' | 'low';
  }>;
}

export interface AIDiagnosis {
  summary: string;
  salesAnalysis: string;
  financialBalance: string;
  overallStatus: 'healthy' | 'warning' | 'critical';
}

export interface AIRecommendation {
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action: string;
  category: 'sales' | 'inventory' | 'finance' | 'operations';
}

export interface AIInsightsResponse {
  diagnosis: AIDiagnosis;
  generatedAt: string;
  contextPeriod: string;
}

export interface AIChatRequest {
  message: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface AIChatResponse {
  response: string;
  timestamp: string;
}
