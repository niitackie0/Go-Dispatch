/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Bike,
  Check,
  Loader2,
  Plus,
  Power,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import type { AdminUser, FleetRider } from '../types.js';
import { can } from '../capabilities.js';
import { formatPhone } from '../phone.js';

interface FleetManagementProps {
  token: string;
  currentUser: AdminUser | null;
}

const PAGE_SIZE = 10;

/**
 * The fleet: who carries parcels, and whether there are enough of them.
 *
 * SEPARATE FROM STAFF ACCOUNTS ON PURPOSE, and the separation is the feature.
 * A rider has a name, a handset and no way into this console — they work from a
 * per-order link that can only move their own parcel. Support, by contrast, is
 * an account with a password that can work the whole board. Putting the two in
 * one list would eventually mean giving somebody a login because they were
 * hired to ride a motorbike.
 *
 * So: no email field, no password field, no role selector. Adding a rider adds
 * a name, a number, and one unit of delivery capacity.
 *
 * Support can read this page. Only an owner can change it.
 */
export default function FleetManagement({ token, currentUser }: FleetManagementProps) {
  const canManage = can(currentUser?.role, 'riders:manage');

  const [riders, setRiders] = useState<FleetRider[]>([]);
  const [waiting, setWaiting] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState(1);

  // Add form
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [creating, setCreating] = useState(false);

  // Per-row activity
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/riders', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || 'Could not load the fleet.');
      }
      const body = await res.json();
      setRiders(body.riders ?? []);
      setWaiting(body.waiting ?? 0);
    } catch (err: any) {
      setError(err.message || 'Could not load the fleet.');
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
      const res = await fetch(url, {
        ...options,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || 'That did not work.');
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
    const ok = await mutate(
      '/api/riders',
      { method: 'POST', body: JSON.stringify({ name: newName, phone: newPhone }) },
      // Says what actually happens next, which is not "nothing until you assign
      // them" — the automation picks them up on its own.
      `${newName.trim()} is on the fleet. The next parcel due for pickup can go to them.`
    );
    if (ok) {
      setNewName('');
      setNewPhone('');
      setShowAdd(false);
    }
    setCreating(false);
  };

  const handleToggleActive = async (rider: FleetRider) => {
    setBusyId(rider.id);
    const turningOff = rider.active;
    await mutate(
      `/api/riders/${rider.id}`,
      { method: 'PATCH', body: JSON.stringify({ active: !rider.active }) },
      turningOff
        ? rider.carrying > 0
          ? `${rider.name} is off the fleet and will get nothing new. The ${rider.carrying} parcel${rider.carrying === 1 ? '' : 's'} already with them stay${rider.carrying === 1 ? 's' : ''} theirs.`
          : `${rider.name} is off the fleet and will not be assigned work.`
        : `${rider.name} is back on the fleet.`
    );
    setBusyId(null);
  };

  const handleRemove = async (rider: FleetRider) => {
    setBusyId(rider.id);
    await mutate(`/api/riders/${rider.id}`, { method: 'DELETE' }, `${rider.name} removed.`);
    setConfirmRemoveId(null);
    setBusyId(null);
  };

  const activeRiders = riders.filter((r) => r.active);
  const freeRiders = activeRiders.filter((r) => r.available && r.carrying === 0);
  const totalPages = Math.max(1, Math.ceil(riders.length / PAGE_SIZE));
  const visible = riders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /** What this rider is doing, in the three states worth telling apart. */
  const state = (rider: FleetRider) => {
    if (!rider.active) {
      return { label: 'Off the fleet', chip: 'bg-slate-500/10 border border-slate-300 text-slate-500' };
    }
    if (rider.carrying > 0) {
      return { label: 'On the road', chip: 'bg-amber-500/10 border border-amber-500/20 text-amber-700' };
    }
    return { label: 'Free', chip: 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600' };
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* ---------- Header ---------- */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 tracking-tight">Fleet</h2>
          <p className="text-sm text-slate-500 mt-1 max-w-xl">
            The couriers who carry parcels. Riders do not sign in here — they work from a
            link sent with each job, so there is no password and no role. Staff accounts
            are a separate list.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="min-h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
          {canManage && (
            <button
              onClick={() => setShowAdd((v) => !v)}
              className="min-h-11 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer"
            >
              {showAdd ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {showAdd ? 'Cancel' : 'Add rider'}
            </button>
          )}
        </div>
      </div>

      {/* ---------- Capacity ----------
          Three numbers and one sentence. The sentence is the part that matters:
          a busy fleet is not an error state, and somebody looking at a backlog
          should not go hunting for a button that assigns it by hand. */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'On the fleet', value: activeRiders.length },
            { label: 'Free now', value: freeRiders.length },
            { label: 'Parcels waiting', value: waiting },
          ].map(({ label, value }) => (
            <div key={label}>
              <span className="text-xs font-mono uppercase tracking-widest text-slate-500 font-semibold">
                {label}
              </span>
              <span className="mt-1 block text-2xl font-medium text-slate-900 tabular-nums tracking-tight">
                {value}
              </span>
            </div>
          ))}
        </div>

        {waiting > 0 && freeRiders.length === 0 && (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Every rider is carrying something, so {waiting} parcel{waiting === 1 ? '' : 's'}{' '}
              {waiting === 1 ? 'is' : 'are'} holding at Confirmed. They are handed out
              automatically, oldest pickup first, the moment a rider marks a delivery done —
              nobody has to assign them. Add a rider here to drain it faster.
            </span>
          </p>
        )}

        {activeRiders.length === 0 && !loading && (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-600">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Nobody is on the fleet, so nothing will be assigned. Confirmed orders will
              queue up and wait.
            </span>
          </p>
        )}
      </div>

      {/* ---------- Messages ---------- */}
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

      {/* ---------- Add form ---------- */}
      {showAdd && canManage && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-slate-200 bg-white p-4 space-y-3.5"
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
            <Bike className="h-4 w-4 text-red-600" />
            New rider
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-mono uppercase tracking-widest text-slate-500 font-semibold">
                Full name
              </span>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-red-400"
                placeholder="As it should read on the board"
              />
            </label>

            <label className="block">
              <span className="text-xs font-mono uppercase tracking-widest text-slate-500 font-semibold">
                Phone
              </span>
              <input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                required
                inputMode="tel"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-red-400"
                placeholder="024 481 5203"
              />
            </label>
          </div>

          {/* Said here rather than discovered later: this number is quoted to a
              customer by SMS, so it has to be the handset they will be called from. */}
          <p className="text-xs text-slate-500">
            The number goes out in the text telling a customer who is coming — it must be
            the phone they will actually be called from.
          </p>

          <button
            type="submit"
            disabled={creating}
            className="w-full sm:w-auto min-h-11 px-5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Add to fleet
          </button>
        </form>
      )}

      {/* ---------- Roster ---------- */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {/* Phones: a card per rider, for the same reason the staff list has one —
            the row actions end up off-screen inside the table's own scroll box. */}
        <div className="md:hidden divide-y divide-slate-100">
          {loading && (
            <div className="py-10 text-center">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400 mx-auto" />
            </div>
          )}

          {!loading && visible.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-500">Nobody on the fleet yet.</p>
          )}

          {!loading &&
            visible.map((rider) => {
              const busy = busyId === rider.id;
              const { label, chip } = state(rider);

              return (
                <div key={rider.id} className="p-4 space-y-3">
                  <div>
                    <span className="text-base font-semibold text-slate-900">{rider.name}</span>
                    <span className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded-md ${chip}`}>
                      {label}
                    </span>
                    <a
                      href={`tel:${rider.phone}`}
                      className="block text-sm text-slate-500 font-mono mt-0.5"
                    >
                      {formatPhone(rider.phone)}
                    </a>
                    <span className="block text-sm text-slate-400 mt-0.5 tabular-nums">
                      Carrying {rider.carrying} · delivered {rider.delivered}
                    </span>
                  </div>

                  {canManage && (
                    <div className="flex flex-wrap gap-2">
                      {busy && <Loader2 className="h-4 w-4 animate-spin text-slate-400 self-center" />}

                      <button
                        onClick={() => handleToggleActive(rider)}
                        disabled={busy}
                        className="min-h-11 px-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:border-red-400 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Power className="h-4 w-4" />
                        {rider.active ? 'Take off fleet' : 'Put back on'}
                      </button>

                      {rider.carrying + rider.delivered === 0 &&
                        (confirmRemoveId === rider.id ? (
                          <>
                            <button
                              onClick={() => handleRemove(rider)}
                              disabled={busy}
                              className="min-h-11 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium transition-colors cursor-pointer"
                            >
                              Confirm remove
                            </button>
                            <button
                              onClick={() => setConfirmRemoveId(null)}
                              className="min-h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setConfirmRemoveId(rider.id)}
                            disabled={busy}
                            className="min-h-11 px-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:text-rose-600 hover:border-rose-300 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                            Remove
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {['Rider', 'Phone', 'Status', 'Carrying', 'Delivered', ''].map((h, i) => (
                  <th
                    key={i}
                    className="px-4 py-2.5 text-xs font-mono uppercase tracking-widest text-slate-500 font-semibold whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center">
                    <Loader2 className="h-5 w-5 animate-spin text-slate-400 mx-auto" />
                  </td>
                </tr>
              )}

              {!loading && visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-xs text-slate-500">
                    Nobody on the fleet yet.
                  </td>
                </tr>
              )}

              {!loading &&
                visible.map((rider) => {
                  const busy = busyId === rider.id;
                  const { label, chip } = state(rider);
                  const removable = rider.carrying + rider.delivered === 0;

                  return (
                    <tr
                      key={rider.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-semibold text-slate-900">{rider.name}</span>
                      </td>

                      <td className="px-4 py-3 text-xs text-slate-500 font-mono whitespace-nowrap">
                        <a href={`tel:${rider.phone}`} className="hover:text-slate-900">
                          {formatPhone(rider.phone)}
                        </a>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-md ${chip}`}>
                          {label}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-sm text-slate-900 tabular-nums">
                        {rider.carrying}
                      </td>

                      <td className="px-4 py-3 text-sm text-slate-500 tabular-nums">
                        {rider.delivered}
                      </td>

                      <td className="px-4 py-3">
                        {canManage && (
                          <div className="flex items-center justify-end gap-1.5">
                            {busy && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}

                            <button
                              onClick={() => handleToggleActive(rider)}
                              disabled={busy}
                              title={rider.active ? 'Take off the fleet' : 'Put back on the fleet'}
                              className="min-h-9 px-2.5 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:border-red-400 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <Power className="h-3.5 w-3.5" />
                              {rider.active ? 'Take off' : 'Put back'}
                            </button>

                            {removable &&
                              (confirmRemoveId === rider.id ? (
                                <>
                                  <button
                                    onClick={() => handleRemove(rider)}
                                    disabled={busy}
                                    className="min-h-9 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium transition-colors cursor-pointer"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    onClick={() => setConfirmRemoveId(null)}
                                    className="min-h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 transition-colors cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => setConfirmRemoveId(rider.id)}
                                  disabled={busy}
                                  title="Remove — only possible while they have no parcels on record"
                                  className="min-h-9 px-2.5 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:text-rose-600 hover:border-rose-300 transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Remove
                                </button>
                              ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------- Pagination ---------- */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500 tabular-nums">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="min-h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 disabled:opacity-40 transition-colors cursor-pointer"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="min-h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 disabled:opacity-40 transition-colors cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Says what the page will not do, where somebody would otherwise look for
          the button. Deleting a rider with history would blank their name off
          every delivery they ever made, including the day's cash figures. */}
      {canManage && (
        <p className="text-xs text-slate-500">
          A rider who has carried anything can be taken off the fleet but not deleted —
          removing them would blank their name off every delivery they have made.
        </p>
      )}
    </div>
  );
}
