/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Layers,
  Search, 
  Calendar, 
  Filter, 
  TrendingUp, 
  User, 
  Phone, 
  MapPin, 
  Package, 
  FileText, 
  CheckCircle, 
  ArrowRight, 
  Loader2, 
  Download, 
  Settings, 
  Clock, 
  X,
  CreditCard,
  Truck,
  Edit2,
  ChevronRight,
  ClipboardList,
  AlertCircle,
  Menu,
  LogOut,
  ExternalLink,
  Copy,
  Check,
  Users,
  ShieldCheck,
  ChevronDown
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Order,
  Payment,
  StatusHistory,
  PricingConfig,
  DashboardStats,
  OrderStatus,
  PaymentStatus,
  PackageSize,
  AdminUser
} from '../types.js';
import { can } from '../capabilities.js';
import { advanceStatus, nextStatuses } from '../transitions.js';
import type { Capability } from '../capabilities.js';
import StaffManagement from './StaffManagement.js';
import AccountSecurity from './AccountSecurity.js';
import { Link } from '../router.js';

interface AdminDashboardProps {
  token: string;
  user: AdminUser | null;
  onLogout: () => void;
}

// Order status list in correct workflow order.
// `dot` is the solid colour used by the pipeline distribution bar and status dots.
const STATUS_ORDER: { key: OrderStatus; label: string; bg: string; text: string; dot: string }[] = [
  { key: 'requested', label: 'Requested', bg: 'bg-violet-500/10 border border-violet-500/20', text: 'text-violet-600', dot: 'bg-violet-500' },
  { key: 'awaiting_payment', label: 'Awaiting Payment', bg: 'bg-orange-500/10 border border-orange-500/20', text: 'text-orange-600', dot: 'bg-orange-500' },
  { key: 'confirmed', label: 'Confirmed', bg: 'bg-amber-500/10 border border-amber-500/20', text: 'text-amber-600', dot: 'bg-amber-500' },
  { key: 'queued', label: 'Queued', bg: 'bg-blue-500/10 border border-blue-500/20', text: 'text-blue-600', dot: 'bg-blue-500' },
  { key: 'picked_up', label: 'Picked Up', bg: 'bg-fuchsia-500/10 border border-fuchsia-500/20', text: 'text-fuchsia-600', dot: 'bg-fuchsia-500' },
  { key: 'in_transit', label: 'In Transit', bg: 'bg-sky-500/10 border border-sky-500/20', text: 'text-sky-600', dot: 'bg-sky-500' },
  { key: 'delivered', label: 'Delivered', bg: 'bg-emerald-500/10 border border-emerald-500/20', text: 'text-emerald-600', dot: 'bg-emerald-500' },
  { key: 'cancelled', label: 'Cancelled', bg: 'bg-rose-500/10 border border-rose-500/20', text: 'text-rose-600', dot: 'bg-rose-500' },
];

type SubTab = 'overview' | 'pipeline' | 'payments' | 'pricing' | 'staff' | 'account';

/**
 * The console's sections, in sidebar order.
 *
 * One list drives all three places a section is named — the desktop sidebar,
 * the mobile section menu, and the page heading — so they cannot drift apart.
 * `capability` gates visibility; a section without one is open to every role.
 */
const NAV_ITEMS: {
  key: SubTab;
  label: string;
  title: string;
  icon: LucideIcon;
  capability?: Capability;
}[] = [
  { key: 'overview', label: 'Overview', title: 'Overview', icon: TrendingUp },
  { key: 'pipeline', label: 'Dispatch board', title: 'Dispatch board', icon: Layers },
  { key: 'payments', label: 'Payments', title: 'Payments ledger', icon: CreditCard, capability: 'payments:read' },
  { key: 'pricing', label: 'Pricing', title: 'Pricing', icon: Settings, capability: 'pricing:write' },
  { key: 'staff', label: 'Staff accounts', title: 'Staff accounts', icon: Users, capability: 'staff:manage' },
  { key: 'account', label: 'My account', title: 'My account', icon: ShieldCheck },
];

