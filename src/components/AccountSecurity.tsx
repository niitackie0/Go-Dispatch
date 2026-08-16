/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  Loader2,
  LogOut,
  Monitor,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import type { AdminUser } from '../types.js';

interface AccountSecurityProps {
  token: string;
  user: AdminUser | null;
}

const MIN_PASSWORD_LENGTH = 12;

interface SessionSummary {
  id: string;
  current: boolean;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
}

/** Enough to recognise your own devices; not an analytics exercise. */
function describeAgent(agent: string | null): { label: string; mobile: boolean } {
  if (!agent) return { label: 'Unknown device', mobile: false };

  const mobile = /Mobile|Android|iPhone|iPad/i.test(agent);
  const browser =
    /Edg\//.test(agent) ? 'Edge'
    : /OPR\//.test(agent) ? 'Opera'
    : /Chrome\//.test(agent) ? 'Chrome'
    : /Safari\//.test(agent) ? 'Safari'
    : /Firefox\//.test(agent) ? 'Firefox'
    : 'Browser';

  const os =
    /Windows/i.test(agent) ? 'Windows'
    : /Android/i.test(agent) ? 'Android'
    : /iPhone|iPad|iOS/i.test(agent) ? 'iOS'
    : /Mac OS X/i.test(agent) ? 'macOS'
    : /Linux/i.test(agent) ? 'Linux'
    : 'Unknown OS';

  return { label: `${browser} on ${os}`, mobile };
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export default function AccountSecurity({ token, user }: AccountSecurityProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [busySessionId, setBusySessionId] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const res = await fetch('/api/auth/sessions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setSessions(await res.json());
    } finally {
      setLoadingSessions(false);
    }
  }, [token]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');

    // Checked here purely to save a round trip; the server checks it too.
    if (newPassword !== confirmPassword) {
      setError('The two new passwords do not match');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.error || 'Could not change your password');
      }

      const revoked = body?.revokedSessions ?? 0;
      setNotice(
        revoked > 0
          ? `Password changed. Signed out of ${revoked} other ${revoked === 1 ? 'device' : 'devices'}.`
          : 'Password changed.'
      );
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      loadSessions();
    } catch (err: any) {
      setError(err.message || 'Could not change your password');
    } finally {
      setSaving(false);
    }
  };

  const revokeOne = async (id: string) => {
    setBusySessionId(id);
    try {
      await fetch(`/api/auth/sessions/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      await loadSessions();
    } finally {
      setBusySessionId(null);
    }
  };

  const revokeOthers = async () => {
    setBusySessionId('all');
    try {
      const res = await fetch('/api/auth/sessions', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => null);
      setNotice(`Signed out of ${body?.revokedSessions ?? 0} other device(s).`);
      await loadSessions();
    } finally {
      setBusySessionId(null);
    }
  };

  const otherSessions = sessions.filter((s) => !s.current).length;

  return (
    <div className="p-4 sm:p-6 max-w-3xl space-y-5">
      <div>
        <h2 className="text-base font-semibold text-slate-900 tracking-tight">My Account</h2>
        <p className="text-sm text-slate-500 mt-1">
          Signed in as{' '}
          <span className="font-mono text-slate-700">{user?.email}</span>
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-600 font-medium">
          <AlertCircle className="h-4 w-4 shrink-0 mt-px" />
          <span>{error}</span>
        </div>
      )}
      {notice && !error && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-600 font-medium">
          <Check className="h-4 w-4 shrink-0 mt-px" />
          <span>{notice}</span>
        </div>
      )}

      {/* ---------- Change password ---------- */}
      <form
        onSubmit={handleChangePassword}
        className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3.5"
      >
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
          <ShieldCheck className="h-4 w-4 text-red-600" />
          Change password
        </div>

        <label className="block">
          <span className="text-xs font-mono uppercase tracking-widest text-slate-500 font-semibold">
            Current password
          </span>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="mt-1 w-full min-h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-red-400"
          />
        </label>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-mono uppercase tracking-widest text-slate-500 font-semibold">
              New password
            </span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              className="mt-1 w-full min-h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-red-400"
            />
          </label>

          <label className="block">
            <span className="text-xs font-mono uppercase tracking-widest text-slate-500 font-semibold">
              Confirm new password
            </span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              className="mt-1 w-full min-h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-red-400"
            />
          </label>
        </div>

        <p className="text-sm text-slate-500">
          At least {MIN_PASSWORD_LENGTH} characters. Changing it signs you out of every
          other device — if someone else knew the old one, leaving their session open
          would defeat the point.
        </p>

        <button
          type="submit"
          disabled={saving}
          className="w-full sm:w-auto min-h-11 px-5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Update password
        </button>
      </form>

      {/* ---------- Sessions ---------- */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
            <Monitor className="h-4 w-4 text-red-600" />
            Where you are signed in
          </div>
          {otherSessions > 0 && (
            <button
              onClick={revokeOthers}
              disabled={busySessionId === 'all'}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-100 text-slate-600 hover:text-rose-600 hover:border-rose-300 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {busySessionId === 'all' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <LogOut className="h-3.5 w-3.5" />
              )}
              Sign out other devices
            </button>
          )}
        </div>

        {loadingSessions ? (
          <div className="px-4 py-8 text-center">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400 mx-auto" />
          </div>
        ) : (
          <ul>
            {sessions.map((session) => {
              const { label, mobile } = describeAgent(session.userAgent);
              return (
                <li
                  key={session.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 last:border-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 shrink-0">
                      {mobile ? (
                        <Smartphone className="h-4 w-4" />
                      ) : (
                        <Monitor className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-900 truncate">
                          {label}
                        </span>
                        {session.current && (
                          <span className="text-xs font-mono uppercase tracking-wider text-emerald-600 font-semibold shrink-0">
                            this device
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-500 font-mono">
                        {session.ipAddress ?? 'unknown IP'} · active{' '}
                        {relativeTime(session.lastSeenAt)}
                      </span>
                    </div>
                  </div>

                  {!session.current && (
                    <button
                      onClick={() => revokeOne(session.id)}
                      disabled={busySessionId === session.id}
                      className="min-h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-rose-600 hover:border-rose-300 text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      {busySessionId === session.id ? '…' : 'Revoke'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
