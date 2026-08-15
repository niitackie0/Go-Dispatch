/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from './router.js';
import CustomerLayout from './components/CustomerLayout.js';
import Home from './components/Home.js';
import BookPage from './components/BookPage.js';
import TrackPage from './components/TrackPage.js';
import AdminLogin from './components/AdminLogin.js';
import AdminDashboard from './components/AdminDashboard.js';
import RiderView from './components/RiderView.js';
import type { AdminUser } from './types.js';

export default function App() {
  const { path, navigate } = useRouter();
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);

  // Restore the admin session on mount, then confirm it with the server.
  //
  // The stored copy is only a hint: the token may have been revoked, or the
  // account's role changed, since it was written. /api/auth/me is the source of
  // truth, and it also repairs sessions stored before roles existed.
  useEffect(() => {
    const storedToken = localStorage.getItem('wp_admin_token');
    const storedUser = localStorage.getItem('wp_admin_user');

    if (!storedToken) {
      setAuthLoaded(true);
      return;
    }

    setAdminToken(storedToken);
    if (storedUser) {
      try {
        setAdminUser(JSON.parse(storedUser));
      } catch {
        setAdminUser(null);
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
          setAdminToken(null);
          setAdminUser(null);
        } else if (res.ok) {
          const data = await res.json();
          localStorage.setItem('wp_admin_user', JSON.stringify(data.user));
          setAdminUser(data.user);
        }
        // Any other status (e.g. 503) leaves the stored session alone rather
        // than signing someone out over a transient server problem.
      } catch {
        // Offline — keep what we have.
      } finally {
        if (!cancelled) setAuthLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleAdminLogin = (token: string, user: AdminUser) => {
    localStorage.setItem('wp_admin_token', token);
    localStorage.setItem('wp_admin_user', JSON.stringify(user));
    setAdminToken(token);
    setAdminUser(user);
    navigate('/admin');
  };

  const handleAdminLogout = async () => {
    if (adminToken) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${adminToken}` },
        });
      } catch (err) {
        console.error('Logout error', err);
      }
    }
    localStorage.removeItem('wp_admin_token');
    localStorage.removeItem('wp_admin_user');
    setAdminToken(null);
    setAdminUser(null);
    navigate('/');
  };

  // ---------------- RIDER SELF-SERVICE (standalone, token in the URL) -------
  if (path.startsWith('/rider/')) {
    return <RiderView token={decodeURIComponent(path.slice('/rider/'.length))} />;
  }

  // ---------------- ADMIN (standalone, no customer chrome) ----------------
  if (path.startsWith('/admin')) {
    // Avoid a flash of the login screen before localStorage is read.
    if (!authLoaded) {
      return <div className="min-h-dvh bg-[#0c0c0e]" />;
    }
    return adminToken ? (
      <AdminDashboard token={adminToken} user={adminUser} onLogout={handleAdminLogout} />
    ) : (
      <AdminLogin onLoginSuccess={handleAdminLogin} />
    );
  }

  // ---------------- CUSTOMER SITE ----------------
  let page: React.ReactNode;
  if (path === '/book') {
    page = <BookPage />;
  } else if (path === '/track') {
    page = <TrackPage />;
  } else {
    page = <Home />;
  }

  return <CustomerLayout>{page}</CustomerLayout>;
}