export default function AdminDashboard({ token, user, onLogout }: AdminDashboardProps) {
  const userInitials = (user?.name || 'A')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // Which section of the console is open
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('overview');
  // Mobile only: the section menu that replaces the sidebar below lg
  const [sectionMenuOpen, setSectionMenuOpen] = useState(false);

  // Which controls this role may see. The server enforces the same table; this
  // only stops the console offering buttons that would come back 403.
  const canSeePayments = can(user?.role, 'payments:read');
  const canSeeRevenue = can(user?.role, 'revenue:read');
  // Read-only roles (support) must not be offered actions that would 403.
  const canWriteOrders = can(user?.role, 'orders:write');
  const canRecordPayment = can(user?.role, 'payments:write');
  const canSetPricing = can(user?.role, 'pricing:write');
  const canManageStaff = can(user?.role, 'staff:manage');

  // The sections this role may open, in sidebar order. Memoised on the role so
  // the guard effect below runs on a role change, not on every render.
  const visibleNavItems = useMemo(
    () => NAV_ITEMS.filter((item) => !item.capability || can(user?.role, item.capability)),
    [user?.role]
  );

  const activeNavItem =
    visibleNavItems.find((item) => item.key === activeSubTab) ?? visibleNavItems[0];

  /**
   * Switch section. Closes the mobile menu and clears the status filter when
   * entering the dispatch board, so arriving from a status tile on the overview
   * does not leave a stale filter applied.
   */
  const goToSection = (key: SubTab) => {
    setActiveSubTab(key);
    setSectionMenuOpen(false);
    if (key === 'pipeline') setStatusFilter('');
  };

  // A role that loses access to the section it is standing on gets moved off it.
  useEffect(() => {
    if (!visibleNavItems.some((item) => item.key === activeSubTab)) {
      setActiveSubTab('overview');
    }
  }, [activeSubTab, visibleNavItems]);

  // Loading indicator states
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [loadingPricing, setLoadingPricing] = useState(true);

  // Loaded server-side datasets
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<(Payment & { trackingCode: string; senderName: string; senderPhone: string })[]>([]);
  const [pricing, setPricing] = useState<PricingConfig | null>(null);
  const [allOrdersForStats, setAllOrdersForStats] = useState<Order[]>([]);
  const [allPaymentsForStats, setAllPaymentsForStats] = useState<any[]>([]);

  // Filters for orders list/pipeline
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  // Selected Order Detail Drawer / Inspect Panel state
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<{
    order: Order;
    history: StatusHistory[];
    payments: Payment[];
  } | null>(null);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);

  // Action input states inside Drawer
  const [statusNote, setStatusNote] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [submittingStatus, setSubmittingStatus] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Pricing configuration inputs
  const [smallPriceInput, setSmallPriceInput] = useState('');
  const [mediumPriceInput, setMediumPriceInput] = useState('');
  const [largePriceInput, setLargePriceInput] = useState('');
  const [submittingPricing, setSubmittingPricing] = useState(false);
  const [pricingSuccessMsg, setPricingSuccessMsg] = useState('');

  // Pagination (10 per page) for the pipeline table and payments ledger
  const PAGE_SIZE = 10;
  const [pipelinePage, setPipelinePage] = useState(1);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const [copiedRiderLink, setCopiedRiderLink] = useState(false);

  // Helper fetch configurations with authentication header
  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  });

  // Load general stats
  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const [statsRes, ordersRes, paymentsRes] = await Promise.all([
        fetch('/api/stats', { headers: getAuthHeaders() }),
        fetch('/api/orders', { headers: getAuthHeaders() }),
        fetch('/api/payments', { headers: getAuthHeaders() })
      ]);

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
      if (ordersRes.ok) {
        const oData = await ordersRes.json();
        setAllOrdersForStats(oData);
      }
      if (paymentsRes.ok) {
        const pData = await paymentsRes.json();
        setAllPaymentsForStats(pData);
      }
    } catch (err) {
      console.error('Failed to load stats', err);
    } finally {
      setLoadingStats(false);
    }
  };

  // Load filtered orders
  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      let queryParams = new URLSearchParams();
      if (searchFilter) queryParams.append('search', searchFilter);
      if (statusFilter) queryParams.append('status', statusFilter);
      if (startDateFilter) queryParams.append('startDate', startDateFilter);
      if (endDateFilter) queryParams.append('endDate', endDateFilter);

      const res = await fetch(`/api/orders?${queryParams.toString()}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (err) {
      console.error('Failed to load orders', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  // Load payments
  const fetchPayments = async () => {
    setLoadingPayments(true);
    try {
      const res = await fetch('/api/payments', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setPayments(data);
      }
    } catch (err) {
      console.error('Failed to load payments', err);
    } finally {
      setLoadingPayments(false);
    }
  };

  // Load pricing config
  const fetchPricing = async () => {
    setLoadingPricing(true);
    try {
      const res = await fetch('/api/pricing', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setPricing(data);
        setSmallPriceInput((data.small / 100).toString());
        setMediumPriceInput((data.medium / 100).toString());
        setLargePriceInput((data.large / 100).toString());
      }
    } catch (err) {
      console.error('Failed to load pricing', err);
    } finally {
      setLoadingPricing(false);
    }
  };

  // Sync data loaders based on active views
  useEffect(() => {
    fetchStats();
    fetchPricing();
  }, []);

  useEffect(() => {
    if (activeSubTab === 'overview') {
      fetchStats();
    } else if (activeSubTab === 'pipeline') {
      fetchOrders();
    } else if (activeSubTab === 'payments') {
      fetchPayments();
    } else if (activeSubTab === 'pricing') {
      fetchPricing();
    }
  }, [activeSubTab, searchFilter, statusFilter, startDateFilter, endDateFilter]);

  // Silent background refresh. Ticks every 30s rather than every second — the
  // old version re-rendered the whole console once a second to decrement a
  // countdown that is no longer shown.
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStats();
      fetchOrders();
      if (activeSubTab === 'payments') {
        fetchPayments();
      }
    }, 30_000);

    return () => clearInterval(interval);
  }, [activeSubTab, searchFilter, statusFilter, startDateFilter, endDateFilter]);

  // Load Order Details Drawer on selection
  useEffect(() => {
    if (selectedOrderId) {
      loadOrderDetails(selectedOrderId);
    } else {
      setSelectedOrderDetails(null);
    }
  }, [selectedOrderId]);

  const loadOrderDetails = async (id: string) => {
    setLoadingOrderDetails(true);
    try {
      const res = await fetch(`/api/orders/${id}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSelectedOrderDetails(data);
        // Pre-populate cash mark amount with actual pricing
        setPaymentAmount((data.order.priceAmount / 100).toString());
      }
    } catch (err) {
      console.error('Failed to load order detail', err);
    } finally {
      setLoadingOrderDetails(false);
    }
  };

  // Trigger Order Status Change
  const handleUpdateStatus = async (newStatus: OrderStatus) => {
    if (!selectedOrderId) return;
    setSubmittingStatus(true);
    try {
      const res = await fetch(`/api/orders/${selectedOrderId}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          status: newStatus,
          note: statusNote.trim() || undefined
        })
      });

      if (!res.ok) throw new Error('Failed to update order status');
      
      setStatusNote('');
      // Reload order details & trigger pipeline/stats refetches
      await loadOrderDetails(selectedOrderId);
      fetchOrders();
      fetchStats();
    } catch (err: any) {
      alert(err.message || 'Error occurred while changing status.');
    } finally {
      setSubmittingStatus(false);
    }
  };

  // Advance a single order to its next pipeline status directly from the table row
  const advanceOrderStatus = async (order: Order) => {
    const next = advanceStatus(order.status);
    if (!next) return;
    setAdvancingId(order.id);
    try {
      const res = await fetch(`/api/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error('Failed to advance order status');
      fetchOrders();
      fetchStats();
    } catch (err: any) {
      alert(err.message || 'Error advancing status.');
    } finally {
      setAdvancingId(null);
    }
  };

  // Reset pagination when the underlying lists change
  useEffect(() => { setPipelinePage(1); }, [searchFilter, statusFilter, startDateFilter, endDateFilter]);
  useEffect(() => { setPaymentsPage(1); }, [payments.length]);

  // Record Manual Payment / Mark as Paid
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId) return;
    setSubmittingPayment(true);
    try {
      const amtPesewas = Math.round(Number(paymentAmount) * 100);
      if (isNaN(amtPesewas) || amtPesewas <= 0) {
        throw new Error('Please enter a valid monetary payment amount.');
      }

      const res = await fetch(`/api/orders/${selectedOrderId}/pay`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          amount: amtPesewas,
          note: paymentNote.trim() || undefined,
          providerReference: paymentRef.trim() || undefined
        })
      });

      if (!res.ok) throw new Error('Failed to log payment transaction.');

      setPaymentNote('');
      setPaymentRef('');
      await loadOrderDetails(selectedOrderId);
      fetchOrders();
      fetchStats();
    } catch (err: any) {
      alert(err.message || 'Error occurred recording payment.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Update dynamic Pricing Config
  const handleUpdatePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingPricing(true);
    setPricingSuccessMsg('');
    try {
      const smallVal = Math.round(Number(smallPriceInput) * 100);
      const mediumVal = Math.round(Number(mediumPriceInput) * 100);
      const largeVal = Math.round(Number(largePriceInput) * 100);

      if (isNaN(smallVal) || isNaN(mediumVal) || isNaN(largeVal) || smallVal < 0 || mediumVal < 0 || largeVal < 0) {
        throw new Error('All size tier prices must be valid non-negative numbers.');
      }

      const res = await fetch('/api/pricing', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          small: smallVal,
          medium: mediumVal,
          large: largeVal
        })
      });

      if (!res.ok) throw new Error('Failed to modify database pricing config.');
      
      const data = await res.json();
      setPricing(data.pricing);
      setPricingSuccessMsg('Waypoint pricing configurations saved and updated successfully!');
      setTimeout(() => setPricingSuccessMsg(''), 5000);
    } catch (err: any) {
      alert(err.message || 'Error configuring pricing.');
    } finally {
      setSubmittingPricing(false);
    }
  };

  // Trigger payments CSV download
  const handleExportPaymentsCSV = () => {
    fetch('/api/payments/export', { headers: getAuthHeaders() })
      .then(res => {
        if (!res.ok) throw new Error();
        return res.blob();
      })
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'waypoint_payments_ledger.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      })
      .catch(() => alert('Failed to download ledger report CSV.'));
  };

  // Move Order Status to next step sequentially
  const getStatusLabel = (s: OrderStatus) => {
    return STATUS_ORDER.find(item => item.key === s)?.label || s;
  };

  /** "3d", "6h", "45m" — how long something has been sitting. */
  const formatAge = (iso: string) => {
    const mins = Math.max(0, (Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 60) return `${Math.floor(mins)}m`;
    if (mins < 60 * 24) return `${Math.floor(mins / 60)}h`;
    return `${Math.floor(mins / (60 * 24))}d`;
  };

  /**
   * Everything the overview shows beyond the raw status counts, derived from
   * the orders and payments already loaded — no extra endpoint.
   *
   * `updatedAt` is the last time an order changed at all, which for a stalled
   * order is when it entered its current status. That is what "sitting for 3d"
   * means here; it is not a per-status clock.
   */
  const overview = useMemo(() => {
    const hoursSince = (iso: string) => (Date.now() - new Date(iso).getTime()) / 3_600_000;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const isToday = (iso?: string) => !!iso && new Date(iso) >= startOfToday;

    // Orders that need a human to do something. One reason per order — the
    // first that matches, most urgent first.
    const attention = allOrdersForStats
      .filter((o) => o.status !== 'delivered' && o.status !== 'cancelled')
      .map((o) => {
        const idle = hoursSince(o.updatedAt || o.createdAt);
        let reason: string | null = null;
        if (o.status === 'awaiting_payment' && idle >= 24) reason = 'Awaiting payment';
        else if (o.status === 'requested' && idle >= 2) reason = 'Not yet confirmed';
        else if (o.status === 'queued' && !o.riderName) reason = 'No rider assigned';
        else if ((o.status === 'picked_up' || o.status === 'in_transit') && idle >= 24) reason = 'On the road over a day';
        return reason ? { order: o, reason, idle } : null;
      })
      .filter((x): x is { order: Order; reason: string; idle: number } => x !== null)
      .sort((a, b) => b.idle - a.idle);

    // Money owed on orders that are still live. Cancelled orders are not debt.
    const unpaid = allOrdersForStats.filter(
      (o) => o.paymentStatus === 'pending' && o.status !== 'cancelled'
    );
    const outstanding = unpaid.reduce((sum, o) => sum + o.priceAmount, 0);

    // Who is carrying what right now.
    const carrying = new Map<string, number>();
    for (const o of allOrdersForStats) {
      if (!o.riderName) continue;
      if (o.status === 'queued' || o.status === 'picked_up' || o.status === 'in_transit') {
        carrying.set(o.riderName, (carrying.get(o.riderName) ?? 0) + 1);
      }
    }
    const riders = [...carrying.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return {
      attention,
      outstanding,
      unpaidCount: unpaid.length,
      today: {
        booked: allOrdersForStats.filter((o) => isToday(o.createdAt)).length,
        delivered: allOrdersForStats.filter((o) => o.status === 'delivered' && isToday(o.updatedAt)).length,
        cancelled: allOrdersForStats.filter((o) => o.status === 'cancelled' && isToday(o.updatedAt)).length,
      },
      riders,
    };
  }, [allOrdersForStats]);

  return (
    <div className="w-full min-h-screen bg-[#F5F8FE] relative text-[#e4e4e7]" id="admin_dashboard_container">
      
      {/* Sidebar on desktop, section menu on mobile */}
      <div className="flex min-h-screen">

        {/* Desktop sidebar. Hidden below lg — phones use the header menu instead
            of a full-width nav block stacked above the content. */}
        <aside className="hidden lg:flex w-72 shrink-0 p-5 border-r border-slate-200 bg-white sticky top-0 h-[100dvh] flex-col justify-between overflow-y-auto">
          {/* Top Section */}
          <div className="space-y-6">

            {/* Branding / Identity Area */}
            <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
              <div className="h-10 w-10 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-center text-violet-600 shadow-sm shrink-0">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight leading-none">Waypoint</h2>
                <span className="text-xs font-medium text-slate-500 mt-1 block">Operations console</span>
              </div>
            </div>

            {/* Section navigation */}
            <nav className="space-y-1">

              {visibleNavItems.map(({ key, label, icon: Icon }) => {
                const active = activeSubTab === key;
                return (
                  <button
                    key={key}
                    onClick={() => goToSection(key)}
                    aria-current={active ? 'page' : undefined}
                    className={`w-full min-h-11 flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                      active
                        ? 'bg-violet-50 text-violet-700 border border-violet-200'
                        : 'text-slate-600 border border-transparent hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-violet-600' : 'text-slate-400'}`} />
                      <span>{label}</span>
                    </span>
                    {key === 'pipeline' && allOrdersForStats.length > 0 && (
                      <span className="text-xs tabular-nums bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded-md font-semibold">
                        {allOrdersForStats.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Sidebar Footer */}
          <div className="pt-4 border-t border-slate-200 text-xs text-slate-400">
            Waypoint Courier Services
          </div>
        </aside>

        {/* Right main area panel */}
        <div className="flex-1 min-w-0 flex flex-col">
          
          {/* Top Panel Bar */}
          <header className="border-b border-slate-200 bg-white/95 backdrop-blur-sm px-4 sm:px-6 py-3 sticky top-0 z-30">
            <div className="flex items-center justify-between gap-3">
              {/* Below lg the section name is the menu button; at lg the sidebar
                  owns navigation and this is a plain heading. */}
              <div className="min-w-0 flex-1">
                <button
                  onClick={() => setSectionMenuOpen((open) => !open)}
                  aria-expanded={sectionMenuOpen}
                  aria-haspopup="menu"
                  className="lg:hidden w-full min-h-11 flex items-center gap-2 -ml-2 px-2 py-1.5 rounded-xl text-left hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <span className="min-w-0">
                    <span className="block text-xs text-slate-500">Waypoint</span>
                    <span className="block text-lg font-bold text-slate-900 tracking-tight truncate">
                      {activeNavItem?.title}
                    </span>
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${sectionMenuOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                <h1 className="hidden lg:block text-xl font-bold text-slate-900 tracking-tight truncate">
                  {activeNavItem?.title}
                  {activeSubTab === 'pipeline' && statusFilter && (
                    <span className="ml-2 text-base font-semibold text-violet-600">
                      {getStatusLabel(statusFilter as OrderStatus)}
                    </span>
                  )}
                </h1>
              </div>

              {/* Quick actions + account */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <button
                  onClick={() => {
                    fetchStats();
                    fetchOrders();
                    fetchPayments();
                  }}
                  className="min-h-11 min-w-11 px-3 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  title="Refresh data"
                >
                  <Clock className="h-4 w-4" />
                  <span className="hidden sm:inline">Refresh</span>
                </button>

                {/* View live customer site */}
                <Link
                  to="/"
                  className="hidden md:flex min-h-11 items-center gap-2 px-3 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-sm font-semibold transition-colors cursor-pointer"
                  title="Open the live customer site"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>View site</span>
                </Link>

                {/* Signed-in user identity */}
                <div className="flex items-center gap-2 pl-1">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 border border-violet-200 text-violet-700 text-sm font-bold shrink-0">
                    {userInitials}
                  </div>
                  <div className="hidden xl:block leading-tight">
                    <span className="block text-sm font-semibold text-slate-900 max-w-[160px] truncate">{user?.name || 'Administrator'}</span>
                    <span className="block text-xs text-slate-500 max-w-[160px] truncate">{user?.email}</span>
                  </div>
                </div>

                {/* Logout */}
                <button
                  onClick={onLogout}
                  title="Sign out"
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Mobile section menu — the dropdown that replaces the stacked
                sidebar. Only rendered below lg. */}
            {sectionMenuOpen && (
              <nav className="lg:hidden mt-2 pb-1 space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
                {visibleNavItems.map(({ key, label, icon: Icon }) => {
                  const active = activeSubTab === key;
                  return (
                    <button
                      key={key}
                      onClick={() => goToSection(key)}
                      aria-current={active ? 'page' : undefined}
                      className={`w-full min-h-12 flex items-center justify-between gap-3 px-3 rounded-xl text-base font-semibold transition-colors cursor-pointer ${
                        active
                          ? 'bg-violet-50 text-violet-700 border border-violet-200'
                          : 'text-slate-700 border border-transparent hover:bg-slate-50'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-violet-600' : 'text-slate-400'}`} />
                        <span>{label}</span>
                      </span>
                      {key === 'pipeline' && allOrdersForStats.length > 0 && (
                        <span className="text-sm tabular-nums bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded-md font-semibold">
                          {allOrdersForStats.length}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            )}
          </header>

          {/* Core scrollable canvas workspace */}
          <div className="p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8 flex-1">

      {/* ----------------- SUB TAB: OVERVIEW STATS ----------------- */}
      {activeSubTab === 'overview' && (
        <div className="space-y-8 animate-in fade-in duration-200" id="dash_subtab_overview">
          {loadingStats ? (
            <div className="flex py-12 justify-center"><Loader2 className="h-8 w-8 text-violet-600 animate-spin" /></div>
          ) : (
            <>
              {/* Needs attention — first, because it is the only block on this
                  screen that asks the reader to do something. Everything below
                  is a readout; this is a queue. */}
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200">
                  <h2 className="text-base font-semibold text-slate-900">Needs attention</h2>
                  {overview.attention.length > 0 && (
                    <span className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-sm font-bold text-amber-700 tabular-nums">
                      {overview.attention.length}
                    </span>
                  )}
                </div>

                {overview.attention.length === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-700">Nothing is stuck</p>
                    <p className="text-sm text-slate-500 mt-0.5">
                      No unpaid, unconfirmed or unassigned orders waiting.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-200">
                    {overview.attention.slice(0, 6).map(({ order, reason }) => (
                      <li key={order.id}>
                        <button
                          onClick={() => setSelectedOrderId(order.id)}
                          className="w-full min-h-14 flex items-center justify-between gap-3 px-5 py-3 text-left hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          <span className="min-w-0">
                            <span className="font-mono text-sm font-bold text-slate-900 block">
                              {order.trackingCode}
                            </span>
                            <span className="text-sm text-slate-500 truncate block">{reason}</span>
                          </span>
                          <span className="shrink-0 flex items-center gap-2">
                            <span className="text-sm font-semibold text-amber-700 tabular-nums">
                              {formatAge(order.updatedAt || order.createdAt)}
                            </span>
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {overview.attention.length > 6 && (
                  <button
                    onClick={() => goToSection('pipeline')}
                    className="w-full min-h-12 border-t border-slate-200 text-sm font-semibold text-violet-700 hover:bg-violet-50 transition-colors cursor-pointer rounded-b-2xl"
                  >
                    View all {overview.attention.length} on the dispatch board
                  </button>
                )}
              </div>

              {/* The day so far, money owed, and who is out. Outstanding is
                  money, so it follows the same revenue gate as the cards. */}
              <div className={`grid grid-cols-1 gap-4 ${canSeeRevenue ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-500">Today</h3>
                  <dl className="mt-3 space-y-2">
                    {([
                      ['Booked', overview.today.booked],
                      ['Delivered', overview.today.delivered],
                      ['Cancelled', overview.today.cancelled],
                    ] as const).map(([label, value]) => (
                      <div key={label} className="flex items-baseline justify-between">
                        <dt className="text-base text-slate-600">{label}</dt>
                        <dd className="text-xl font-semibold text-slate-900 tabular-nums">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                {canSeeRevenue && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-slate-500">Outstanding</h3>
                    <p className="mt-3 text-3xl font-semibold text-slate-900 tabular-nums tracking-tight">
                      GHS {(overview.outstanding / 100).toFixed(2)}
                    </p>
                    <p className="mt-1.5 text-sm text-slate-500">
                      {overview.unpaidCount === 0
                        ? 'Everything live is paid for'
                        : `Across ${overview.unpaidCount} unpaid order${overview.unpaidCount === 1 ? '' : 's'}`}
                    </p>
                  </div>
                )}

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-500">On the road</h3>
                  {overview.riders.length === 0 ? (
                    <p className="mt-3 text-base text-slate-500">No riders carrying parcels.</p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {overview.riders.map((r) => (
                        <li key={r.name} className="flex items-baseline justify-between gap-3">
                          <span className="flex items-center gap-2 min-w-0">
                            <Truck className="h-4 w-4 text-violet-500 shrink-0" />
                            <span className="text-base text-slate-700 truncate">{r.name}</span>
                          </span>
                          <span className="text-base font-semibold text-slate-900 tabular-nums shrink-0">
                            {r.count}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Revenue cards — omitted entirely for roles without revenue:read.
                  The server does not send the figures to them, so rendering the
                  cards would show GHS 0.00, which reads as "you earned nothing"
                  rather than "this is not yours to see". */}
              {canSeeRevenue && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

                {/* Today */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-semibold text-slate-500 block">Revenue today</span>
                      <span className="text-xl sm:text-2xl lg:text-3xl font-semibold text-slate-900 mt-1 block tracking-tight tabular-nums">
                        GHS {((stats?.revenue?.today || 0) / 100).toFixed(2)}
                      </span>
                      <span className="text-xs text-emerald-600 font-semibold mt-1.5 flex items-center gap-1">
                        Settled today
                      </span>
                    </div>
                  </div>
                </div>

                {/* Week */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-semibold text-slate-500 block">Revenue this week</span>
                      <span className="text-xl sm:text-2xl lg:text-3xl font-semibold text-slate-900 mt-1 block tracking-tight tabular-nums">
                        GHS {((stats?.revenue?.week || 0) / 100).toFixed(2)}
                      </span>
                      <span className="text-xs text-slate-500 font-medium mt-1.5 block">
                        Trailing 7 days
                      </span>
                    </div>
                  </div>
                </div>

                {/* Month */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-semibold text-slate-500 block">Revenue this month</span>
                      <span className="text-xl sm:text-2xl lg:text-3xl font-semibold text-slate-900 mt-1 block tracking-tight tabular-nums">
                        GHS {((stats?.revenue?.month || 0) / 100).toFixed(2)}
                      </span>
                      <span className="text-xs text-slate-500 font-medium mt-1.5 block">
                        Trailing 30 days
                      </span>
                    </div>
                  </div>
                </div>

                {/* All Time */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-semibold text-slate-500 block">Collected all time</span>
                      <span className="text-xl sm:text-2xl lg:text-3xl font-semibold text-slate-900 mt-1 block tracking-tight tabular-nums">
                        GHS {((stats?.revenue?.allTime || 0) / 100).toFixed(2)}
                      </span>
                      <span className="text-xs text-slate-500 font-medium mt-1.5 block">
                        Every settled payment
                      </span>
                    </div>
                  </div>
                </div>

              </div>
              )}

              {/* Dispatch pipeline — one card: distribution bar + clickable status segments */}
              {(() => {
                const rows = STATUS_ORDER.map((s) => ({ ...s, count: stats?.counts[s.key] || 0 }));
                const total = rows.reduce((sum, s) => sum + s.count, 0);
                const active = rows.filter((s) => s.key !== 'delivered' && s.key !== 'cancelled')
                                   .reduce((sum, s) => sum + s.count, 0);

                return (
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    {/* Header */}
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                      <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4 text-violet-600" />
                        <h2 className="text-sm font-semibold text-slate-900">Dispatch pipeline</h2>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>
                          <span className="font-semibold text-slate-900 tabular-nums">{active}</span> in flight
                        </span>
                        <span className="h-3 w-px bg-slate-200" />
                        <span>
                          <span className="font-semibold text-slate-900 tabular-nums">{total}</span> total
                        </span>
                      </div>
                    </div>

                    {/* Proportional distribution bar */}
                    <div
                      className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-slate-100 mb-5"
                      role="img"
                      aria-label={`Order distribution: ${rows.map((s) => `${s.label} ${s.count}`).join(', ')}`}
                    >
                      {rows.map((s) =>
                        s.count > 0 ? (
                          <div
                            key={s.key}
                            className={`${s.dot} h-full`}
                            style={{ width: `${(s.count / (total || 1)) * 100}%` }}
                            title={`${s.label}: ${s.count}`}
                          />
                        ) : null
                      )}
                    </div>

                    {/* Clickable status segments */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1">
                      {rows.map((s) => {
                        const isActive = statusFilter === s.key;
                        return (
                          <button
                            key={s.key}
                            id={`stat_queue_card_${s.key}`}
                            onClick={() => {
                              setStatusFilter(s.key);
                              setActiveSubTab('pipeline');
                            }}
                            title={`Filter the board by ${s.label}`}
                            className={`group rounded-xl px-3 py-2.5 text-left transition-colors cursor-pointer ${
                              isActive ? 'bg-violet-50 ring-1 ring-violet-200' : 'hover:bg-slate-50'
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.dot}`} />
                              <span className="text-xs font-medium text-slate-500 truncate">{s.label}</span>
                            </span>
                            <span className="mt-1 block text-xl font-semibold text-slate-900 tabular-nums group-hover:text-violet-700 transition-colors">
                              {s.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

            </>
          )}
        </div>
      )}

      {/* ----------------- SUB TAB: DISPATCH PIPELINE ----------------- */}
      {activeSubTab === 'pipeline' && (
        <div className="space-y-6 animate-in fade-in duration-200" id="dash_subtab_pipeline">
          
          {/* Filters Bar */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-md grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-500 mb-1">Search Keywords</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  id="filter_search"
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Tracking code, sender name, phone..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-100 text-slate-900 pl-10 pr-4 py-3 text-sm outline-none focus:border-violet-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-500 mb-1">Status</label>
              <select
                id="filter_status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-100 text-slate-900 px-3 py-3 text-sm outline-none focus:border-violet-500 focus:bg-white transition-all"
              >
                <option value="">All Pipeline States</option>
                {STATUS_ORDER.map(s => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-500 mb-1">Created Since</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-500" />
                <input
                  id="filter_start_date"
                  type="date"
                  value={startDateFilter}
                  onChange={(e) => setStartDateFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-100 text-slate-900 pl-9 pr-3 py-3 text-sm outline-none focus:border-violet-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <button
              onClick={() => {
                setSearchFilter('');
                setStatusFilter('');
                setStartDateFilter('');
                setEndDateFilter('');
              }}
              className="w-full min-h-11 text-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-semibold text-sm transition-colors cursor-pointer"
            >
              Clear Filters
            </button>
          </div>

          {/* Loader/Grid */}
          {loadingOrders ? (
            <div className="flex py-12 justify-center"><Loader2 className="h-8 w-8 text-violet-600 animate-spin" /></div>
          ) : orders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center text-slate-500 bg-white">
              <ClipboardList className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-700">No dispatch orders match criteria</p>
              <p className="text-sm text-slate-500 mt-1">Try relaxing filters or search queries.</p>
            </div>
          ) : (
            /* Orders table (paginated 10 / page) */
            (() => {
              const totalPages = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
              const page = Math.min(pipelinePage, totalPages);
              const pageOrders = orders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
              return (
                <div className="space-y-3">
                  {/* Phones: one card per order, so status, price and the
                      Advance button stay on screen. The table below needs
                      ~900px of width and put Advance out of reach on a phone. */}
                  <div className="md:hidden space-y-3">
                    {pageOrders.map((order) => {
                      const statusTheme = STATUS_ORDER.find(s => s.key === order.status) || STATUS_ORDER[0];
                      const next = advanceStatus(order.status);
                      return (
                        <div
                          key={order.id}
                          onClick={() => setSelectedOrderId(order.id)}
                          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3 cursor-pointer active:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <span className="font-mono text-base font-bold text-slate-900">{order.trackingCode}</span>
                              {order.riderName && (
                                <span className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                                  <Truck className="h-4 w-4 text-violet-500 shrink-0" />
                                  {order.riderName}
                                </span>
                              )}
                            </div>
                            <span className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold ${statusTheme.bg} ${statusTheme.text}`}>
                              {statusTheme.label}
                            </span>
                          </div>

                          {/* Full addresses — no truncation, this is the screen
                              a rider or dispatcher actually reads them from. */}
                          <div className="text-sm space-y-1">
                            <p className="text-slate-800">{order.pickupAddress}</p>
                            <p className="text-slate-500">&rarr; {order.dropoffAddress}</p>
                          </div>

                          <div className="flex items-center gap-2 text-sm">
                            <span className="capitalize text-slate-600">{order.packageSize}</span>
                            <span className="text-slate-300">·</span>
                            <span className="font-semibold text-slate-900 tabular-nums">
                              {order.currency} {(order.priceAmount / 100).toFixed(2)}
                            </span>
                            <span className={`ml-auto rounded-md border px-2 py-0.5 text-xs font-semibold capitalize ${
                              order.paymentStatus === 'paid' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' :
                              order.paymentStatus === 'refunded' ? 'bg-violet-50 border-violet-200 text-violet-600' :
                              'bg-amber-500/10 border-amber-500/20 text-amber-600'
                            }`}>
                              {order.paymentStatus}
                            </span>
                          </div>

                          {next && canWriteOrders ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); advanceOrderStatus(order); }}
                              disabled={advancingId === order.id}
                              className="w-full min-h-12 flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 text-base font-bold text-violet-700 hover:bg-violet-100 transition-colors disabled:opacity-50 cursor-pointer"
                            >
                              {advancingId === order.id
                                ? <Loader2 className="h-5 w-5 animate-spin" />
                                : <ArrowRight className="h-5 w-5" />}
                              Advance to {getStatusLabel(next)}
                            </button>
                          ) : order.status === 'awaiting_payment' ? (
                            <p className="flex items-center gap-2 text-sm font-semibold text-orange-600">
                              <Clock className="h-4 w-4 shrink-0" />
                              Confirms automatically on payment
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  {/* Tablet and up: the table. */}
                  <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <table className="w-full text-left text-sm text-slate-700">
                      <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3">Tracking</th>
                          <th className="px-4 py-3">Route</th>
                          <th className="px-4 py-3">Size</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Payment</th>
                          <th className="px-4 py-3 text-right">Price</th>
                          <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {pageOrders.map((order) => {
                          const statusTheme = STATUS_ORDER.find(s => s.key === order.status) || STATUS_ORDER[0];
                          const next = advanceStatus(order.status);
                          return (
                            <tr
                              key={order.id}
                              onClick={() => setSelectedOrderId(order.id)}
                              className="hover:bg-slate-50 cursor-pointer transition-colors"
                            >
                              <td className="px-4 py-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                                {order.trackingCode}
                                {order.riderName && (
                                  <span className="mt-0.5 flex items-center gap-1 font-sans text-xs font-medium text-slate-500">
                                    <Truck className="h-3.5 w-3.5 text-violet-500" />
                                    {order.riderName}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 max-w-[220px]">
                                <span className="block text-slate-800 truncate">{order.pickupAddress}</span>
                                <span className="block text-slate-500 truncate">&rarr; {order.dropoffAddress}</span>
                              </td>
                              <td className="px-4 py-3 capitalize text-slate-700">{order.packageSize}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-block px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${statusTheme.bg} ${statusTheme.text}`}>
                                  {statusTheme.label}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-block rounded-md border px-2 py-0.5 text-xs font-semibold capitalize ${
                                  order.paymentStatus === 'paid' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' :
                                  order.paymentStatus === 'refunded' ? 'bg-violet-50 border-violet-200 text-violet-600' :
                                  'bg-amber-500/10 border-amber-500/20 text-amber-600'
                                }`}>
                                  {order.paymentStatus}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                                {order.currency} {(order.priceAmount / 100).toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                {next && canWriteOrders ? (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); advanceOrderStatus(order); }}
                                    disabled={advancingId === order.id}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-bold text-violet-700 hover:bg-violet-100 transition-colors disabled:opacity-50 cursor-pointer"
                                    title={`Advance to ${getStatusLabel(next)}`}
                                  >
                                    {advancingId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                                    {getStatusLabel(next)}
                                  </button>
                                ) : order.status === 'awaiting_payment' ? (
                                  <span
                                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600"
                                    title="Payment-gated — confirms automatically once payment is received"
                                  >
                                    <Clock className="h-4 w-4" />
                                    Auto on payment
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-400">Final</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pager */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1 text-sm text-slate-500">
                    <span>
                      Showing {(page - 1) * PAGE_SIZE + 1}&ndash;{Math.min(page * PAGE_SIZE, orders.length)} of {orders.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPipelinePage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="min-h-11 px-4 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
                      >
                        &lsaquo; Prev
                      </button>
                      <span className="font-mono">Page {page} / {totalPages}</span>
                      <button
                        onClick={() => setPipelinePage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        className="min-h-11 px-4 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Next &rsaquo;
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()
          )}

        </div>
      )}

      {/* ----------------- SUB TAB: PAYMENTS LEDGER ----------------- */}
      {activeSubTab === 'payments' && (
        <div className="space-y-6 animate-in fade-in duration-200" id="dash_subtab_payments">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Payments Ledger & Audits</h2>
              <p className="text-sm text-slate-500 mt-0.5">Historical ledger of all completed, pending, or manual reconciliation transactions.</p>
            </div>
            <button
              onClick={handleExportPaymentsCSV}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white min-h-11 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100 shadow-sm transition-colors self-start cursor-pointer"
            >
              <Download className="h-4.5 w-4.5" />
              <span>Export Accounting CSV</span>
            </button>
          </div>

          {loadingPayments ? (
            <div className="flex py-12 justify-center"><Loader2 className="h-8 w-8 text-violet-600 animate-spin" /></div>
          ) : payments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center text-slate-500 bg-white">
              <CreditCard className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-700">No ledger transactions logged</p>
            </div>
          ) : (
            /* Payments Table (paginated 10 / page) */
            (() => {
              const totalPages = Math.max(1, Math.ceil(payments.length / PAGE_SIZE));
              const page = Math.min(paymentsPage, totalPages);
              const pagePayments = payments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
              return (
              <div className="space-y-3">

              {/* Phones: a card per transaction. Nine columns cannot be read on
                  a 390px screen, so the ledger stacks instead. */}
              <div className="md:hidden space-y-3">
                {pagePayments.map((p) => (
                  <div key={p.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="font-mono text-base font-bold text-slate-900 block">{p.trackingCode}</span>
                        <span className="text-sm text-slate-500">{p.senderName}</span>
                      </div>
                      <span className="shrink-0 text-lg font-bold text-slate-900 tabular-nums">
                        {p.currency} {(p.amount / 100).toFixed(2)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-md border px-2 py-0.5 text-xs font-bold capitalize ${
                        p.status === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' :
                        p.status === 'failed' ? 'bg-red-500/10 border-red-500/20 text-red-600' :
                        'bg-amber-500/10 border-amber-500/20 text-amber-600'
                      }`}>
                        {p.status}
                      </span>
                      <span className={`rounded-md border px-2 py-0.5 text-xs font-bold capitalize ${
                        p.provider === 'momo' ? 'bg-amber-500/10 border-amber-500/20 text-amber-600' : 'bg-slate-100 border-slate-300 text-slate-700'
                      }`}>
                        {p.provider}
                      </span>
                      <span className="ml-auto text-sm text-slate-500">
                        {p.paidAt ? new Date(p.paidAt).toLocaleDateString() : new Date(p.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {p.note && <p className="text-sm text-slate-500">{p.note}</p>}

                    <p className="text-xs text-slate-400 font-mono break-all">
                      {p.providerReference ? `Ref ${p.providerReference}` : 'No provider reference'}
                    </p>
                  </div>
                ))}
              </div>

              <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm text-slate-700 border-collapse">
                <thead className="bg-slate-50 font-bold uppercase tracking-wide text-slate-500 text-xs border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Sender</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">State</th>
                    <th className="px-4 py-3">Notes</th>
                    <th className="px-4 py-3">Settled</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {pagePayments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900 whitespace-nowrap">{p.trackingCode}</td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-900 block">{p.senderName}</span>
                        <span className="text-xs text-slate-500 block font-mono">{p.senderPhone}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                        {p.currency} {(p.amount / 100).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-bold capitalize ${
                          p.provider === 'momo' ? 'bg-amber-500/10 border-amber-500/20 text-amber-600' : 'bg-slate-100 border-slate-300 text-slate-700'
                        }`}>
                          {p.provider}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500 max-w-[140px] truncate" title={p.providerReference || undefined}>
                        {p.providerReference || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-bold capitalize ${
                          p.status === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' :
                          p.status === 'failed' ? 'bg-red-500/10 border-red-500/20 text-red-600' :
                          'bg-amber-500/10 border-amber-500/20 text-amber-600'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate" title={p.note}>
                        {p.note || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {p.paidAt ? new Date(p.paidAt).toLocaleDateString() : new Date(p.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1 text-sm text-slate-500">
                <span>
                  Showing {(page - 1) * PAGE_SIZE + 1}&ndash;{Math.min(page * PAGE_SIZE, payments.length)} of {payments.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPaymentsPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="min-h-11 px-4 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
                  >
                    &lsaquo; Prev
                  </button>
                  <span className="font-mono">Page {page} / {totalPages}</span>
                  <button
                    onClick={() => setPaymentsPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="min-h-11 px-4 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Next &rsaquo;
                  </button>
                </div>
              </div>
              </div>
              );
            })()
          )}
        </div>
      )}

      {/* ----------------- SUB TAB: PRICING CONFIGURATION ----------------- */}
      {activeSubTab === 'pricing' && (
        <div className="mx-auto max-w-2xl animate-in fade-in duration-200" id="dash_subtab_pricing">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xl space-y-6">
            
            <div className="pb-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-1.5">
                <Settings className="h-5 w-5 text-violet-600" /> Pricing
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Configure the flat rates stored in the system database for different package weight categories. New custom quotes automatically calculate from this config.
              </p>
            </div>

            {pricingSuccessMsg && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs font-bold flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                <span>{pricingSuccessMsg}</span>
              </div>
            )}

            {loadingPricing ? (
              <div className="flex py-6 justify-center"><Loader2 className="h-6 w-6 text-violet-600 animate-spin" /></div>
            ) : (
              <form onSubmit={handleUpdatePricing} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  
                  {/* Small */}
                  <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                    <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">Small (e.g. pouch)</span>
                    <div className="flex items-center space-x-1.5 mt-2">
                      <span className="text-sm font-semibold text-slate-500">GHS</span>
                      <input
                        id="input_price_small"
                        type="number"
                        step="0.01"
                        required
                        value={smallPriceInput}
                        onChange={(e) => setSmallPriceInput(e.target.value)}
                        className="w-full min-h-11 py-2 font-bold font-mono text-slate-900 border-b border-slate-200 bg-transparent text-lg outline-none focus:border-violet-500"
                      />
                    </div>
                  </div>

                  {/* Medium */}
                  <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                    <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">Medium (box)</span>
                    <div className="flex items-center space-x-1.5 mt-2">
                      <span className="text-sm font-semibold text-slate-500">GHS</span>
                      <input
                        id="input_price_medium"
                        type="number"
                        step="0.01"
                        required
                        value={mediumPriceInput}
                        onChange={(e) => setMediumPriceInput(e.target.value)}
                        className="w-full min-h-11 py-2 font-bold font-mono text-slate-900 border-b border-slate-200 bg-transparent text-lg outline-none focus:border-violet-500"
                      />
                    </div>
                  </div>

                  {/* Large */}
                  <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                    <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">Large (strapped)</span>
                    <div className="flex items-center space-x-1.5 mt-2">
                      <span className="text-sm font-semibold text-slate-500">GHS</span>
                      <input
                        id="input_price_large"
                        type="number"
                        step="0.01"
                        required
                        value={largePriceInput}
                        onChange={(e) => setLargePriceInput(e.target.value)}
                        className="w-full min-h-11 py-2 font-bold font-mono text-slate-900 border-b border-slate-200 bg-transparent text-lg outline-none focus:border-violet-500"
                      />
                    </div>
                  </div>

                </div>

                <div className="pt-4 border-t border-slate-200 flex justify-end">
                  <button
                    id="btn_save_pricing"
                    type="submit"
                    disabled={submittingPricing}
                    className="w-full sm:w-auto min-h-12 rounded-xl btn-aurora text-white text-base font-bold px-6 shadow-lg shadow-violet-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {submittingPricing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Saving…</span>
                      </>
                    ) : (
                      <>
                        <span>Save pricing</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

      {activeSubTab === 'staff' && canManageStaff && (
        <div className="animate-in fade-in duration-200" id="dash_subtab_staff">
          <StaffManagement token={token} currentUser={user} />
        </div>
      )}

      {activeSubTab === 'account' && (
        <div className="animate-in fade-in duration-200" id="dash_subtab_account">
          <AccountSecurity token={token} user={user} />
        </div>
      )}

      {/* ----------------- ORDER DETAIL RIGHT-SIDEBAR INSPECTOR (DRAWER) ----------------- */}
      {selectedOrderId && (
        <div className="fixed inset-0 z-50 overflow-hidden" id="order_inspector_panel">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/65 backdrop-blur-xs transition-opacity" onClick={() => setSelectedOrderId(null)}></div>
          
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
            <div className="w-screen max-w-lg bg-white border-l border-slate-200 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300">
              
              {/* Drawer Header */}
              <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-sm text-slate-500 block">Order</span>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-1.5 mt-0.5">
                    {selectedOrderDetails?.order.trackingCode ?? ''}
                  </h2>
                </div>
                <button
                  id="btn_close_inspector"
                  onClick={() => setSelectedOrderId(null)}
                  className="h-11 w-11 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                
                {loadingOrderDetails || !selectedOrderDetails ? (
                  <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 text-violet-600 animate-spin" /></div>
                ) : (
                  <>
                    {/* General Specs Ticket Card */}
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-4">
                      {/* The tracking code is in the drawer header, so this row
                          carries the price alone rather than repeating it. */}
                      <div className="pb-3 border-b border-dashed border-slate-200">
                        <span className="text-sm text-slate-500 block">Price</span>
                        <span className="text-xl font-semibold text-slate-900 tabular-nums">
                          {selectedOrderDetails.order.currency} {(selectedOrderDetails.order.priceAmount / 100).toFixed(2)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-slate-500 block">Status</span>
                          <span className={`inline-block font-bold capitalize mt-0.5 rounded px-2 py-0.5 text-xs tracking-wider ${
                            STATUS_ORDER.find(s => s.key === selectedOrderDetails.order.status)?.bg || 'bg-slate-100'
                          } ${
                            STATUS_ORDER.find(s => s.key === selectedOrderDetails.order.status)?.text || 'text-slate-700'
                          }`}>
                            {selectedOrderDetails.order.status.replace('_', ' ')}
                          </span>
                        </div>

                        <div>
                          <span className="text-slate-500 block">Payment</span>
                          <span className={`inline-block font-bold uppercase mt-0.5 rounded border px-2 py-0.5 text-xs tracking-wider ${
                            selectedOrderDetails.order.paymentStatus === 'paid' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' :
                            'bg-amber-500/10 border-amber-500/20 text-amber-600'
                          }`}>
                            {selectedOrderDetails.order.paymentStatus}
                          </span>
                        </div>
                      </div>

                      {/* Assigned courier + shareable self-service link */}
                      {selectedOrderDetails.order.riderToken && (
                        <div className="mt-4 pt-4 border-t border-dashed border-slate-200">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <span className="text-slate-500 font-medium block text-xs">Assigned courier</span>
                              <span className="flex items-center gap-1.5 mt-0.5 text-sm font-semibold text-slate-900">
                                <Truck className="h-3.5 w-3.5 text-violet-600" />
                                {selectedOrderDetails.order.riderName || 'Unassigned'}
                              </span>
                            </div>
                            <button
                              onClick={() => {
                                const link = `${window.location.origin}/rider/${selectedOrderDetails.order.riderToken}`;
                                navigator.clipboard.writeText(link);
                                setCopiedRiderLink(true);
                                setTimeout(() => setCopiedRiderLink(false), 2000);
                              }}
                              className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 min-h-11 px-3 text-sm font-bold text-violet-700 hover:bg-violet-100 transition-colors cursor-pointer"
                              title="Copy the courier's self-service update link"
                            >
                              {copiedRiderLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                              {copiedRiderLink ? 'Copied' : 'Copy rider link'}
                            </button>
                          </div>
                          <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                            Send this to the courier — they can mark picked up, in transit and delivered themselves,
                            without a dashboard login.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Coordinates & Customer info */}
                    <div className="space-y-4">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Sender and recipient</h3>
                      
                      <div className="space-y-3.5 bg-white rounded-xl border border-slate-200 p-4 text-xs text-slate-700">
                        {/* Sender */}
                        <div className="flex gap-2.5 pb-3 border-b border-slate-200">
                          <User className="h-4.5 w-4.5 text-slate-500 shrink-0" />
                          <div>
                            <span className="text-slate-500 block font-semibold text-xs uppercase">Sender</span>
                            <span className="font-bold text-slate-900 block mt-0.5">{selectedOrderDetails.order.senderName}</span>
                            <span className="text-slate-500 font-mono text-xs block mt-0.5">{selectedOrderDetails.order.senderPhone}</span>
                            <span className="text-slate-700 block mt-1"><strong className="text-slate-500">Pickup:</strong> {selectedOrderDetails.order.pickupAddress}</span>
                            {selectedOrderDetails.order.pickupNotes && (
                              <span className="block italic text-xs text-slate-500 mt-1">Landmark: {selectedOrderDetails.order.pickupNotes}</span>
                            )}
                          </div>
                        </div>

                        {/* Recipient */}
                        <div className="flex gap-2.5">
                          <User className="h-4.5 w-4.5 text-slate-500 shrink-0" />
                          <div>
                            <span className="text-slate-500 block font-semibold text-xs uppercase">Recipient</span>
                            <span className="font-bold text-slate-900 block mt-0.5">{selectedOrderDetails.order.recipientName}</span>
                            <span className="text-slate-500 font-mono text-xs block mt-0.5">{selectedOrderDetails.order.recipientPhone}</span>
                            <span className="text-slate-700 block mt-1"><strong className="text-slate-500">Dropoff:</strong> {selectedOrderDetails.order.dropoffAddress}</span>
                            {selectedOrderDetails.order.dropoffNotes && (
                              <span className="block italic text-xs text-slate-500 mt-1">Landmark: {selectedOrderDetails.order.dropoffNotes}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Specifications */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Parcel specs</h3>
                      <div className="bg-white rounded-xl border border-slate-200 p-4 text-xs text-slate-700 space-y-2">
                        <p><strong className="text-slate-500">Size:</strong> <span className="capitalize font-bold text-slate-900">{selectedOrderDetails.order.packageSize}</span></p>
                        <p><strong className="text-slate-500">Weight:</strong> <span className="font-bold text-slate-900">{selectedOrderDetails.order.packageWeightKg} kg</span></p>
                        <p><strong className="text-slate-500">Description:</strong> <span className="text-slate-700">{selectedOrderDetails.order.packageDescription}</span></p>
                        <p><strong className="text-slate-500">Pickup:</strong> <span className="text-slate-700">{new Date(selectedOrderDetails.order.scheduledPickupAt).toLocaleString()}</span></p>
                      </div>
                    </div>

                    {/* CONTROL BOX: Transition workflow status — write roles only */}
                    {canWriteOrders && (
                    <div className="space-y-4 border-t border-slate-200 pt-6">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-900 flex items-center gap-1.5">
                        <Edit2 className="h-4 w-4 text-violet-600" /> Workflow Transition Pipeline
                      </h3>

                      <div className="space-y-3 bg-slate-100/25 rounded-xl p-4 border border-slate-200">
                        {/* Quick sequential next step trigger */}
                        {advanceStatus(selectedOrderDetails.order.status) && (
                          <div className="space-y-2 pb-3 border-b border-slate-200 mb-3">
                            <span className="text-xs text-slate-500 font-semibold block">Fast Next Step:</span>
                            <button
                              id="btn_trigger_next_status"
                              onClick={() => handleUpdateStatus(advanceStatus(selectedOrderDetails.order.status)!)}
                              disabled={submittingStatus}
                              className="w-full text-center min-h-12 px-4 rounded-xl btn-aurora text-white font-bold text-base shadow-md shadow-violet-500/20 transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                            >
                              <span>Move to "{getStatusLabel(advanceStatus(selectedOrderDetails.order.status)!)}"</span>
                              <ArrowRight className="h-4 w-4" />
                            </button>
                          </div>
                        )}

                        {/* Only the moves the server will actually accept. The
                            table is shared with the API, so this list cannot
                            drift from what is permitted. */}
                        {(() => {
                          const legal = nextStatuses(selectedOrderDetails.order.status);
                          if (legal.length === 0) {
                            return (
                              <p className="text-sm text-slate-500">
                                This order is {getStatusLabel(selectedOrderDetails.order.status).toLowerCase()} and cannot change further.
                              </p>
                            );
                          }
                          return (
                            <div className="grid grid-cols-2 gap-2">
                              {legal.map((key) => (
                                <button
                                  key={key}
                                  disabled={submittingStatus}
                                  onClick={() => handleUpdateStatus(key)}
                                  className="min-h-11 px-3 rounded-lg border text-center transition-colors font-semibold text-sm bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 cursor-pointer disabled:opacity-50"
                                >
                                  {getStatusLabel(key)}
                                </button>
                              ))}
                            </div>
                          );
                        })()}

                        {/* Optional status log notes */}
                        <div className="pt-2">
                          <label className="block text-sm text-slate-500 mb-1 font-semibold">Workflow Log Note (Who, what landmark/action)</label>
                          <input
                            id="input_status_note"
                            type="text"
                            value={statusNote}
                            onChange={(e) => setStatusNote(e.target.value)}
                            placeholder="e.g. Courier Kwesi assigned; package verified intact"
                            className="w-full min-h-11 text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-900 px-3 py-2.5 outline-none focus:border-violet-500"
                          />
                        </div>
                      </div>
                    </div>
                    )}

                    {/* CONTROL BOX: Mark payment as paid manually — finance/owner only */}
                    {canRecordPayment && selectedOrderDetails.order.paymentStatus !== 'paid' && (
                      <div className="space-y-4 border-t border-slate-200 pt-6">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-900 flex items-center gap-1.5">
                          <CreditCard className="h-4 w-4 text-emerald-600" /> Manual Payment reconciliation
                        </h3>

                        <form onSubmit={handleRecordPayment} className="space-y-3 bg-emerald-950/10 rounded-xl p-4 border border-emerald-800/30">
                          <span className="text-xs text-emerald-600 font-semibold block leading-relaxed">
                            Log a manually confirmed MTN MoMo transfer, banking deposit, or cash transaction to unlock metrics.
                          </span>

                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <label className="block text-sm text-slate-500 mb-1">Received Amount (GHS)</label>
                              <input
                                id="input_reconcile_amount"
                                type="number"
                                step="0.01"
                                required
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                                className="w-full min-h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 outline-none text-slate-900 font-bold focus:border-violet-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-slate-500 mb-1">Provider Reference (Optional)</label>
                              <input
                                id="input_reconcile_ref"
                                type="text"
                                value={paymentRef}
                                onChange={(e) => setPaymentRef(e.target.value)}
                                placeholder="e.g. TX-882012"
                                className="w-full min-h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 outline-none font-mono text-sm text-slate-900 focus:border-violet-500"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm text-slate-500 mb-1">Internal Audit Ledger Notes</label>
                            <input
                              id="input_reconcile_note"
                              type="text"
                              required
                              value={paymentNote}
                              onChange={(e) => setPaymentNote(e.target.value)}
                              placeholder="e.g. Verified momo screenshot on dispatch WhatsApp"
                              className="w-full min-h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none text-slate-900 focus:border-violet-500"
                            />
                          </div>

                          <button
                            id="btn_confirm_reconcile"
                            type="submit"
                            disabled={submittingPayment}
                            className="w-full text-center min-h-12 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-900 font-bold text-base shadow-lg shadow-emerald-600/10 transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                          >
                            {submittingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>Record Ledger Payment & Clear pending</span>}
                          </button>
                        </form>
                      </div>
                    )}

                    {/* Historical Status Timeline & Payment History logs */}
                    <div className="space-y-4 border-t border-slate-200 pt-6">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                        <Clock className="h-4.5 w-4.5" /> Event Timeline History ({selectedOrderDetails.history.length})
                      </h3>

                      <div className="space-y-3 pl-3 border-l-2 border-slate-200">
                        {selectedOrderDetails.history.map((log) => (
                          <div key={log.id} className="relative pl-4 text-xs font-sans text-slate-500 space-y-1">
                            <div className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-slate-300 border border-white"></div>
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-900 capitalize">{log.status.replace('_', ' ')}</span>
                              <span className="text-xs text-slate-500 font-mono">{new Date(log.changedAt).toLocaleString()}</span>
                            </div>
                            <p className="text-slate-600 leading-relaxed">{log.note}</p>
                            {log.changedByName && (
                              <span className="block text-xs text-slate-500 font-medium">Logged by: {log.changedByName}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                  </>
                )}

              </div>

            </div>
          </div>
        </div>
      )}

          </div>
        </div>
      </div>
    </div>
  );
}
