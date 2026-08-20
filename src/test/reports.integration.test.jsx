import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const base44Mock = vi.hoisted(() => ({
  entities: {
    Calculation: {
      list: vi.fn(),
    },
  },
  functions: {
    invoke: vi.fn(),
  },
}));

const toastMock = vi.hoisted(() => vi.fn());

vi.mock('@/api/base44Client', () => ({ base44: base44Mock }));
vi.mock('@/components/ui/use-toast', () => ({
  toast: toastMock,
  useToast: () => ({ toast: toastMock }),
}));

vi.mock('recharts', () => {
  const ChartShell = ({ children }) => <div>{children}</div>;
  return {
    BarChart: ChartShell,
    Bar: ChartShell,
    XAxis: ChartShell,
    YAxis: ChartShell,
    CartesianGrid: ChartShell,
    Tooltip: ChartShell,
    ResponsiveContainer: ChartShell,
    Legend: ChartShell,
  };
});

import Reports from '@/pages/Reports';

const calculations = [
  {
    id: 'calc-1',
    product_name: 'منظف أساسي',
    packaging_size: '1L',
    raw_material_cost: 100,
    packaging_cost: 20,
    manual_cost: 10,
    total_cost: 130,
    cost_per_liter: 130,
    created_date: '2026-08-19T10:00:00.000Z',
  },
  {
    id: 'calc-2',
    product_name: 'منظف متقدم',
    packaging_size: '5L',
    raw_material_cost: 250,
    packaging_cost: 30,
    manual_cost: 20,
    total_cost: 300,
    cost_per_liter: 60,
    created_date: '2026-08-18T10:00:00.000Z',
  },
];

describe('Reports integration flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    base44Mock.entities.Calculation.list.mockResolvedValue(calculations);
    base44Mock.functions.invoke.mockResolvedValue({ exported: 2, failed: 0 });
  });

  it('loads calculations and filters the report by product name', async () => {
    const user = userEvent.setup();
    render(<Reports />);

    expect(screen.getByText('جارٍ التحميل...')).toBeInTheDocument();
    await waitFor(() => expect(base44Mock.entities.Calculation.list).toHaveBeenCalledWith('-created_date', 100));

    expect(await screen.findByText('منظف أساسي')).toBeInTheDocument();
    expect(screen.getByText('منظف متقدم')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('بحث بالمنتج...'), 'متقدم');

    expect(screen.queryByText('منظف أساسي')).not.toBeInTheDocument();
    expect(screen.getByText('منظف متقدم')).toBeInTheDocument();
  });

  it('exports the report to Google Sheets and shows the exported count', async () => {
    const user = userEvent.setup();
    render(<Reports />);
    await screen.findByText('منظف أساسي');

    await user.click(screen.getByRole('button', { name: /تصدير لجوجل شيتس/i }));

    await waitFor(() => expect(base44Mock.functions.invoke).toHaveBeenCalledWith('exportCostReports', {}));
    expect(toastMock).toHaveBeenCalledWith({ title: 'تم تصدير 2 سجل إلى جوجل شيتس' });
  });

  it('shows a destructive toast when Google Sheets export fails', async () => {
    const user = userEvent.setup();
    base44Mock.functions.invoke.mockRejectedValue(new Error('connector unavailable'));
    render(<Reports />);
    await screen.findByText('منظف أساسي');

    await user.click(screen.getByRole('button', { name: /تصدير لجوجل شيتس/i }));

    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'فشل التصدير',
      description: 'connector unavailable',
      variant: 'destructive',
    })));
  });
});
