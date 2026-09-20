import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Navbar } from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatIST, formatTimeString } from '../utils/formatters';
import { OrderOut, OrderStatus, Product, Outlet } from '../types';
import {
  Check,
  X,
  ArrowRight,
  Shield,
  Coffee,
  Calendar,
  Clock,
  RotateCw,
  Search,
  Filter,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  ChevronRight,
  Tag,
  Eye,
  Store,
  Layers,
} from 'lucide-react';

export const StaffDashboardPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Navigation tab: orders vs menu management
  const [activeTab, setActiveTab] = useState<'orders' | 'menu'>('orders');

  // Orders tab state
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [orderSearch, setOrderSearch] = useState<string>('');
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<OrderOut | null>(null);

  // Reject modal state
  const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');

  // Menu tab state
  const [selectedOutletFilter, setSelectedOutletFilter] = useState<string>('');
  const [menuCategoryFilter, setMenuCategoryFilter] = useState<string>('all');
  const [menuSearch, setMenuSearch] = useState<string>('');
  const [isAddProductOpen, setIsAddProductOpen] = useState<boolean>(false);

  // Form state for creating new product
  const [newProdName, setNewProdName] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('hot_coffee');
  const [newProdDesc, setNewProdDesc] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('220');
  const [newProdImage, setNewProdImage] = useState('');
  const [newProdModifiers, setNewProdModifiers] = useState<
    Array<{ modifier_group: string; option_name: string; price_delta: string }>
  >([
    { modifier_group: 'size', option_name: 'Regular (250ml)', price_delta: '0' },
    { modifier_group: 'size', option_name: 'Large (350ml)', price_delta: '50' },
  ]);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch all staff orders with live 3-second polling
  const {
    data: orders = [],
    isLoading: isOrdersLoading,
    refetch: refetchOrders,
    isRefetching: isOrdersRefetching,
  } = useQuery<OrderOut[]>({
    queryKey: ['staff-orders'],
    queryFn: async () => (await api.get('/staff/orders')).data,
    refetchInterval: 3000,
    enabled: !!user && (user.role === 'staff' || user.role === 'admin'),
  });

  // Fetch all outlets for stock override selection
  const { data: outlets = [] } = useQuery<Outlet[]>({
    queryKey: ['outlets'],
    queryFn: async () => (await api.get('/outlets')).data,
    enabled: !!user && (user.role === 'staff' || user.role === 'admin'),
  });

  // Fetch menu for menu management
  const {
    data: products = [],
    isLoading: isMenuLoading,
    refetch: refetchMenu,
  } = useQuery<Product[]>({
    queryKey: ['staff-menu', selectedOutletFilter],
    queryFn: async () => {
      const url = selectedOutletFilter
        ? `/menu?outlet_id=${selectedOutletFilter}`
        : '/menu';
      return (await api.get(url)).data;
    },
    enabled: !!user && (user.role === 'staff' || user.role === 'admin'),
  });

  // Order Decision Mutation (ACCEPT / REJECT)
  const decisionMutation = useMutation({
    mutationFn: async ({
      orderId,
      action,
      reason,
    }: {
      orderId: string;
      action: 'ACCEPT' | 'REJECT';
      reason?: string;
    }) => {
      return (
        await api.patch(`/staff/orders/${orderId}/decision`, {
          action,
          rejection_reason: reason || undefined,
        })
      ).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-orders'] });
      setRejectingOrderId(null);
      setRejectionReason('');
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to process order decision');
    },
  });

  // Order Status State Machine Mutation
  const statusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      return (await api.patch(`/staff/orders/${orderId}/status`, { status })).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-orders'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to update order status');
    },
  });

  // Global Product Availability Mutation
  const availabilityMutation = useMutation({
    mutationFn: async ({ productId, isAvailable }: { productId: string; isAvailable: boolean }) => {
      return (
        await api.patch(`/staff/products/${productId}/availability`, {
          is_available: isAvailable,
        })
      ).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-menu'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to update product availability');
    },
  });

  // Outlet-Specific Product Availability Mutation
  const outletStockMutation = useMutation({
    mutationFn: async ({
      productId,
      outletId,
      isAvailable,
    }: {
      productId: string;
      outletId: string;
      isAvailable: boolean;
    }) => {
      return (
        await api.patch(`/staff/products/${productId}/outlet-availability`, {
          outlet_id: outletId,
          is_available: isAvailable,
        })
      ).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-menu'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to update outlet stock');
    },
  });

  // Create New Product Mutation
  const createProductMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        category: newProdCategory,
        name: newProdName.trim(),
        description: newProdDesc.trim() || undefined,
        base_price: parseFloat(newProdPrice),
        image_url: newProdImage.trim() || undefined,
        modifiers: newProdModifiers
          .filter((m) => m.option_name.trim())
          .map((m) => ({
            modifier_group: m.modifier_group.trim(),
            option_name: m.option_name.trim(),
            price_delta: parseFloat(m.price_delta) || 0,
          })),
      };
      return (await api.post('/staff/products', payload)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-menu'] });
      setIsAddProductOpen(false);
      setNewProdName('');
      setNewProdDesc('');
      setNewProdPrice('220');
      setNewProdImage('');
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to add new product');
    },
  });

  // Delete Product Mutation
  const deleteProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      return (await api.delete(`/staff/products/${productId}`)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-menu'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to delete product');
    },
  });

  const handleCopyId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper for status badge styling
  const getStatusMeta = (status: string) => {
    switch (status) {
      case 'ORDER_RECEIVED':
        return {
          label: 'Incoming (New)',
          color: 'bg-amber-50 text-amber-950 border-amber-300 font-extrabold',
          badgeText: 'Action Required',
          dot: 'bg-amber-500 animate-ping',
        };
      case 'PREPARING':
        return {
          label: 'Brewing & Preparing',
          color: 'bg-orange-50 text-orange-900 border-orange-200 font-bold',
          badgeText: 'In Progress',
          dot: 'bg-orange-500 animate-pulse',
        };
      case 'READY_FOR_PICKUP':
        return {
          label: 'Ready for Pickup',
          color: 'bg-blue-50 text-blue-900 border-blue-200 font-bold',
          badgeText: 'At Counter',
          dot: 'bg-blue-500',
        };
      case 'COMPLETED':
        return {
          label: 'Completed',
          color: 'bg-emerald-50 text-emerald-900 border-emerald-200 font-bold',
          badgeText: 'Collected',
          dot: 'bg-emerald-500',
        };
      case 'CANCELLED':
        return {
          label: 'Cancelled',
          color: 'bg-stone-100 text-stone-600 border-stone-200 font-medium',
          badgeText: 'Cancelled',
          dot: 'bg-stone-400',
        };
      case 'REJECTED':
        return {
          label: 'Declined',
          color: 'bg-rose-50 text-rose-900 border-rose-200 font-medium',
          badgeText: 'Declined',
          dot: 'bg-rose-500',
        };
      default:
        return {
          label: status,
          color: 'bg-stone-100 text-stone-700 border-stone-200 font-medium',
          badgeText: status,
          dot: 'bg-stone-400',
        };
    }
  };

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (statusFilter !== 'all') {
        if (statusFilter === 'incoming' && order.status !== 'ORDER_RECEIVED') return false;
        if (statusFilter === 'preparing' && order.status !== 'PREPARING') return false;
        if (statusFilter === 'ready' && order.status !== 'READY_FOR_PICKUP') return false;
        if (statusFilter === 'completed' && order.status !== 'COMPLETED') return false;
        if (
          statusFilter === 'cancelled' &&
          order.status !== 'CANCELLED' &&
          order.status !== 'REJECTED'
        ) {
          return false;
        }
      }

      if (orderSearch.trim()) {
        const q = orderSearch.toLowerCase().trim();
        const matchesId = order.id.toLowerCase().includes(q);
        const matchesCustomer = (order.customer_name || '').toLowerCase().includes(q);
        const matchesItem = order.items.some((i) =>
          i.product_name.toLowerCase().includes(q)
        );
        return matchesId || matchesCustomer || matchesItem;
      }

      return true;
    });
  }, [orders, statusFilter, orderSearch]);

  // Filtered menu products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (menuCategoryFilter !== 'all' && p.category !== menuCategoryFilter) {
        return false;
      }
      if (menuSearch.trim()) {
        const q = menuSearch.toLowerCase().trim();
        return (
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [products, menuCategoryFilter, menuSearch]);

  const incomingCount = orders.filter((o) => o.status === 'ORDER_RECEIVED').length;
  const preparingCount = orders.filter((o) => o.status === 'PREPARING').length;
  const readyCount = orders.filter((o) => o.status === 'READY_FOR_PICKUP').length;

  return (
    <div className="min-h-screen bg-stone-100 selection:bg-amber-200 selection:text-amber-950 flex flex-col pb-20">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 py-6 sm:py-8 flex-1 w-full space-y-6">
        {/* Admin Header & Mode Switcher */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-stone-900 text-white rounded-2xl shadow-sm">
              <Shield size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-serif font-black text-stone-900">
                  Staff & Admin Portal
                </h1>
                <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 rounded-full text-[10px] font-black uppercase tracking-wider">
                  {user?.role}
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Logged in as <strong>{user?.full_name}</strong> ({user?.email})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/menu"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-stone-300 text-xs font-bold text-stone-700 hover:bg-stone-50 transition"
            >
              <Store size={14} />
              <span>Customer View</span>
            </Link>

            <button
              onClick={() => {
                refetchOrders();
                refetchMenu();
              }}
              disabled={isOrdersRefetching}
              className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl transition"
              title="Refresh all data"
            >
              <RotateCw size={16} className={isOrdersRefetching ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Top Level Tabs: Orders Board vs Menu Management */}
        <div className="flex items-center gap-2 border-b border-stone-200 pb-2">
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition flex items-center gap-2 ${
              activeTab === 'orders'
                ? 'bg-amber-900 text-white shadow-sm'
                : 'bg-white text-stone-600 hover:bg-stone-50 border border-stone-200'
            }`}
          >
            <Coffee size={16} />
            <span>Kitchen Orders Board</span>
            {incomingCount > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-amber-600 text-white rounded-full text-[10px] font-extrabold animate-pulse">
                {incomingCount} New
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('menu')}
            className={`px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition flex items-center gap-2 ${
              activeTab === 'menu'
                ? 'bg-amber-900 text-white shadow-sm'
                : 'bg-white text-stone-600 hover:bg-stone-50 border border-stone-200'
            }`}
          >
            <Layers size={16} />
            <span>Menu & Stock Management</span>
          </button>
        </div>

        {/* TAB 1: KITCHEN ORDERS BOARD */}
        {activeTab === 'orders' && (
          <div className="space-y-6 animate-fade-in">
            {/* Filter Bar & Search */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="flex items-center gap-1.5 p-1 bg-stone-200/60 rounded-2xl w-full sm:w-auto overflow-x-auto">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    statusFilter === 'all'
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  All ({orders.length})
                </button>
                <button
                  onClick={() => setStatusFilter('incoming')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1 ${
                    statusFilter === 'incoming'
                      ? 'bg-amber-900 text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <span>Incoming</span>
                  {incomingCount > 0 && (
                    <span className="px-1.5 py-0.2 bg-amber-600 text-white rounded-full text-[10px]">
                      {incomingCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setStatusFilter('preparing')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1 ${
                    statusFilter === 'preparing'
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <span>Brewing ({preparingCount})</span>
                </button>
                <button
                  onClick={() => setStatusFilter('ready')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1 ${
                    statusFilter === 'ready'
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <span>Ready ({readyCount})</span>
                </button>
                <button
                  onClick={() => setStatusFilter('completed')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    statusFilter === 'completed'
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Completed
                </button>
                <button
                  onClick={() => setStatusFilter('cancelled')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    statusFilter === 'cancelled'
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Cancelled/Rejected
                </button>
              </div>

              <div className="relative w-full sm:w-64">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                />
                <input
                  type="text"
                  placeholder="Search customer, order ID or item..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 text-xs bg-white border border-stone-300 rounded-xl outline-none focus:border-amber-800"
                />
              </div>
            </div>

            {/* Orders Grid */}
            {isOrdersLoading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-3">
                <div className="w-8 h-8 border-3 border-amber-900 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-bold text-stone-500">
                  Loading kitchen orders...
                </span>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="bg-white rounded-3xl border border-stone-200 p-12 text-center space-y-3">
                <Coffee size={32} className="mx-auto text-stone-300" />
                <h3 className="font-bold text-stone-800 text-sm">No Orders in this View</h3>
                <p className="text-xs text-stone-400">
                  New pickup orders from customers will appear here in real-time.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredOrders.map((order) => {
                  const meta = getStatusMeta(order.status);
                  const isScheduled = order.pickup_type === 'scheduled';

                  return (
                    <div
                      key={order.id}
                      className={`bg-white rounded-3xl p-5 border flex flex-col justify-between transition-all shadow-xs hover:shadow-md ${
                        order.status === 'ORDER_RECEIVED'
                          ? 'border-amber-400 ring-2 ring-amber-400/20'
                          : order.status === 'READY_FOR_PICKUP'
                          ? 'border-blue-400'
                          : 'border-stone-200'
                      }`}
                    >
                      <div className="space-y-3">
                        {/* Header: ID, Copy, Status Badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs font-bold text-stone-900">
                                #{order.id.slice(0, 8)}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleCopyId(order.id, e)}
                                title="Copy ID"
                                className="text-stone-400 hover:text-stone-700"
                              >
                                {copiedId === order.id ? (
                                  <Check size={12} className="text-green-600" />
                                ) : (
                                  <Copy size={12} />
                                )}
                              </button>
                            </div>
                            <span className="text-xs font-bold text-stone-800 block mt-0.5">
                              {order.customer_name || 'Customer'}
                            </span>
                            <span className="text-[11px] text-stone-400 block mt-0.5">
                              {formatIST(order.created_at)}
                            </span>
                          </div>

                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] border ${meta.color}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                            <span>{meta.label}</span>
                          </span>
                        </div>

                        {/* Scheduled vs Immediate Pickup Banner */}
                        <div
                          className={`p-2 rounded-xl text-xs flex items-center gap-1.5 ${
                            isScheduled
                              ? 'bg-amber-50 border border-amber-200/80 text-amber-950 font-bold'
                              : 'bg-stone-100 text-stone-700 font-semibold'
                          }`}
                        >
                          {isScheduled ? (
                            <>
                              <Calendar size={13} className="text-amber-800 shrink-0" />
                              <span className="truncate">
                                Sched: {formatIST(order.scheduled_pickup_time)}
                              </span>
                            </>
                          ) : (
                            <>
                              <Clock size={13} className="text-stone-500 shrink-0" />
                              <span>Brew Now (Immediate Pickup)</span>
                            </>
                          )}
                        </div>

                        {/* Items Breakdown */}
                        <div className="divide-y divide-stone-100 border-t border-b border-stone-100 py-2 space-y-1.5">
                          {order.items.map((item) => (
                            <div key={item.id} className="pt-1.5 first:pt-0 text-xs">
                              <div className="flex justify-between font-bold text-stone-900">
                                <span>
                                  {item.quantity}x {item.product_name}
                                </span>
                                <span>{formatCurrency(item.total_price)}</span>
                              </div>
                              {item.selected_modifiers && item.selected_modifiers.length > 0 && (
                                <div className="text-[11px] text-stone-500 pl-3 pt-0.5">
                                  {item.selected_modifiers
                                    .map((m) => m.option_name)
                                    .join(', ')}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Payment & Customer Summary */}
                        <div className="flex justify-between items-center text-xs">
                          <div>
                            <span className="text-stone-400 block text-[11px]">Payable</span>
                            <span className="font-extrabold text-stone-900 text-sm">
                              {formatCurrency(order.final_payable)}
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="text-stone-400 block text-[11px]">Payment</span>
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                                order.payment_status === 'PAID'
                                  ? 'bg-green-50 text-green-700'
                                  : 'bg-stone-100 text-stone-600'
                              }`}
                            >
                              {order.payment_status}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* State Machine Transition Actions */}
                      <div className="mt-4 pt-3 border-t border-stone-100 space-y-2">
                        {order.status === 'ORDER_RECEIVED' ? (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                decisionMutation.mutate({
                                  orderId: order.id,
                                  action: 'ACCEPT',
                                })
                              }
                              disabled={decisionMutation.isPending}
                              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs disabled:opacity-50"
                            >
                              <Check size={14} />
                              <span>Accept Order</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setRejectingOrderId(order.id)}
                              disabled={decisionMutation.isPending}
                              className="py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition border border-rose-200"
                            >
                              <X size={14} />
                              <span>Reject</span>
                            </button>
                          </div>
                        ) : order.status === 'PREPARING' ? (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                statusMutation.mutate({
                                  orderId: order.id,
                                  status: 'READY_FOR_PICKUP',
                                })
                              }
                              disabled={statusMutation.isPending}
                              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs disabled:opacity-50"
                            >
                              <CheckCircle2 size={14} />
                              <span>Mark Ready for Pickup</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (confirm('Cancel this in-progress order? Points will be reversed.')) {
                                  statusMutation.mutate({
                                    orderId: order.id,
                                    status: 'CANCELLED',
                                  });
                                }
                              }}
                              disabled={statusMutation.isPending}
                              className="py-2.5 px-2.5 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-xl text-xs font-bold transition"
                              title="Cancel order"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : order.status === 'READY_FOR_PICKUP' ? (
                          <button
                            type="button"
                            onClick={() =>
                              statusMutation.mutate({
                                orderId: order.id,
                                status: 'COMPLETED',
                              })
                            }
                            disabled={statusMutation.isPending}
                            className="w-full py-2.5 bg-stone-900 hover:bg-black text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs disabled:opacity-50"
                          >
                            <Check size={14} />
                            <span>Hand Over & Complete</span>
                          </button>
                        ) : null}

                        {/* Customer & Payment Details Button */}
                        <button
                          type="button"
                          onClick={() => setSelectedOrderDetails(order)}
                          className="w-full py-2 bg-stone-50 hover:bg-stone-100 text-stone-700 text-[11px] font-bold rounded-xl border border-stone-200 transition flex items-center justify-center gap-1"
                        >
                          <Eye size={12} />
                          <span>View Full Customer & Payment Details</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MENU & STOCK MANAGEMENT */}
        {activeTab === 'menu' && (
          <div className="space-y-6 animate-fade-in">
            {/* Outlet Filter & Add Product Controls */}
            <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-stone-600 uppercase tracking-wider">
                    Outlet Scope:
                  </span>
                  <select
                    value={selectedOutletFilter}
                    onChange={(e) => setSelectedOutletFilter(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-xl font-bold text-stone-800 outline-none focus:border-amber-800"
                  >
                    <option value="">Global Catalog (All Outlets)</option>
                    {outlets.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                  />
                  <input
                    type="text"
                    placeholder="Filter products..."
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-xl outline-none focus:border-amber-800"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAddProductOpen(true)}
                className="px-4 py-2 bg-amber-900 hover:bg-amber-950 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs self-start sm:self-auto"
              >
                <Plus size={15} />
                <span>Add New Product</span>
              </button>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 p-1 bg-stone-200/60 rounded-2xl w-full sm:w-auto overflow-x-auto">
              {['all', 'hot_coffee', 'cold_coffee', 'matcha', 'food'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setMenuCategoryFilter(cat)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap capitalize ${
                    menuCategoryFilter === cat
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {cat.replace(/_/g, ' ')}
                </button>
              ))}
            </div>

            {/* Products Management Grid */}
            {isMenuLoading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-3">
                <div className="w-8 h-8 border-3 border-amber-900 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-bold text-stone-500">Loading catalog...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProducts.map((product) => {
                  return (
                    <div
                      key={product.id}
                      className="bg-white rounded-3xl p-5 border border-stone-200 shadow-xs flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            {product.image_url ? (
                              <img
                                src={product.image_url}
                                alt={product.name}
                                className="w-12 h-12 object-cover rounded-xl border border-stone-200 shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 bg-amber-50 text-amber-900 rounded-xl flex items-center justify-center shrink-0">
                                <Coffee size={20} />
                              </div>
                            )}
                            <div>
                              <h3 className="font-bold text-stone-900 text-sm leading-tight">
                                {product.name}
                              </h3>
                              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-stone-100 text-stone-600 mt-1 inline-block">
                                {product.category.replace(/_/g, ' ')}
                              </span>
                            </div>
                          </div>

                          <span className="font-serif font-black text-stone-900 text-base shrink-0">
                            {formatCurrency(product.base_price)}
                          </span>
                        </div>

                        <p className="text-xs text-stone-400 line-clamp-2">
                          {product.description || 'Artisanal roastery offering.'}
                        </p>

                        {/* Modifiers Count */}
                        <div className="text-[11px] text-stone-500 bg-stone-50 p-2 rounded-xl border border-stone-100 flex items-center justify-between">
                          <span>Modifiers Attached:</span>
                          <span className="font-bold text-stone-800">
                            {product.modifiers?.length || 0} options
                          </span>
                        </div>
                      </div>

                      {/* Management Controls: Global Switch + Outlet Override + Delete */}
                      <div className="pt-3 border-t border-stone-100 space-y-2.5">
                        {/* Global Availability Toggle */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-stone-700">Catalog Active:</span>
                          <button
                            type="button"
                            onClick={() =>
                              availabilityMutation.mutate({
                                productId: product.id,
                                isAvailable: !product.is_available,
                              })
                            }
                            className={`px-3 py-1 rounded-full text-xs font-extrabold transition ${
                              product.is_available
                                ? 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200'
                                : 'bg-stone-200 text-stone-600 hover:bg-stone-300'
                            }`}
                          >
                            {product.is_available ? 'Available' : 'Disabled'}
                          </button>
                        </div>

                        {/* Outlet Stock Override if outlet filter is chosen */}
                        {selectedOutletFilter && (
                          <div className="flex items-center justify-between text-xs pt-1 border-t border-dashed border-stone-200">
                            <span className="font-bold text-stone-700">In Outlet Stock:</span>
                            <button
                              type="button"
                              onClick={() =>
                                outletStockMutation.mutate({
                                  productId: product.id,
                                  outletId: selectedOutletFilter,
                                  isAvailable: !product.is_available,
                                })
                              }
                              className={`px-3 py-1 rounded-full text-xs font-extrabold transition ${
                                product.is_available
                                  ? 'bg-blue-100 text-blue-900 hover:bg-blue-200'
                                  : 'bg-rose-100 text-rose-900 hover:bg-rose-200'
                              }`}
                            >
                              {product.is_available ? 'In Stock' : 'Out of Stock'}
                            </button>
                          </div>
                        )}

                        {/* Delete Product */}
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              confirm(
                                `Are you sure you want to delete '${product.name}' and all its modifiers from the catalog?`
                              )
                            ) {
                              deleteProductMutation.mutate(product.id);
                            }
                          }}
                          disabled={deleteProductMutation.isPending}
                          className="w-full py-1.5 text-red-600 hover:bg-red-50 text-[11px] font-bold rounded-xl transition flex items-center justify-center gap-1"
                        >
                          <Trash2 size={12} />
                          <span>Delete from Catalog</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* CUSTOMER & PAYMENT DETAILS MODAL */}
      {selectedOrderDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-stone-200 flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50">
              <div>
                <h3 className="font-serif font-black text-stone-900 text-lg">
                  Order #{selectedOrderDetails.id.slice(0, 8)} Details
                </h3>
                <p className="text-xs text-stone-500">
                  Placed on {formatIST(selectedOrderDetails.created_at)}
                </p>
              </div>
              <button
                onClick={() => setSelectedOrderDetails(null)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Customer ID & Pickup info */}
              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-stone-500">Customer:</span>
                  <span className="font-bold text-stone-900">
                    {selectedOrderDetails.customer_name || 'Customer'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Pickup Mode:</span>
                  <span className="font-bold text-stone-900 capitalize">
                    {selectedOrderDetails.pickup_type}
                  </span>
                </div>
                {selectedOrderDetails.pickup_type === 'scheduled' && (
                  <div className="flex justify-between">
                    <span className="text-stone-500">Scheduled Time:</span>
                    <span className="font-bold text-amber-900">
                      {formatIST(selectedOrderDetails.scheduled_pickup_time)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-stone-500">Payment Status:</span>
                  <span className="font-extrabold text-green-700 bg-green-50 px-2 py-0.5 rounded">
                    {selectedOrderDetails.payment_status}
                  </span>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <h4 className="font-bold text-stone-700 uppercase tracking-wider text-[11px]">
                  Order Items Breakdown
                </h4>
                <div className="divide-y divide-stone-100 border border-stone-200 rounded-2xl p-3 bg-stone-50/50">
                  {selectedOrderDetails.items.map((item) => (
                    <div key={item.id} className="py-2 first:pt-0 last:pb-0">
                      <div className="flex justify-between font-bold text-stone-900">
                        <span>
                          {item.quantity}x {item.product_name}
                        </span>
                        <span>{formatCurrency(item.total_price)}</span>
                      </div>
                      {item.selected_modifiers?.length > 0 && (
                        <div className="text-[11px] text-stone-500 pl-3 pt-0.5 space-y-0.5">
                          {item.selected_modifiers.map((m, idx) => (
                            <div key={idx} className="flex justify-between">
                              <span className="capitalize">
                                {m.group}: {m.option_name}
                              </span>
                              {m.price_delta > 0 && <span>+{formatCurrency(m.price_delta)}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Calculation breakdown */}
              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-2 text-stone-600">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-bold text-stone-900">
                    {formatCurrency(selectedOrderDetails.subtotal)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>GST (5%)</span>
                  <span className="font-bold text-stone-900">
                    {formatCurrency(selectedOrderDetails.tax)}
                  </span>
                </div>
                {parseFloat(selectedOrderDetails.discount_amount) > 0 && (
                  <div className="flex justify-between text-green-700 font-bold">
                    <span>
                      Loyalty Discount ({selectedOrderDetails.points_redeemed} pts)
                    </span>
                    <span>-{formatCurrency(selectedOrderDetails.discount_amount)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-stone-200 flex justify-between font-serif font-black text-sm text-stone-900">
                  <span>Total Amount Paid</span>
                  <span>{formatCurrency(selectedOrderDetails.final_payable)}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-stone-50 border-t border-stone-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedOrderDetails(null)}
                className="px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-bold hover:bg-black transition"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT ORDER WITH REASON MODAL */}
      {rejectingOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 border border-stone-200 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-rose-700 font-bold">
              <AlertTriangle size={18} />
              <h3 className="text-base text-stone-900">Decline Incoming Order?</h3>
            </div>
            <p className="text-xs text-stone-500 leading-relaxed">
              Declining this order will set its status to <strong>REJECTED</strong>, mark payment as{' '}
              <strong>REFUNDED</strong>, and reverse any redeemed loyalty points back to the customer.
            </p>

            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                Reason for Rejection (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Roastery closing early / Ingredient unavailable"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl outline-none focus:border-rose-600"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingOrderId(null)}
                className="flex-1 py-2.5 border border-stone-300 text-stone-700 rounded-xl text-xs font-bold hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  decisionMutation.mutate({
                    orderId: rejectingOrderId,
                    action: 'REJECT',
                    reason: rejectionReason,
                  })
                }
                disabled={decisionMutation.isPending}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
              >
                {decisionMutation.isPending ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD NEW PRODUCT MODAL */}
      {isAddProductOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-stone-200 flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50">
              <h3 className="font-serif font-black text-stone-900 text-lg">
                Add New Product to Catalog
              </h3>
              <button
                onClick={() => setIsAddProductOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Spanish Latte"
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl outline-none focus:border-amber-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    Category *
                  </label>
                  <select
                    value={newProdCategory}
                    onChange={(e) => setNewProdCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl outline-none focus:border-amber-800 font-bold"
                  >
                    <option value="hot_coffee">Hot Coffee</option>
                    <option value="cold_coffee">Cold Coffee</option>
                    <option value="matcha">Matcha & Teas</option>
                    <option value="food">Bakery & Food</option>
                    <option value="add_ons">Add-ons</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    Base Price (₹) *
                  </label>
                  <input
                    type="number"
                    step="5"
                    value={newProdPrice}
                    onChange={(e) => setNewProdPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl outline-none focus:border-amber-800 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Tasting notes and ingredients..."
                  value={newProdDesc}
                  onChange={(e) => setNewProdDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl outline-none focus:border-amber-800 resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">
                  Image CDN URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={newProdImage}
                  onChange={(e) => setNewProdImage(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl outline-none focus:border-amber-800"
                />
              </div>

              {/* Modifiers Builder */}
              <div className="pt-2 border-t border-stone-100 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-stone-700">
                    Modifiers & Customizations
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setNewProdModifiers((prev) => [
                        ...prev,
                        { modifier_group: 'add_ons', option_name: '', price_delta: '0' },
                      ])
                    }
                    className="text-[11px] font-bold text-amber-900 hover:underline flex items-center gap-1"
                  >
                    <Plus size={12} /> Add Option
                  </button>
                </div>

                <div className="space-y-2">
                  {newProdModifiers.map((mod, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Group (e.g. size/milk)"
                        value={mod.modifier_group}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewProdModifiers((prev) =>
                            prev.map((m, i) => (i === idx ? { ...m, modifier_group: val } : m))
                          );
                        }}
                        className="w-28 px-2 py-1.5 border border-stone-300 rounded-lg text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Option Name (e.g. Large)"
                        value={mod.option_name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewProdModifiers((prev) =>
                            prev.map((m, i) => (i === idx ? { ...m, option_name: val } : m))
                          );
                        }}
                        className="flex-1 px-2 py-1.5 border border-stone-300 rounded-lg text-xs"
                      />
                      <input
                        type="number"
                        placeholder="Delta ₹"
                        value={mod.price_delta}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewProdModifiers((prev) =>
                            prev.map((m, i) => (i === idx ? { ...m, price_delta: val } : m))
                          );
                        }}
                        className="w-20 px-2 py-1.5 border border-stone-300 rounded-lg text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setNewProdModifiers((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="p-1.5 text-stone-400 hover:text-red-600"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 bg-stone-50 border-t border-stone-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddProductOpen(false)}
                className="px-4 py-2 border border-stone-300 text-stone-700 rounded-xl text-xs font-bold hover:bg-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => createProductMutation.mutate()}
                disabled={!newProdName.trim() || createProductMutation.isPending}
                className="px-5 py-2 bg-amber-900 hover:bg-amber-950 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
              >
                {createProductMutation.isPending ? 'Adding...' : 'Save Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffDashboardPage;