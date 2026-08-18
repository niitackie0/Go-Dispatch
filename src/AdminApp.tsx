/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import AdminLogin from './components/AdminLogin.js';
import AdminDashboard from './components/AdminDashboard.js';
import type { AdminUser } from './types.js';

/**
 * The operations console, as its own application.
 *
 * It used to be a branch inside the customer app, which meant the whole
 * console — the dispatch board, the payments ledger, staff management, every
 * chart library they pull in — was downloaded by every customer who opened the
 * booking form and never seen by any of them. Splitting it here means the two
 * audiences no longer share a bundle: a customer downloads the site, and
 * whoever runs the operation downloads the console.
 *
 * It has no router. There is exactly one screen at exactly one path — the
 * server decides that path from ADMIN_PATH — and what changes is whether you
 * are signed in. Navigating back to the customer site is a full page load,
 * because it is genuinely a different application.
 */
export default function AdminApp() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [ready, setReady] = useState(false);

  /**
   * Restore the session on load, then confirm it with the server.
   *
   * What is in localStorage is only a hint: the token may have been revoked
   * since it was written — a password change signs every session out — and the
   * account's role may have changed. /api/auth/me is the source of truth.
   */
  useEffect(() => {
    const storedToken = localStorage.getItem('wp_admin_token');
    const storedUser = localStorage.getItem('wp_admin_user');

    if (!storedToken) {
      setReady(true);
      return;
    }

    setToken(storedToken);
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        setUser(null);
      }
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        if (cancelled) return;

        if (res.status === 401) {
          localStorage.removeItem('wp_admin_token');
          localStorage.removeItem('wp_admin_user');
          setToken(null);
          setUser(null);
        } else if (res.ok) {
          const data = await res.json();
          localStorage.setItem('wp_admin_user', JSON.stringify(data.user));
          setUser(data.user);
        }
        // Any other status (a 503, say) leaves the stored session alone rather
        // than signing somebody out over a transient server problem.
      } catch {
        // Offline. Keep what we have.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogin = (newToken: string, newUser: AdminUser) => {
    localStorage.setItem('wp_admin_token', newToken);
    localStorage.setItem('wp_admin_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const handleLogout = async () => {
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (err) {
        console.error('Logout error', err);
      }
    }
    localStorage.removeItem('wp_admin_token');
    localStorage.removeItem('wp_admin_user');
    setToken(null);
    setUser(null);
    // Stays here rather than leaving for the customer site: somebody who signs
    // out is usually about to sign back in as somebody else.
  };

  // Avoids a flash of the login screen before localStorage has been read.
  if (!ready) {
    return <div className="min-h-dvh bg-[var(--wp-bg)]" />;
  }

  return token ? (
    <AdminDashboard token={token} user={user} onLogout={handleLogout} />
  ) : (
    <AdminLogin onLoginSuccess={handleLogin} />
  );
}
