/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import PasswordField from './PasswordField.js';
import type { AdminUser } from '../types.js';

interface AdminLoginProps {
  onLoginSuccess: (token: string, user: AdminUser) => void;
}

/**
 * The way into the console.
 *
 * Two or three people ever sign in here, perhaps once a week. So this page is
 * not really written for them — it is what a scanner, or a stranger who has
 * the address, sees. It used to sell: half the screen was a red panel with
 * bullet points about analytics and audit ledgers, addressed to an audience
 * who already own the company, and telling anybody who found the path exactly
 * what it guards.
 *
 * Now it is a wordmark, two fields and a button, centred on an empty ground.
 * A single narrow column, because that is the whole task; nothing is explained,
 * because everybody who belongs here already knows.
 *
 * The password can be revealed. There is no reset by email in this product, so
 * a typo made twice the same way locks somebody out of a system that cannot
 * let them back in — see PasswordField.
 */
export default function AdminLogin({ onLoginSuccess }: AdminLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        // Surface what the server actually said — "too many attempts" is very
        // different from "wrong password", and guessing again will not help.
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || 'That email and password did not match.');
      }
      const data = await res.json();
      onLoginSuccess(data.token, data.user);
    } catch (err: any) {
      setError(err.message || 'Could not sign in just now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[var(--wp-bg)] flex flex-col items-center justify-center px-5 py-12">
      <main className="w-full max-w-[22rem]">
        {/* The mark, letterspaced, doing the work a logo and a headline used
            to do between them. */}
        <h1 className="font-mono text-[13px] font-medium uppercase tracking-[0.28em] text-slate-900">
          GO DISPATCH
        </h1>

        <form onSubmit={handleSubmit} className="mt-9 space-y-4">
          <div>
            <label
              htmlFor="input_admin_email"
              className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5"
            >
              Email
            </label>
            <input
              id="input_admin_email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full min-h-12 rounded-2xl border border-slate-200/80 bg-white px-3.5 text-[15px] text-slate-900 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-colors"
            />
          </div>

          <PasswordField
            id="input_admin_password"
            label="Password"
            value={password}
            onChange={setPassword}
            required
            autoComplete="current-password"
          />

          {/* Held between the fields and the button, where the eye already is
              after a failed attempt. */}
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-2xl bg-red-50 px-3.5 py-3 text-[13px] text-red-800"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <button
            id="btn_admin_signin"
            type="submit"
            disabled={loading}
            className="btn-aurora w-full min-h-12 inline-flex items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-white transition-all disabled:opacity-60 cursor-pointer"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Signing in' : 'Sign in'}
          </button>
        </form>
      </main>

      {/* No credentials, no product description, no link to anything. A sign-in
          page that explains what it guards has told a stranger the one thing
          worth withholding. */}
      <p className="mt-10 text-[13px] text-slate-400">Access is issued by an owner.</p>
    </div>
  );
}
