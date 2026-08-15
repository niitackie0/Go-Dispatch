/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Truck, 
  MapPin, 
  Clock, 
  Package, 
  HelpCircle, 
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Circle
} from 'lucide-react';
import { OrderStatus } from '../types.js';

interface TrackingViewProps {
  initialTrackingCode?: string;
}

interface PublicOrder {
  id: string;
  trackingCode: string;
  senderName: string;
  recipientName: string;
  pickupAddress: string;
  dropoffAddress: string;
  packageSize: string;
  packageDescription: string;
  scheduledPickupAt: string;
  status: OrderStatus;
  paymentStatus: string;
  createdAt: string;
  timeline: {
    status: OrderStatus;
    note?: string;
    changedAt: string;
  }[];
}

// Order Status Steps for Public Timeline
const STATUS_STEPS: { key: OrderStatus; label: string; desc: string }[] = [
  { key: 'requested', label: 'Requested', desc: 'Order submitted and awaiting dispatch review' },
  { key: 'confirmed', label: 'Confirmed', desc: 'Details verified and confirmed by phone' },
  { key: 'queued', label: 'Queued', desc: 'In queue and assigned to motorcycle courier' },
  { key: 'picked_up', label: 'Picked Up', desc: 'Parcel successfully picked up from sender' },
  { key: 'in_transit', label: 'In Transit', desc: 'Courier en route to recipient dropoff point' },
  { key: 'delivered', label: 'Delivered', desc: 'Parcel successfully delivered and signed' }
];

