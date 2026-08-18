/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Lock, Mail, Loader2, AlertCircle, Truck, ArrowLeft, Layers, CreditCard, TrendingUp } from 'lucide-react';
import type { AdminUser } from '../types.js';

interface AdminLoginProps {
  onLoginSuccess: (token: string, user: AdminUser) => void;
}

export default function AdminLogin({ onLoginSuccess }: AdminLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
        throw new Error(
          body?.error || 'Invalid email or password credentials. Please try again.'
        );
      }
      const data = await res.json();
      onLoginSuccess(data.token, data.user);
    } catch (err: any) {
      setError(err.message || 'Server connection failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[var(--wp-bg)] text-slate-900 font-sans grid lg:grid-cols-2">
      {/* ---------- Left: aurora brand panel (desktop) ---------- */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden p-12 text-white" style={{ background: 'var(--wp-grad)' }}>
        <div
          className="absolute inset-0 opacity-25"
          style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.55) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
          aria-hidden="true"
        />
        <div className="absolute -bottom-24 -left-16 h-[360px] w-[360px] rounded-full bg-white/15 blur-[90px]" aria-hidden="true" />

        <div className="relative">
          <a href="/" className="inline-flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur border border-white/30">
              <Truck className="h-5 w-5" />
            </div>
            <div className="leading-none">
              <span className="block text-lg font-semibold font-display">GO DISPATCH</span>
              <span className="block text-xs font-mono uppercase tracking-[0.18em] text-white/70 mt-0.5">Operations Console</span>
            </div>
          </a>
        </div>

        <div className="relative max-w-md">
          <h2 className="font-display text-3xl font-semibold tracking-tight leading-tight">
            Run the whole dispatch operation from one console.
          </h2>
          <p className="mt-4 text-white/80 leading-relaxed">
            Sign in to manage the delivery pipeline, record manual payments, tune pricing, and audit
            every status change across your fleet.
          </p>

          <div className="mt-8 space-y-3">
            {[
              { icon: TrendingUp, label: 'Live revenue & booking analytics' },
              { icon: Layers, label: 'Move parcels through the dispatch board' },
              { icon: CreditCard, label: 'Auditable manual payment ledger' },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-3 text-sm text-white/90">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 backdrop-blur border border-white/25">
                  <f.icon className="h-4 w-4" />
                </div>
                {f.label}
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-xs text-white/60 font-mono">
          GO DISPATCH — Staff access only.
        </div>
      </div>

      {/* ---------- Right: sign-in form ---------- */}
      <div className="flex flex-col items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <a href="/" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-red-700 transition-colors mb-8">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to the GO DISPATCH site
          </a>

          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl text-white" style={{ background: 'var(--wp-grad)' }}>
              <Truck className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold font-display text-slate-900">GO DISPATCH staff</span>
          </div>

          <div className="mb-8">
            <h1 className="font-display text-2xl font-semibold text-slate-900 tracking-tight">Sign in to the console</h1>
            <p className="mt-2 text-sm text-slate-500">Administrative staff, couriers, and pricing controllers.</p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-6 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2"
            >
              <AlertCircle className="h-4.5 w-4.5 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="input_admin_email" className="block text-sm font-medium text-slate-600 mb-1.5">
                Staff email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  id="input_admin_email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-slate-200 bg-white text-slate-900 pl-10 pr-4 py-2.5 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 placeholder-slate-400 shadow-sm transition-all"
                />
              </div>
            </div>

            <div>
              <label htmlFor="input_admin_password" className="block text-sm font-medium text-slate-600 mb-1.5">
                Access password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  id="input_admin_password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-white text-slate-900 pl-10 pr-16 py-2.5 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 placeholder-slate-400 shadow-sm transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-2.5 text-xs font-medium text-slate-400 hover:text-slate-700 transition-colors"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button
              id="btn_admin_signin"
              type="submit"
              disabled={loading}
              className="btn-aurora w-full inline-flex items-center justify-center gap-2 rounded-xl text-white font-medium py-3 text-sm transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign in to console'
              )}
            </button>
          </form>

          {/* No credentials are printed here. This page is reachable by anyone
              who finds the URL, and a login screen that tells you the password
              is not a login screen. Staff accounts are issued from the console
              by an owner. */}
          <p className="mt-8 text-sm text-slate-500 leading-relaxed">
            Access is issued by an account owner. If you have been locked out, ask
            an owner to issue you a new password from the staff console.
          </p>
        </div>
      </div>
    </div>
  );
}
