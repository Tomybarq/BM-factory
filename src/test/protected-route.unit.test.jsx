import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  isAuthenticated: false,
  isLoadingAuth: false,
  authChecked: true,
  authError: null,
  checkUserAuth: vi.fn(),
}));

vi.mock('@/lib/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('@/components/UserNotRegisteredError', () => ({
  default: () => <div>User not registered</div>,
}));

import ProtectedRoute from '@/components/ProtectedRoute';

const renderRoute = () => render(
  <MemoryRouter initialEntries={['/protected']}>
    <Routes>
      <Route
        path="/protected"
        element={<ProtectedRoute fallback={<div>Loading route</div>} unauthenticatedElement={<div>Login fallback</div>} />}
      >
        <Route index element={<div>Protected content</div>} />
      </Route>
    </Routes>
  </MemoryRouter>,
);

describe('ProtectedRoute', () => {
  beforeEach(() => {
    authState.isAuthenticated = false;
    authState.isLoadingAuth = false;
    authState.authChecked = true;
    authState.authError = null;
    vi.clearAllMocks();
  });

  it('shows the fallback while authentication is loading', () => {
    authState.isLoadingAuth = true;

    renderRoute();

    expect(screen.getByText('Loading route')).toBeInTheDocument();
    expect(authState.checkUserAuth).not.toHaveBeenCalled();
  });

  it('checks authentication when it has not been checked yet', async () => {
    authState.authChecked = false;

    renderRoute();

    expect(screen.getByText('Loading route')).toBeInTheDocument();
    await waitFor(() => expect(authState.checkUserAuth).toHaveBeenCalledTimes(1));
  });

  it('shows the dedicated error for a user who is not registered', () => {
    authState.authError = { type: 'user_not_registered' };

    renderRoute();

    expect(screen.getByText('User not registered')).toBeInTheDocument();
  });

  it('uses the unauthenticated fallback for other authentication errors', () => {
    authState.authError = { type: 'unknown', message: 'network failure' };

    renderRoute();

    expect(screen.getByText('Login fallback')).toBeInTheDocument();
  });

  it('uses the unauthenticated fallback when there is no active session', () => {
    renderRoute();

    expect(screen.getByText('Login fallback')).toBeInTheDocument();
  });

  it('renders the nested protected content for an authenticated user', () => {
    authState.isAuthenticated = true;

    renderRoute();

    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });
});