export default function TrackingView({ initialTrackingCode = '' }: TrackingViewProps) {
  const [searchQuery, setSearchQuery] = useState(initialTrackingCode);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<PublicOrder[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialTrackingCode) {
      setSearchQuery(initialTrackingCode);
      handleTrack(undefined, initialTrackingCode);
    }
  }, [initialTrackingCode]);

  const handleTrack = async (e?: React.FormEvent, codeOverride?: string) => {
    if (e) e.preventDefault();
    const query = codeOverride || searchQuery;
    if (!query.trim()) return;

    setSearching(true);
    setError('');
    setResults(null);

    try {
      const res = await fetch(`/api/orders/track?q=${encodeURIComponent(query.trim())}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('No delivery orders found matching that tracking code or phone number.');
        }
        const data = await res.json();
        throw new Error(data.error || 'Failed to retrieve tracking data.');
      }
      const data = await res.json();
      setResults(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred during lookup.');
    } finally {
      setSearching(false);
    }
  };

  const getStepIndex = (currentStatus: OrderStatus) => {
    if (currentStatus === 'cancelled') return -1;
    return STATUS_STEPS.findIndex(step => step.key === currentStatus);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10" id="tracking_view_container">

      {/* Search Input Box */}
      <div className="max-w-2xl mx-auto mb-10">
        <form onSubmit={handleTrack} className="flex gap-2 p-1.5 rounded-2xl border-2 border-slate-200 bg-white shadow-xl focus-within:border-violet-500 transition-all">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-500" />
            <input
              id="input_tracking_search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter tracking code (e.g. WP-8293-102) or phone number..."
              className="w-full rounded-xl pl-12 pr-4 py-3 text-base text-slate-900 placeholder-slate-400 outline-none bg-transparent"
            />
          </div>
          <button
            id="btn_tracking_search"
            type="submit"
            disabled={searching}
            className="rounded-xl btn-aurora text-white font-semibold px-6 py-3 shadow-md shadow-violet-500/20 transition-colors disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
          >
            <span>{searching ? 'Locating...' : 'Search'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {/* Demo helpers */}
        <div className="mt-4 flex flex-wrap gap-2 items-center justify-center text-xs text-slate-500">
          <span className="font-semibold text-slate-700">Quick Seed Examples:</span>
          <button 
            onClick={() => { setSearchQuery('WP-8293-102'); handleTrack(undefined, 'WP-8293-102'); }}
            className="px-2 py-1 rounded bg-slate-100 border border-slate-200 hover:bg-slate-100 text-slate-700 font-mono font-semibold cursor-pointer"
          >
            WP-8293-102 (Ama - Delivered)
          </button>
          <button 
            onClick={() => { setSearchQuery('WP-4012-948'); handleTrack(undefined, 'WP-4012-948'); }}
            className="px-2 py-1 rounded bg-slate-100 border border-slate-200 hover:bg-slate-100 text-slate-700 font-mono font-semibold cursor-pointer"
          >
            WP-4012-948 (Ekow - In Transit)
          </button>
          <button 
            onClick={() => { setSearchQuery('0244123456'); handleTrack(undefined, '0244123456'); }}
            className="px-2 py-1 rounded bg-slate-100 border border-slate-200 hover:bg-slate-100 text-slate-700 font-mono font-semibold cursor-pointer"
          >
            Search by Phone: 0244123456
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="max-w-2xl mx-auto p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start space-x-2.5">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Results Section */}
      {results && results.map((order) => {
        const activeStepIndex = getStepIndex(order.status);
        
        return (
          <div key={order.id} className="border border-slate-200 rounded-2xl bg-white shadow-xl p-6 sm:p-8 space-y-8 mb-8" id={`tracking_result_${order.trackingCode}`}>
            
            {/* Ticket Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-slate-200 gap-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-2xl font-semibold font-mono text-slate-900 tracking-tight">{order.trackingCode}</span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                    order.status === 'delivered' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600' :
                    order.status === 'cancelled' ? 'bg-red-500/10 border-red-500/20 text-red-600' :
                    order.status === 'in_transit' ? 'bg-sky-500/10 border-sky-500/20 text-sky-600' :
                    'bg-amber-500/10 border-amber-500/20 text-amber-600'
                  }`}>
                    {order.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center text-xs text-slate-500 space-x-3 mt-1.5">
                  <span className="flex items-center"><Package className="h-3.5 w-3.5 mr-1" /> {order.packageSize.toUpperCase()} Tier</span>
                  <span>•</span>
                  <span>Description: {order.packageDescription}</span>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">Est. Delivery Target</span>
                <span className="text-sm font-semibold text-slate-900">
                  {new Date(order.scheduledPickupAt).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>

            {/* Public Stepper Line */}
            {order.status === 'cancelled' ? (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold">This booking has been cancelled</h4>
                  <p className="text-xs text-red-600 mt-1">Our dispatch managers marked this order as cancelled. Please contact our support team if this is an error.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <h3 className="text-sm font-bold text-slate-900">Shipment Timeline Stepper</h3>
                
                {/* Horizontal / Vertical Stepper visual */}
                <div className="relative">
                  {/* Progress Line */}
                  <div className="absolute left-6 top-1.5 bottom-1.5 w-0.5 bg-slate-100 hidden sm:block md:left-1/2 md:-ml-px"></div>

                  <div className="space-y-8 sm:space-y-0 sm:grid sm:grid-cols-3 md:grid-cols-6 sm:gap-4 relative z-10 text-center">
                    {STATUS_STEPS.map((step, idx) => {
                      const isCompleted = idx <= activeStepIndex;
                      const isCurrent = idx === activeStepIndex;

                      return (
                        <div key={step.key} className="flex flex-col items-center">
                          {/* Dot / Indicator */}
                          <div className={`flex h-12 w-12 items-center justify-center rounded-full border-2 transition-colors ${
                            isCompleted 
                              ? 'bg-violet-600 border-violet-500 text-white shadow-md shadow-violet-500/30' 
                              : 'bg-slate-50 border-slate-200 text-slate-400'
                          }`}>
                            {isCompleted ? (
                              <CheckCircle2 className="h-6 w-6" />
                            ) : (
                              <Circle className="h-5 w-5 text-slate-300" />
                            )}
                          </div>
                          
                          {/* Labels */}
                          <div className="mt-3">
                            <span className={`block text-xs font-bold ${isCurrent ? 'text-violet-600' : isCompleted ? 'text-slate-800' : 'text-slate-500'}`}>
                              {step.label}
                            </span>
                            <span className="block text-[10px] text-slate-500 mt-1 max-w-[120px] mx-auto leading-relaxed">
                              {step.desc}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Coordinates Brief */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-200 text-sm text-slate-700">
              <div className="space-y-2">
                <div className="flex items-center space-x-1.5 text-xs text-slate-500 uppercase tracking-wider font-semibold">
                  <MapPin className="h-3.5 w-3.5 text-violet-600" />
                  <span>Pickup Coordinates</span>
                </div>
                <p className="font-semibold text-slate-900">{order.pickupAddress}</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-1.5 text-xs text-slate-500 uppercase tracking-wider font-semibold">
                  <MapPin className="h-3.5 w-3.5 text-violet-600" />
                  <span>Dropoff Destination</span>
                </div>
                <p className="font-semibold text-slate-900">{order.dropoffAddress}</p>
              </div>
            </div>

            {/* Audit History Logs (Sanitized, only shows timestamps) */}
            <div className="space-y-3 pt-6 border-t border-slate-200">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center">
                <Clock className="h-3.5 w-3.5 mr-1.5 text-violet-600" />
                <span>Verification Logs & Events</span>
              </h4>
              <div className="space-y-2 bg-slate-50 rounded-xl p-4 border border-slate-200">
                {order.timeline.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No verification events tracked yet.</p>
                ) : (
                  order.timeline.map((item, idx) => (
                    <div key={idx} className="flex items-start text-xs font-sans text-slate-700 gap-3">
                      <span className="font-mono text-slate-500 shrink-0">
                        {new Date(item.changedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <div>
                        <strong className="text-slate-900 capitalize">{item.status.replace('_', ' ')}</strong>
                        <span className="mx-1.5 text-slate-300">|</span>
                        <span>{item.note || 'Verification checkpoint passed.'}</span>
                        <span className="block font-mono text-[10px] text-slate-500 mt-0.5">
                          {new Date(item.changedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        );
      })}

    </div>
  );
}
