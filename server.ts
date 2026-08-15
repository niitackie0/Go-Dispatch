/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { 
  Order, 
  Payment, 
  StatusHistory, 
  PricingConfig, 
  AdminUser, 
  OrderStatus, 
  PaymentStatus, 
  PackageSize,
  DashboardStats,
  Rider,
  RiderJob,
  Payer,
  PaymentTiming
} from './src/types.js';

dotenv.config();

const app = express();
const PORT = 3000;

// Body parsing middleware
app.use(express.json());

// Database file path
const DB_FILE = path.join(process.cwd(), 'db.json');

// Interface for DB Structure
interface DBStructure {
  orders: Order[];
  payments: Payment[];
  statusHistory: StatusHistory[];
  adminUsers: AdminUser[];
  pricing: PricingConfig;
  riders: Rider[];
}

// Default pricing config (in pesewas, e.g. GHS 1 = 100 pesewas)
const DEFAULT_PRICING: PricingConfig = {
  small: 2500,  // 25.00 GHS
  medium: 5000, // 50.00 GHS
  large: 9000,  // 90.00 GHS
  currency: 'GHS',
};

// Seed administrative user
const SEED_ADMIN: AdminUser = {
  id: 'admin_1',
  name: 'Waypoint Dispatch Admin',
  email: 'admin@waypoint.com',
  role: 'admin',
  createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
};

// Seed courier fleet — auto-queueing assigns from this pool
const SEED_RIDERS: Rider[] = [
  { id: 'rider_1', name: 'Kwesi Boateng', phone: '0244777001', available: true, createdAt: new Date().toISOString() },
  { id: 'rider_2', name: 'Yaw Antwi', phone: '0244777002', available: true, createdAt: new Date().toISOString() },
  { id: 'rider_3', name: 'Abena Nkrumah', phone: '0244777003', available: true, createdAt: new Date().toISOString() },
];

/**
 * Automation rules engine.
 *
 * Runs after any mutation and on a periodic tick. Deliberately only automates
 * ADMINISTRATIVE transitions — physical states (picked_up / in_transit /
 * delivered) are never invented here, they require a real signal from a rider.
 *
 * Returns the list of human-readable actions taken (for logging/telemetry).
 */
function applyAutomations(db: DBStructure): string[] {
  const actions: string[] = [];
  const now = Date.now();
  const QUEUE_WINDOW_MS = 60 * 60 * 1000; // auto-queue within 1h of scheduled pickup

  const log = (orderId: string, status: OrderStatus, note: string) => {
    db.statusHistory.push({
      id: 'hist_' + Math.random().toString(36).substring(2),
      orderId,
      status,
      note,
      changedByName: 'Waypoint Automation',
      changedAt: new Date().toISOString(),
    });
  };

  for (const order of db.orders) {
    // ---- Rule A: payment received -> auto-confirm -------------------------
    // Prepaid orders sit in awaiting_payment and cannot dispatch until paid.
    if (order.status === 'awaiting_payment' && order.paymentStatus === 'paid') {
      order.status = 'confirmed';
      order.updatedAt = new Date().toISOString();
      log(order.id, 'confirmed', 'Auto-confirmed — payment received');
      actions.push(`auto-confirmed ${order.trackingCode}`);
    }

    // ---- Rule B: pickup window + free rider -> auto-queue ------------------
    // Capacity lives here, not at confirmation: an order stays "confirmed
    // (awaiting rider)" for as long as the fleet is busy.
    if (order.status === 'confirmed') {
      const pickupAt = new Date(order.scheduledPickupAt).getTime();
      if (!isNaN(pickupAt) && pickupAt - now <= QUEUE_WINDOW_MS) {
        const rider = db.riders.find(r => r.available);
        if (rider) {
          rider.available = false;
          order.riderId = rider.id;
          order.riderName = rider.name;
          order.riderToken = order.riderToken || 'rdr_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
          order.status = 'queued';
          order.updatedAt = new Date().toISOString();
          log(order.id, 'queued', `Auto-queued — assigned to ${rider.name}`);
          actions.push(`auto-queued ${order.trackingCode} -> ${rider.name}`);
        }
      }
    }

    // ---- Rule C: delivered on-delivery order -> auto-reconcile payment -----
    if (
      order.status === 'delivered' &&
      order.paymentTiming === 'on_delivery' &&
      order.paymentStatus !== 'paid'
    ) {
      order.paymentStatus = 'paid';
      order.updatedAt = new Date().toISOString();
      db.payments.push({
        id: 'pay_' + Math.random().toString(36).substring(2),
        orderId: order.id,
        amount: order.priceAmount,
        currency: order.currency,
        provider: 'manual',
        status: 'success',
        paidAt: new Date().toISOString(),
        note: `Auto-reconciled — cash collected on delivery (${order.payer === 'recipient' ? 'recipient' : 'sender'})`,
        createdAt: new Date().toISOString(),
      });
      log(order.id, 'delivered', 'Payment auto-reconciled — collected on delivery');
      actions.push(`auto-reconciled ${order.trackingCode}`);
    }

    // ---- Free the rider once the job is finished --------------------------
    if ((order.status === 'delivered' || order.status === 'cancelled') && order.riderId) {
      const rider = db.riders.find(r => r.id === order.riderId);
      if (rider && !rider.available) {
        rider.available = true;
        actions.push(`freed rider ${rider.name}`);
      }
    }
  }

  return actions;
}

