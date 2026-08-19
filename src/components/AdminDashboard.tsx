/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Layers,
  Search, 
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
  Users,
  ShieldCheck,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Undo2,
  ChevronUp
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
import { AUTOMATION_ACTOR } from '../brand.js';
import { advanceStatus, checkUndo, nextStatuses } from '../transitions.js';
import { quote, formatAmount } from '../pricing.js';
import type { Capability } from '../capabilities.js';
import SelectModal from './SelectModal.js';
import StaffManagement from './StaffManagement.js';
import AccountSecurity from './AccountSecurity.js';
import Tooltip from './Tooltip.js';
import DateModal from './DateModal.js';
import Sheet from './Sheet.js';
import { formatPhone } from '../phone.js';

interface AdminDashboardProps {
  token: string;
  user: AdminUser | null;
  onLogout: () => void;
}

// Order status list in correct workflow order.
// `dot` is the solid colour used by the pipeline distribution bar and status dots.
const STATUS_ORDER: { key: OrderStatus; label: string; bg: string; text: string; dot: string }[] = [
  { key: 'requested', label: 'Requested', bg: 'bg-slate-500/10 border border-slate-500/20', text: 'text-slate-600', dot: 'bg-slate-500' },
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
  // Desktop: the sidebar collapses to an icon rail. Remembered across visits —
  // someone working on a small laptop should not re-collapse it every time.
  const [railed, setRailed] = useState(() => {
    try { return localStorage.getItem('gd_admin_rail') === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('gd_admin_rail', railed ? '1' : '0'); } catch { /* private mode */ }
  }, [railed]);

  // Which controls this role may see. The server enforces the same table; this
  // only stops the console offering buttons that would come back 403.
  const canSeePayments = can(user?.role, 'payments:read');
  const canSeeRevenue = can(user?.role, 'revenue:read');
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
  const [baseRateInput, setBaseRateInput] = useState('');
  const [includedKgInput, setIncludedKgInput] = useState('');
  const [perExtraKgInput, setPerExtraKgInput] = useState('');
  const [submittingPricing, setSubmittingPricing] = useState(false);
  const [pricingSuccessMsg, setPricingSuccessMsg] = useState('');

  // Pagination (10 per page) for the pipeline table and payments ledger
  const PAGE_SIZE = 10;
  const [pipelinePage, setPipelinePage] = useState(1);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [advancingId, setAdvancingId] = useState<string | null>(null);

  // The payments ledger is filtered here rather than at the API: it is already
  // loaded in full for the revenue figures, so a round trip per keystroke would
  // buy nothing.
  const [paymentSearch, setPaymentSearch] = useState('');

  /**
   * Which ledger row is showing its detail.
   *
   * One at a time. The ledger is scanned far more often than it is read, and
   * eight columns of references and notes is a wall of text -- so a row shows
   * what identifies it and opens for the rest.
   */
  const [openPayment, setOpenPayment] = useState<string | null>(null);

  /**
   * Whether the filter controls are showing, below sm.
   *
   * On a phone the filter panel filled the whole first screen, so the board it
   * filters began below the fold: the answer was hidden by the question. The
   * search box stays -- it is the one people reach for -- and the rest folds
   * behind a button that says how many filters are on, so a narrowed board is
   * never a mystery.
   */
  const [filtersOpen, setFiltersOpen] = useState(false);

  /**
   * How much every row shows.
   *
   * One switch for the whole list rather than a control per row: somebody
   * reconciling fifteen payments wants all fifteen thickened at once, and
   * somebody triaging the board wants none of them. Remembered, because it is
   * a working style rather than a per-visit decision.
   */
  const [fullDetail, setFullDetail] = useState(() => {
    try { return localStorage.getItem('gd_full_detail') === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('gd_full_detail', fullDetail ? '1' : '0'); } catch { /* private mode */ }
  }, [fullDetail]);

  /**
   * The step just taken, and the offer to take it back.
   *
   * Advancing an order is one click on a table row, and the row under the
   * pointer is not always the row that was meant. This is where that mistake
   * gets caught — within a second or two, before anybody has acted on it.
   */
  const [undoOffer, setUndoOffer] = useState<
    { orderId: string; trackingCode: string; from: OrderStatus; to: OrderStatus } | null
  >(null);
  const [undoing, setUndoing] = useState(false);

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
        setBaseRateInput((data.baseAmount / 100).toString());
        setIncludedKgInput(String(data.includedKg));
        setPerExtraKgInput((data.perExtraKgAmount / 100).toString());
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
        // Checked rather than trusted: every read of this object assumes an
        // order is present, so a 200 carrying anything else takes the whole
        // console down with it rather than failing to open one drawer.
        if (!data?.order) {
          console.error('[orders] detail response had no order', data);
          setSelectedOrderId(null);
          alert('That order could not be loaded. Refresh and try again.');
          return;
        }
        setSelectedOrderDetails({
          order: data.order,
          history: Array.isArray(data.history) ? data.history : [],
          payments: Array.isArray(data.payments) ? data.payments : [],
        });
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
      
      const cameFrom = selectedOrderDetails?.order.status;
      if (cameFrom && selectedOrderDetails) {
        setUndoOffer({
          orderId: selectedOrderId,
          trackingCode: selectedOrderDetails.order.trackingCode,
          from: cameFrom,
          to: newStatus,
        });
      }

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
      setUndoOffer({
        orderId: order.id,
        trackingCode: order.trackingCode,
        from: order.status,
        to: next,
      });
      fetchOrders();
      fetchStats();
    } catch (err: any) {
      alert(err.message || 'Error advancing status.');
    } finally {
      setAdvancingId(null);
    }
  };

  /**
   * Take back the last status change on an order.
   *
   * The server owns the rules — the window, what counts as undoable, and every
   * side effect that has to come back with the status. This only asks, and
   * repeats what it says when it refuses.
   */
  const undoLastChange = async (orderId: string) => {
    setUndoing(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/undo`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not undo that change.');

      setUndoOffer(null);
      if (selectedOrderId === orderId) await loadOrderDetails(orderId);
      fetchOrders();
      fetchStats();
      if (activeSubTab === 'payments') fetchPayments();
    } catch (err: any) {
      alert(err.message || 'Could not undo that change.');
    } finally {
      setUndoing(false);
    }
  };

  // The offer is about the step just taken, so it does not outlive the moment
  // it was made in.
  useEffect(() => {
    if (!undoOffer) return;
    const t = setTimeout(() => setUndoOffer(null), 15_000);
    return () => clearTimeout(t);
  }, [undoOffer]);

  /**
   * Whether the drawer should offer an undo, decided by the same function the
   * server refuses with — so the button cannot appear for a change the API
   * would decline to reverse, and the reason shown is the reason it would give.
   */
  const drawerUndo = useMemo(() => {
    if (!selectedOrderDetails) return null;
    return checkUndo(
      selectedOrderDetails.history,
      selectedOrderDetails.order.status,
      AUTOMATION_ACTOR
    );
  }, [selectedOrderDetails]);

  /**
   * The board, in the order the work actually wants doing.
   *
   * Newest-first is how a database returns rows, not how a day runs: it put a
   * parcel booked ten minutes ago above one whose collection slot passed two
   * days back. So live parcels come first, most overdue at the top, then the
   * ones still ahead of their slot in the order they fall due, and finished
   * work last.
   */
  const boardOrders = useMemo(() => {
    const finished = (o: Order) => o.status === 'delivered' || o.status === 'cancelled';
    const due = (o: Order) => new Date(o.scheduledPickupAt).getTime();
    const now = Date.now();

    return [...orders].sort((a, b) => {
      if (finished(a) !== finished(b)) return finished(a) ? 1 : -1;
      if (finished(a)) return due(b) - due(a);

      const aLate = due(a) < now;
      const bLate = due(b) < now;
      if (aLate !== bLate) return aLate ? -1 : 1;
      // Overdue: worst first. Upcoming: soonest first.
      return aLate ? due(a) - due(b) : due(a) - due(b);
    });
  }, [orders]);

  /** Initials for the courier chip. Two letters is all the room there is. */
  const initials = (name?: string) =>
    (name || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase() || '?';

  // Reset pagination when the underlying lists change
  useEffect(() => { setPipelinePage(1); }, [searchFilter, statusFilter, startDateFilter, endDateFilter]);
  useEffect(() => { setPaymentsPage(1); }, [payments.length, paymentSearch]);

  /**
   * The ledger, narrowed by the search box.
   *
   * Matches on everything printed in a row — code, sender, phone, provider
   * reference, the note — because reconciling a transfer usually starts from
   * whichever of those the customer quoted down the phone, and finance should
   * not have to know which column it lives in.
   */
  const filteredPayments = useMemo(() => {
    const q = paymentSearch.trim().toLowerCase();
    if (!q) return payments;
    return payments.filter((p) =>
      [p.trackingCode, p.senderName, p.senderPhone, p.providerReference, p.note, p.provider, p.status]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q))
    );
  }, [payments, paymentSearch]);

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
      const baseAmount = Math.round(Number(baseRateInput) * 100);
      const includedKg = Math.round(Number(includedKgInput));
      const perExtraKgAmount = Math.round(Number(perExtraKgInput) * 100);

      if (![baseAmount, includedKg, perExtraKgAmount].every((n) => Number.isFinite(n) && n >= 0)) {
        throw new Error('Every value must be a non-negative number.');
      }
      if (includedKg < 1) {
        throw new Error('The included weight must be at least 1kg.');
      }

      const res = await fetch('/api/pricing', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ baseAmount, includedKg, perExtraKgAmount })
      });

      if (!res.ok) throw new Error('Failed to modify database pricing config.');
      
      const data = await res.json();
      setPricing(data.pricing);
      setPricingSuccessMsg('Pricing saved.');
      setTimeout(() => setPricingSuccessMsg(''), 5000);
    } catch (err: any) {
      alert(err.message || 'Error configuring pricing.');
    } finally {
      setSubmittingPricing(false);
    }
  };

  // Move Order Status to next step sequentially
  const getStatusLabel = (s: OrderStatus) => {
    return STATUS_ORDER.find(item => item.key === s)?.label || s;
  };

  /**
   * The collection slot, said the way a dispatcher would: "Today 9:00am".
   *
   * A bare date is the one thing a board like this must not print — the whole
   * job is knowing what is due now, and "18/08/2026 09:00" makes the reader do
   * the arithmetic on every row.
   */
  const formatPickup = (iso: string) => {
    const at = new Date(iso);
    const time = at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();

    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const days = Math.floor((at.getTime() - midnight.getTime()) / 86_400_000);

    if (days === 0) return `Today ${time}`;
    if (days === 1) return `Tomorrow ${time}`;
    if (days === -1) return `Yesterday ${time}`;
    return `${at.toLocaleDateString([], { day: 'numeric', month: 'short' })} ${time}`;
  };

  /**
   * The collection slot as a dispatcher would say it out loud.
   *
   * An overdue parcel says how overdue -- "2 days late" -- because that is the
   * fact being acted on. A date and a time is what a database knows; it makes
   * the reader work out the answer on every row.
   */
  const formatDue = (order: Order) => {
    const at = new Date(order.scheduledPickupAt);
    const time = at
      .toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      .toLowerCase()
      .replace(' ', '');

    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const days = Math.floor((at.getTime() - midnight.getTime()) / 86_400_000);
    const settled = order.status === 'delivered' || order.status === 'cancelled';

    if (settled) {
      if (days === 0) return `Today ${time}`;
      if (days === -1) return `Yesterday`;
      return at.toLocaleDateString([], { day: 'numeric', month: 'short' });
    }

    if (days <= -2) return `${Math.abs(days)} days late`;
    if (days === -1) return 'Yesterday';
    if (days === 0) return at.getTime() < Date.now() ? `Late, ${time}` : `Today ${time}`;
    if (days === 1) return `Tomorrow ${time}`;
    if (days < 7) return `${at.toLocaleDateString([], { weekday: 'short' })} ${time}`;
    return at.toLocaleDateString([], { day: 'numeric', month: 'short' });
  };

  /** Short date for the line that says when the booking came in. */
  const formatBooked = (iso: string) =>
    new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' });

  /**
   * A collection whose slot has passed while the parcel is still sitting here.
   * Nothing about the status says this — an order can be perfectly "confirmed"
   * and two days late.
   */
  const isLateForPickup = (order: Order) =>
    new Date(order.scheduledPickupAt).getTime() < Date.now() &&
    ['requested', 'awaiting_payment', 'confirmed', 'queued'].includes(order.status);

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
    <div className="w-full min-h-screen bg-[var(--wp-bg)] relative text-[#e4e4e7]" id="admin_dashboard_container">
      
      {/* Sidebar on desktop, section menu on mobile */}
      <div className="flex min-h-screen">

        {/* Desktop sidebar. Hidden below lg — phones use the header menu instead
            of a full-width nav block stacked above the content. */}
        <aside
          className={`hidden lg:flex shrink-0 border-r border-slate-200 bg-white sticky top-0 h-[100dvh] flex-col justify-between overflow-y-auto overflow-x-hidden transition-[width] duration-200 ease-out ${railed ? 'w-[76px] px-3 py-5' : 'w-72 p-5'}`}
        >
          {/* Top Section */}
          <div className="space-y-6">

            {/* Branding, and the control that collapses this sidebar. */}
            <div className={`flex items-center gap-3 pb-4 border-b border-slate-200 ${railed ? 'flex-col' : ''}`}>
              <div className="h-10 w-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 shrink-0">
                <Truck className="h-5 w-5" />
              </div>
              {!railed && (
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold text-slate-900 tracking-tight leading-none truncate">GO DISPATCH</h2>
                  <span className="text-xs font-medium text-slate-500 mt-1 block">Operations console</span>
                </div>
              )}
              <Tooltip placement="right" label={railed ? 'Expand the sidebar' : 'Collapse the sidebar to icons. Remembered next time.'}>
                <button
                  onClick={() => setRailed((v) => !v)}
                  aria-label={railed ? 'Expand sidebar' : 'Collapse sidebar'}
                  aria-pressed={railed}
                  className="h-11 w-11 shrink-0 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  {railed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
                </button>
              </Tooltip>
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
                    title={railed ? label : undefined}
                    data-active={active}
                    className={`gd-nav-item w-full min-h-11 flex items-center gap-3 rounded-xl text-sm font-medium transition-colors duration-200 cursor-pointer ${railed ? 'justify-center px-0' : 'justify-between px-3'} py-2.5 ${
                      active
                        ? 'bg-red-50 text-red-700'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    {/* One marker per item, but only the active one has height,
                        so switching sections reads as a bar growing where you
                        clicked rather than two bars blinking. */}
                    <span className="gd-nav-mark" aria-hidden="true" />
                    <span className="flex items-center gap-3 min-w-0">
                      <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-red-600' : 'text-slate-400'}`} />
                      {!railed && <span className="truncate">{label}</span>}
                    </span>
                    {!railed && key === 'pipeline' && allOrdersForStats.length > 0 && (
                      <span className="text-xs tabular-nums bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded-md font-medium">
                        {allOrdersForStats.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {!railed && (
            <div className="pt-4 border-t border-slate-200 text-xs text-slate-400">
              GO DISPATCH
            </div>
          )}
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
                    <span className="block text-xs text-slate-500">GO DISPATCH</span>
                    <span className="block text-lg font-semibold text-slate-900 tracking-tight truncate">
                      {activeNavItem?.title}
                    </span>
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${sectionMenuOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                <h1 className="hidden lg:block text-xl font-semibold text-slate-900 tracking-tight truncate">
                  {activeNavItem?.title}
                  {activeSubTab === 'pipeline' && statusFilter && (
                    <span className="ml-2 text-base font-medium text-red-600">
                      {getStatusLabel(statusFilter as OrderStatus)}
                    </span>
                  )}
                </h1>
              </div>

              {/* Quick actions + account */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <Tooltip placement="bottom" label="Reload orders, payments and figures now. They also refresh on their own every 30 seconds.">
                  <button
                    onClick={() => {
                      fetchStats();
                      fetchOrders();
                      fetchPayments();
                    }}
                    className="min-h-11 min-w-11 px-3 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-sm font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Clock className="h-4 w-4" />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>
                </Tooltip>

                {/* View live customer site */}
                <Tooltip placement="bottom" label="Open the customer site — what a sender sees when they book.">
                  {/* A real link, not a router one: the customer site is a
                      different bundle now, so this has to be a page load. */}
                  <a
                    href="/"
                    className="hidden md:flex min-h-11 items-center gap-2 px-3 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-sm font-medium transition-colors cursor-pointer"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>View site</span>
                  </a>
                </Tooltip>

                {/* Signed-in user identity */}
                <div className="flex items-center gap-2 pl-1">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 border border-red-200 text-red-700 text-sm font-semibold shrink-0">
                    {userInitials}
                  </div>
                  <div className="hidden xl:block leading-tight">
                    <span className="block text-sm font-medium text-slate-900 max-w-[160px] truncate">{user?.name || 'Administrator'}</span>
                    <span className="block text-xs text-slate-500 max-w-[160px] truncate">{user?.email}</span>
                  </div>
                </div>

                {/* Logout */}
                <Tooltip placement="bottom" label="Sign out of the console on this device.">
                  <button
                    onClick={onLogout}
                    aria-label="Sign out"
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </Tooltip>
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
                      data-active={active}
                      className={`gd-nav-item w-full min-h-12 flex items-center justify-between gap-3 px-3 rounded-xl text-base font-medium transition-colors duration-200 cursor-pointer ${
                        active
                          ? 'bg-red-50 text-red-700'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="gd-nav-mark" aria-hidden="true" />
                      <span className="flex items-center gap-3">
                        <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-red-600' : 'text-slate-400'}`} />
                        <span>{label}</span>
                      </span>
                      {key === 'pipeline' && allOrdersForStats.length > 0 && (
                        <span className="text-sm tabular-nums bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded-md font-medium">
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
          <div key={activeSubTab} className="gd-enter p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8 flex-1">

      {/* ----------------- SUB TAB: OVERVIEW STATS ----------------- */}
      {activeSubTab === 'overview' && (
        <div className="space-y-8" id="dash_subtab_overview">
          {loadingStats ? (
            <div className="flex py-12 justify-center"><Loader2 className="h-8 w-8 text-red-600 animate-spin" /></div>
          ) : (
            <>
              {/* Needs attention — first, because it is the only block on this
                  screen that asks the reader to do something. Everything below
                  is a readout; this is a queue. */}
              <div className="gd-panel">
                <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200">
                  <h2 className="text-base font-medium text-slate-900">Needs attention</h2>
                  {overview.attention.length > 0 && (
                    <span className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-sm font-semibold text-amber-700 tabular-nums">
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
                            <span className="font-mono text-sm font-semibold text-slate-900 block">
                              {order.trackingCode}
                            </span>
                            <span className="text-sm text-slate-500 truncate block">{reason}</span>
                          </span>
                          <span className="shrink-0 flex items-center gap-2">
                            <span className="text-sm font-medium text-amber-700 tabular-nums">
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
                    className="w-full min-h-12 border-t border-slate-200 text-sm font-medium text-red-700 hover:bg-red-50 transition-colors cursor-pointer rounded-b-2xl"
                  >
                    View all {overview.attention.length} on the dispatch board
                  </button>
                )}
              </div>

              {/* The day so far, money owed, and who is out. Outstanding is
                  money, so it follows the same revenue gate as the cards. */}
              <div className={`grid grid-cols-1 gap-4 ${canSeeRevenue ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>

                <div className="gd-panel p-5">
                  <h3 className="text-sm font-medium text-slate-500">Today</h3>
                  <dl className="mt-3 space-y-2">
                    {([
                      ['Booked', overview.today.booked],
                      ['Delivered', overview.today.delivered],
                      ['Cancelled', overview.today.cancelled],
                    ] as const).map(([label, value]) => (
                      <div key={label} className="flex items-baseline justify-between">
                        <dt className="text-base text-slate-600">{label}</dt>
                        <dd className="text-xl font-medium text-slate-900 tabular-nums">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                {canSeeRevenue && (
                  <div className="gd-panel p-5">
                    <h3 className="text-sm font-medium text-slate-500">Outstanding</h3>
                    <p key={overview.outstanding} className="gd-tick mt-3 text-3xl font-medium text-slate-900 tabular-nums tracking-tight">
                      GHS {(overview.outstanding / 100).toFixed(2)}
                    </p>
                    <p className="mt-1.5 text-sm text-slate-500">
                      {overview.unpaidCount === 0
                        ? 'Everything live is paid for'
                        : `Across ${overview.unpaidCount} unpaid order${overview.unpaidCount === 1 ? '' : 's'}`}
                    </p>
                  </div>
                )}

                <div className="gd-panel p-5">
                  <h3 className="text-sm font-medium text-slate-500">On the road</h3>
                  {overview.riders.length === 0 ? (
                    <p className="mt-3 text-base text-slate-500">No riders carrying parcels.</p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {overview.riders.map((r) => (
                        <li key={r.name} className="flex items-baseline justify-between gap-3">
                          <span className="flex items-center gap-2 min-w-0">
                            <Truck className="h-4 w-4 text-red-500 shrink-0" />
                            <span className="text-base text-slate-700 truncate">{r.name}</span>
                          </span>
                          <span className="text-base font-medium text-slate-900 tabular-nums shrink-0">
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
                <div className="gd-panel p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-slate-500 block">Revenue today</span>
                      <span className="text-xl sm:text-2xl lg:text-3xl font-medium text-slate-900 mt-1 block tracking-tight tabular-nums">
                        GHS {((stats?.revenue?.today || 0) / 100).toFixed(2)}
                      </span>
                      <span className="text-xs text-emerald-600 font-medium mt-1.5 flex items-center gap-1">
                        Settled today
                      </span>
                    </div>
                  </div>
                </div>

                {/* Week */}
                <div className="gd-panel p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-slate-500 block">Revenue this week</span>
                      <span className="text-xl sm:text-2xl lg:text-3xl font-medium text-slate-900 mt-1 block tracking-tight tabular-nums">
                        GHS {((stats?.revenue?.week || 0) / 100).toFixed(2)}
                      </span>
                      <span className="text-xs text-slate-500 font-medium mt-1.5 block">
                        Trailing 7 days
                      </span>
                    </div>
                  </div>
                </div>

                {/* Month */}
                <div className="gd-panel p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-slate-500 block">Revenue this month</span>
                      <span className="text-xl sm:text-2xl lg:text-3xl font-medium text-slate-900 mt-1 block tracking-tight tabular-nums">
                        GHS {((stats?.revenue?.month || 0) / 100).toFixed(2)}
                      </span>
                      <span className="text-xs text-slate-500 font-medium mt-1.5 block">
                        Trailing 30 days
                      </span>
                    </div>
                  </div>
                </div>

                {/* All Time */}
                <div className="gd-panel p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-slate-500 block">Collected all time</span>
                      <span className="text-xl sm:text-2xl lg:text-3xl font-medium text-slate-900 mt-1 block tracking-tight tabular-nums">
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
                  <div className="gd-panel p-6">
                    {/* Header */}
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                      <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4 text-red-600" />
                        <h2 className="text-sm font-medium text-slate-900">Dispatch pipeline</h2>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>
                          <span className="font-medium text-slate-900 tabular-nums">{active}</span> in flight
                        </span>
                        <span className="h-3 w-px bg-slate-200" />
                        <span>
                          <span className="font-medium text-slate-900 tabular-nums">{total}</span> total
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
                          <Tooltip
                            key={s.key}
                            label={`Open the dispatch board showing only ${s.label.toLowerCase()} orders`}
                          >
                          <button
                            id={`stat_queue_card_${s.key}`}
                            onClick={() => {
                              setStatusFilter(s.key);
                              setActiveSubTab('pipeline');
                            }}
                            className={`group rounded-xl px-3 py-2.5 text-left transition-colors cursor-pointer ${
                              isActive ? 'bg-red-50 ring-1 ring-red-200' : 'hover:bg-slate-50'
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.dot}`} />
                              <span className="text-xs font-medium text-slate-500 truncate">{s.label}</span>
                            </span>
                            <span className="mt-1 block text-xl font-medium text-slate-900 tabular-nums group-hover:text-red-700 transition-colors">
                              {s.count}
                            </span>
                          </button>
                          </Tooltip>
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
        <div className="space-y-6" id="dash_subtab_pipeline">
          
          {/* Filters Bar */}
          {(() => {
            const activeFilters = [statusFilter, startDateFilter].filter(Boolean).length;
            return (
          <div className="gd-panel p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 sm:gap-3 items-end">
            
            <div className="md:col-span-2">
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5">Search</label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  id="filter_search"
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Code, name or phone"
                  className="w-full min-h-12 rounded-2xl border border-slate-200/80 bg-white text-slate-900 pl-10 pr-4 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-colors"
                />
              </div>
            </div>

            {/* Below sm these three fold away behind the button underneath. */}
            <div className={`${filtersOpen ? 'block' : 'hidden'} sm:block`}>
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5">Status</label>
              <SelectModal
                id="filter_status"
                value={statusFilter}
                onChange={setStatusFilter}
                title="Filter by status"
                placeholder="All statuses"
                options={[
                  { value: '', label: 'All statuses' },
                  ...STATUS_ORDER.map((s) => ({ value: s.key, label: s.label })),
                ]}
                className="w-full min-h-12 flex items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-white px-3.5 text-left text-sm text-slate-900 hover:border-slate-300 focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none transition-colors cursor-pointer"
              />
            </div>

            <div className={`${filtersOpen ? 'block' : 'hidden'} sm:block`}>
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1.5">Booked since</label>
              <DateModal
                id="filter_start_date"
                value={startDateFilter}
                onChange={setStartDateFilter}
                title="Show orders booked since"
              />
            </div>

            <button
              onClick={() => {
                setSearchFilter('');
                setStatusFilter('');
                setStartDateFilter('');
                setEndDateFilter('');
              }}
              className={`${filtersOpen ? 'block' : 'hidden'} sm:block w-full min-h-12 text-center rounded-2xl border border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium text-sm transition-colors cursor-pointer`}
            >
              Clear filters
            </button>

            {/* Phone only: the way in and out of the folded controls. */}
            <button
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
              className="sm:hidden flex min-h-11 w-full items-center justify-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
            >
              {filtersOpen ? 'Fewer filters' : 'More filters'}
              {activeFilters > 0 && (
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                  {activeFilters} on
                </span>
              )}
              <ChevronDown className={`h-4 w-4 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
            );
          })()}

          {/* Loader/Grid */}
          {loadingOrders ? (
            <div className="flex py-12 justify-center"><Loader2 className="h-8 w-8 text-red-600 animate-spin" /></div>
          ) : orders.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 p-12 text-center text-slate-500 bg-white/60">
              <ClipboardList className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-700">No dispatch orders match criteria</p>
              <p className="text-sm text-slate-500 mt-1">Try relaxing filters or search queries.</p>
            </div>
          ) : (
            (() => {
              const totalPages = Math.max(1, Math.ceil(boardOrders.length / PAGE_SIZE));
              const page = Math.min(pipelinePage, totalPages);
              const pageOrders = boardOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
              return (
                <div className="space-y-3">

                  {/* One switch for the whole list. */}
                  <div className="flex items-center justify-between px-1">
                    <p className="text-sm text-slate-500">Most overdue first</p>
                    <button
                      onClick={() => setFullDetail((v) => !v)}
                      role="switch"
                      aria-checked={fullDetail}
                      className="flex items-center gap-2 min-h-11 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                    >
                      Full detail
                      <span className={`relative h-6 w-10 rounded-full transition-colors ${fullDetail ? 'bg-red-600' : 'bg-slate-300'}`}>
                        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${fullDetail ? 'left-5' : 'left-1'}`} />
                      </span>
                    </button>
                  </div>

                  {/* One list at every width. The courier rides on every row --
                      "who has this" is the question a ringing phone usually
                      asks -- and a parcel nobody is carrying says so in red,
                      because that is a gap in the plan rather than a state. */}
                  <div className="gd-panel overflow-hidden">
                    {pageOrders.map((order, i) => {
                      const theme = STATUS_ORDER.find((x) => x.key === order.status) || STATUS_ORDER[0];
                      const late = isLateForPickup(order);
                      const settled = order.status === 'delivered' || order.status === 'cancelled';
                      const unassigned = !order.riderName && !settled;

                      return (
                        <button
                          key={order.id}
                          onClick={() => setSelectedOrderId(order.id)}
                          // Capped at 8 so a full page never takes longer than
                          // a beat to settle.
                          style={{ animationDelay: `${Math.min(i, 8) * 28}ms` }}
                          className={`gd-row gd-row-in w-full px-4 sm:px-5 py-3 text-left ${
                            i > 0 ? 'border-t border-slate-100' : ''
                          }`}
                        >
                          {/* A phone reads this top-to-bottom: when, then what,
                              then who. A laptop reads it left-to-right. Same
                              markup, because two markups drift. */}
                          <span className="flex items-start gap-3">
                            {/* Who is carrying it. */}
                            <span
                              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                unassigned
                                  ? 'bg-red-50 text-red-600 ring-1 ring-red-200'
                                  : order.riderName
                                    ? 'bg-slate-100 text-slate-600'
                                    : 'bg-slate-50 text-slate-300'
                              }`}
                              title={order.riderName || 'No rider assigned'}
                            >
                              {order.riderName ? initials(order.riderName) : '?'}
                            </span>

                            <span className="min-w-0 flex-1">
                              {/* Line one: when it is due, and where it stands.
                                  On a phone these are the two facts that decide
                                  whether the row is worth opening. */}
                              <span className="flex items-center justify-between gap-2">
                                <span className={`text-sm font-semibold leading-tight ${
                                  late ? 'text-red-600' : settled ? 'text-slate-400' : 'text-slate-900'
                                }`}>
                                  {formatDue(order)}
                                </span>
                                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${theme.bg} ${theme.text}`}>
                                  {theme.label}
                                </span>
                              </span>

                              {/* Line two: which parcel. */}
                              <span className="mt-0.5 block font-mono text-sm font-semibold text-slate-900">
                                {order.trackingCode}
                              </span>

                              {/* Line three: who and where to. */}
                              <span className="block truncate text-sm text-slate-500">
                                {order.riderName ? (
                                  <>{order.riderName} <span className="text-slate-300">·</span> </>
                                ) : (
                                  <span className="font-medium text-red-600">Unassigned <span className="text-slate-300">·</span> </span>
                                )}
                                to {order.destinationRegion || order.dropoffAddress}
                              </span>

                              {/* What the switch adds, on every row at once. */}
                              {fullDetail && (
                                <span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-2 text-xs text-slate-500">
                                  <span>{order.packageWeightKg}kg</span>
                                  <span className="font-medium text-slate-900 tabular-nums">
                                    {order.currency} {(order.priceAmount / 100).toFixed(2)}
                                  </span>
                                  <span className={order.paymentStatus === 'paid' ? 'text-emerald-700' : 'text-amber-700'}>
                                    {order.paymentStatus === 'paid' ? 'Paid' : 'Payment due'}
                                  </span>
                                  <span className="hidden sm:inline truncate">{order.pickupAddress}</span>
                                  <span className="text-slate-400">Booked {formatBooked(order.createdAt)}</span>
                                </span>
                              )}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Pager */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 px-1 text-sm text-slate-500">
                    <span>
                      Showing {(page - 1) * PAGE_SIZE + 1}&ndash;{Math.min(page * PAGE_SIZE, boardOrders.length)} of {boardOrders.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPipelinePage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="min-h-11 px-3.5 rounded-2xl border border-slate-200/80 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
                      >
                        &lsaquo; Prev
                      </button>
                      <span className="font-mono">Page {page} / {totalPages}</span>
                      <button
                        onClick={() => setPipelinePage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        className="min-h-11 px-3.5 rounded-2xl border border-slate-200/80 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
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
        <div className="space-y-6" id="dash_subtab_payments">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Payments ledger</h2>
              <p className="text-sm text-slate-500 mt-0.5">Every transaction recorded against an order, newest first.</p>
            </div>
          </div>

          {/* Finding one transaction. Someone rings about a payment and quotes
              whichever detail they have to hand — a tracking code, the number
              they sent from, a MoMo reference — so one box takes all of them. */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                id="filter_payment_search"
                type="search"
                value={paymentSearch}
                onChange={(e) => setPaymentSearch(e.target.value)}
                placeholder="Search code, sender, phone, reference or note"
                className="w-full min-h-11 rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
              />
            </div>
            {paymentSearch && (
              <div className="flex items-center gap-3 text-sm text-slate-500 shrink-0">
                <span className="tabular-nums">
                  {filteredPayments.length} of {payments.length}
                </span>
                <button
                  onClick={() => setPaymentSearch('')}
                  className="min-h-11 px-3 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {loadingPayments ? (
            <div className="flex py-12 justify-center"><Loader2 className="h-8 w-8 text-red-600 animate-spin" /></div>
          ) : payments.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 p-12 text-center text-slate-500 bg-white/60">
              <CreditCard className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-700">No ledger transactions logged</p>
            </div>
          ) : (
            /* Payments Table (paginated 10 / page) */
            (() => {
              const totalPages = Math.max(1, Math.ceil(filteredPayments.length / PAGE_SIZE));
              const page = Math.min(paymentsPage, totalPages);
              const pagePayments = filteredPayments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

              if (filteredPayments.length === 0) {
                return (
                  <div className="rounded-3xl border border-dashed border-slate-200 p-12 text-center bg-white/60">
                    <Search className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-slate-700">
                      Nothing in the ledger matches "{paymentSearch}"
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      A payment only appears here once it has been recorded against an order.
                    </p>
                  </div>
                );
              }

              return (
              <div className="space-y-3">

              <div className="flex items-center justify-between px-1">
                <p className="text-sm text-slate-500">Newest first</p>
                <button
                  onClick={() => setFullDetail((v) => !v)}
                  role="switch"
                  aria-checked={fullDetail}
                  className="flex items-center gap-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  Full detail
                  <span className={`relative h-6 w-10 rounded-full transition-colors ${fullDetail ? 'bg-red-600' : 'bg-slate-300'}`}>
                    <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${fullDetail ? 'left-5' : 'left-1'}`} />
                  </span>
                </button>
              </div>

              {/* The same list mechanics as the board: a row says who and how
                  much, the switch thickens every row at once, and the whole
                  transaction opens in a sheet rather than pushing the list
                  down the page. */}
              <div className="gd-panel overflow-hidden">
                {pagePayments.map((p, i) => {
                  const settled = p.paidAt ?? p.createdAt;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setOpenPayment(p.id)}
                      style={{ animationDelay: `${Math.min(i, 8) * 28}ms` }}
                      className={`gd-row gd-row-in w-full flex flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-5 py-3.5 text-left ${
                        i > 0 ? 'border-t border-slate-100' : ''
                      }`}
                    >
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                          p.status === 'success' ? 'bg-emerald-500' :
                          p.status === 'failed' ? 'bg-red-500' : 'bg-amber-400'
                        }`}
                        title={p.status}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-sm font-semibold text-slate-900">{p.trackingCode}</span>
                        <span className="block truncate text-sm text-slate-500">{p.senderName}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-base font-semibold text-slate-900 tabular-nums">
                          {p.currency} {(p.amount / 100).toFixed(2)}
                        </span>
                        <span className="block text-xs text-slate-400 tabular-nums">
                          {new Date(settled).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                        </span>
                      </span>

                      {fullDetail && (
                        <span className="w-full flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-slate-100 pt-2.5 text-sm text-slate-500">
                          <span className="capitalize">{p.provider}</span>
                          <span className="font-mono text-xs">{p.providerReference || 'No reference'}</span>
                          <span className="font-mono text-xs">{formatPhone(p.senderPhone)}</span>
                          {p.note && <span className="truncate">{p.note}</span>}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 px-1 text-sm text-slate-500">
                <span>
                  Showing {(page - 1) * PAGE_SIZE + 1}&ndash;{Math.min(page * PAGE_SIZE, filteredPayments.length)} of {filteredPayments.length}
                  {paymentSearch && ' matching'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPaymentsPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="min-h-11 px-3.5 rounded-2xl border border-slate-200/80 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
                  >
                    &lsaquo; Prev
                  </button>
                  <span className="font-mono">Page {page} / {totalPages}</span>
                  <button
                    onClick={() => setPaymentsPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="min-h-11 px-3.5 rounded-2xl border border-slate-200/80 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
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
        <div className="mx-auto max-w-2xl" id="dash_subtab_pricing">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xl space-y-6">
            
            <div className="pb-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-1.5">
                <Settings className="h-5 w-5 text-red-600" /> Pricing
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                One rate to every town we serve, plus a charge for weight above the
                allowance. Changing these affects future bookings only — orders
                already placed keep the price they were quoted.
              </p>
            </div>

            {pricingSuccessMsg && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs font-semibold flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                <span>{pricingSuccessMsg}</span>
              </div>
            )}

            {loadingPricing ? (
              <div className="flex py-6 justify-center"><Loader2 className="h-6 w-6 text-red-600 animate-spin" /></div>
            ) : (
              <form onSubmit={handleUpdatePricing} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                  <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                    <Tooltip label="What every parcel costs up to the included weight, to any region. Distance never changes it.">
                      <label htmlFor="input_base_rate" className="block w-fit text-sm font-medium text-slate-500 underline decoration-dotted decoration-slate-300 underline-offset-4 cursor-help">
                        Flat rate
                      </label>
                    </Tooltip>
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="text-sm font-medium text-slate-500">GHS</span>
                      <input
                        id="input_base_rate"
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={baseRateInput}
                        onChange={(e) => setBaseRateInput(e.target.value)}
                        className="w-full min-h-11 py-2 font-semibold font-mono text-slate-900 border-b border-slate-200 bg-transparent text-lg outline-none focus:border-red-500"
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                    <Tooltip label="The weight the flat rate covers. Anything heavier is charged per whole kilo above this.">
                      <label htmlFor="input_included_kg" className="block w-fit text-sm font-medium text-slate-500 underline decoration-dotted decoration-slate-300 underline-offset-4 cursor-help">
                        Covers up to
                      </label>
                    </Tooltip>
                    <div className="flex items-center gap-1.5 mt-2">
                      <input
                        id="input_included_kg"
                        type="number"
                        step="1"
                        min="1"
                        required
                        value={includedKgInput}
                        onChange={(e) => setIncludedKgInput(e.target.value)}
                        className="w-full min-h-11 py-2 font-semibold font-mono text-slate-900 border-b border-slate-200 bg-transparent text-lg outline-none focus:border-red-500"
                      />
                      <span className="text-sm font-medium text-slate-500">kg</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                    <Tooltip label="Charged per whole kilo over the allowance. Part kilos round up — 3.4kg is billed as 4kg.">
                      <label htmlFor="input_per_extra_kg" className="block w-fit text-sm font-medium text-slate-500 underline decoration-dotted decoration-slate-300 underline-offset-4 cursor-help">
                        Each extra kg
                      </label>
                    </Tooltip>
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="text-sm font-medium text-slate-500">GHS</span>
                      <input
                        id="input_per_extra_kg"
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={perExtraKgInput}
                        onChange={(e) => setPerExtraKgInput(e.target.value)}
                        className="w-full min-h-11 py-2 font-semibold font-mono text-slate-900 border-b border-slate-200 bg-transparent text-lg outline-none focus:border-red-500"
                      />
                    </div>
                  </div>

                </div>

                {/* What the numbers above actually produce, so a change can be
                    sanity-checked before it is saved. */}
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <span className="text-sm font-medium text-slate-500">Worked examples</span>
                  <ul className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    {[1, 3, 5, 10].map((kg) => {
                      const rule = {
                        baseAmount: Math.round(Number(baseRateInput) * 100) || 0,
                        includedKg: Math.round(Number(includedKgInput)) || 1,
                        perExtraKgAmount: Math.round(Number(perExtraKgInput) * 100) || 0,
                        currency: pricing?.currency ?? 'GHS',
                      };
                      return (
                        <li key={kg}>
                          <span className="block text-slate-500">{kg}kg</span>
                          <span className="block font-medium text-slate-900 tabular-nums">
                            {formatAmount(quote(kg, rule).total, rule.currency)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div className="pt-4 border-t border-slate-200 flex justify-end">
                  <button
                    id="btn_save_pricing"
                    type="submit"
                    disabled={submittingPricing}
                    className="w-full sm:w-auto min-h-12 rounded-xl btn-aurora text-white text-base font-semibold px-6 shadow-lg shadow-red-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
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

      {/* ----------------- UNDO OFFER -----------------
          Sits above the drawer, because the change it is offering to take back
          can have been made from inside it. Fifteen seconds is long enough to
          notice a wrong row and short enough that it is gone before it becomes
          scenery — the server's window stays open for ten minutes either way,
          reachable from the order's own drawer. */}
      {undoOffer && canWriteOrders && (
        <div className="fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-5 pointer-events-none">
          <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 shadow-2xl animate-in slide-in-from-bottom-2 fade-in duration-200">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white">
                <span className="font-mono font-semibold">{undoOffer.trackingCode}</span>
                {' '}moved to{' '}
                <span className="font-medium">{getStatusLabel(undoOffer.to)}</span>
              </p>
              <p className="text-xs text-slate-400">Was {getStatusLabel(undoOffer.from)}</p>
            </div>

            <button
              onClick={() => undoLastChange(undoOffer.orderId)}
              disabled={undoing}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 min-h-11 px-3.5 text-sm font-semibold text-white transition-colors disabled:opacity-50 cursor-pointer"
            >
              {undoing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
              Undo
            </button>

            <button
              onClick={() => setUndoOffer(null)}
              aria-label="Dismiss"
              className="shrink-0 h-11 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* One transaction, in full. */}
      {(() => {
        const p = payments.find((x) => x.id === openPayment);
        if (!p) return null;
        const settled = p.paidAt ?? p.createdAt;
        return (
          <Sheet
            open
            onClose={() => setOpenPayment(null)}
            title={<span className="font-mono">{p.trackingCode}</span>}
            subtitle={`${p.currency} ${(p.amount / 100).toFixed(2)} · ${p.status}`}
          >
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wider text-slate-400">Paid by</dt>
                <dd className="mt-0.5 text-slate-900">{p.senderName}</dd>
                <dd className="font-mono text-xs text-slate-500">{formatPhone(p.senderPhone)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-slate-400">Method</dt>
                <dd className="mt-0.5 capitalize text-slate-900">{p.provider}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-slate-400">Settled</dt>
                <dd className="mt-0.5 text-slate-900 tabular-nums">
                  {new Date(settled).toLocaleString(undefined, {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-slate-400">Recorded by</dt>
                <dd className="mt-0.5 text-slate-900">{p.recordedByAdminId ? 'Staff' : 'Automation'}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs uppercase tracking-wider text-slate-400">Reference</dt>
                <dd className="mt-0.5 break-all font-mono text-xs text-slate-700">
                  {p.providerReference || 'None recorded'}
                </dd>
              </div>
              {p.note && (
                <div className="col-span-2">
                  <dt className="text-xs uppercase tracking-wider text-slate-400">Note</dt>
                  <dd className="mt-0.5 text-slate-700">{p.note}</dd>
                </div>
              )}
            </dl>
          </Sheet>
        );
      })()}

      {/* ----------------- THE ORDER SCREEN -----------------
          One parcel, in a sheet that rises over the board. The board does not
          move while it is open and is exactly where it was when it closes.

          Nothing folds. The side panel was 512px wide and had to hide five
          sections to fit; a sheet is as tall as the screen, so everything is
          simply there, in the order somebody works through it: what and where,
          then the action, then who to ring, then the record. */}
      {selectedOrderId && (
        <Sheet
          open
          onClose={() => setSelectedOrderId(null)}
          title={
            loadingOrderDetails || !selectedOrderDetails
              ? 'Loading'
              : <span className="font-mono">{selectedOrderDetails.order.trackingCode}</span>
          }
          subtitle={
            selectedOrderDetails && (
              <span className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  STATUS_ORDER.find((x) => x.key === selectedOrderDetails.order.status)?.bg ?? 'bg-slate-100'
                } ${
                  STATUS_ORDER.find((x) => x.key === selectedOrderDetails.order.status)?.text ?? 'text-slate-700'
                }`}>
                  {getStatusLabel(selectedOrderDetails.order.status)}
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  selectedOrderDetails.order.paymentStatus === 'paid'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-amber-50 text-amber-700'
                }`}>
                  {selectedOrderDetails.order.paymentStatus === 'paid' ? 'Paid' : 'Payment due'}
                </span>
                <span className="text-slate-400">
                  {selectedOrderDetails.order.currency}{' '}
                  {(selectedOrderDetails.order.priceAmount / 100).toFixed(2)}
                </span>
              </span>
            )
          }
          footer={
            canWriteOrders && selectedOrderDetails && advanceStatus(selectedOrderDetails.order.status) ? (
              <div className="space-y-2">
                <button
                  id="btn_trigger_next_status"
                  onClick={() => handleUpdateStatus(advanceStatus(selectedOrderDetails.order.status)!)}
                  disabled={submittingStatus}
                  // 56px is a thumb target on a phone. With a mouse it is just
                  // a loud slab, so it comes down to 48 from sm up.
                  className="btn-aurora w-full min-h-14 sm:min-h-12 flex items-center justify-center gap-2 rounded-2xl text-base sm:text-sm font-semibold text-white cursor-pointer disabled:opacity-60"
                >
                  {submittingStatus ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
                  Move to {getStatusLabel(advanceStatus(selectedOrderDetails.order.status)!)}
                </button>
                {drawerUndo?.ok === true && (
                  <button
                    onClick={() => undoLastChange(selectedOrderDetails.order.id)}
                    disabled={undoing}
                    className="w-full min-h-11 flex items-center justify-center gap-2 rounded-2xl text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {undoing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
                    {drawerUndo.wasUndo ? 'Redo' : 'Undo'} — back to {getStatusLabel(drawerUndo.previous)}
                  </button>
                )}
              </div>
            ) : null
          }
        >
          {loadingOrderDetails || !selectedOrderDetails ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-red-600" />
            </div>
          ) : (
            <div className="space-y-6">

              {/* Where it goes, and when. */}
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Collect from</p>
                <p className="mt-1 text-sm leading-snug text-slate-900">
                  {selectedOrderDetails.order.pickupAddress}
                </p>
                {selectedOrderDetails.order.pickupNotes && (
                  <p className="text-sm text-slate-500">{selectedOrderDetails.order.pickupNotes}</p>
                )}
                <p className="mt-3 text-xs font-medium uppercase tracking-wider text-slate-400">Deliver to</p>
                <p className="mt-1 text-sm leading-snug text-slate-900">
                  {selectedOrderDetails.order.dropoffAddress}
                </p>
                {selectedOrderDetails.order.dropoffNotes && (
                  <p className="text-sm text-slate-500">{selectedOrderDetails.order.dropoffNotes}</p>
                )}
                <p className="mt-3 border-t border-slate-200 pt-3 text-sm text-slate-600">
                  Collection {formatPickup(selectedOrderDetails.order.scheduledPickupAt)}
                  <span className="text-slate-300"> · </span>
                  {selectedOrderDetails.order.packageWeightKg}kg
                  <span className="text-slate-300"> · </span>
                  {selectedOrderDetails.order.packageDescription}
                </p>
              </div>

              {/* Who to ring. Both numbers, because either end can go wrong. */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Sender</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{selectedOrderDetails.order.senderName}</p>
                  <a href={`tel:${selectedOrderDetails.order.senderPhone}`}
                     className="mt-1.5 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-red-700">
                    <Phone className="h-4 w-4" />
                    {formatPhone(selectedOrderDetails.order.senderPhone)}
                  </a>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Recipient</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{selectedOrderDetails.order.recipientName}</p>
                  <a href={`tel:${selectedOrderDetails.order.recipientPhone}`}
                     className="mt-1.5 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-red-700">
                    <Phone className="h-4 w-4" />
                    {formatPhone(selectedOrderDetails.order.recipientPhone)}
                  </a>
                </div>
              </div>

              {/* Who is carrying it. The link they used to work from is gone --
                  see the note on serializeOrder. */}
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Courier</p>
                <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Truck className="h-4 w-4 text-red-600" />
                  {selectedOrderDetails.order.riderName || 'Unassigned'}
                </p>
              </div>

              {/* Moves the Advance button does not cover. */}
              {canWriteOrders && nextStatuses(selectedOrderDetails.order.status).filter(
                (k) => k !== advanceStatus(selectedOrderDetails.order.status)
              ).length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Other moves</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {nextStatuses(selectedOrderDetails.order.status)
                      .filter((k) => k !== advanceStatus(selectedOrderDetails.order.status))
                      .map((key) => (
                        <button
                          key={key}
                          disabled={submittingStatus}
                          onClick={() => handleUpdateStatus(key)}
                          className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {getStatusLabel(key)}
                        </button>
                      ))}
                  </div>
                  <input
                    id="input_status_note"
                    type="text"
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    placeholder="Note for the record (optional)"
                    className="mt-2 w-full min-h-11 rounded-xl border border-slate-200 px-3.5 text-sm text-slate-900 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-colors"
                  />
                </div>
              )}

              {/* Money owed, and the way to settle it. */}
              {canRecordPayment && selectedOrderDetails.order.paymentStatus !== 'paid' && (
                <form onSubmit={handleRecordPayment} className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-emerald-800">Record a payment</p>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      id="input_reconcile_amount"
                      type="number" step="0.01" required
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder="Amount"
                      className="min-h-11 rounded-xl border border-emerald-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    />
                    <input
                      id="input_reconcile_ref"
                      type="text"
                      value={paymentRef}
                      onChange={(e) => setPaymentRef(e.target.value)}
                      placeholder="Reference"
                      className="min-h-11 rounded-xl border border-emerald-200 bg-white px-3 font-mono text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>
                  <input
                    id="input_reconcile_note"
                    type="text" required
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    placeholder="What was seen — a MoMo screenshot, cash counted"
                    className="w-full min-h-11 rounded-xl border border-emerald-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  />
                  <button
                    id="btn_confirm_reconcile"
                    type="submit"
                    disabled={submittingPayment}
                    className="w-full min-h-12 flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {submittingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                    Record it
                  </button>
                </form>
              )}

              {/* What has happened, newest first. */}
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  History
                </p>
                <ol className="mt-2 space-y-3.5">
                  {selectedOrderDetails.history.map((log) => (
                    <li key={log.id} className="text-sm">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-medium text-slate-900">{getStatusLabel(log.status)}</span>
                        <span className="shrink-0 font-mono text-xs text-slate-400 tabular-nums">
                          {new Date(log.changedAt).toLocaleString(undefined, {
                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="mt-0.5 leading-relaxed text-slate-600">{log.note}</p>
                      {log.changedByName && (
                        <p className="text-xs text-slate-400">by {log.changedByName}</p>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </Sheet>
      )}

          </div>
        </div>
      </div>
    </div>
  );
}
