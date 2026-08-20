import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
  auth: {
    getUser: vi.fn(),
    signUp: vi.fn(),
    verifyOtp: vi.fn(),
    resend: vi.fn(),
    signInWithOAuth: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
  },
  functions: {
    invoke: vi.fn(),
  },
}));

vi.mock('@/api/supabaseClient', () => ({ supabase: supabaseMock }));

import { base44 } from '@/api/base44Client';

const createQuery = (result) => {
  const query = {
    select: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return query;
};

describe('base44Client auth contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/');
  });

  it('registers a user through Supabase Auth', async () => {
    const data = { user: { id: 'u-1', email: 'user@example.com' }, session: null };
    supabaseMock.auth.signUp.mockResolvedValue({ data, error: null });

    await expect(base44.auth.register({ email: 'user@example.com', password: 'secret123' }))
      .resolves.toEqual(data);

    expect(supabaseMock.auth.signUp).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'secret123',
    });
  });

  it('verifies signup OTP using the expected Supabase token contract', async () => {
    const session = { access_token: 'access-token' };
    supabaseMock.auth.verifyOtp.mockResolvedValue({ data: { session }, error: null });

    await expect(base44.auth.verifyOtp({ email: 'user@example.com', otpCode: '123456' }))
      .resolves.toEqual(session);

    expect(supabaseMock.auth.verifyOtp).toHaveBeenCalledWith({
      email: 'user@example.com',
      token: '123456',
      type: 'signup',
    });
  });

  it('sends password reset requests to the configured reset route', async () => {
    supabaseMock.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    window.history.replaceState({}, '', '/forgot-password');

    await base44.auth.resetPasswordRequest('user@example.com');

    expect(supabaseMock.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'user@example.com',
      { redirectTo: 'http://localhost:3000/reset-password' },
    );
  });

  it('lists entities with descending order and an optional limit', async () => {
    const query = createQuery({ data: [{ id: 'calc-1' }], error: null });
    supabaseMock.from.mockReturnValue(query);

    await expect(base44.entities.Calculation.list('-created_date', 100))
      .resolves.toEqual([{ id: 'calc-1' }]);

    expect(supabaseMock.from).toHaveBeenCalledWith('Calculation');
    expect(query.order).toHaveBeenCalledWith('created_date', { ascending: false });
    expect(query.limit).toHaveBeenCalledWith(100);
  });

  it('invokes exportCostReports and returns its function payload directly', async () => {
    const payload = { exported: 2, failed: 0 };
    supabaseMock.functions.invoke.mockResolvedValue({ data: payload, error: null });

    await expect(base44.functions.invoke('exportCostReports', {})).resolves.toEqual(payload);

    expect(supabaseMock.functions.invoke).toHaveBeenCalledWith('exportCostReports', {
      body: {},
    });
  });

  it('starts OAuth login with an origin-based redirect URL', async () => {
    const data = { provider: 'google' };
    supabaseMock.auth.signInWithOAuth.mockResolvedValue({ data, error: null });

    await expect(base44.auth.loginWithProvider('google', '/'))
      .resolves.toEqual(data);

    expect(supabaseMock.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'http://localhost:3000/' },
    });
  });

  it('updates the authenticated user password during reset flow', async () => {
    const data = { user: { id: 'u-1' } };
    supabaseMock.auth.updateUser.mockResolvedValue({ data, error: null });

    await expect(base44.auth.resetPassword({ resetToken: 'ignored', newPassword: 'new-secret' }))
      .resolves.toEqual(data);

    expect(supabaseMock.auth.updateUser).toHaveBeenCalledWith({ password: 'new-secret' });
  });

  it('surfaces Supabase Auth errors to callers', async () => {
    const error = new Error('Invalid verification code');
    supabaseMock.auth.verifyOtp.mockResolvedValue({ data: null, error });

    await expect(base44.auth.verifyOtp({ email: 'user@example.com', otpCode: '000000' }))
      .rejects.toThrow('Invalid verification code');
  });
});
