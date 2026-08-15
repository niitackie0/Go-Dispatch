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

interface AdminUserInfo {
  name: string;
  email: string;
}

export default function App() {
  const { path, navigate } = useRouter();
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUserInfo | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);

  // Restore admin session from localStorage on mount.
  useEffect(() => {
    const storedToken = localStorage.getItem('wp_admin_token');
    const storedUser = localStorage.getItem('wp_admin_user');
    if (storedToken && storedUser) {
      setAdminToken(storedToken);
      try {
        setAdminUser(JSON.parse(storedUser));
      } catch {
        setAdminUser(null);
      }
    }
    setAuthLoaded(true);
  }, []);

  const handleAdminLogin = (token: string, user: AdminUserInfo) => {
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
