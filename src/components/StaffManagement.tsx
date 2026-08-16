/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  KeyRound,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { ADMIN_ROLES, type AdminRole, type AdminUser } from '../types.js';

interface StaffManagementProps {
  token: string;
  currentUser: AdminUser | null;
}

const PAGE_SIZE = 10;
const MIN_PASSWORD_LENGTH = 12;

/** Kept in step with src/server/permissions.ts — that file is the enforcement. */
const ROLE_INFO: Record<AdminRole, { label: string; blurb: string; chip: string }> = {
  owner: {
    label: 'Owner',
    blurb: 'Everything, including pricing and staff accounts.',
    chip: 'bg-violet-500/10 border border-violet-500/20 text-violet-600',
  },
  dispatcher: {
    label: 'Dispatcher',
    blurb: 'Orders, statuses and riders. No pricing, no payments.',
    chip: 'bg-blue-500/10 border border-blue-500/20 text-blue-600',
  },
  finance: {
    label: 'Finance',
    blurb: 'Payments, exports and revenue. No dispatch.',
    chip: 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600',
  },
  support: {
    label: 'Support',
    blurb: 'Read-only, for answering customer calls.',
    chip: 'bg-slate-500/10 border border-slate-500/20 text-slate-600',
  },
};

/** Meets the server's minimum without a human having to invent one. */
function generatePassword(): string {
  const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint32Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => alphabet[n % alphabet.length]).join('');
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function StaffManagement({ token, currentUser }: StaffManagementProps) {
  const [staff, setStaff] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState(1);

  // Add form
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<AdminRole>('support');
  const [creating, setCreating] = useState(false);

  // Per-row activity
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [issuedPassword, setIssuedPassword] = useState<{ id: string; value: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }),
    [token]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admins', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || 'Could not load staff accounts.');
      }
      setStaff(await res.json());
    } catch (err: any) {
      setError(err.message || 'Could not load staff accounts.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  /** Every mutation goes through here so errors surface the same way. */
  const mutate = async (
    url: string,
    options: RequestInit,
    successMessage: string
  ): Promise<boolean> => {
    setError('');
    setNotice('');
    try {
      const res = await fetch(url, { ...options, headers: authHeaders() });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error || 'That did not work.');
      }
      setNotice(successMessage);
      await load();
      return true;
    } catch (err: any) {
      setError(err.message || 'That did not work.');
      return false;
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    const password = newPassword || generatePassword();

    const ok = await mutate(
      '/api/admins',
      {
        method: 'POST',
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          password,
          role: newRole,
        }),
      },
      `${newName} added as ${ROLE_INFO[newRole].label}.`
    );

    if (ok) {
      // Shown once — the server only ever stores the hash.
      setIssuedPassword({ id: 'new', value: password });
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('support');
      setShowAdd(false);
    }
    setCreating(false);
  };

  const handleRoleChange = async (member: AdminUser, role: AdminRole) => {
    setBusyId(member.id);
    await mutate(
      `/api/admins/${member.id}`,
      { method: 'PATCH', body: JSON.stringify({ role }) },
      `${member.name} is now ${ROLE_INFO[role].label}.`
    );
    setBusyId(null);
  };

  const handleResetPassword = async (member: AdminUser) => {
    setBusyId(member.id);
    const password = generatePassword();
    const ok = await mutate(
      `/api/admins/${member.id}`,
      { method: 'PATCH', body: JSON.stringify({ password }) },
      // A reset always signs them out everywhere too — see the server-side
      // comment in routes/admins.ts for why that is not optional.
      `New password issued for ${member.name}. They are signed out everywhere until they use it.`
    );
    if (ok) setIssuedPassword({ id: member.id, value: password });
    setBusyId(null);
  };

  /** For a lost device where the person still works here — keep the account,
   *  drop every open session. */
  const handleSignOutEverywhere = async (member: AdminUser) => {
    setBusyId(member.id);
    await mutate(
      `/api/admins/${member.id}/sessions`,
      { method: 'DELETE' },
      `${member.name} signed out everywhere.`
    );
    setBusyId(null);
  };

  const handleDelete = async (member: AdminUser) => {
    setBusyId(member.id);
    await mutate(
      `/api/admins/${member.id}`,
      { method: 'DELETE' },
      `${member.name} removed.`
    );
    setConfirmDeleteId(null);
    setBusyId(null);
  };

  const copyPassword = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the value is on screen to copy by hand */
    }
  };

  const ownerCount = staff.filter((s) => s.role === 'owner').length;
  const totalPages = Math.max(1, Math.ceil(staff.length / PAGE_SIZE));
  const visible = staff.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* ---------- Header ---------- */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">Staff Accounts</h2>
          <p className="text-sm text-slate-500 mt-1 max-w-xl">
            Who can sign in to this console, and what each of them is allowed to do.
            Permissions are enforced by the server — hiding a control is a convenience,
            not the protection.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="min-h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
          <button
            onClick={() => {
              setShowAdd((v) => !v);
              setIssuedPassword(null);
            }}
            className="min-h-11 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer"
          >
            {showAdd ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {showAdd ? 'Cancel' : 'Add staff'}
          </button>
        </div>
      </div>

      {/* ---------- Messages ---------- */}
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-600 font-semibold">
          <AlertCircle className="h-4 w-4 shrink-0 mt-px" />
          <span>{error}</span>
        </div>
      )}
      {notice && !error && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-600 font-semibold">
          <Check className="h-4 w-4 shrink-0 mt-px" />
          <span>{notice}</span>
        </div>
      )}

      {/* ---------- One-time password reveal ---------- */}
      {issuedPassword && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-700">
            <KeyRound className="h-4 w-4" />
            Password shown once — copy it now
          </div>
          <p className="text-sm text-amber-700/80">
            Only a hash is stored, so this cannot be recovered later. Send it to them
            over something private, and have them change it.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-white border border-amber-500/25 px-3 py-2 font-mono text-sm text-slate-900 break-all">
              {issuedPassword.value}
            </code>
            <button
              onClick={() => copyPassword(issuedPassword.value)}
              className="px-3 py-2 rounded-lg border border-amber-500/25 bg-white text-amber-700 hover:bg-amber-50 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              onClick={() => setIssuedPassword(null)}
              className="p-2 rounded-lg border border-amber-500/25 bg-white text-amber-700 hover:bg-amber-50 transition-all cursor-pointer shrink-0"
              title="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ---------- Add form ---------- */}
      {showAdd && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-slate-200 bg-white p-4 space-y-3.5"
        >
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
            <UserPlus className="h-4 w-4 text-violet-600" />
            New staff account
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-mono uppercase tracking-widest text-slate-500 font-bold">
                Full name
              </span>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400"
                placeholder="Kwesi Boateng"
              />
            </label>

            <label className="block">
              <span className="text-xs font-mono uppercase tracking-widest text-slate-500 font-bold">
                Email
              </span>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400"
                placeholder="kwesi@waypoint.com"
              />
            </label>
          </div>

          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-slate-500 font-bold">
              Role
            </span>
            <div className="mt-1.5 grid sm:grid-cols-2 gap-2">
              {ADMIN_ROLES.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setNewRole(role)}
                  className={`text-left px-3 py-2.5 rounded-lg border transition-all cursor-pointer ${
                    newRole === role
                      ? 'border-violet-400 bg-violet-500/5'
                      : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <span className="text-xs font-bold text-slate-900 block">
                    {ROLE_INFO[role].label}
                  </span>
                  <span className="text-xs text-slate-500 block mt-0.5">
                    {ROLE_INFO[role].blurb}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-xs font-mono uppercase tracking-widest text-slate-500 font-bold">
              Password — leave blank to generate one
            </span>
            <div className="mt-1 flex gap-2">
              <input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={MIN_PASSWORD_LENGTH}
                className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-900 outline-none focus:border-violet-400"
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
              />
              <button
                type="button"
                onClick={() => setNewPassword(generatePassword())}
                className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-100 text-slate-600 hover:text-slate-900 text-xs font-bold transition-all cursor-pointer shrink-0"
              >
                Generate
              </button>
            </div>
          </label>

          <button
            type="submit"
            disabled={creating}
            className="w-full sm:w-auto min-h-11 px-5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Create account
          </button>
        </form>
      )}

      {/* ---------- Table ---------- */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {/* Phones: a card per person. Five columns pushed the role selector and
            every row action off-screen inside the table's own scroll box, so
            the page looked fine while the controls were unreachable. */}
        <div className="md:hidden divide-y divide-slate-100">
          {loading && (
            <div className="py-10 text-center">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400 mx-auto" />
            </div>
          )}

          {!loading && visible.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-500">No staff accounts yet.</p>
          )}

          {!loading &&
            visible.map((member) => {
              const isSelf = member.id === currentUser?.id;
              const isLastOwner = member.role === 'owner' && ownerCount <= 1;
              const busy = busyId === member.id;

              return (
                <div key={member.id} className="p-4 space-y-3">
                  <div>
                    <span className="text-base font-bold text-slate-900">{member.name}</span>
                    {isSelf && (
                      <span className="ml-2 text-xs font-bold uppercase tracking-wider text-violet-600">
                        you
                      </span>
                    )}
                    <span className="block text-sm text-slate-500 font-mono break-all">{member.email}</span>
                    <span className="block text-sm text-slate-400 mt-0.5">
                      Added {formatDate(member.createdAt)}
                    </span>
                  </div>

                  <select
                    value={member.role}
                    disabled={busy || isLastOwner}
                    onChange={(e) => handleRoleChange(member, e.target.value as AdminRole)}
                    title={
                      isLastOwner
                        ? 'The last owner cannot be demoted — someone must be able to manage staff and pricing.'
                        : undefined
                    }
                    className={`w-full text-sm font-bold rounded-lg min-h-11 px-3 outline-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-70 ${ROLE_INFO[member.role].chip}`}
                  >
                    {ADMIN_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_INFO[role].label}
                      </option>
                    ))}
                  </select>

                  {/* Labelled here rather than icon-only — there is room, and
                      these three actions are not guessable from a glyph. */}
                  <div className="flex flex-wrap gap-2">
                    {busy && <Loader2 className="h-4 w-4 animate-spin text-slate-400 self-center" />}

                    <button
                      onClick={() => handleResetPassword(member)}
                      disabled={busy}
                      className="min-h-11 px-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:border-violet-400 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <KeyRound className="h-4 w-4" />
                      New password
                    </button>

                    {!isSelf && (
                      <button
                        onClick={() => handleSignOutEverywhere(member)}
                        disabled={busy}
                        className="min-h-11 px-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:text-amber-600 hover:border-amber-400 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign out
                      </button>
                    )}

                    {!isSelf && !isLastOwner && (
                      confirmDeleteId === member.id ? (
                        <>
                          <button
                            onClick={() => handleDelete(member)}
                            disabled={busy}
                            className="min-h-11 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition-colors cursor-pointer"
                          >
                            Confirm remove
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="min-h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(member.id)}
                          disabled={busy}
                          className="min-h-11 px-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:text-rose-600 hover:border-rose-300 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {['Name', 'Email', 'Role', 'Added', ''].map((h, i) => (
                  <th
                    key={i}
                    className="px-4 py-2.5 text-xs font-mono uppercase tracking-widest text-slate-500 font-bold whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center">
                    <Loader2 className="h-5 w-5 animate-spin text-slate-400 mx-auto" />
                  </td>
                </tr>
              )}

              {!loading && visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-xs text-slate-500">
                    No staff accounts yet.
                  </td>
                </tr>
              )}

              {!loading &&
                visible.map((member) => {
                  const isSelf = member.id === currentUser?.id;
                  const isLastOwner = member.role === 'owner' && ownerCount <= 1;
                  const busy = busyId === member.id;

                  return (
                    <tr
                      key={member.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-bold text-slate-900">{member.name}</span>
                        {isSelf && (
                          <span className="ml-2 text-xs font-mono uppercase tracking-wider text-violet-600 font-bold">
                            you
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-xs text-slate-500 font-mono whitespace-nowrap">
                        {member.email}
                      </td>

                      <td className="px-4 py-3">
                        <select
                          value={member.role}
                          disabled={busy || isLastOwner}
                          onChange={(e) => handleRoleChange(member, e.target.value as AdminRole)}
                          title={
                            isLastOwner
                              ? 'The last owner cannot be demoted — someone must be able to manage staff and pricing.'
                              : undefined
                          }
                          className={`text-sm font-bold rounded-lg min-h-11 px-3 outline-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-70 ${ROLE_INFO[member.role].chip}`}
                        >
                          {ADMIN_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_INFO[role].label}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="px-4 py-3 text-xs text-slate-500 font-mono whitespace-nowrap">
                        {formatDate(member.createdAt)}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}

                          <button
                            onClick={() => handleResetPassword(member)}
                            disabled={busy}
                            className="h-11 w-11 flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-900 hover:border-violet-400 transition-all cursor-pointer disabled:opacity-50"
                            title="Issue a new password — also signs them out everywhere"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </button>

                          {!isSelf && (
                            <button
                              onClick={() => handleSignOutEverywhere(member)}
                              disabled={busy}
                              className="h-11 w-11 flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 hover:text-amber-600 hover:border-amber-400 transition-all cursor-pointer disabled:opacity-50"
                              title="Sign out everywhere — for a lost device, without changing anything else"
                            >
                              <LogOut className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {confirmDeleteId === member.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(member)}
                                disabled={busy}
                                className="px-2 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all cursor-pointer"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 text-xs font-bold transition-all cursor-pointer"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(member.id)}
                              disabled={busy || isSelf || isLastOwner}
                              className="h-11 w-11 flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 hover:text-rose-600 hover:border-rose-400 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                              title={
                                isSelf
                                  ? 'You cannot delete your own account'
                                  : isLastOwner
                                    ? 'The last owner cannot be deleted'
                                    : 'Remove this account'
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* ---------- Pagination ---------- */}
        {!loading && staff.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-200 bg-slate-50">
            <span className="text-xs text-slate-500 font-mono">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, staff.length)} of{' '}
              {staff.length}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-500 text-xs font-bold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-500 text-xs font-bold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