// Seeding function to populate realistic demo orders, payments, status histories
function getSeedData(): DBStructure {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const orders: Order[] = [
    {
      id: 'ord_1',
      trackingCode: 'WP-8293-102',
      senderName: 'Ama Osei',
      senderPhone: '0244123456',
      pickupAddress: 'Block C, Airport Residential Area, Accra',
      pickupNotes: 'Opposite the French School, ring gate bell',
      recipientName: 'Kofi Mensah',
      recipientPhone: '0207987654',
      dropoffAddress: 'House No. 12, Ring Road Central, Kokomlemle, Accra',
      dropoffNotes: 'Next to the MTN office',
      packageSize: 'small',
      packageWeightKg: 1.2,
      packageDescription: 'Important contract documents and office keys',
      scheduledPickupAt: new Date(now - 4 * day).toISOString(),
      priceAmount: 2500,
      currency: 'GHS',
      status: 'delivered',
      paymentStatus: 'paid',
      createdAt: new Date(now - 4 * day).toISOString(),
      updatedAt: new Date(now - 3 * day).toISOString(),
    },
    {
      id: 'ord_2',
      trackingCode: 'WP-4012-948',
      senderName: 'Ekow Taylor',
      senderPhone: '0553112233',
      pickupAddress: 'Teshie Estates, near Bush Road, Accra',
      pickupNotes: 'Blue gate near the taxi rank',
      recipientName: 'Abena Appiah',
      recipientPhone: '0244998877',
      dropoffAddress: 'SSNIT Flats, Block B, Madina, Accra',
      dropoffNotes: 'Third floor, Room 304',
      packageSize: 'medium',
      packageWeightKg: 4.5,
      packageDescription: 'Handmade leather shoes and kente cloth bundle',
      scheduledPickupAt: new Date(now - 2 * day).toISOString(),
      priceAmount: 5000,
      currency: 'GHS',
      status: 'in_transit',
      paymentStatus: 'paid',
      createdAt: new Date(now - 2 * day).toISOString(),
      updatedAt: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'ord_3',
      trackingCode: 'WP-7721-309',
      senderName: 'Yaa Boateng',
      senderPhone: '0277334455',
      pickupAddress: 'East Legon, Lagos Avenue, Accra',
      pickupNotes: 'Behind the Shell station',
      recipientName: 'Kwame Asante',
      recipientPhone: '0501122446',
      dropoffAddress: 'Dzorwulu, near Fiesta Royale Hotel, Accra',
      dropoffNotes: 'Drop at security desk',
      packageSize: 'large',
      packageWeightKg: 12.0,
      packageDescription: 'Kitchen blender and electronic food scale',
      scheduledPickupAt: new Date(now - 1 * day).toISOString(),
      priceAmount: 9000,
      currency: 'GHS',
      status: 'queued',
      paymentStatus: 'pending',
      createdAt: new Date(now - 1 * day).toISOString(),
      updatedAt: new Date(now - 12 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'ord_4',
      trackingCode: 'WP-9923-014',
      senderName: 'John Doe',
      senderPhone: '0243009988',
      pickupAddress: 'Osu, Danquah Circle, Accra',
      pickupNotes: 'Above the pharmacy',
      recipientName: 'Richard Mills',
      recipientPhone: '0204455667',
      dropoffAddress: 'Labone, near Metro TV, Accra',
      dropoffNotes: 'Gate has a palm tree outside',
      packageSize: 'small',
      packageWeightKg: 0.5,
      packageDescription: 'Replacement charger and laptop power adapter',
      scheduledPickupAt: new Date(now - 5 * 60 * 1000).toISOString(),
      priceAmount: 2500,
      currency: 'GHS',
      status: 'confirmed',
      paymentStatus: 'pending',
      createdAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'ord_5',
      trackingCode: 'WP-1048-552',
      senderName: 'Sarah Lamptey',
      senderPhone: '0544881122',
      pickupAddress: 'Spintex Road, near Kotobabi Junction, Accra',
      pickupNotes: 'Inside the Accra Mall Complex back parking',
      recipientName: 'Michael Tagoe',
      recipientPhone: '0244665544',
      dropoffAddress: 'Tema Community 6, near the Harbor, Tema',
      dropoffNotes: 'Warehouse B',
      packageSize: 'large',
      packageWeightKg: 18.2,
      packageDescription: 'Automotive replacement filters and engine gaskets',
      scheduledPickupAt: new Date(now + 1 * day).toISOString(),
      priceAmount: 9000,
      currency: 'GHS',
      status: 'requested',
      paymentStatus: 'pending',
      createdAt: new Date(now - 1 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now - 1 * 60 * 60 * 1000).toISOString(),
    }
  ];

  const payments: Payment[] = [
    {
      id: 'pay_1',
      orderId: 'ord_1',
      amount: 2500,
      currency: 'GHS',
      provider: 'momo',
      providerReference: 'MTN-MOMO-88291039',
      status: 'success',
      paidAt: new Date(now - 4 * day).toISOString(),
      createdAt: new Date(now - 4 * day).toISOString(),
    },
    {
      id: 'pay_2',
      orderId: 'ord_2',
      amount: 5000,
      currency: 'GHS',
      provider: 'manual',
      status: 'success',
      paidAt: new Date(now - 2 * day).toISOString(),
      recordedByAdminId: 'admin_1',
      note: 'Admin confirmed payment screenshot on WhatsApp. Reference: GIB-9921',
      createdAt: new Date(now - 2 * day).toISOString(),
    }
  ];

  const statusHistory: StatusHistory[] = [
    // ord_1
    {
      id: 'hist_1_1',
      orderId: 'ord_1',
      status: 'requested',
      note: 'Order submitted online by customer',
      changedAt: new Date(now - 4 * day).toISOString(),
    },
    {
      id: 'hist_1_2',
      orderId: 'ord_1',
      status: 'confirmed',
      note: 'Admin confirmed pickup coordinates and package details',
      changedByAdminId: 'admin_1',
      changedByName: 'Waypoint Dispatch Admin',
      changedAt: new Date(now - 4 * day + 30 * 60 * 1000).toISOString(),
    },
    {
      id: 'hist_1_3',
      orderId: 'ord_1',
      status: 'queued',
      note: 'Assigned to courier route B7',
      changedByAdminId: 'admin_1',
      changedByName: 'Waypoint Dispatch Admin',
      changedAt: new Date(now - 4 * day + 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'hist_1_4',
      orderId: 'ord_1',
      status: 'picked_up',
      note: 'Courier Kwesi picked up package from sender',
      changedAt: new Date(now - 3 * day).toISOString(),
    },
    {
      id: 'hist_1_5',
      orderId: 'ord_1',
      status: 'delivered',
      note: 'Delivered successfully and signed by Kofi Mensah',
      changedAt: new Date(now - 3 * day + 3 * 60 * 60 * 1000).toISOString(),
    },
    // ord_2
    {
      id: 'hist_2_1',
      orderId: 'ord_2',
      status: 'requested',
      note: 'Order submitted online by customer',
      changedAt: new Date(now - 2 * day).toISOString(),
    },
    {
      id: 'hist_2_2',
      orderId: 'ord_2',
      status: 'confirmed',
      note: 'Admin phone confirmation completed',
      changedByAdminId: 'admin_1',
      changedByName: 'Waypoint Dispatch Admin',
      changedAt: new Date(now - 2 * day + 1 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'hist_2_3',
      orderId: 'ord_2',
      status: 'queued',
      note: 'Awaiting pickup on route D1',
      changedByAdminId: 'admin_1',
      changedByName: 'Waypoint Dispatch Admin',
      changedAt: new Date(now - 2 * day + 4 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'hist_2_4',
      orderId: 'ord_2',
      status: 'picked_up',
      note: 'Package picked up from Teshie',
      changedAt: new Date(now - 1 * day).toISOString(),
    },
    {
      id: 'hist_2_5',
      orderId: 'ord_2',
      status: 'in_transit',
      note: 'Courier is currently route-en-route to Madina',
      changedAt: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
    },
    // ord_3
    {
      id: 'hist_3_1',
      orderId: 'ord_3',
      status: 'requested',
      note: 'Order submitted online by customer',
      changedAt: new Date(now - 1 * day).toISOString(),
    },
    {
      id: 'hist_3_2',
      orderId: 'ord_3',
      status: 'confirmed',
      note: 'Details verified, sender ready with item',
      changedByAdminId: 'admin_1',
      changedByName: 'Waypoint Dispatch Admin',
      changedAt: new Date(now - 1 * day + 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'hist_3_3',
      orderId: 'ord_3',
      status: 'queued',
      note: 'Placed in queue for pickup dispatch',
      changedByAdminId: 'admin_1',
      changedByName: 'Waypoint Dispatch Admin',
      changedAt: new Date(now - 12 * 60 * 60 * 1000).toISOString(),
    },
    // ord_4
    {
      id: 'hist_4_1',
      orderId: 'ord_4',
      status: 'requested',
      note: 'Order submitted online by customer',
      changedAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'hist_4_2',
      orderId: 'ord_4',
      status: 'confirmed',
      note: 'Confirmed with sender',
      changedByAdminId: 'admin_1',
      changedByName: 'Waypoint Dispatch Admin',
      changedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    },
    // ord_5
    {
      id: 'hist_5_1',
      orderId: 'ord_5',
      status: 'requested',
      note: 'New booking requested online',
      changedAt: new Date(now - 1 * 60 * 60 * 1000).toISOString(),
    }
  ];

  return {
    orders,
    payments,
    statusHistory,
    adminUsers: [SEED_ADMIN],
    pricing: DEFAULT_PRICING,
    riders: SEED_RIDERS,
  };
}

// Read database helper
function readDB(): DBStructure {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const initial = getSeedData();
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(data) as DBStructure;
    // Migration: databases created before the fleet/automation feature have no riders.
    if (!Array.isArray(parsed.riders)) {
      parsed.riders = SEED_RIDERS;
    }
    return parsed;
  } catch (error) {
    console.error('Error reading db.json, returning seeded default data', error);
    return getSeedData();
  }
}

// Write database helper
function writeDB(data: DBStructure): void {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing to db.json', error);
  }
}

// Generate secure simple token (Session store for simplicity)
const ACTIVE_TOKENS = new Map<string, AdminUser>();

// Initialize database
readDB();

// API Endpoints

// 1. AUTHENTICATION
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  if (email === 'admin@waypoint.com' && password === 'password123') {
    const token = 'wp_tok_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    ACTIVE_TOKENS.set(token, SEED_ADMIN);
    return res.json({ token, user: SEED_ADMIN });
  }
  
  return res.status(401).json({ error: 'Invalid email or password' });
});

// Middleware to verify Admin auth token
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized. Auth token missing' });
  }
  const token = authHeader.split(' ')[1];
  const admin = ACTIVE_TOKENS.get(token);
  if (!admin) {
    return res.status(401).json({ error: 'Unauthorized. Invalid or expired token' });
  }
  // Attach user to request
  (req as any).user = admin;
  next();
}

