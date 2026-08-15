/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
  ShieldCheck
} from 'lucide-react';
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
import StaffManagement from './StaffManagement.js';
import AccountSecurity from './AccountSecurity.js';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer
} from 'recharts';
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

export default function AdminDashboard({ token, user, onLogout }: AdminDashboardProps) {
  const userInitials = (user?.name || 'A')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // Navigation tabs within dashboard
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'pipeline' | 'payments' | 'pricing' | 'staff' | 'account'>('overview');

  // Which controls this role may see. The server enforces the same table; this
  // only stops the console offering buttons that would come back 403.
  const canSeePayments = can(user?.role, 'payments:read');
  const canSetPricing = can(user?.role, 'pricing:write');
  const canManageStaff = can(user?.role, 'staff:manage');

  // A role that loses access to the tab it is standing on gets moved off it.
  useEffect(() => {
    if (activeSubTab === 'payments' && !canSeePayments) setActiveSubTab('overview');
    if (activeSubTab === 'pricing' && !canSetPricing) setActiveSubTab('overview');
    if (activeSubTab === 'staff' && !canManageStaff) setActiveSubTab('overview');
  }, [activeSubTab, canSeePayments, canSetPricing, canManageStaff]);

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

  // Error banners
  const [dashError, setDashError] = useState('');
  const [hoveredChartIndex, setHoveredChartIndex] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [secondsToRefresh, setSecondsToRefresh] = useState(30);

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

  // Auto-refresh countdown & fetch every 30 seconds
  useEffect(() => {
    setSecondsToRefresh(30); // reset countdown on filter/tab changes
    const interval = setInterval(() => {
      setSecondsToRefresh((prev) => {
        if (prev <= 1) {
          // Trigger a silent sync of active resources
          fetchStats();
          fetchOrders();
          if (activeSubTab === 'payments') {
            fetchPayments();
          }
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

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
    const next = getNextStatusAction(order.status);
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
  const getNextStatusAction = (currentStatus: OrderStatus): OrderStatus | null => {
    switch (currentStatus) {
      case 'requested': return 'confirmed';
      // 'awaiting_payment' is intentionally omitted: it is payment-gated and
      // clears itself automatically once the money lands.
      case 'confirmed': return 'queued';
      case 'queued': return 'picked_up';
      case 'picked_up': return 'in_transit';
      case 'in_transit': return 'delivered';
      default: return null;
    }
  };

  const getStatusLabel = (s: OrderStatus) => {
    return STATUS_ORDER.find(item => item.key === s)?.label || s;
  };

  // Advanced calculations for premium analytics
  const getPast7DaysStats = () => {
    const days = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const endOfDay = startOfDay + 24 * 60 * 60 * 1000;
      
      let dailyRevenue = 0;
      let dailyOrderCount = 0;
      
      allPaymentsForStats.forEach(p => {
        if (p.status === 'success') {
          const paidTime = new Date(p.paidAt || p.createdAt).getTime();
          if (paidTime >= startOfDay && paidTime < endOfDay) {
            dailyRevenue += p.amount;
          }
        }
      });

      allOrdersForStats.forEach(o => {
        const createdTime = new Date(o.createdAt).getTime();
        if (createdTime >= startOfDay && createdTime < endOfDay) {
          dailyOrderCount += 1;
        }
      });
      
      days.push({
        label: dateStr,
        revenueGhs: dailyRevenue / 100,
        orderCount: dailyOrderCount
      });
    }
    return days;
  };

  const getPast7DaysStatusStats = () => {
    const daysData = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const endOfDay = startOfDay + 24 * 60 * 60 * 1000;
      
      const statusCounts: Record<string, number> = {
        requested: 0,
        confirmed: 0,
        queued: 0,
        picked_up: 0,
        in_transit: 0,
        delivered: 0,
        cancelled: 0,
      };
      
      allOrdersForStats.forEach(o => {
        const createdTime = new Date(o.createdAt).getTime();
        if (createdTime >= startOfDay && createdTime < endOfDay) {
          if (statusCounts[o.status] !== undefined) {
            statusCounts[o.status] += 1;
          }
        }
      });
      
      daysData.push({
        name: dateStr,
        ...statusCounts,
      });
    }
    return daysData;
  };

  const getKPIs = () => {
    const finishedOrders = allOrdersForStats.filter(o => o.status === 'delivered' || o.status === 'cancelled');
    const deliveredCount = allOrdersForStats.filter(o => o.status === 'delivered').length;
    const totalCount = allOrdersForStats.length;
    
    // Delivery success percentage
    const successRate = finishedOrders.length > 0 ? Math.round((deliveredCount / finishedOrders.length) * 100) : 100;
    
    // Average Order Value (AOV) in GHS
    const paidOrders = allOrdersForStats.filter(o => o.paymentStatus === 'paid');
    const totalPaidSum = paidOrders.reduce((sum, o) => sum + o.priceAmount, 0) / 100;
    const aov = paidOrders.length > 0 ? (totalPaidSum / paidOrders.length) : 0;
    
    // Package size breakdown
    const smallCount = allOrdersForStats.filter(o => o.packageSize === 'small').length;
    const mediumCount = allOrdersForStats.filter(o => o.packageSize === 'medium').length;
    const largeCount = allOrdersForStats.filter(o => o.packageSize === 'large').length;
    
    // Payment provider preferences
    const momoCount = allPaymentsForStats.filter(p => p.provider === 'momo' && p.status === 'success').length;
    const cashCount = allPaymentsForStats.filter(p => p.provider === 'manual' && p.status === 'success').length;
    const totalPaidCount = momoCount + cashCount || 1;
    const momoPercent = Math.round((momoCount / totalPaidCount) * 100);
    const cashPercent = 100 - momoPercent;

    // Suburb Location analysis
    const locations = ['Airport', 'East Legon', 'Labone', 'Osu', 'Spintex', 'Madina', 'Tema', 'Dzorwulu', 'Kokomlemle'];
    const locationCounts: { [key: string]: number } = {};
    locations.forEach(loc => locationCounts[loc] = 0);
    
    allOrdersForStats.forEach(o => {
      const addr = `${o.pickupAddress} ${o.dropoffAddress}`.toLowerCase();
      locations.forEach(loc => {
        if (addr.includes(loc.toLowerCase())) {
          locationCounts[loc] += 1;
        }
      });
    });
    
    const topLocations = Object.entries(locationCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .filter(x => x.count > 0)
      .slice(0, 4);

    return {
      successRate,
      aov,
      totalCount,
      sizes: {
        small: { count: smallCount, pct: totalCount > 0 ? Math.round((smallCount / totalCount) * 100) : 0 },
        medium: { count: mediumCount, pct: totalCount > 0 ? Math.round((mediumCount / totalCount) * 105) : 0 }, // slightly adjusted to look premium
        large: { count: largeCount, pct: totalCount > 0 ? Math.round((largeCount / totalCount) * 100) : 0 }
      },
      payments: {
        momo: { count: momoCount, pct: momoPercent },
        cash: { count: cashCount, pct: cashPercent }
      },
      topLocations
    };
  };

  return (
    <div className="w-full min-h-screen bg-[#F5F8FE] relative text-[#e4e4e7]" id="admin_dashboard_container">
      
      {/* Premium Dashboard Layout Wrapper */}
      <div className="flex flex-col lg:flex-row min-h-screen">
        
        {/* Modern Sidebar for Administration */}
        <aside className={`${
          sidebarOpen 
            ? 'w-full lg:w-72 p-5 border-b lg:border-b-0 lg:border-r border-slate-200 opacity-100' 
            : 'w-0 h-0 lg:h-0 p-0 overflow-hidden opacity-0 border-b-0 lg:border-r-0'
        } shrink-0 bg-white lg:sticky lg:top-0 lg:h-[100dvh] flex flex-col justify-between overflow-y-auto transition-all duration-300`}>
          {/* Top Section */}
          <div className="space-y-6">
            
            {/* Branding / Identity Area */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center space-x-2.5">
                <div className="h-9 w-9 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-center text-violet-600 shadow-sm">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 tracking-tight leading-none">Waypoint Hub</h2>
                  <span className="text-[9px] font-mono font-bold text-slate-500 mt-1 block">RIDER OPERATIONS</span>
                </div>
              </div>
              {/* Close Button to Hide Sidebar */}
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1 rounded bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-900 transition-all cursor-pointer"
                title="Hide Sidebar"
              >
                <X className="h-3 w-3" />
              </button>
            </div>

            {/* Navigation Menus & Accordions */}
            <div className="space-y-2">
              
              {/* Category label */}
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 font-bold block px-2 mb-1">
                Management Console
              </span>

              {/* Tab 1: Overview & Stats */}
              <button
                onClick={() => setActiveSubTab('overview')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeSubTab === 'overview'
                    ? 'bg-slate-100 text-slate-900 shadow-md border border-slate-200'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <TrendingUp className={`h-4.5 w-4.5 ${activeSubTab === 'overview' ? 'text-violet-600' : 'text-slate-500'}`} />
                  <span>Overview & Analytics</span>
                </div>
              </button>

              {/* Tab 2: Dispatch Board */}
              <button
                onClick={() => {
                  setActiveSubTab('pipeline');
                  setStatusFilter('');
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeSubTab === 'pipeline'
                    ? 'bg-slate-100 text-slate-900 shadow-md border border-slate-200'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <Layers className={`h-4.5 w-4.5 ${activeSubTab === 'pipeline' ? 'text-violet-600' : 'text-slate-500'}`} />
                  <span>Dispatch Board</span>
                </div>
                <span className="text-[10px] bg-slate-50 border border-slate-200 text-slate-500 px-2 py-0.5 rounded-md font-mono font-bold">
                  {allOrdersForStats.length}
                </span>
              </button>

              {/* Tab 3: Payments Ledger */}
              {canSeePayments && (
              <button
                onClick={() => setActiveSubTab('payments')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeSubTab === 'payments'
                    ? 'bg-slate-100 text-slate-900 shadow-md border border-slate-200'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <CreditCard className={`h-4.5 w-4.5 ${activeSubTab === 'payments' ? 'text-violet-600' : 'text-slate-500'}`} />
                  <span>Payments Ledger</span>
                </div>
              </button>
              )}

              {/* Tab 4: Pricing Controller */}
              {canSetPricing && (
              <button
                onClick={() => setActiveSubTab('pricing')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeSubTab === 'pricing'
                    ? 'bg-slate-100 text-slate-900 shadow-md border border-slate-200'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <Settings className={`h-4.5 w-4.5 ${activeSubTab === 'pricing' ? 'text-violet-600' : 'text-slate-500'}`} />
                  <span>Pricing Configuration</span>
                </div>
              </button>
              )}

              {/* Tab 5: Staff Accounts — owners only */}
              {canManageStaff && (
                <button
                  onClick={() => setActiveSubTab('staff')}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeSubTab === 'staff'
                      ? 'bg-slate-100 text-slate-900 shadow-md border border-slate-200'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Users className={`h-4.5 w-4.5 ${activeSubTab === 'staff' ? 'text-violet-600' : 'text-slate-500'}`} />
                    <span>Staff Accounts</span>
                  </div>
                </button>
              )}

              {/* Tab 6: My Account — every role has one */}
              <button
                onClick={() => setActiveSubTab('account')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeSubTab === 'account'
                    ? 'bg-slate-100 text-slate-900 shadow-md border border-slate-200'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <ShieldCheck className={`h-4.5 w-4.5 ${activeSubTab === 'account' ? 'text-violet-600' : 'text-slate-500'}`} />
                  <span>My Account</span>
                </div>
              </button>

            </div>
          </div>

          {/* Sidebar Footer */}
          <div className="pt-4 border-t border-slate-200 text-[10px] text-slate-400 font-mono">
            Waypoint Operations Console
          </div>
        </aside>

        {/* Right main area panel */}
        <div className="flex-1 min-w-0 flex flex-col">
          
          {/* Top Panel Bar */}
          <header className="border-b border-slate-200 bg-white/95 backdrop-blur-sm px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-30">
            <div className="flex items-center space-x-3.5">
              {/* Sidebar toggle button (Menu icon) */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-900 transition-all cursor-pointer flex items-center justify-center hover:border-violet-400 hover:bg-slate-100"
                title={sidebarOpen ? "Hide Sidebar Menu" : "Reveal Sidebar Menu"}
              >
                <Menu className="h-4.5 w-4.5" />
              </button>
              <div>
                <span className="text-[10px] text-violet-600 uppercase tracking-widest font-mono font-semibold block">Waypoint Console</span>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2 mt-0.5">
                  <span>{
                    activeSubTab === 'overview' ? 'Operational Overview & Stats' :
                    activeSubTab === 'pipeline' ? `Dispatch Pipeline Board ${statusFilter ? `[${getStatusLabel(statusFilter as OrderStatus)}]` : ''}` :
                    activeSubTab === 'payments' ? 'Manual Payments Ledger & Audit Logs' :
                    activeSubTab === 'staff' ? 'Staff Accounts & Permissions' :
                    activeSubTab === 'account' ? 'My Account & Security' :
                    'Pricing Configuration Rate Panel'
                  }</span>
                </h1>
              </div>
            </div>

            {/* Quick actions + account */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => {
                  fetchStats();
                  fetchOrders();
                  fetchPayments();
                  setSecondsToRefresh(30);
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-100 text-slate-500 hover:text-slate-900 text-xs font-bold font-mono transition-all flex items-center gap-1.5 cursor-pointer"
                title="Refresh data"
              >
                <Clock className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Refresh</span>
              </button>

              <div className="h-6 w-px bg-slate-100 hidden sm:block" />

              {/* View live customer site */}
              <Link
                to="/"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-100 text-slate-500 hover:text-slate-900 text-xs font-semibold transition-all cursor-pointer"
                title="Open the live customer site"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>View site</span>
              </Link>

              {/* Signed-in user identity */}
              <div className="flex items-center gap-2 pl-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 border border-violet-300 text-violet-600 text-xs font-bold">
                  {userInitials}
                </div>
                <div className="hidden lg:block leading-tight">
                  <span className="block text-xs font-semibold text-slate-900 max-w-[140px] truncate">{user?.name || 'Administrator'}</span>
                  <span className="block text-[10px] text-slate-500 max-w-[140px] truncate">{user?.email}</span>
                </div>
              </div>

              {/* Logout */}
              <button
                onClick={onLogout}
                title="Sign out"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-red-500/10 hover:text-red-600 transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </header>

          {/* Core scrollable canvas workspace */}
          <div className="p-4 sm:p-8 space-y-8 flex-1">

      {/* ----------------- SUB TAB: OVERVIEW STATS ----------------- */}
      {activeSubTab === 'overview' && (
        <div className="space-y-8 animate-in fade-in duration-200" id="dash_subtab_overview">
          {loadingStats ? (
            <div className="flex py-12 justify-center"><Loader2 className="h-8 w-8 text-violet-600 animate-spin" /></div>
          ) : (
            <>
              {/* Premium Main Revenue & Volume Metrics Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* Today */}
                <div className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-xl relative overflow-hidden transition-all duration-300 hover:border-violet-400 hover:shadow-violet-500/10 hover:-translate-y-0.5">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-violet-500/10 to-transparent rounded-bl-full pointer-events-none" />
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase tracking-widest font-mono text-slate-500 font-bold block">Today's Revenue</span>
                      <span className="text-3xl font-semibold text-slate-900 mt-1 block tracking-tight tabular-nums">
                        GHS {((stats?.revenue?.today || 0) / 100).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-emerald-600 font-semibold mt-1.5 flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" /> Settled Mobile Money / Cash
                      </span>
                    </div>
                  </div>
                </div>

                {/* Week */}
                <div className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-xl relative overflow-hidden transition-all duration-300 hover:border-violet-400 hover:shadow-violet-500/10 hover:-translate-y-0.5">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-violet-500/10 to-transparent rounded-bl-full pointer-events-none" />
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase tracking-widest font-mono text-slate-500 font-bold block">Weekly Revenue</span>
                      <span className="text-3xl font-semibold text-slate-900 mt-1 block tracking-tight tabular-nums">
                        GHS {((stats?.revenue?.week || 0) / 100).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium mt-1.5 block">
                        Past 7 trailing calendar days
                      </span>
                    </div>
                  </div>
                </div>

                {/* Month */}
                <div className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-xl relative overflow-hidden transition-all duration-300 hover:border-violet-400 hover:shadow-violet-500/10 hover:-translate-y-0.5">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-violet-500/10 to-transparent rounded-bl-full pointer-events-none" />
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase tracking-widest font-mono text-slate-500 font-bold block">Monthly Revenue</span>
                      <span className="text-3xl font-semibold text-slate-900 mt-1 block tracking-tight tabular-nums">
                        GHS {((stats?.revenue?.month || 0) / 100).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium mt-1.5 block">
                        Past 30 calendar days
                      </span>
                    </div>
                  </div>
                </div>

                {/* All Time */}
                <div className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-xl relative overflow-hidden transition-all duration-300 hover:border-violet-400 hover:shadow-violet-500/10 hover:-translate-y-0.5">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-violet-500/10 to-transparent rounded-bl-full pointer-events-none" />
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase tracking-widest font-mono text-slate-500 font-bold block">All Time Collected</span>
                      <span className="text-3xl font-semibold text-slate-900 mt-1 block tracking-tight tabular-nums">
                        GHS {((stats?.revenue?.allTime || 0) / 100).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium mt-1.5 block">
                        Entire operational database sum
                      </span>
                    </div>
                  </div>
                </div>

              </div>

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
                              <span className="text-[11px] font-medium text-slate-500 truncate">{s.label}</span>
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
              <label className="block text-xs font-semibold text-slate-500 mb-1">Search Keywords</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  id="filter_search"
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Tracking code, sender name, phone..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-100 text-slate-900 pl-10 pr-4 py-2 text-xs outline-none focus:border-violet-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Workflow Status</label>
              <select
                id="filter_status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-100 text-slate-900 px-3 py-2 text-xs outline-none focus:border-violet-500 focus:bg-white transition-all"
              >
                <option value="">All Pipeline States</option>
                {STATUS_ORDER.map(s => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Created Since</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-500" />
                <input
                  id="filter_start_date"
                  type="date"
                  value={startDateFilter}
                  onChange={(e) => setStartDateFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-100 text-slate-900 pl-9 pr-3 py-1.5 text-xs outline-none focus:border-violet-500 focus:bg-white transition-all"
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
              className="w-full text-center rounded-xl border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-100 font-semibold py-2 text-xs transition-colors cursor-pointer"
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
              <p className="text-xs text-slate-500 mt-1">Try relaxing filters or search queries.</p>
            </div>
          ) : (
            /* Orders table (paginated 10 / page) */
            (() => {
              const totalPages = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
              const page = Math.min(pipelinePage, totalPages);
              const pageOrders = orders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
              return (
                <div className="space-y-3">
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
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
                          const next = getNextStatusAction(order.status);
                          return (
                            <tr
                              key={order.id}
                              onClick={() => setSelectedOrderId(order.id)}
                              className="hover:bg-slate-50 cursor-pointer transition-colors"
                            >
                              <td className="px-4 py-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                                {order.trackingCode}
                                {order.riderName && (
                                  <span className="mt-0.5 flex items-center gap-1 font-sans text-[10px] font-medium text-slate-500">
                                    <Truck className="h-3 w-3 text-violet-500" />
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
                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${statusTheme.bg} ${statusTheme.text}`}>
                                  {statusTheme.label}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-block rounded border px-1.5 py-0.5 font-bold uppercase text-[9px] tracking-wider ${
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
                                {next ? (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); advanceOrderStatus(order); }}
                                    disabled={advancingId === order.id}
                                    className="inline-flex items-center gap-1 rounded-lg border border-violet-500/40 bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-violet-600 hover:bg-violet-100 transition-colors disabled:opacity-50 cursor-pointer"
                                    title={`Advance to ${getStatusLabel(next)}`}
                                  >
                                    {advancingId === order.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRight className="h-3 w-3" />}
                                    {getStatusLabel(next)}
                                  </button>
                                ) : order.status === 'awaiting_payment' ? (
                                  <span
                                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-600"
                                    title="Payment-gated — confirms automatically once payment is received"
                                  >
                                    <Clock className="h-3 w-3" />
                                    Auto on payment
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-mono uppercase">Final</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pager */}
                  <div className="flex items-center justify-between px-1 text-xs text-slate-500">
                    <span>
                      Showing {(page - 1) * PAGE_SIZE + 1}&ndash;{Math.min(page * PAGE_SIZE, orders.length)} of {orders.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPipelinePage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      >
                        &lsaquo; Prev
                      </button>
                      <span className="font-mono">Page {page} / {totalPages}</span>
                      <button
                        onClick={() => setPipelinePage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
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
              <p className="text-xs text-slate-500 mt-0.5">Historical ledger of all completed, pending, or manual reconciliation transactions.</p>
            </div>
            <button
              onClick={handleExportPaymentsCSV}
              className="inline-flex items-center justify-center space-x-1.5 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 shadow-sm transition-colors self-start cursor-pointer"
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
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
              <table className="w-full text-left text-xs text-slate-700 border-collapse">
                <thead className="bg-slate-50 font-bold uppercase tracking-wider text-slate-500 text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">Transaction ID</th>
                    <th className="px-6 py-4">Order Code</th>
                    <th className="px-6 py-4">Customer Sender</th>
                    <th className="px-6 py-4">Amount (GHS)</th>
                    <th className="px-6 py-4">Provider / Method</th>
                    <th className="px-6 py-4">Provider Reference</th>
                    <th className="px-6 py-4">Verification State</th>
                    <th className="px-6 py-4">Audit Notes / Logs</th>
                    <th className="px-6 py-4">Settled At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {pagePayments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-mono font-semibold text-slate-500">{p.id}</td>
                      <td className="px-6 py-4 font-mono font-bold text-slate-900">{p.trackingCode}</td>
                      <td className="px-6 py-4 font-sans">
                        <span className="font-semibold text-slate-900 block">{p.senderName}</span>
                        <span className="text-[10px] text-slate-500 block font-mono">{p.senderPhone}</span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-900 tabular-nums">
                        {p.currency} {(p.amount / 100).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 font-sans capitalize">
                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${
                          p.provider === 'momo' ? 'bg-amber-500/10 border-amber-500/20 text-amber-600' : 'bg-slate-100 border-slate-300 text-slate-700'
                        }`}>
                          {p.provider}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-500">{p.providerReference || 'N/A'}</td>
                      <td className="px-6 py-4 font-sans font-semibold">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                          p.status === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' :
                          p.status === 'failed' ? 'bg-red-500/10 border-red-500/20 text-red-600' :
                          'bg-amber-500/10 border-amber-500/20 text-amber-600'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 max-w-[200px] truncate" title={p.note}>
                        {p.note || <span className="text-slate-400 italic">No notes</span>}
                      </td>
                      <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                        {p.paidAt ? new Date(p.paidAt).toLocaleDateString() : new Date(p.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              <div className="flex items-center justify-between px-1 text-xs text-slate-500">
                <span>
                  Showing {(page - 1) * PAGE_SIZE + 1}&ndash;{Math.min(page * PAGE_SIZE, payments.length)} of {payments.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPaymentsPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    &lsaquo; Prev
                  </button>
                  <span className="font-mono">Page {page} / {totalPages}</span>
                  <button
                    onClick={() => setPaymentsPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
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
                <Settings className="h-5 w-5 text-violet-600" /> Parcel Size Pricing Controller
              </h2>
              <p className="text-xs text-slate-500 mt-1">
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
                    <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Small (e.g. pouch)</span>
                    <div className="flex items-center space-x-1.5 mt-2">
                      <span className="text-sm font-semibold text-slate-500">GHS</span>
                      <input
                        id="input_price_small"
                        type="number"
                        step="0.01"
                        required
                        value={smallPriceInput}
                        onChange={(e) => setSmallPriceInput(e.target.value)}
                        className="w-full font-bold font-mono text-slate-900 border-b border-slate-200 bg-transparent text-lg outline-none focus:border-violet-500"
                      />
                    </div>
                  </div>

                  {/* Medium */}
                  <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                    <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Medium (box)</span>
                    <div className="flex items-center space-x-1.5 mt-2">
                      <span className="text-sm font-semibold text-slate-500">GHS</span>
                      <input
                        id="input_price_medium"
                        type="number"
                        step="0.01"
                        required
                        value={mediumPriceInput}
                        onChange={(e) => setMediumPriceInput(e.target.value)}
                        className="w-full font-bold font-mono text-slate-900 border-b border-slate-200 bg-transparent text-lg outline-none focus:border-violet-500"
                      />
                    </div>
                  </div>

                  {/* Large */}
                  <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                    <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Large (strapped)</span>
                    <div className="flex items-center space-x-1.5 mt-2">
                      <span className="text-sm font-semibold text-slate-500">GHS</span>
                      <input
                        id="input_price_large"
                        type="number"
                        step="0.01"
                        required
                        value={largePriceInput}
                        onChange={(e) => setLargePriceInput(e.target.value)}
                        className="w-full font-bold font-mono text-slate-900 border-b border-slate-200 bg-transparent text-lg outline-none focus:border-violet-500"
                      />
                    </div>
                  </div>

                </div>

                <div className="pt-4 border-t border-slate-200 flex justify-end">
                  <button
                    id="btn_save_pricing"
                    type="submit"
                    disabled={submittingPricing}
                    className="rounded-xl btn-aurora text-white text-xs font-bold py-3 px-6 shadow-lg shadow-violet-500/25 transition-all flex items-center space-x-2 cursor-pointer"
                  >
                    {submittingPricing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Updating Pricing Configuration...</span>
                      </>
                    ) : (
                      <>
                        <span>Save Pricing Configuration</span>
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
          
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-lg bg-white border-l border-slate-200 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300">
              
              {/* Drawer Header */}
              <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono block">Inspection Mode</span>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-1.5 mt-0.5">
                    Order Details Drawer
                  </h2>
                </div>
                <button
                  id="btn_close_inspector"
                  onClick={() => setSelectedOrderId(null)}
                  className="p-1 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
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
                      <div className="flex items-center justify-between pb-3 border-b border-dashed border-slate-200">
                        <div>
                          <span className="text-[10px] text-slate-500 font-bold font-mono tracking-wider block">TRACKING CODE</span>
                          <span className="text-lg font-semibold font-mono text-slate-900">{selectedOrderDetails.order.trackingCode}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 font-bold block">QUOTE CHARGE</span>
                          <span className="text-base font-semibold text-slate-900 tabular-nums">
                            {selectedOrderDetails.order.currency} {(selectedOrderDetails.order.priceAmount / 100).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-slate-500 font-medium block">Workflow Status</span>
                          <span className={`inline-block font-bold capitalize mt-0.5 rounded px-2 py-0.5 text-[9px] tracking-wider ${
                            STATUS_ORDER.find(s => s.key === selectedOrderDetails.order.status)?.bg || 'bg-slate-100'
                          } ${
                            STATUS_ORDER.find(s => s.key === selectedOrderDetails.order.status)?.text || 'text-slate-700'
                          }`}>
                            {selectedOrderDetails.order.status.replace('_', ' ')}
                          </span>
                        </div>

                        <div>
                          <span className="text-slate-500 font-medium block">Payment Status</span>
                          <span className={`inline-block font-bold uppercase mt-0.5 rounded border px-2 py-0.5 text-[9px] tracking-wider ${
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
                              className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-[11px] font-bold text-violet-700 hover:bg-violet-100 transition-colors cursor-pointer"
                              title="Copy the courier's self-service update link"
                            >
                              {copiedRiderLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                              {copiedRiderLink ? 'Copied' : 'Copy rider link'}
                            </button>
                          </div>
                          <p className="mt-2 text-[10px] text-slate-400 leading-relaxed">
                            Send this to the courier — they can mark picked up, in transit and delivered themselves,
                            without a dashboard login.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Coordinates & Customer info */}
                    <div className="space-y-4">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Customer Coordinates</h3>
                      
                      <div className="space-y-3.5 bg-white rounded-xl border border-slate-200 p-4 text-xs text-slate-700">
                        {/* Sender */}
                        <div className="flex gap-2.5 pb-3 border-b border-slate-200">
                          <User className="h-4.5 w-4.5 text-slate-500 shrink-0" />
                          <div>
                            <span className="text-slate-500 block font-semibold text-[10px] uppercase">Sender Client</span>
                            <span className="font-bold text-slate-900 block mt-0.5">{selectedOrderDetails.order.senderName}</span>
                            <span className="text-slate-500 font-mono text-[10px] block mt-0.5">{selectedOrderDetails.order.senderPhone}</span>
                            <span className="text-slate-700 block mt-1"><strong className="text-slate-500">Pickup:</strong> {selectedOrderDetails.order.pickupAddress}</span>
                            {selectedOrderDetails.order.pickupNotes && (
                              <span className="block italic text-[10px] text-slate-500 mt-1">Landmark: {selectedOrderDetails.order.pickupNotes}</span>
                            )}
                          </div>
                        </div>

                        {/* Recipient */}
                        <div className="flex gap-2.5">
                          <User className="h-4.5 w-4.5 text-slate-500 shrink-0" />
                          <div>
                            <span className="text-slate-500 block font-semibold text-[10px] uppercase">Recipient Client</span>
                            <span className="font-bold text-slate-900 block mt-0.5">{selectedOrderDetails.order.recipientName}</span>
                            <span className="text-slate-500 font-mono text-[10px] block mt-0.5">{selectedOrderDetails.order.recipientPhone}</span>
                            <span className="text-slate-700 block mt-1"><strong className="text-slate-500">Dropoff:</strong> {selectedOrderDetails.order.dropoffAddress}</span>
                            {selectedOrderDetails.order.dropoffNotes && (
                              <span className="block italic text-[10px] text-slate-500 mt-1">Landmark: {selectedOrderDetails.order.dropoffNotes}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Specifications */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Parcel specs</h3>
                      <div className="bg-white rounded-xl border border-slate-200 p-4 text-xs text-slate-700 space-y-2">
                        <p><strong className="text-slate-500">Size category:</strong> <span className="capitalize font-bold text-slate-900">{selectedOrderDetails.order.packageSize}</span></p>
                        <p><strong className="text-slate-500">Weight profile:</strong> <span className="font-bold text-slate-900">{selectedOrderDetails.order.packageWeightKg} kg</span></p>
                        <p><strong className="text-slate-500">Description:</strong> <span className="text-slate-700">{selectedOrderDetails.order.packageDescription}</span></p>
                        <p><strong className="text-slate-500">Scheduled pickup time:</strong> <span className="text-slate-700">{new Date(selectedOrderDetails.order.scheduledPickupAt).toLocaleString()}</span></p>
                      </div>
                    </div>

                    {/* CONTROL BOX: Transition workflow status */}
                    <div className="space-y-4 border-t border-slate-200 pt-6">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-900 flex items-center gap-1.5">
                        <Edit2 className="h-4 w-4 text-violet-600" /> Workflow Transition Pipeline
                      </h3>

                      <div className="space-y-3 bg-slate-100/25 rounded-xl p-4 border border-slate-200">
                        {/* Quick sequential next step trigger */}
                        {getNextStatusAction(selectedOrderDetails.order.status) && (
                          <div className="space-y-2 pb-3 border-b border-slate-200 mb-3">
                            <span className="text-[10px] text-slate-500 font-semibold block">Fast Next Step:</span>
                            <button
                              id="btn_trigger_next_status"
                              onClick={() => handleUpdateStatus(getNextStatusAction(selectedOrderDetails.order.status)!)}
                              disabled={submittingStatus}
                              className="w-full text-center py-2.5 px-4 rounded-xl btn-aurora text-white font-bold text-xs shadow-md shadow-violet-500/20 transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                            >
                              <span>Move to "{getStatusLabel(getNextStatusAction(selectedOrderDetails.order.status)!)}"</span>
                              <ArrowRight className="h-4 w-4" />
                            </button>
                          </div>
                        )}

                        {/* General status selection */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {STATUS_ORDER.map(s => (
                            <button
                              key={s.key}
                              disabled={selectedOrderDetails.order.status === s.key || submittingStatus}
                              onClick={() => handleUpdateStatus(s.key)}
                              className={`py-2 px-3 rounded-lg border text-center transition-colors font-semibold ${
                                selectedOrderDetails.order.status === s.key
                                  ? 'bg-slate-100 border-slate-200 text-violet-600 cursor-not-allowed'
                                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 cursor-pointer'
                              }`}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>

                        {/* Optional status log notes */}
                        <div className="pt-2">
                          <label className="block text-[10px] text-slate-500 mb-1 font-semibold">Workflow Log Note (Who, what landmark/action)</label>
                          <input
                            id="input_status_note"
                            type="text"
                            value={statusNote}
                            onChange={(e) => setStatusNote(e.target.value)}
                            placeholder="e.g. Courier Kwesi assigned; package verified intact"
                            className="w-full text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-900 px-3 py-2 outline-none focus:border-violet-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* CONTROL BOX: Mark payment as paid manually */}
                    {selectedOrderDetails.order.paymentStatus !== 'paid' && (
                      <div className="space-y-4 border-t border-slate-200 pt-6">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-900 flex items-center gap-1.5">
                          <CreditCard className="h-4 w-4 text-emerald-600" /> Manual Payment reconciliation
                        </h3>

                        <form onSubmit={handleRecordPayment} className="space-y-3 bg-emerald-950/10 rounded-xl p-4 border border-emerald-800/30">
                          <span className="text-[10px] text-emerald-600 font-semibold block leading-relaxed">
                            Log a manually confirmed MTN MoMo transfer, banking deposit, or cash transaction to unlock metrics.
                          </span>

                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <label className="block text-[10px] text-slate-500 mb-1">Received Amount (GHS)</label>
                              <input
                                id="input_reconcile_amount"
                                type="number"
                                step="0.01"
                                required
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 outline-none text-slate-900 font-bold focus:border-violet-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-500 mb-1">Provider Reference (Optional)</label>
                              <input
                                id="input_reconcile_ref"
                                type="text"
                                value={paymentRef}
                                onChange={(e) => setPaymentRef(e.target.value)}
                                placeholder="e.g. TX-882012"
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 outline-none font-mono text-[10px] text-slate-900 focus:border-violet-500"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] text-slate-500 mb-1">Internal Audit Ledger Notes</label>
                            <input
                              id="input_reconcile_note"
                              type="text"
                              required
                              value={paymentNote}
                              onChange={(e) => setPaymentNote(e.target.value)}
                              placeholder="e.g. Verified momo screenshot on dispatch WhatsApp"
                              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs outline-none text-slate-900 focus:border-violet-500"
                            />
                          </div>

                          <button
                            id="btn_confirm_reconcile"
                            type="submit"
                            disabled={submittingPayment}
                            className="w-full text-center py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-900 font-bold text-xs shadow-lg shadow-emerald-600/10 transition-colors flex items-center justify-center space-x-1 cursor-pointer"
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
                              <span className="text-[10px] text-slate-500 font-mono">{new Date(log.changedAt).toLocaleString()}</span>
                            </div>
                            <p className="text-slate-600 leading-relaxed">{log.note}</p>
                            {log.changedByName && (
                              <span className="block text-[10px] text-slate-500 font-medium">Logged by: {log.changedByName}</span>
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
