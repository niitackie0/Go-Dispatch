/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useRouter } from './router.js';
import CustomerLayout from './components/CustomerLayout.js';
import Home from './components/Home.js';
import BookPage from './components/BookPage.js';
import TrackPage from './components/TrackPage.js';
import PolicyPage from './components/PolicyPage.js';
import ContactPage from './components/ContactPage.js';
import RiderView from './components/RiderView.js';

/**
 * The customer site.
 *
 * The operations console is deliberately absent: it is a separate application
 * with its own entry (admin.html / src/AdminApp.tsx), served at whatever
 * ADMIN_PATH says. Nothing here imports it, which is the point — none of that
 * code is in the bundle a customer downloads to book a parcel.
 *
 * A request for the old /admin path is refused by the server before it ever
 * reaches this file. It does not redirect: a redirect would announce where the
 * console moved to, which is the one thing moving it was meant to avoid.
 */
export default function App() {
  const { path } = useRouter();

  // The courier's self-service page. Standalone — no site chrome — because it
  // is opened from a link in a message, on a phone, at the roadside.
  if (path.startsWith('/rider/')) {
    return <RiderView token={decodeURIComponent(path.slice('/rider/'.length))} />;
  }

  let page: React.ReactNode;
  if (path === '/book') {
    page = <BookPage />;
  } else if (path === '/track') {
    page = <TrackPage />;
  } else if (path === '/policy') {
    page = <PolicyPage />;
  } else if (path === '/contact') {
    page = <ContactPage />;
  } else {
    page = <Home />;
  }

  return <CustomerLayout>{page}</CustomerLayout>;
}
