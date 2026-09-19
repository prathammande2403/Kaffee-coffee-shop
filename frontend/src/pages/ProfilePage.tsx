import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { Navbar } from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatIST } from '../utils/formatters';
import { LoyaltyTransactionOut, OrderOut } from '../types';
import {
  User,
  Mail,
  Phone,
  Calendar,
  Award,
  Shield,
  Clock,
  ArrowRight,
  LogOut,
  ShoppingBag,
  Sparkles,
  Lock,
  Info,
  CheckCircle2,
  XCircle,
  RotateCcw,
} from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  // Fetch real loyalty transaction ledger
  const {
    data: loyaltyTransactions = [],
    isLoading: isLoyaltyLoading,
    refetch: refetchLoyalty,
  } = useQuery<LoyaltyTransactionOut[]>({
    queryKey: ['loyalty-history'],
    queryFn: async () => {
      const res = await api.get('/auth/loyalty-history');
      return res.data;
    },
    enabled: !!user,
  });

  // Fetch order history (with fallback stub)
  const {
    data: orders = [],
    isLoading: isOrdersLoading,
  } = useQuery<OrderOut[]>({
    queryKey: ['my-orders'],
    queryFn: async () => {
      try {
        const res = await api.get('/orders');
        return res.data;
      } catch {
        return [];
      }
    },
    enabled: !!user,
  });

  if (!user) return null;

  // Format reason code into friendly badge and description
  const formatReason = (reason: string) => {
    switch (reason) {
      case 'ORDER_EARN':
        return { label: 'Brew Reward Earned', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'CHECKOUT_REDEEM':
        return { label: 'Redeemed on Order', color: 'bg-amber-50 text-amber-800 border-amber-200' };
      case 'CANCELLED_REFUND':
        return { label: 'Cancellation Refund', color: 'bg-sky-50 text-sky-700 border-sky-200' };
      case 'ORDER_REJECTED_REFUND':
        return { label: 'Store Rejection Refund', color: 'bg-rose-50 text-rose-700 border-rose-200' };
      case 'REVERSAL':
        return { label: 'Staff Reversal', color: 'bg-stone-100 text-stone-700 border-stone-200' };
      default:
        return { label: reason, color: 'bg-stone-100 text-stone-600 border-stone-200' };
    }
  };

  // Format order status
  const formatStatus = (status: string) => {
    switch (status) {
      case 'ORDER_RECEIVED':
        return { label: 'Received', color: 'bg-amber-50 text-amber-800 border-amber-200' };
      case 'PREPARING':
        return { label: 'Brewing', color: 'bg-orange-50 text-orange-800 border-orange-200' };
      case 'READY_FOR_PICKUP':
        return { label: 'Ready for Pickup', color: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'COMPLETED':
        return { label: 'Completed', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'CANCELLED':
        return { label: 'Cancelled', color: 'bg-stone-100 text-stone-600 border-stone-200' };
      case 'REJECTED':
        return { label: 'Declined', color: 'bg-rose-50 text-rose-700 border-rose-200' };
      default:
        return { label: status, color: 'bg-stone-100 text-stone-600 border-stone-200' };
    }
  };

  const minRedemptionThreshold = 50;
  const redemptionProgress = Math.min(100, (user.loyalty_balance / minRedemptionThreshold) * 100);

  return (
    <div className="min-h-screen bg-stone-50 selection:bg-amber-200 selection:text-amber-950 flex flex-col">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 py-8 sm:py-12 flex-1 w-full space-y-8">
        {/* TOP HERO PROFILE HEADER */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-amber-900 text-amber-100 flex items-center justify-center font-black text-2xl sm:text-3xl shadow-md shrink-0">
              {user.full_name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2) || 'K'}
            </div>

            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
                  {user.full_name}
                </h1>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                    user.role === 'staff' || user.role === 'admin'
                      ? 'bg-stone-800 text-white border-stone-900'
                      : 'bg-amber-100 text-amber-900 border-amber-200'
                  }`}
                >
                  {user.role}
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs text-stone-500 mt-1.5 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <Mail size={13} className="text-stone-400" />
                  {user.email}
                </span>
                <span className="flex items-center gap-1.5">
                  <Phone size={13} className="text-stone-400" />
                  {user.phone}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar size={13} className="text-stone-400" />
                  Member since {formatIST(user.created_at)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-stone-600 hover:text-rose-700 bg-stone-100 hover:bg-rose-50 border border-stone-200 text-xs font-bold transition"
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* TWO-COLUMN GRID: LOYALTY CARD (LEFT) & PROFILE DETAILS (RIGHT) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT: LOYALTY POINTS & REWARD CARD */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-gradient-to-br from-amber-900 via-amber-950 to-stone-900 text-white rounded-3xl p-6 shadow-lg relative overflow-hidden flex flex-col justify-between min-h-[260px]">
              {/* Decorative coffee bean watermarks */}
              <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-white/5 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -top-6 -right-6 text-white/5 pointer-events-none">
                <Award size={120} />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 text-[11px] font-bold text-amber-200">
                    <Sparkles size={13} />
                    <span>Kaffa Roast Club</span>
                  </div>
                  <button
                    onClick={() => refreshUser()}
                    className="p-1 rounded-lg hover:bg-white/10 text-stone-300 hover:text-white transition"
                    title="Refresh Balance"
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>

                <div className="mt-5">
                  <span className="text-xs uppercase tracking-wider text-amber-200/80 font-bold block">
                    Available Balance
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-4xl font-black tracking-tight">
                      {user.loyalty_balance}
                    </span>
                    <span className="text-sm font-bold text-amber-200/90">Points</span>
                  </div>
                  <p className="text-xs text-amber-100/70 mt-1">
                    Equivalent discount value:{' '}
                    <span className="font-extrabold text-white">
                      {formatCurrency(user.loyalty_balance * 1.0)}
                    </span>
                  </p>
                </div>
              </div>

              {/* Progress towards redemption */}
              <div className="pt-4 border-t border-white/10 mt-4">
                <div className="flex items-center justify-between text-[11px] mb-1.5">
                  <span className="text-amber-200/80 font-semibold">Min. Redemption Threshold</span>
                  <span className="font-extrabold text-white">
                    {user.loyalty_balance >= minRedemptionThreshold
                      ? 'Ready to Redeem'
                      : `${user.loyalty_balance} / ${minRedemptionThreshold} pts`}
                  </span>
                </div>
                <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${redemptionProgress}%` }}
                  />
                </div>
                <p className="text-[10px] text-amber-200/60 mt-2">
                  Spend ₹10 on checkout to earn 1 pt • 1 pt = ₹1 discount on orders
                </p>
              </div>
            </div>

            {/* Quick Roastery Menu CTA */}
            <div className="bg-amber-50/80 border border-amber-200/80 rounded-3xl p-5 shadow-sm">
              <h3 className="text-sm font-extrabold text-stone-900 mb-1">Craving fresh coffee?</h3>
              <p className="text-xs text-stone-500 mb-3">
                Order online for swift counter pickup at your nearest outlet.
              </p>
              <Link
                to="/menu"
                className="inline-flex items-center gap-1.5 w-full justify-center py-2.5 bg-amber-900 hover:bg-amber-950 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                <span>Browse Menu</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          {/* RIGHT: VIEW / EDIT PROFILE & RECENT ORDERS */}
          <div className="lg:col-span-2 space-y-6">
            {/* View / Edit Profile Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-stone-200/80 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-stone-900 tracking-tight">
                    Account Profile
                  </h2>
                  <p className="text-xs text-stone-500">Your verified customer identity</p>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-100 border border-stone-200 text-stone-600 text-[11px] font-bold">
                  <Lock size={12} className="text-stone-400" />
                  <span>Verified Account</span>
                </span>
              </div>

              {/* Informative Note regarding Edit Profile */}
              <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-2xl flex items-start gap-2.5 text-xs text-stone-600 leading-relaxed">
                <Info size={16} className="text-stone-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-stone-800 block mb-0.5">
                    Profile Modification Notice
                  </span>
                  <span>
                    Your registered name, email, and phone number are securely tied to your order history and loyalty ledger. Profile editing is currently view-only in compliance with backend API policies.
                  </span>
                </div>
              </div>

              {/* Read-Only Profile Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-stone-400 mb-1">
                    Full Name
                  </label>
                  <div className="px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-800 flex items-center justify-between">
                    <span>{user.full_name}</span>
                    <Lock size={12} className="text-stone-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-stone-400 mb-1">
                    Registered Email
                  </label>
                  <div className="px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-800 flex items-center justify-between">
                    <span>{user.email}</span>
                    <Lock size={12} className="text-stone-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-stone-400 mb-1">
                    Primary Phone Number
                  </label>
                  <div className="px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-800 flex items-center justify-between">
                    <span>{user.phone}</span>
                    <Lock size={12} className="text-stone-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-stone-400 mb-1">
                    User Role & Access
                  </label>
                  <div className="px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-800 capitalize flex items-center justify-between">
                    <span>{user.role}</span>
                    <Shield size={12} className="text-amber-700" />
                  </div>
                </div>
              </div>
            </div>

            {/* LOYALTY TRANSACTIONS LEDGER */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-stone-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-stone-900 tracking-tight">
                    Loyalty Activity Ledger
                  </h2>
                  <p className="text-xs text-stone-500">
                    Audit log of points earned on completed pickups and checkout redemptions
                  </p>
                </div>
                <Link
                  to="/loyalty"
                  className="text-xs font-bold text-amber-900 hover:underline flex items-center gap-1"
                >
                  <span>View Full Ledger</span>
                  <ArrowRight size={13} />
                </Link>
              </div>

              {isLoyaltyLoading ? (
                <div className="space-y-2.5">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-stone-100 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : loyaltyTransactions.length === 0 ? (
                <div className="p-8 text-center bg-stone-50 rounded-2xl border border-stone-100">
                  <Award size={28} className="mx-auto mb-2 text-stone-300" />
                  <p className="text-xs font-bold text-stone-600">No loyalty activity yet</p>
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    Place an order at any roastery outlet to begin earning points
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-stone-100">
                  {loyaltyTransactions.map((tx) => {
                    const reasonInfo = formatReason(tx.reason);
                    const isPositive = tx.points_change > 0;

                    return (
                      <div
                        key={tx.id}
                        className="py-3 flex items-center justify-between gap-4 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${reasonInfo.color}`}
                            >
                              {reasonInfo.label}
                            </span>
                            {tx.order_id && (
                              <Link
                                to={`/orders/${tx.order_id}`}
                                className="font-mono text-[11px] text-amber-900 hover:underline"
                              >
                                Order #{tx.order_id.slice(0, 8)}
                              </Link>
                            )}
                          </div>
                          <p className="text-[11px] text-stone-400">
                            {formatIST(tx.created_at)}
                          </p>
                        </div>

                        <div className="text-right">
                          <span
                            className={`font-black text-sm ${
                              isPositive ? 'text-emerald-700' : 'text-amber-800'
                            }`}
                          >
                            {isPositive ? `+${tx.points_change}` : tx.points_change} pts
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ORDER HISTORY SECTION */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-stone-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-stone-900 tracking-tight">
                    Order History
                  </h2>
                  <p className="text-xs text-stone-500">Your previous and ongoing coffee orders</p>
                </div>
                <Link
                  to="/orders"
                  className="text-xs font-bold text-amber-900 hover:underline flex items-center gap-1"
                >
                  <span>All Orders & Tracking</span>
                  <ArrowRight size={13} />
                </Link>
              </div>

              {isOrdersLoading ? (
                <div className="space-y-2.5">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-stone-100 rounded-2xl animate-pulse" />
                  ))}
                </div>
              ) : orders.length === 0 ? (
                <div className="p-8 text-center bg-stone-50 rounded-2xl border border-stone-100">
                  <ShoppingBag size={28} className="mx-auto mb-2 text-stone-300" />
                  <p className="text-xs font-bold text-stone-600">No orders placed yet</p>
                  <p className="text-[11px] text-stone-400 mt-0.5 mb-4">
                    Your freshly brewed pickups will appear here
                  </p>
                  <Link
                    to="/menu"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-900 text-white rounded-xl text-xs font-bold hover:bg-amber-950 transition"
                  >
                    <span>Explore Roastery Menu</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => {
                    const statusInfo = formatStatus(order.status);

                    return (
                      <div
                        key={order.id}
                        className="p-4 rounded-2xl border border-stone-200/80 hover:border-amber-800/40 bg-stone-50/50 hover:bg-white transition flex items-center justify-between gap-4 flex-wrap"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-stone-900 text-sm">
                              Order #{order.id.slice(0, 8)}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${statusInfo.color}`}
                            >
                              {statusInfo.label}
                            </span>
                          </div>
                          <p className="text-[11px] text-stone-500">
                            {formatIST(order.created_at)} • {order.items?.length || 0}{' '}
                            {(order.items?.length || 0) === 1 ? 'item' : 'items'}
                          </p>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <span className="text-xs text-stone-400 block">Total</span>
                            <span className="text-sm font-black text-stone-900">
                              {formatCurrency(order.final_payable)}
                            </span>
                          </div>

                          <Link
                            to={`/orders/${order.id}`}
                            className="p-2 rounded-xl bg-white border border-stone-200 hover:border-amber-800 text-amber-900 transition"
                            title="View Order Tracking"
                          >
                            <ArrowRight size={16} />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