app.get('/api/auth/me', requireAdmin, (req, res) => {
  res.json({ user: (req as any).user });
});

app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    ACTIVE_TOKENS.delete(token);
  }
  res.json({ success: true });
});


// 2. PRICING CONFIG
app.get('/api/pricing', (req, res) => {
  const db = readDB();
  res.json(db.pricing);
});

app.patch('/api/pricing', requireAdmin, (req, res) => {
  const { small, medium, large } = req.body;
  const db = readDB();
  
  if (typeof small === 'number') db.pricing.small = small;
  if (typeof medium === 'number') db.pricing.medium = medium;
  if (typeof large === 'number') db.pricing.large = large;
  
  writeDB(db);
  res.json({ success: true, pricing: db.pricing });
});


// 3. PUBLIC TRACKING LOOKUP
app.get('/api/orders/track', (req, res) => {
  const query = req.query.q as string;
  if (!query) {
    return res.status(400).json({ error: 'Search query (tracking code or phone number) is required' });
  }

  const db = readDB();
  const normalizedQuery = query.trim().toUpperCase();
  const normalizedPhone = query.trim().replace(/\s+/g, '');

  // Look up order (matches tracking code or sender/recipient phone number)
  const orders = db.orders.filter(o => {
    const trackMatch = o.trackingCode.toUpperCase() === normalizedQuery;
    const senderMatch = o.senderPhone.replace(/\s+/g, '').includes(normalizedPhone);
    const recipientMatch = o.recipientPhone.replace(/\s+/g, '').includes(normalizedPhone);
    return trackMatch || senderMatch || recipientMatch;
  });

  if (orders.length === 0) {
    return res.status(404).json({ error: 'No orders found matching tracking code or phone number' });
  }

  // Sanitize orders for public view (remove sensitive details if necessary, but keep layout timeline safe)
  const sanitizedOrders = orders.map(order => {
    // Gather timeline history for this order
    const history = db.statusHistory
      .filter(h => h.orderId === order.id)
      .sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime());

    return {
      id: order.id,
      trackingCode: order.trackingCode,
      senderName: order.senderName, // simple name ok for verification
      recipientName: order.recipientName,
      pickupAddress: order.pickupAddress,
      dropoffAddress: order.dropoffAddress,
      packageSize: order.packageSize,
      packageDescription: order.packageDescription,
      scheduledPickupAt: order.scheduledPickupAt,
      status: order.status,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt,
      timeline: history.map(h => ({
        status: h.status,
        note: h.note,
        changedAt: h.changedAt
      }))
    };
  });

  res.json(sanitizedOrders);
});


