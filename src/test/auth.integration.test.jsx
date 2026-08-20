import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.hoisted(() => ({
  register: vi.fn(),
  verifyOtp: vi.fn(),
  resendOtp: vi.fn(),
  loginWithProvider: vi.fn(),
  resetPasswordRequest: vi.fn(),
}));

const toastMock = vi.hoisted(() => vi.fn());

vi.mock('@/api/base44Client', () => ({
  base44: { auth: authMock },
}));

vi.mock('@/components/ui/use-toast', () => ({
  toast: toastMock,
  useToast: () => ({ toast: toastMock }),
}));

vi.mock('@/components/ui/input-otp', () => ({
  InputOTP: ({ value, onChange, children, ...props }) => (
    <div>
      <input aria-label="verification code" value={value} onChange={(event) => onChange(event.target.value)} {...props} />
      {children}
    </div>
  ),
  InputOTPGroup: ({ children }) => <div>{children}</div>,
  InputOTPSlot: () => null,
}));

import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';

const renderWithRouter = (ui) => render(<MemoryRouter initialEntries={['/']}>{ui}</MemoryRouter>);

describe('authentication flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.register.mockResolvedValue({ user: { id: 'u-1' }, session: null });
    authMock.verifyOtp.mockResolvedValue({ access_token: 'token' });
    authMock.resendOtp.mockResolvedValue({});
    authMock.resetPasswordRequest.mockResolvedValue({});
  });

  it('registers an account and moves the user to email verification', async () => {
    const user = userEvent.setup();
    renderWithRouter(<Register />);

    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret123');
    await user.type(screen.getByLabelText('Confirm Password'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(authMock.register).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'secret123',
    }));
    expect(await screen.findByText('Verify your email')).toBeInTheDocument();
    expect(screen.getByText('We sent a code to user@example.com')).toBeInTheDocument();
  });

  it('resends an OTP from the verification step', async () => {
    const user = userEvent.setup();
    renderWithRouter(<Register />);

    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret123');
    await user.type(screen.getByLabelText('Confirm Password'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await screen.findByText('Verify your email');

    await user.click(screen.getByRole('button', { name: 'Resend' }));

    await waitFor(() => expect(authMock.resendOtp).toHaveBeenCalledWith('user@example.com'));
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Code sent' }));
  });

  it('shows a non-enumerating success message after a password reset request fails', async () => {
    const user = userEvent.setup();
    authMock.resetPasswordRequest.mockRejectedValue(new Error('network failure'));
    renderWithRouter(<ForgotPassword />);

    await user.type(screen.getByLabelText('Email address'), 'user@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    await waitFor(() => expect(authMock.resetPasswordRequest).toHaveBeenCalledWith('user@example.com'));
    expect(await screen.findByText(/If an account exists with that email/i)).toBeInTheDocument();
  });
});
