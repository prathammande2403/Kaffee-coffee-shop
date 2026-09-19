import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { Navbar } from '../components/Navbar';
import { useCartStore } from '../store/useCartStore';
import { formatCurrency, formatIST, formatTimeString } from '../utils/formatters';
import { OrderOut, Outlet } from '../types';
import {
  Clock,
  CheckCircle2,
  RotateCw,
  XCircle,
  Copy,
  Check,
  MapPin,
  Coffee,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';

export const OrderTrackingPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const loadItems = useCartStore((state) => state.loadItems);
  const [copied, setCopied] = useState<boolean>(false);

  // Poll active order state every 3 seconds with fallback to /orders
  const {
    data: order,
    isLoading,
    isError,
  } = useQuery<OrderOut>({
    queryKey: ['order', orderId],
    queryFn: async () => {
      try {
        const res = await api.get(`/orders/${orderId}`);
        if (res.data && res.data.id) return res.data;
      } catch {
        // Fallback if backend /orders/{order_id} has serialization issue
      }
      const myOrdersRes = await api.get('/orders');
      const match = (myOrdersRes.data || []).find((o: OrderOut) => o.id === orderId);
      if (match) return match;
      throw new Error('Order not found');
    },
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === 'COMPLETED' || s === 'CANCELLED' || s === 'REJECTED' ? false : 3000;
    },
    enabled: !!orderId,
  });

  // Fetch outlet details for address and prep time
  const { data: outlet } = useQuery<Outlet>({
    queryKey: ['outlet', order?.outlet_id],
    queryFn: async () => (await api.get(`/outlets/${order?.outlet_id}`)).data,
    enabled: !!order?.outlet_id,
  });

  // Customer Cancellation Mutation
  const cancelMutation = useMutation({
    mutationFn: async () => (await api.patch(`/orders/${orderId}/cancel`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      alert('Order cancelled successfully. Any redeemed loyalty points have been refunded to your account.');
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to cancel order.');
    },
  });

  // Repeat Previous Order Mutation
  const repeatMutation = useMutation({
    mutationFn: async () => (await api.post(`/orders/${orderId}/repeat`)).data,
    onSuccess: (data) => {
      loadItems(data.outlet_id, data.outlet_name, data.items);
      navigate('/checkout');
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to repeat this order');
    },
  });

  const handleCopyId = () => {
    if (!orderId) return;
    navigator.clipboard.writeText(orderId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Navbar />
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
          <div className="w-10 h-10 border-4 border-amber-800 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold text-stone-600">Retrieving order confirmation...</p>
        </div>
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Navbar />
        <div className="max-w-md mx-auto text-center py-20 px-4 space-y-4">
          <div className="w-16 h-16 bg-red-100 text-red-700 rounded-full flex items-center justify-center mx-auto">
            <XCircle size={32} />
          </div>
          <h2 className="text-xl font-bold text-stone-900">Order Not Found</h2>
          <p className="text-xs text-stone-500">
            We couldn&apos;t find an order matching this ID, or you might not have authorization to view it.
          </p>
          <Link
            to="/menu"
            className="inline-block px-6 py-2.5 bg-amber-900 text-white rounded-xl text-xs font-bold hover:bg-amber-950 transition"
          >
            Return to Menu
          </Link>
        </div>
      </div>
    );
  }

  const steps = [
    { key: 'ORDER_RECEIVED', label: 'Received', desc: 'Order sent to barista' },
    { key: 'PREPARING', label: 'Brewing', desc: 'Barista crafting drinks' },
    { key: 'READY_FOR_PICKUP', label: 'Ready', desc: 'Ready at counter' },
    { key: 'COMPLETED', label: 'Picked Up', desc: 'Order collected' },
  ];

  const currentStepIdx = steps.findIndex((s) => s.key === order.status);
  const isTerminalCancelled = order.status === 'CANCELLED';
  const isTerminalRejected = order.status === 'REJECTED';
  const isCompleted = order.status === 'COMPLETED';

  // Points earned calculation
  const pointsEarned = Math.floor(parseFloat(order.final_payable) / 10);

  return (
    <div className="min-h-screen bg-stone-50 pb-16">
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-semibold text-stone-500">
          <Link to="/menu" className="hover:text-amber-900 transition">
            Menu
          </Link>
          <ChevronRight size={12} />
          <Link to="/profile" className="hover:text-amber-900 transition">
            Order History
          </Link>
          <ChevronRight size={12} />
          <span className="text-stone-900 font-bold">Order Details</span>
        </div>

        {/* Top Celebratory Card */}
        <div className="bg-white rounded-3xl border border-stone-200/90 p-6 sm:p-7 shadow-sm space-y-6 text-center">
          <div>
            {!isTerminalCancelled && !isTerminalRejected ? (
              <div className="w-14 h-14 bg-emerald-100/70 text-emerald-800 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
                <CheckCircle2 size={32} />
              </div>
            ) : (
              <div className="w-14 h-14 bg-rose-100 text-rose-800 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
                <XCircle size={32} />
              </div>
            )}

            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-950 font-mono text-[11px] font-extrabold rounded-full border border-amber-200/80">
              <span>Order #{order.id.slice(0, 8)}</span>
              <button
                type="button"
                onClick={handleCopyId}
                title="Copy Full Order ID"
                className="hover:text-amber-700 transition"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </button>
            </span>

            <h1 className="text-2xl sm:text-3xl font-serif font-black text-stone-900 mt-2.5 capitalize">
              {order.status === 'ORDER_RECEIVED'
                ? 'Order Confirmed!'
                : order.status.replace(/_/g, ' ').toLowerCase()}
            </h1>
            <p className="text-xs text-stone-500 mt-1">Placed on {formatIST(order.created_at)}</p>
          </div>

          {/* Stepper (for Active Progression) */}
          {!isTerminalCancelled && !isTerminalRejected && (
            <div className="py-2">
              <div className="flex items-center justify-between relative px-2 sm:px-6">
                {/* Connecting background line */}
                <div className="absolute left-6 right-6 top-4 h-0.5 bg-stone-200 -z-0" />
                <div
                  className="absolute left-6 top-4 h-0.5 bg-amber-900 transition-all duration-500 -z-0"
                  style={{
                    width: `${Math.max(0, (currentStepIdx / (steps.length - 1)) * 88)}%`,
                  }}
                />

                {steps.map((step, idx) => {
                  const isDone = idx < currentStepIdx;
                  const isCurrent = idx === currentStepIdx;

                  return (
                    <div key={step.key} className="flex flex-col items-center relative z-10">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs ${
                          isCurrent
                            ? 'bg-amber-900 text-white ring-4 ring-amber-100 scale-110'
                            : isDone
                            ? 'bg-amber-800 text-white'
                            : 'bg-white text-stone-400 border border-stone-300'
                        }`}
                      >
                        {isDone ? <Check size={14} strokeWidth={3} /> : idx + 1}
                      </div>
                      <span
                        className={`text-[11px] mt-2 font-bold ${
                          isCurrent
                            ? 'text-amber-950'
                            : isDone
                            ? 'text-stone-800'
                            : 'text-stone-400'
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Terminal cancellation callout */}
          {isTerminalCancelled && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-center justify-center gap-2">
              <AlertTriangle size={16} />
              <span>This order has been cancelled and refunded.</span>
            </div>
          )}

          {/* Terminal rejection callout */}
          {isTerminalRejected && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-center justify-center gap-2">
              <AlertTriangle size={16} />
              <span>This order was rejected by the outlet and refunded.</span>
            </div>
          )}

          {/* Pickup Timing & Outlet Card */}
          <div className="p-4 sm:p-5 bg-stone-50 rounded-2xl border border-stone-200 text-left space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-stone-400 uppercase tracking-wider">
                Pickup Destination
              </span>
              <span className="text-xs font-bold text-amber-900 bg-white border border-stone-200 px-2.5 py-0.5 rounded-full">
                {order.pickup_type === 'immediate' ? 'Immediate Pickup' : 'Scheduled Pickup'}
              </span>
            </div>

            <div className="space-y-1">
              <h3 className="font-extrabold text-stone-900 text-base">
                {outlet?.name || 'Artisan Roastery'}
              </h3>
              <p className="text-xs text-stone-500 flex items-start gap-1">
                <MapPin size={13} className="shrink-0 text-stone-400 mt-0.5" />
                <span>{outlet?.address || 'Pickup Counter'}</span>
              </p>
            </div>

            <div className="pt-2 border-t border-stone-200/70 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-stone-700 font-semibold">
                <Clock size={14} className="text-amber-800" />
                <span>
                  {order.pickup_type === 'immediate'
                    ? `Ready in ~${outlet?.avg_prep_minutes || 12} mins from order time`
                    : `Scheduled for: ${formatIST(order.scheduled_pickup_time)}`}
                </span>
              </div>
              {outlet?.opening_time && (
                <span className="text-[11px] text-stone-400">
                  Hours: {formatTimeString(outlet.opening_time)} –{' '}
                  {formatTimeString(outlet.closing_time)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Itemized Receipt Card */}
        <div className="bg-white rounded-3xl border border-stone-200/90 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <h2 className="text-sm font-black text-stone-900 uppercase tracking-wider">
              Ordered Items
            </h2>
            <span className="text-xs text-stone-500 font-medium">
              {order.items.reduce((s, i) => s + i.quantity, 0)} items total
            </span>
          </div>

          <div className="divide-y divide-stone-100">
            {order.items.map((item) => (
              <div key={item.id} className="py-3 flex justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="font-bold text-stone-900 text-sm">
                    {item.quantity}x {item.product_name}
                  </div>
                  {item.selected_modifiers && item.selected_modifiers.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.selected_modifiers.map((m, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-stone-100 text-stone-600 rounded-md text-[10px] font-medium"
                        >
                          {m.option_name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <span className="font-bold text-stone-900">{formatCurrency(item.total_price)}</span>
                  <div className="text-[10px] text-stone-400 font-mono">
                    {item.quantity} × {formatCurrency(item.unit_price)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Financial Breakdown */}
          <div className="pt-3 border-t border-stone-100 space-y-2 text-xs text-stone-600">
            <div className="flex justify-between items-center">
              <span>Subtotal</span>
              <span className="font-bold text-stone-900">{formatCurrency(order.subtotal)}</span>
            </div>

            <div className="flex justify-between items-center">
              <span>GST (5%)</span>
              <span className="font-bold text-stone-900">{formatCurrency(order.tax)}</span>
            </div>

            {parseFloat(order.discount_amount) > 0 && (
              <div className="flex justify-between items-center text-green-700 font-bold bg-green-50 p-2 rounded-xl border border-green-200">
                <span>Loyalty Discount ({order.points_redeemed} pts)</span>
                <span>-{formatCurrency(order.discount_amount)}</span>
              </div>
            )}

            <div className="pt-2 border-t border-stone-200 flex justify-between items-baseline">
              <div>
                <span className="font-black text-stone-900 text-sm block">Total Paid</span>
                <span className="text-[10px] text-stone-400 font-mono">
                  Payment Status: {order.payment_status}
                </span>
              </div>
              <span className="text-xl font-serif font-black text-stone-900">
                {formatCurrency(order.final_payable)}
              </span>
            </div>
          </div>

          {/* Points earned callout */}
          {pointsEarned > 0 && (
            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200/80 flex items-center gap-2 text-amber-950 text-xs font-semibold">
              <Sparkles size={15} className="text-amber-800 shrink-0" />
              <span>
                {isCompleted
                  ? `You earned +${pointsEarned} loyalty points on this completed order!`
                  : `You will earn +${pointsEarned} loyalty points once your order is collected!`}
              </span>
            </div>
          )}
        </div>

        {/* Order Actions */}
        <div className="space-y-3 pt-2">
          {order.status === 'ORDER_RECEIVED' && (
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    'Are you sure you want to cancel this order? Any loyalty points used will be refunded to your account immediately.'
                  )
                ) {
                  cancelMutation.mutate();
                }
              }}
              disabled={cancelMutation.isPending}
              className="w-full py-3.5 rounded-2xl border border-red-200 text-red-700 hover:bg-red-50 text-xs font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <XCircle size={16} />
              <span>{cancelMutation.isPending ? 'Cancelling Order...' : 'Cancel This Order'}</span>
            </button>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => repeatMutation.mutate()}
              disabled={repeatMutation.isPending}
              className="py-3 px-4 rounded-2xl bg-amber-900 hover:bg-amber-950 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              <RotateCw size={14} className={repeatMutation.isPending ? 'animate-spin' : ''} />
              <span>Repeat Order</span>
            </button>

            <Link
              to="/menu"
              className="py-3 px-4 rounded-2xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 text-xs font-bold transition flex items-center justify-center gap-2 text-center"
            >
              <Coffee size={14} />
              <span>Explore More Coffee</span>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default OrderTrackingPage;