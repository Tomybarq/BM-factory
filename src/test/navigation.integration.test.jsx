import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  isLoadingAuth: false,
  isLoadingPublicSettings: false,
  authError: null,
  navigateToLogin: vi.fn(),
  isAuthenticated: false,
  authChecked: true,
  checkUserAuth: vi.fn(),
}));

vi.mock('@/lib/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => authState,
}));

vi.mock('@/components/Layout', async () => {
  const { Outlet } = await import('react-router-dom');
  return {
    default: () => (
      <div data-testid="layout">
        <Outlet />
      </div>
    ),
  };
});

vi.mock('@/components/ui/toaster', () => ({
  Toaster: () => null,
}));

vi.mock('@/components/ScrollToTop', () => ({
  default: () => null,
}));

vi.mock('@/components/UserNotRegisteredError', () => ({
  default: () => <div>User not registered</div>,
}));

vi.mock('@/lib/PageNotFound', () => ({
  default: () => <div>Page not found</div>,
}));

vi.mock('@/pages/Login', () => ({
  default: () => <div>Login page</div>,
}));

vi.mock('@/pages/Register', () => ({
  default: () => <div>Register page</div>,
}));

vi.mock('@/pages/ForgotPassword', () => ({
  default: () => <div>Forgot password page</div>,
}));

vi.mock('@/pages/ResetPassword', () => ({
  default: () => <div>Reset password page</div>,
}));

vi.mock('@/pages/Dashboard', () => ({
  default: () => <div>Dashboard page</div>,
}));

vi.mock('@/pages/RawMaterials', () => ({
  default: () => <div>Raw materials page</div>,
}));

vi.mock('@/pages/Packaging', () => ({
  default: () => <div>Packaging page</div>,
}));

vi.mock('@/pages/Products', () => ({
  default: () => <div>Products page</div>,
}));

vi.mock('@/pages/CostCalculator', () => ({
  default: () => <div>Calculator page</div>,
}));

vi.mock('@/pages/ProductionKanban', () => ({
  default: () => <div>Kanban page</div>,
}));

vi.mock('@/pages/Reports', () => ({
  default: () => <div>Reports page</div>,
}));

vi.mock('@/pages/GoogleSheetsSettings', () => ({
  default: () => <div>Sheets settings page</div>,
}));

import App from '@/App';

const visit = (path) => {
  window.history.pushState({}, '', path);
};

describe('application navigation', () => {
  beforeEach(() => {
    authState.isLoadingAuth = false;
    authState.isLoadingPublicSettings = false;
    authState.authError = null;
    authState.isAuthenticated = false;
    authState.authChecked = true;
    vi.clearAllMocks();
  });

  afterEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('renders public authentication routes without requiring a session', () => {
    visit('/login');

    render(<App />);

    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('redirects an unauthenticated user from a protected route to login', async () => {
    visit('/reports');

    render(<App />);

    expect(await screen.findByText('Login page')).toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe('/login'));
    expect(authState.checkUserAuth).not.toHaveBeenCalled();
  });

  it('renders a protected route for an authenticated user', () => {
    authState.isAuthenticated = true;
    visit('/reports');

    render(<App />);

    expect(screen.getByText('Reports page')).toBeInTheDocument();
    expect(screen.getByTestId('layout')).toBeInTheDocument();
  });

  it('renders the not-found route for unknown locations', () => {
    visit('/does-not-exist');

    render(<App />);

    expect(screen.getByText('Page not found')).toBeInTheDocument();
  });
});
