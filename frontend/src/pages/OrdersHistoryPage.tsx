import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { Navbar } from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { useCartStore } from '../store/useCartStore';
import { formatCurrency, formatIST } from '../utils/formatters';
import { OrderOut, OrderStatus } from '../types';
import {
  Clock,
  CheckCircle2,
  XCircle,
  RotateCw,
  Search,
  ChevronRight,
  Coffee,
  Copy,
  Check,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  MapPin,
  Calendar,
} from 'lucide-react';

export const OrdersHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const loadItems = useCartStore((state) => state.loadItems);

  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Poll orders list every 3000ms for real-time live status updates
  const {
    data: orders = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery<OrderOut[]>({
    queryKey: ['my-orders'],
    queryFn: async () => {
      const res = await api.get('/orders');
      return res.data;
    },
    refetchInterval: (query) => {
      // If there are any active orders, poll every 3 seconds; otherwise every 10 seconds
      const hasActiveOrders = query.state.data?.some(
        (o) =>
          o.status === 'ORDER_RECEIVED' ||
          o.status === 'PREPARING' ||
          o.status === 'READY_FOR_PICKUP'
      );
      return hasActiveOrders ? 3000 : 10000;
    },
    enabled: !!user,
  });

  // Cancel order mutation
  const cancelMutation = useMutation({
    mutationFn: async (orderId: string) => {
      return (await api.patch(`/orders/${orderId}/cancel`)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-orders'] });
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      alert('Order cancelled successfully. Any redeemed loyalty points have been refunded.');
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to cancel order.');
    },
  });

  // Repeat previous order mutation
  const repeatMutation = useMutation({
    mutationFn: async (orderId: string) => {
      return (await api.post(`/orders/${orderId}/repeat`)).data;
    },
    onSuccess: (data) => {
      loadItems(data.outlet_id, data.outlet_name, data.items);
      navigate('/checkout');
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to repeat this order');
    },
  });

  const handleCopyId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper for status styling reflecting exact API_CONTRACT.md enum values
  const getStatusMeta = (status: OrderStatus) => {
    switch (status) {
      case 'ORDER_RECEIVED':
        return {
          label: 'Order Received',
          dotColor: 'bg-amber-500 animate-ping',
          badgeClass: 'bg-amber-50 text-amber-900 border-amber-200/80',
          stepIndex: 0,
        };
      case 'PREPARING':
        return {
          label: 'Brewing & Preparing',
          dotColor: 'bg-orange-500 animate-pulse',
          badgeClass: 'bg-orange-50 text-orange-900 border-orange-200/80',
          stepIndex: 1,
        };
      case 'READY_FOR_PICKUP':
        return {
          label: 'Ready for Pickup!',
          dotColor: 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]',
          badgeClass: 'bg-blue-50 text-blue-900 border-blue-200 font-black',
          stepIndex: 2,
        };
      case 'COMPLETED':
        return {
          label: 'Completed',
          dotColor: 'bg-emerald-500',
          badgeClass: 'bg-emerald-50 text-emerald-900 border-emerald-200/80',
          stepIndex: 3,
        };
      case 'CANCELLED':
        return {
          label: 'Cancelled',
          dotColor: 'bg-stone-400',
          badgeClass: 'bg-stone-100 text-stone-600 border-stone-200',
          stepIndex: -1,
        };
      case 'REJECTED':
        return {
          label: 'Declined',
          dotColor: 'bg-rose-500',
          badgeClass: 'bg-rose-50 text-rose-900 border-rose-200',
          stepIndex: -1,
        };
      default:
        return {
          label: status,
          dotColor: 'bg-stone-400',
          badgeClass: 'bg-stone-100 text-stone-700 border-stone-200',
          stepIndex: -1,
        };
    }
  };

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Tab filter
      if (activeTab === 'active') {
        if (
          order.status !== 'ORDER_RECEIVED' &&
          order.status !== 'PREPARING' &&
          order.status !== 'READY_FOR_PICKUP'
        ) {
          return false;
        }
      } else if (activeTab === 'completed') {
        if (order.status !== 'COMPLETED') return false;
      } else if (activeTab === 'cancelled') {
        if (order.status !== 'CANCELLED' && order.status !== 'REJECTED') return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesId = order.id.toLowerCase().includes(q);
        const matchesItems = order.items.some((i) =>
          i.product_name.toLowerCase().includes(q)
        );
        return matchesId || matchesItems;
      }

      return true;
    });
  }, [orders, activeTab, searchQuery]);

  const activeCount = useMemo(() => {
    return orders.filter(
      (o) =>
        o.status === 'ORDER_RECEIVED' ||
        o.status === 'PREPARING' ||
        o.status === 'READY_FOR_PICKUP'
    ).length;
  }, [orders]);

  return (
    <div className="min-h-screen bg-stone-50 selection:bg-amber-200 selection:text-amber-950 flex flex-col pb-16">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-8 flex-1 w-full space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-stone-500 mb-1">
              <Link to="/menu" className="hover:text-amber-900 transition">
                Menu
              </Link>
              <ChevronRight size={12} />
              <span className="text-stone-900 font-bold">My Orders</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-black text-stone-900">
              Orders & Status Tracking
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {activeCount > 0 && (
              <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-900 rounded-full text-xs font-bold border border-amber-200">
                <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping" />
                <span>{activeCount} Active Now</span>
              </span>
            )}

            <button
              onClick={() => refetch()}
              disabled={isRefetching}
              title="Refresh live status"
              className="p-2 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 text-stone-600 transition"
            >
              <RotateCw size={16} className={isRefetching ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="flex items-center gap-1.5 p-1 bg-stone-200/60 rounded-2xl w-full sm:w-auto overflow-x-auto">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                activeTab === 'all'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              All ({orders.length})
            </button>
            <button
              onClick={() => setActiveTab('active')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'active'
                  ? 'bg-white text-amber-950 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {activeCount > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
              )}
              <span>Active ({activeCount})</span>
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                activeTab === 'completed'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Completed
            </button>
            <button
              onClick={() => setActiveTab('cancelled')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                activeTab === 'cancelled'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Cancelled
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
            />
            <input
              type="text"
              placeholder="Search by order ID or item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-xs bg-white border border-stone-200 rounded-xl outline-none focus:border-amber-800 transition"
            />
          </div>
        </div>

        {/* Orders List */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <div className="w-8 h-8 border-3 border-amber-900 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-bold text-stone-500">Loading your order history...</span>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-3xl border border-stone-200/90 p-12 text-center space-y-4 shadow-xs">
            <div className="w-16 h-16 bg-stone-100 text-stone-400 rounded-2xl flex items-center justify-center mx-auto">
              <Coffee size={28} />
            </div>
            <h3 className="font-bold text-stone-800 text-base">No Orders Found</h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              {searchQuery
                ? `No orders matching "${searchQuery}". Try searching for another item or clear your search filter.`
                : activeTab === 'active'
                ? 'You do not have any orders actively brewing right now. Explore our artisanal menu to place one!'
                : 'You have not placed any orders yet. Try our single-origin pour-overs or specialty espresso!'}
            </p>
            <Link
              to="/menu"
              className="inline-block px-6 py-2.5 bg-amber-900 hover:bg-amber-950 text-white rounded-xl text-xs font-bold transition shadow-xs"
            >
              Explore Artisanal Menu
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const statusMeta = getStatusMeta(order.status);
              const isActive =
                order.status === 'ORDER_RECEIVED' ||
                order.status === 'PREPARING' ||
                order.status === 'READY_FOR_PICKUP';

              return (
                <div
                  key={order.id}
                  className={`bg-white rounded-3xl border transition shadow-xs hover:shadow-md p-5 sm:p-6 space-y-4 ${
                    isActive
                      ? 'border-amber-900/30 ring-1 ring-amber-900/10'
                      : 'border-stone-200/80'
                  }`}
                >
                  {/* Card Header: ID, Date, Status Badge */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-stone-900">
                        Order #{order.id.slice(0, 8)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleCopyId(order.id, e)}
                        title="Copy full Order ID"
                        className="text-stone-400 hover:text-stone-700 transition"
                      >
                        {copiedId === order.id ? (
                          <Check size={13} className="text-green-600" />
                        ) : (
                          <Copy size={13} />
                        )}
                      </button>
                      <span className="text-stone-300">•</span>
                      <span className="text-xs text-stone-500">{formatIST(order.created_at)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusMeta.badgeClass}`}
                      >
                        <span className={`w-2 h-2 rounded-full ${statusMeta.dotColor}`} />
                        <span>{statusMeta.label}</span>
                      </span>
                    </div>
                  </div>

                  {/* Active Order Progress Stepper Bar */}
                  {isActive && statusMeta.stepIndex >= 0 && (
                    <div className="p-3.5 bg-amber-50/50 rounded-2xl border border-amber-200/60 space-y-2">
                      <div className="flex justify-between text-[11px] font-bold text-stone-600">
                        <span className="text-amber-950 flex items-center gap-1">
                          <Sparkles size={12} />
                          <span>Live Brewing Status</span>
                        </span>
                        <span className="text-stone-500">Auto-refreshing</span>
                      </div>
                      <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden relative">
                        <div
                          className="bg-amber-900 h-full rounded-full transition-all duration-700"
                          style={{
                            width:
                              statusMeta.stepIndex === 0
                                ? '25%'
                                : statusMeta.stepIndex === 1
                                ? '60%'
                                : '100%',
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-stone-400 font-semibold px-0.5">
                        <span
                          className={statusMeta.stepIndex >= 0 ? 'text-amber-950 font-bold' : ''}
                        >
                          1. Received
                        </span>
                        <span
                          className={statusMeta.stepIndex >= 1 ? 'text-amber-950 font-bold' : ''}
                        >
                          2. Brewing
                        </span>
                        <span
                          className={statusMeta.stepIndex >= 2 ? 'text-amber-950 font-bold' : ''}
                        >
                          3. Ready at Counter
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Pickup mode banner */}
                  <div className="flex items-center gap-2 text-xs text-stone-600">
                    <Clock size={14} className="text-amber-800" />
                    <span>
                      {order.pickup_type === 'immediate'
                        ? 'Immediate Order (Brew on receipt)'
                        : `Scheduled Pickup for: ${formatIST(order.scheduled_pickup_time)}`}
                    </span>
                  </div>

                  {/* Items Summary */}
                  <div className="divide-y divide-stone-100 bg-stone-50/70 rounded-2xl p-3.5 border border-stone-200/60">
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className="py-2 first:pt-0 last:pb-0 flex justify-between items-start text-xs"
                      >
                        <div>
                          <span className="font-bold text-stone-800">
                            {item.quantity}x {item.product_name}
                          </span>
                          {item.selected_modifiers && item.selected_modifiers.length > 0 && (
                            <div className="text-[11px] text-stone-500 flex flex-wrap gap-1 mt-0.5">
                              {item.selected_modifiers.map((m, idx) => (
                                <span key={idx} className="bg-white px-1.5 py-0.5 rounded border border-stone-200">
                                  {m.option_name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <span className="font-bold text-stone-900">
                          {formatCurrency(item.total_price)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Financial Footer & Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                    <div className="text-xs">
                      <span className="text-stone-500">Paid: </span>
                      <strong className="text-stone-900 text-sm font-serif font-black">
                        {formatCurrency(order.final_payable)}
                      </strong>
                      {order.points_redeemed > 0 && (
                        <span className="text-[11px] text-green-700 ml-2 font-semibold">
                          ({order.points_redeemed} pts redeemed)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Customer cancel if order is received */}
                      {order.status === 'ORDER_RECEIVED' && (
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                'Cancel this order? Any points used will be refunded to your account immediately.'
                              )
                            ) {
                              cancelMutation.mutate(order.id);
                            }
                          }}
                          disabled={cancelMutation.isPending}
                          className="px-3 py-1.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold transition disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      )}

                      {/* Repeat previous order */}
                      <button
                        type="button"
                        onClick={() => repeatMutation.mutate(order.id)}
                        disabled={repeatMutation.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-xl border border-stone-200 transition disabled:opacity-50"
                        title="Reconstitute this order's items into cart"
                      >
                        <RotateCw
                          size={13}
                          className={repeatMutation.isPending ? 'animate-spin' : ''}
                        />
                        <span>Repeat Order</span>
                      </button>

                      {/* View detailed tracker */}
                      <button
                        type="button"
                        onClick={() => navigate(`/orders/${order.id}`)}
                        className="flex items-center gap-1 px-3.5 py-1.5 bg-amber-900 hover:bg-amber-950 text-white text-xs font-bold rounded-xl transition shadow-xs"
                      >
                        <span>Track Live</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default OrdersHistoryPage;
