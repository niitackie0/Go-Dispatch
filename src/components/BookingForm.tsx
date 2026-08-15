/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Package, 
  MapPin, 
  User, 
  Phone, 
  FileText, 
  Calendar, 
  CreditCard, 
  CheckCircle, 
  ArrowRight, 
  Loader2, 
  Info,
  Copy,
  Check
} from 'lucide-react';
import { PricingConfig, PackageSize } from '../types.js';

interface BookingFormProps {
  onSuccessBooking: (trackingCode: string) => void;
}

export default function BookingForm({ onSuccessBooking }: BookingFormProps) {
  // Pricing configuration loaded from API
  const [pricing, setPricing] = useState<PricingConfig>({
    small: 2500,
    medium: 5000,
    large: 9000,
    currency: 'GHS',
  });

  // Loading and feedback states
  const [loadingPricing, setLoadingPricing] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [successOrder, setSuccessOrder] = useState<{
    trackingCode: string;
    priceAmount: number;
    senderName: string;
    recipientName: string;
  } | null>(null);

  // Form Fields
  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupNotes, setPickupNotes] = useState('');

  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [dropoffNotes, setDropoffNotes] = useState('');

  const [packageSize, setPackageSize] = useState<PackageSize>('small');
  const [packageWeight, setPackageWeight] = useState('1');
  const [packageDescription, setPackageDescription] = useState('');
  const [scheduledPickup, setScheduledPickup] = useState('');
  const [paymentProvider, setPaymentProvider] = useState<'momo' | 'manual'>('momo');

  // MoMo simulated interactive state
  const [showMomoModal, setShowMomoModal] = useState(false);
  const [momoPhoneNumber, setMomoPhoneNumber] = useState('');
  const [momoStep, setMomoStep] = useState<1 | 2 | 3>(1); // 1: Prompt, 2: Simulating approval, 3: Completed
  const [validationError, setValidationError] = useState('');

  // Fetch Pricing configuration
  useEffect(() => {
    async function loadPricing() {
      try {
        const res = await fetch('/api/pricing');
        if (res.ok) {
          const data = await res.json();
          setPricing(data);
        }
      } catch (err) {
        console.error('Failed to load pricing config', err);
      } finally {
        setLoadingPricing(false);
      }
    }
    loadPricing();

    // Set default pickup date/time to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    // Format to local ISO-like dateTime-local string: YYYY-MM-DDThh:mm
    const tzOffset = tomorrow.getTimezoneOffset() * 60000;
    const localISOTime = new Date(tomorrow.getTime() - tzOffset).toISOString().slice(0, 16);
    setScheduledPickup(localISOTime);
  }, []);

  const getPrice = () => {
    return pricing[packageSize] / 100;
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const validateForm = () => {
    if (!senderName.trim()) return 'Sender Name is required';
    if (!senderPhone.trim()) return 'Sender Phone number is required';
    if (!pickupAddress.trim()) return 'Pickup Address is required';
    if (!recipientName.trim()) return 'Recipient Name is required';
    if (!recipientPhone.trim()) return 'Recipient Phone number is required';
    if (!dropoffAddress.trim()) return 'Dropoff Address is required';
    if (!packageDescription.trim()) return 'Please provide a short package description';
    if (!scheduledPickup) return 'Please specify a preferred pickup date and time';
    return '';
  };

  const handleTriggerBooking = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');
    
    const err = validateForm();
    if (err) {
      setValidationError(err);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (paymentProvider === 'momo') {
      setMomoPhoneNumber(senderPhone);
      setMomoStep(1);
      setShowMomoModal(true);
    } else {
      // Manual cash / Bank payment booking flow
      submitBooking();
    }
  };

  const submitBooking = async (providerRef?: string) => {
    setSubmitting(true);
    setValidationError('');
    try {
      const payload = {
        senderName,
        senderPhone,
        pickupAddress,
        pickupNotes,
        recipientName,
        recipientPhone,
        dropoffAddress,
        dropoffNotes,
        packageSize,
        packageWeightKg: Number(packageWeight),
        packageDescription,
        scheduledPickupAt: new Date(scheduledPickup).toISOString(),
        paymentProvider
      };

      const res = await fetch('/api/orders/book', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit booking');
      }

      const result = await res.json();
      
      setSuccessOrder({
        trackingCode: result.trackingCode,
        priceAmount: result.order.priceAmount,
        senderName: result.order.senderName,
        recipientName: result.order.recipientName,
      });

      // Clear Form Fields
      setSenderName('');
      setSenderPhone('');
      setPickupAddress('');
      setPickupNotes('');
      setRecipientName('');
      setRecipientPhone('');
      setDropoffAddress('');
      setDropoffNotes('');
      setPackageDescription('');
    } catch (err: any) {
      setValidationError(err.message || 'Error occurred while creating delivery order.');
    } finally {
      setSubmitting(false);
      setShowMomoModal(false);
    }
  };

  const handleMomoPaymentConfirm = () => {
    setMomoStep(2);
    // Mimic the USSD push flow
    setTimeout(() => {
      setMomoStep(3);
      setTimeout(() => {
        submitBooking('MOMO-AUTO-' + Math.floor(10000000 + Math.random() * 90000000));
      }, 1200);
    }, 2200);
  };

  // Success Confirmation screen
  if (successOrder) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8" id="booking_success_container">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-2xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 mb-6">
            <CheckCircle className="h-10 w-10" />
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-2">Booking Confirmed!</h2>
          <p className="text-slate-500 mb-6">
            Your parcel delivery request has been registered. Our dispatch team will review details and reach out shortly.
          </p>

          {/* Tracking Ticket Widget */}
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-left mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-dashed border-slate-200 mb-4">
              <div>
                <span className="text-xs uppercase tracking-wider font-mono text-slate-500">Tracking Code</span>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-xl font-semibold font-mono text-slate-900">{successOrder.trackingCode}</span>
                  <button
                    onClick={() => handleCopyCode(successOrder.trackingCode)}
                    className="p-1 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-sm cursor-pointer"
                    title="Copy tracking code"
                  >
                    {copiedCode ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="mt-4 sm:mt-0 text-right">
                <span className="text-xs uppercase tracking-wider font-mono text-slate-500 block">Calculated Price</span>
                <span className="text-lg font-bold text-violet-600">
                  {pricing.currency} {(successOrder.priceAmount / 100).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm font-sans text-slate-700">
              <div>
                <span className="text-xs text-slate-500 block">Sender</span>
                <span className="font-medium text-slate-900">{successOrder.senderName}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Recipient</span>
                <span className="font-medium text-slate-900">{successOrder.recipientName}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => onSuccessBooking(successOrder.trackingCode)}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 rounded-xl btn-aurora px-6 py-3.5 text-sm font-semibold text-white shadow-md hover:scale-[1.01] transition-all cursor-pointer"
            >
              <span>Track this Parcel</span>
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => setSuccessOrder(null)}
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-100 px-6 py-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            >
              Book Another Parcel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 animate-in fade-in duration-200" id="booking_form_container">

      {validationError && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start space-x-2">
          <Info className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
          <span>{validationError}</span>
        </div>
      )}

      <form onSubmit={handleTriggerBooking} className="space-y-8">
        
        {/* Step 1 & 2: Coordinates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Sender Coordinates */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-200">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-violet-600 border border-slate-200">
                <MapPin className="h-4 w-4" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">1. Pickup Coordinates (Sender)</h2>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Sender Full Name *</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    id="input_sender_name"
                    type="text"
                    required
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="e.g. Ama Osei"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-900 pl-10 pr-4 py-2.5 text-sm outline-none focus:border-violet-500 focus:bg-white focus:ring-1 focus:ring-violet-500 placeholder-slate-400 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Sender Phone Number *</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    id="input_sender_phone"
                    type="tel"
                    required
                    value={senderPhone}
                    onChange={(e) => setSenderPhone(e.target.value)}
                    placeholder="e.g. 0244123456"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-900 pl-10 pr-4 py-2.5 text-sm outline-none focus:border-violet-500 focus:bg-white focus:ring-1 focus:ring-violet-500 placeholder-slate-400 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Pickup Street Address *</label>
                <textarea
                  id="input_pickup_address"
                  required
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                  placeholder="e.g. Block C, Airport Residential Area, Accra"
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-900 px-4 py-2.5 text-sm outline-none focus:border-violet-500 focus:bg-white focus:ring-1 focus:ring-violet-500 placeholder-slate-400 transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Pickup Notes / Landmarks (Optional)</label>
                <input
                  id="input_pickup_notes"
                  type="text"
                  value={pickupNotes}
                  onChange={(e) => setPickupNotes(e.target.value)}
                  placeholder="e.g. Opposite the French School, ring gate bell"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-900 px-4 py-2.5 text-sm outline-none focus:border-violet-500 focus:bg-white focus:ring-1 focus:ring-violet-500 placeholder-slate-400 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Recipient Coordinates */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-200">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-violet-600 border border-slate-200">
                <MapPin className="h-4 w-4" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">2. Dropoff Coordinates (Recipient)</h2>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Recipient Full Name *</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    id="input_recipient_name"
                    type="text"
                    required
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="e.g. Kofi Mensah"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-900 pl-10 pr-4 py-2.5 text-sm outline-none focus:border-violet-500 focus:bg-white focus:ring-1 focus:ring-violet-500 placeholder-slate-400 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Recipient Phone Number *</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    id="input_recipient_phone"
                    type="tel"
                    required
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="e.g. 0207987654"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-900 pl-10 pr-4 py-2.5 text-sm outline-none focus:border-violet-500 focus:bg-white focus:ring-1 focus:ring-violet-500 placeholder-slate-400 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Dropoff Street Address *</label>
                <textarea
                  id="input_dropoff_address"
                  required
                  value={dropoffAddress}
                  onChange={(e) => setDropoffAddress(e.target.value)}
                  placeholder="e.g. House No. 12, Ring Road Central, Kokomlemle, Accra"
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-900 px-4 py-2.5 text-sm outline-none focus:border-violet-500 focus:bg-white focus:ring-1 focus:ring-violet-500 placeholder-slate-400 transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Dropoff Notes / Landmarks (Optional)</label>
                <input
                  id="input_dropoff_notes"
                  type="text"
                  value={dropoffNotes}
                  onChange={(e) => setDropoffNotes(e.target.value)}
                  placeholder="e.g. Next to the MTN office"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-900 px-4 py-2.5 text-sm outline-none focus:border-violet-500 focus:bg-white focus:ring-1 focus:ring-violet-500 placeholder-slate-400 transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Step 3: Package Details & Pricing */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-6">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-200">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-violet-600 border border-slate-200">
              <Package className="h-4 w-4" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">3. Parcel Specifications & Schedule</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Size Selector */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 mb-2">Package Size Tier *</label>
              <div className="grid grid-cols-3 gap-3" id="package_size_selectors">
                
                {/* Small Selector */}
                <button
                  type="button"
                  onClick={() => setPackageSize('small')}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 text-center transition-all cursor-pointer ${
                    packageSize === 'small'
                      ? 'border-violet-500 bg-violet-50 text-slate-900 font-medium shadow-md shadow-violet-500/10'
                      : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:text-slate-800'
                  }`}
                >
                  <span className="text-xs uppercase font-mono tracking-wider text-slate-500 mb-1">Small</span>
                  <span className={`text-sm font-semibold ${packageSize === 'small' ? 'text-violet-600' : 'text-slate-800'}`}>
                    {pricing.currency} {(pricing.small / 100).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1">Fits in courier pouch</span>
                </button>

                {/* Medium Selector */}
                <button
                  type="button"
                  onClick={() => setPackageSize('medium')}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 text-center transition-all cursor-pointer ${
                    packageSize === 'medium'
                      ? 'border-violet-500 bg-violet-50 text-slate-900 font-medium shadow-md shadow-violet-500/10'
                      : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:text-slate-800'
                  }`}
                >
                  <span className="text-xs uppercase font-mono tracking-wider text-slate-500 mb-1">Medium</span>
                  <span className={`text-sm font-semibold ${packageSize === 'medium' ? 'text-violet-600' : 'text-slate-800'}`}>
                    {pricing.currency} {(pricing.medium / 100).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1">Fits in motorcycle box</span>
                </button>

                {/* Large Selector */}
                <button
                  type="button"
                  onClick={() => setPackageSize('large')}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 text-center transition-all cursor-pointer ${
                    packageSize === 'large'
                      ? 'border-violet-500 bg-violet-50 text-slate-900 font-medium shadow-md shadow-violet-500/10'
                      : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:text-slate-800'
                  }`}
                >
                  <span className="text-xs uppercase font-mono tracking-wider text-slate-500 mb-1">Large</span>
                  <span className={`text-sm font-semibold ${packageSize === 'large' ? 'text-violet-600' : 'text-slate-800'}`}>
                    {pricing.currency} {(pricing.large / 100).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1">Requires strapping / van</span>
                </button>
              </div>
            </div>

            {/* Estimated weight */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2">Estimated Weight (kg)</label>
              <input
                id="input_package_weight"
                type="number"
                min="0.1"
                step="0.1"
                value={packageWeight}
                onChange={(e) => setPackageWeight(e.target.value)}
                placeholder="e.g. 1.5"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-900 px-4 py-2.5 text-sm outline-none focus:border-violet-500 focus:bg-slate-100 focus:ring-1 focus:ring-violet-500 placeholder-slate-400 transition-all"
              />
            </div>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Detailed Package Description *</label>
              <div className="relative">
                <FileText className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  id="input_package_desc"
                  type="text"
                  required
                  value={packageDescription}
                  onChange={(e) => setPackageDescription(e.target.value)}
                  placeholder="e.g. Legal documents and keys in manila folder"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-900 pl-10 pr-4 py-2.5 text-sm outline-none focus:border-violet-500 focus:bg-white focus:ring-1 focus:ring-violet-500 placeholder-slate-400 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Preferred Pickup Date & Time *</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  id="input_pickup_time"
                  type="datetime-local"
                  required
                  value={scheduledPickup}
                  onChange={(e) => setScheduledPickup(e.target.value)}
                  style={{ colorScheme: 'dark' }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-900 pl-10 pr-4 py-2.5 text-sm outline-none focus:border-violet-500 focus:bg-white focus:ring-1 focus:ring-violet-500 transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Step 4: Payment Methods */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-6">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-200">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-violet-600 border border-slate-200">
              <CreditCard className="h-4 w-4" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">4. Select Payment Channel</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* MoMo Option */}
            <button
              type="button"
              onClick={() => setPaymentProvider('momo')}
              className={`flex items-start p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                paymentProvider === 'momo'
                  ? 'border-amber-500 bg-amber-500/5 text-slate-900'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50 text-slate-500'
              }`}
            >
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-300 mt-0.5 mr-3">
                {paymentProvider === 'momo' && <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />}
              </div>
              <div>
                <span className="block font-bold text-slate-900">MTN Mobile Money (MoMo)</span>
                <span className="block text-xs text-slate-500 mt-1">
                  Trigger instant Request-to-Pay USSD prompt to approve on your mobile handset immediately.
                </span>
                <span className="inline-block mt-2 rounded bg-amber-500/15 border border-amber-500/20 text-amber-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                  Highly Recommended
                </span>
              </div>
            </button>

            {/* Manual Payment Option */}
            <button
              type="button"
              onClick={() => setPaymentProvider('manual')}
              className={`flex items-start p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                paymentProvider === 'manual'
                  ? 'border-violet-500 bg-violet-50 text-slate-900'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50 text-slate-500'
              }`}
            >
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-300 mt-0.5 mr-3">
                {paymentProvider === 'manual' && <div className="h-2.5 w-2.5 rounded-full bg-violet-600" />}
              </div>
              <div>
                <span className="block font-bold text-slate-900">Manual Payment / Dispatch Tracking</span>
                <span className="block text-xs text-slate-500 mt-1">
                  Confirm booking first. You can coordinate cash on pickup, bank transfer, or offline MoMo. Your payment is logged once received.
                </span>
              </div>
            </button>
          </div>

          {/* Pricing Total Summary Box */}
          <div className="rounded-xl bg-slate-100 border border-slate-200 text-slate-900 p-6 flex flex-col sm:flex-row items-center justify-between shadow-lg">
            <div className="mb-4 sm:mb-0 text-center sm:text-left">
              <span className="text-xs text-slate-500 uppercase tracking-wider font-mono">Total Estimated Charge</span>
              <div className="text-3xl font-semibold mt-1 text-violet-600 tabular-nums">
                {pricing.currency} {getPrice().toFixed(2)}
              </div>
              <p className="text-slate-500 text-xs mt-1">
                * Based on flat-rate size tier pricing config ({packageSize.toUpperCase()}).
              </p>
            </div>

            <button
              id="btn_submit_booking"
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2.5 rounded-xl btn-aurora px-8 py-4 text-sm font-bold text-white shadow-md shadow-violet-500/20 hover:scale-[1.01] transition-all disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>Book Delivery Now</span>
                  <ArrowRight className="h-4.5 w-4.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Real-time Simulated MoMo Prompt Modal */}
      {showMomoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center space-x-2">
                <div className="h-6 w-6 rounded-md bg-amber-500 flex items-center justify-center text-black text-xs font-bold">
                  M
                </div>
                <h3 className="font-bold text-slate-900 text-base">MTN Mobile Money Prompt</h3>
              </div>
              <button
                onClick={() => setShowMomoModal(false)}
                className="text-slate-500 hover:text-slate-700 text-sm font-semibold p-1 cursor-pointer"
              >
                Cancel
              </button>
            </div>

            {momoStep === 1 && (
              <div className="space-y-4">
                <p className="text-sm text-slate-500">
                  Provide your MTN phone number. This simulates a real <strong className="text-slate-900">Request-to-Pay (R2P)</strong> API pull.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Moneys Wallet Number</label>
                  <input
                    id="input_momo_phone"
                    type="tel"
                    value={momoPhoneNumber}
                    onChange={(e) => setMomoPhoneNumber(e.target.value)}
                    placeholder="e.g. 0244123456"
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 text-slate-900 px-4 py-2.5 text-sm outline-none font-mono focus:border-violet-500 placeholder-slate-400"
                  />
                </div>
                <button
                  id="btn_confirm_sim_momo"
                  onClick={handleMomoPaymentConfirm}
                  className="w-full rounded-xl bg-amber-500 hover:bg-amber-600 py-3 text-sm font-bold text-black shadow-md transition-colors cursor-pointer"
                >
                  Send USSD Request Prompt
                </button>
              </div>
            )}

            {momoStep === 2 && (
              <div className="text-center py-6 space-y-4">
                <Loader2 className="h-10 w-10 text-amber-500 animate-spin mx-auto" />
                <div>
                  <h4 className="font-bold text-slate-900">Processing USSD Push</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                    Sending a Request-to-Pay alert of <strong className="text-violet-600">{pricing.currency} {getPrice().toFixed(2)}</strong> to {momoPhoneNumber}. Approve prompt on your handset now.
                  </p>
                </div>
                <div className="bg-black/60 p-3 rounded-lg text-left text-xs font-mono text-slate-500 border border-slate-200/85 max-w-xs mx-auto">
                  <span className="text-slate-500 uppercase tracking-widest text-[9px] font-semibold block mb-1">Simulation logs</span>
                  &gt; curl R2P push status... PENDING<br/>
                  &gt; waiting for MTN provider hook...
                </div>
              </div>
            )}

            {momoStep === 3 && (
              <div className="text-center py-6 space-y-4">
                <div className="h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle className="h-7 w-7" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">Payment Approved!</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Received MTN verification reference. Finalizing your order dispatch booking...
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
