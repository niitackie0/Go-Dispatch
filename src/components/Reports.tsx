/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Download, Loader2, FileSpreadsheet, AlertCircle } from 'lucide-react';
import type { AdminUser } from '../types.js';
import { can } from '../capabilities.js';
import { formatAmount } from '../pricing.js';

interface ReportsProps {
  token: string;
  user: AdminUser | null;
}

interface Summary {
  from: string;
  to: string;
  orders: number;
  delivered: number;
  cancelled: number;
  revenue?: number;
  paymentCount?: number;
}

/** Today, and the same day last month, as yyyy-mm-dd. */
function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

export default function Reports({ token, user }: ReportsProps) {
  const initial = defaultRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);

  const canSeeMoney = can(user?.role, 'revenue:read');
  const canSeePayments = can(user?.role, 'payments:read');

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/reports/summary?from=${from}&to=${to}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Could not load the summary for that range.');
      setSummary(await res.json());
    } catch (err: any) {
      setError(err.message || 'Could not load the summary for that range.');
    } finally {
      setLoading(false);
    }
  }, [from, to, token]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  /**
   * Download a report.
   *
   * Fetched with the auth header and turned into a blob rather than pointed at
   * with a plain link: the endpoints require a bearer token, which a browser
   * navigation cannot send.
   */
  const download = async (path: string, name: string) => {
    setDownloading(path);
    setError('');
    try {
      const res = await fetch(`/api/reports/${path}?from=${from}&to=${to}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || 'That report could not be generated.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name}_${from}_to_${to}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'That report could not be generated.');
    } finally {
      setDownloading(null);
    }
  };

  const presets: { label: string; days: number }[] = [
    { label: 'Last 7 days', days: 7 },
    { label: 'Last 30 days', days: 30 },
    { label: 'Last 90 days', days: 90 },
  ];

  const applyPreset = (days: number) => {
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    setFrom(iso(start));
    setTo(iso(end));
  };

  const REPORTS = [
    {
      path: 'orders.csv',
      name: 'go-dispatch-orders',
      title: 'Orders',
      body: 'Every booking in the range with route, weight, rider and status. The operational record.',
      visible: true,
    },
    {
      path: 'payments.csv',
      name: 'go-dispatch-payments',
      title: 'Payments',
      body: 'Every transaction with method, reference and note. What you hand an accountant.',
      visible: canSeePayments,
    },
    {
      path: 'revenue.csv',
      name: 'go-dispatch-revenue',
      title: 'Revenue by day',
      body: 'Daily totals split by Mobile Money and cash, with a grand total row.',
      visible: canSeeMoney,
    },
  ].filter((r) => r.visible);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Reports</h2>
        <p className="text-sm text-slate-500 mt-1 max-w-2xl">
          Downloads cover the whole date range, not just what is on screen. Figures are
          generated fresh each time, so a report always matches the database.
        </p>
      </div>

      {/* Range */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <div>
            <label htmlFor="report_from" className="block text-sm font-semibold text-slate-500 mb-1">From</label>
            <input
              id="report_from"
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-red-500 focus:bg-white"
            />
          </div>
          <div>
            <label htmlFor="report_to" className="block text-sm font-semibold text-slate-500 mb-1">To</label>
            <input
              id="report_to"
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
              className="w-full min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-red-500 focus:bg-white"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p.days)}
                className="min-h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-2.5">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* What is in the range, before anyone downloads it. */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-500">In this range</h3>
        {loading ? (
          <div className="flex py-6 justify-center"><Loader2 className="h-5 w-5 animate-spin text-red-600" /></div>
        ) : summary ? (
          <dl className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              ['Booked', summary.orders],
              ['Delivered', summary.delivered],
              ['Cancelled', summary.cancelled],
              ...(canSeeMoney
                ? [['Collected', formatAmount(summary.revenue ?? 0)] as [string, string]]
                : []),
            ].map(([label, value]) => (
              <div key={label as string}>
                <dt className="text-sm text-slate-500">{label}</dt>
                <dd className="text-xl font-semibold text-slate-900 tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>

      {/* The downloads */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <div key={r.path} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col">
            <FileSpreadsheet className="h-5 w-5 text-red-600" />
            <h3 className="mt-3 text-base font-bold text-slate-900">{r.title}</h3>
            <p className="mt-1 text-sm text-slate-500 flex-1">{r.body}</p>
            <button
              onClick={() => download(r.path, r.name)}
              disabled={downloading === r.path}
              className="mt-4 w-full min-h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 text-sm font-bold text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {downloading === r.path
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Download className="h-4 w-4" />}
              Download CSV
            </button>
          </div>
        ))}
      </div>

      <p className="text-sm text-slate-500">
        CSV opens in Excel, Google Sheets and most accounting packages. Amounts are in
        cedis with two decimals; dates are yyyy-mm-dd so they sort correctly.
      </p>
    </div>
  );
}