// 4. PUBLIC BOOKING CREATION
app.post('/api/orders/book', (req, res) => {
  const {
    senderName,
    senderPhone,
    pickupAddress,
    pickupNotes,
    recipientName,
    recipientPhone,
    dropoffAddress,
    dropoffNotes,
    packageSize,
    packageWeightKg,
    packageDescription,
    scheduledPickupAt,
    paymentProvider, // 'manual' or 'momo'
    payer,           // 'sender' | 'recipient'
    paymentTiming    // 'prepaid' | 'on_delivery'
  } = req.body;

  // Simple validation
  if (!senderName || !senderPhone || !pickupAddress || !recipientName || !recipientPhone || !dropoffAddress || !packageSize) {
    return res.status(400).json({ error: 'Missing required fields for parcel booking' });
  }

  const db = readDB();

  // Calculate pricing based on current configuration
  const basePrice = db.pricing[packageSize as PackageSize] || db.pricing.small;
  
  // Generate random unique tracking code: e.g. WP-XXXX-YYY
  const num1 = Math.floor(1000 + Math.random() * 9000);
  const num2 = Math.floor(100 + Math.random() * 900);
  const trackingCode = `WP-${num1}-${num2}`;

  const orderId = 'ord_' + Math.random().toString(36).substring(2) + Date.now().toString(36);

  const newOrder: Order = {
    id: orderId,
    trackingCode,
    senderName,
    senderPhone,
    pickupAddress,
    pickupNotes,
    recipientName,
    recipientPhone,
    dropoffAddress,
    dropoffNotes,
    packageSize: packageSize as PackageSize,
    packageWeightKg: Number(packageWeightKg) || 1,
    packageDescription: packageDescription || 'Parcel Delivery',
    scheduledPickupAt: scheduledPickupAt || new Date().toISOString(),
    priceAmount: basePrice,
    currency: db.pricing.currency,
    // Fall back to the legacy mapping so existing clients keep working:
    // MoMo = pay up front, manual = settle at the door.
    payer: (payer as Payer) || 'sender',
    paymentTiming: (paymentTiming as PaymentTiming) || (paymentProvider === 'momo' ? 'prepaid' : 'on_delivery'),
    status: 'requested',
    paymentStatus: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Prepaid orders are payment-gated: they park in awaiting_payment and cannot
  // confirm or dispatch until money lands. Pay-on-delivery orders are accepted
  // straight away but carry a visible "payment due" flag until reconciled.
  const isPrepaid = newOrder.paymentTiming === 'prepaid';
  newOrder.status = isPrepaid ? 'awaiting_payment' : 'confirmed';

  db.orders.push(newOrder);

  // Initial Status History record
  const initialHistory: StatusHistory = {
    id: 'hist_' + Math.random().toString(36).substring(2),
    orderId,
    status: newOrder.status,
    note: isPrepaid
      ? `Order submitted — awaiting payment from ${newOrder.payer}`
      : `Order submitted and auto-confirmed — payment due on delivery (${newOrder.payer})`,
    changedByName: 'Waypoint Automation',
    changedAt: new Date().toISOString()
  };
  db.statusHistory.push(initialHistory);

  // If MoMo payment chosen, we create an initial pending payment record
  if (paymentProvider === 'momo') {
    const newPayment: Payment = {
      id: 'pay_' + Math.random().toString(36).substring(2),
      orderId,
      amount: basePrice,
      currency: db.pricing.currency,
      provider: 'momo',
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    db.payments.push(newPayment);
  }

  applyAutomations(db);
  writeDB(db);

  res.status(201).json({
    success: true,
    order: newOrder,
    trackingCode
  });
});


// 5. ADMIN: GET ALL ORDERS WITH FILTERS
app.get('/api/orders', requireAdmin, (req, res) => {
  const db = readDB();
  const { status, search, startDate, endDate } = req.query;

  let filteredOrders = [...db.orders];

  // Search Filter (tracking code, sender/recipient name, phone, address)
  if (search) {
    const q = (search as string).toLowerCase().trim();
    filteredOrders = filteredOrders.filter(o => 
      o.trackingCode.toLowerCase().includes(q) ||
      o.senderName.toLowerCase().includes(q) ||
      o.senderPhone.includes(q) ||
      o.recipientName.toLowerCase().includes(q) ||
      o.recipientPhone.includes(q) ||
      o.pickupAddress.toLowerCase().includes(q) ||
      o.dropoffAddress.toLowerCase().includes(q)
    );
  }

  // Status Filter
  if (status) {
    filteredOrders = filteredOrders.filter(o => o.status === status);
  }

  // Date Range Filter
  if (startDate) {
    const start = new Date(startDate as string).getTime();
    filteredOrders = filteredOrders.filter(o => new Date(o.createdAt).getTime() >= start);
  }
  if (endDate) {
    const end = new Date(endDate as string).getTime();
    filteredOrders = filteredOrders.filter(o => new Date(o.createdAt).getTime() <= end);
  }

  // Sort descending by creation date
  filteredOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json(filteredOrders);
});


// 6. ADMIN: GET DETAILED ORDER WITH STATUS HISTORY AND PAYMENTS
app.get('/api/orders/:id', requireAdmin, (req, res) => {
  const db = readDB();
  const order = db.orders.find(o => o.id === req.params.id);

  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const history = db.statusHistory
    .filter(h => h.orderId === order.id)
    .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()); // newest first

  const payments = db.payments
    .filter(p => p.orderId === order.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json({
    order,
    history,
    payments
  });
});


// 7. ADMIN: UPDATE ORDER STATUS
app.patch('/api/orders/:id/status', requireAdmin, (req, res) => {
  const { status, note } = req.body;
  const admin = (req as any).user;

  if (!status) {
    return res.status(400).json({ error: 'New status is required' });
  }

  const db = readDB();
  const orderIndex = db.orders.findIndex(o => o.id === req.params.id);

  if (orderIndex === -1) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const order = db.orders[orderIndex];
  const oldStatus = order.status;
  order.status = status as OrderStatus;
  order.updatedAt = new Date().toISOString();

  // Create audit history log
  const newHistory: StatusHistory = {
    id: 'hist_' + Math.random().toString(36).substring(2),
    orderId: order.id,
    status: status as OrderStatus,
    note: note || `Status updated from ${oldStatus} to ${status}`,
    changedByAdminId: admin.id,
    changedByName: admin.name,
    changedAt: new Date().toISOString()
  };

  db.statusHistory.push(newHistory);
  applyAutomations(db);
  writeDB(db);

  res.json({
    success: true,
    order,
    history: newHistory
  });
});


// 8. ADMIN: MANUAL MARK ORDER AS PAID
app.post('/api/orders/:id/pay', requireAdmin, (req, res) => {
  const { amount, note, providerReference } = req.body;
  const admin = (req as any).user;

  const db = readDB();
  const orderIndex = db.orders.findIndex(o => o.id === req.params.id);

  if (orderIndex === -1) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const order = db.orders[orderIndex];
  const payAmount = typeof amount === 'number' ? amount : order.priceAmount;

  // Update order payment status
  order.paymentStatus = 'paid';
  order.updatedAt = new Date().toISOString();

  // Create payment ledger record
  const newPayment: Payment = {
    id: 'pay_' + Math.random().toString(36).substring(2),
    orderId: order.id,
    amount: payAmount,
    currency: order.currency,
    provider: 'manual',
    providerReference: providerReference || undefined,
    status: 'success',
    paidAt: new Date().toISOString(),
    recordedByAdminId: admin.id,
    note: note || 'Manually marked as paid by administrator',
    createdAt: new Date().toISOString()
  };

  db.payments.push(newPayment);

  // Audit log for payment update
  const paymentAudit: StatusHistory = {
    id: 'hist_' + Math.random().toString(36).substring(2),
    orderId: order.id,
    status: order.status,
    note: `Payment marked as PAID manually (Recorded: GHS ${(payAmount / 100).toFixed(2)})`,
    changedByAdminId: admin.id,
    changedByName: admin.name,
    changedAt: new Date().toISOString()
  };

  db.statusHistory.push(paymentAudit);

  applyAutomations(db);
  writeDB(db);

  res.json({
    success: true,
    order,
    payment: newPayment
  });
});


// 9. ADMIN: VIEW ALL PAYMENTS
app.get('/api/payments', requireAdmin, (req, res) => {
  const db = readDB();
  
  // Enriched payments with customer and order tracking codes
  const enrichedPayments = db.payments.map(p => {
    const order = db.orders.find(o => o.id === p.orderId);
    return {
      ...p,
      trackingCode: order?.trackingCode || 'UNKNOWN',
      senderName: order?.senderName || 'UNKNOWN',
      senderPhone: order?.senderPhone || 'UNKNOWN',
    };
  });

  // Sort descending by date
  enrichedPayments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json(enrichedPayments);
});


// 10. ADMIN: EXPORT PAYMENTS AS CSV
app.get('/api/payments/export', requireAdmin, (req, res) => {
  const db = readDB();
  
  let csvContent = 'Payment ID,Order Tracking,Sender,Phone,Amount (GHS),Provider,Reference,Status,Paid At,Recorded By,Notes\n';
  
  db.payments.forEach(p => {
    const order = db.orders.find(o => o.id === p.orderId);
    const trackingCode = order ? order.trackingCode : 'N/A';
    const sender = order ? order.senderName : 'N/A';
    const phone = order ? order.senderPhone : 'N/A';
    const amt = (p.amount / 100).toFixed(2);
    const datePaid = p.paidAt ? new Date(p.paidAt).toLocaleDateString() : 'N/A';
    const recorder = p.recordedByAdminId ? 'Admin' : 'Gateway';
    const cleanNote = p.note ? p.note.replace(/,/g, ';').replace(/\n/g, ' ') : '';
    
    csvContent += `"${p.id}","${trackingCode}","${sender}","${phone}",${amt},"${p.provider}","${p.providerReference || ''}","${p.status}","${datePaid}","${recorder}","${cleanNote}"\n`;
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=waypoint_payments_export.csv');
  res.status(200).send(csvContent);
});


// 11. ADMIN: GET REVENUE STATS
app.get('/api/stats', requireAdmin, (req, res) => {
  const db = readDB();
  const now = new Date();
  const nowMs = now.getTime();

  // Helper date bound variables
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const oneWeekAgo = nowMs - 7 * 24 * 60 * 60 * 1000;
  const oneMonthAgo = nowMs - 30 * 24 * 60 * 60 * 1000;

  let todayRevenue = 0;
  let weekRevenue = 0;
  let monthRevenue = 0;
  let allTimeRevenue = 0;

  // Process success payments
  db.payments.forEach(p => {
    if (p.status === 'success') {
      const paymentTime = new Date(p.paidAt || p.createdAt).getTime();
      allTimeRevenue += p.amount;

      if (paymentTime >= todayStart) {
        todayRevenue += p.amount;
      }
      if (paymentTime >= oneWeekAgo) {
        weekRevenue += p.amount;
      }
      if (paymentTime >= oneMonthAgo) {
        monthRevenue += p.amount;
      }
    }
  });

  // Order counts grouped by status
  const counts: Record<OrderStatus, number> = {
    requested: 0,
    awaiting_payment: 0,
    confirmed: 0,
    queued: 0,
    picked_up: 0,
    in_transit: 0,
    delivered: 0,
    cancelled: 0,
  };

  db.orders.forEach(o => {
    if (counts[o.status] !== undefined) {
      counts[o.status]++;
    }
  });

  const stats: DashboardStats = {
    revenue: {
      today: todayRevenue,
      week: weekRevenue,
      month: monthRevenue,
      allTime: allTimeRevenue,
    },
    counts,
  };

  res.json(stats);
});


/* ============================================================
   RIDER SELF-SERVICE (token-based, no admin login)
   A courier gets a link containing an opaque per-order token.
   The token can ONLY drive the physical steps of its own order —
   it can't read the fleet, touch pricing, or jump the workflow.
   ============================================================ */

// The only transitions a courier is permitted to make, and only in order.
const RIDER_NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  queued: 'picked_up',
  picked_up: 'in_transit',
  in_transit: 'delivered',
};

function findOrderByRiderToken(db: DBStructure, token: string) {
  if (!token) return undefined;
  return db.orders.find(o => o.riderToken === token);
}

// Fetch the job behind a rider link
app.get('/api/rider/:token', (req, res) => {
  const db = readDB();
  const order = findOrderByRiderToken(db, req.params.token);
  if (!order) {
    return res.status(404).json({ error: 'This delivery link is not valid or has expired.' });
  }

  const job: RiderJob = {
    trackingCode: order.trackingCode,
    status: order.status,
    riderName: order.riderName,
    senderName: order.senderName,
    senderPhone: order.senderPhone,
    pickupAddress: order.pickupAddress,
    pickupNotes: order.pickupNotes,
    recipientName: order.recipientName,
    recipientPhone: order.recipientPhone,
    dropoffAddress: order.dropoffAddress,
    dropoffNotes: order.dropoffNotes,
    packageSize: order.packageSize,
    packageWeightKg: order.packageWeightKg,
    packageDescription: order.packageDescription,
    scheduledPickupAt: order.scheduledPickupAt,
    priceAmount: order.priceAmount,
    currency: order.currency,
    paymentStatus: order.paymentStatus,
    cashToCollect: order.paymentTiming === 'on_delivery' && order.paymentStatus !== 'paid',
    payer: order.payer,
  };

  res.json(job);
});

// Courier advances the physical step (picked up -> in transit -> delivered)
app.post('/api/rider/:token/status', (req, res) => {
  const db = readDB();
  const order = findOrderByRiderToken(db, req.params.token);
  if (!order) {
    return res.status(404).json({ error: 'This delivery link is not valid or has expired.' });
  }

  const next = RIDER_NEXT_STATUS[order.status];
  if (!next) {
    return res.status(400).json({
      error: `No further update is available for this parcel (currently ${order.status.replace('_', ' ')}).`,
    });
  }

  order.status = next;
  order.updatedAt = new Date().toISOString();

  db.statusHistory.push({
    id: 'hist_' + Math.random().toString(36).substring(2),
    orderId: order.id,
    status: next,
    note: `Marked "${next.replace('_', ' ')}" by courier in the field`,
    changedByName: order.riderName || 'Courier',
    changedAt: new Date().toISOString(),
  });

  // Delivering an on-delivery order auto-reconciles its payment here.
  applyAutomations(db);
  writeDB(db);

  res.json({ success: true, status: order.status });
});

// Courier records cash taken from the customer
app.post('/api/rider/:token/collect', (req, res) => {
  const db = readDB();
  const order = findOrderByRiderToken(db, req.params.token);
  if (!order) {
    return res.status(404).json({ error: 'This delivery link is not valid or has expired.' });
  }
  if (order.paymentStatus === 'paid') {
    return res.status(400).json({ error: 'This parcel is already marked as paid.' });
  }

  order.paymentStatus = 'paid';
  order.updatedAt = new Date().toISOString();

  db.payments.push({
    id: 'pay_' + Math.random().toString(36).substring(2),
    orderId: order.id,
    amount: order.priceAmount,
    currency: order.currency,
    provider: 'manual',
    status: 'success',
    paidAt: new Date().toISOString(),
    note: `Cash collected in the field by ${order.riderName || 'courier'}`,
    createdAt: new Date().toISOString(),
  });

  db.statusHistory.push({
    id: 'hist_' + Math.random().toString(36).substring(2),
    orderId: order.id,
    status: order.status,
    note: `Payment collected by courier (GHS ${(order.priceAmount / 100).toFixed(2)})`,
    changedByName: order.riderName || 'Courier',
    changedAt: new Date().toISOString(),
  });

  writeDB(db);
  res.json({ success: true, paymentStatus: order.paymentStatus });
});

// ADMIN: fleet roster (used by the dashboard to show rider availability)
app.get('/api/riders', requireAdmin, (req, res) => {
  const db = readDB();
  res.json(db.riders);
});

/**
 * Automation tick — runs the rules on a timer so time-based transitions
 * (e.g. auto-queueing when a pickup window opens) happen on their own,
 * without waiting for someone to click something in the dashboard.
 */
const AUTOMATION_TICK_MS = 60 * 1000;
setInterval(() => {
  try {
    const db = readDB();
    const actions = applyAutomations(db);
    if (actions.length > 0) {
      writeDB(db);
      console.log(`[automation] ${actions.length} action(s):`, actions.join(' | '));
    }
  } catch (err) {
    console.error('[automation] tick failed', err);
  }
}, AUTOMATION_TICK_MS);

// VITE MIDDLEWARE INTERACTION (For dev environment) OR STATIC SERVE (For prod)
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Waypoint full-stack server listening on http://localhost:${PORT}`);
  });
}

startServer();
