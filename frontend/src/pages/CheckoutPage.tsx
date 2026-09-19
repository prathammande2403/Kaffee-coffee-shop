import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { Navbar } from '../components/Navbar';
import { CustomizerModal } from '../components/CustomizerModal';
import { PaymentModal } from '../components/PaymentModal';
import { useAuth } from '../context/AuthContext';
import { useCartStore } from '../store/useCartStore';
import {
  formatCurrency,
  formatTimeString,
  getOutletStatus,
  generatePickupSlots,
  validatePickupSlot,
  PickupSlotOption,
} from '../utils/formatters';
import { Product, CartItem } from '../types';
import {
  Clock,
  Calendar,
  ShieldCheck,
  Trash2,
  ArrowRight,
  Edit3,
  Award,
  Plus,
  Minus,
  AlertTriangle,
  Coffee,
  Check,
  Sparkles,
  ChevronRight,
  Info,
  MapPin,
  Lock,
  XCircle,
} from 'lucide-react';

export const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const {
    items,
    selectedOutletId,
    selectedOutletName,
    selectedOutlet,
    getSubtotal,
    getTax,
    removeItem,
    updateQuantity,
    clearCart,
  } = useCartStore();

  // State for customizing an existing cart item
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isLoadingProduct, setIsLoadingProduct] = useState<boolean>(false);

  // Order & Pickup state
  const [pickupType, setPickupType] = useState<'immediate' | 'scheduled'>('immediate');
  const [scheduledTime, setScheduledTime] = useState<string>('');
  const [pointsInput, setPointsInput] = useState<number>(0);
  const [serverError, setServerError] = useState<string | null>(null);

  // Payment Modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);

  // Live financial calculations according to API_CONTRACT.md
  // 1. Subtotal = sum of (unit_price * quantity)
  const subtotal = getSubtotal();

  // 2. 5% GST quantized to 2 decimal places
  const tax = getTax();

  // 3. Loyalty redemption rules
  const userBalance = user?.loyalty_balance ?? 0;
  const maxRedeemablePoints = Math.min(userBalance, Math.floor(subtotal + tax));

  // Client-side loyalty points validation
  const loyaltyValidation = useMemo(() => {
    if (pointsInput === 0) {
      return { isValid: true, error: null, warning: null };
    }
    if (pointsInput < 50) {
      return {
        isValid: false,
        error: 'Backend policy requires a minimum of 50 loyalty points to redeem.',
        warning: null,
      };
    }
    if (pointsInput > userBalance) {
      return {
        isValid: false,
        error: `Cannot redeem more than your available balance (${userBalance} points).`,
        warning: null,
      };
    }
    if (pointsInput > maxRedeemablePoints) {
      return {
        isValid: true,
        error: null,
        warning: `Redemption capped to total payable amount (${maxRedeemablePoints} points).`,
      };
    }
    return { isValid: true, error: null, warning: null };
  }, [pointsInput, userBalance, maxRedeemablePoints]);

  const effectivePointsToRedeem = loyaltyValidation.isValid
    ? Math.min(pointsInput, maxRedeemablePoints)
    : 0;

  // 4. Loyalty discount = ₹1.00 per point redeemed
  const discountAmount = effectivePointsToRedeem * 1.0;

  // 5. Final payable = max(0.00, subtotal + tax - discount)
  const finalPayable = Math.max(0, Math.round((subtotal + tax - discountAmount) * 100) / 100);

  // 6. Points to earn upon completion = floor(finalPayable / 10)
  const pointsToEarn = Math.floor(finalPayable / 10);

  // Fetch fresh outlet data
  const { data: outletData } = useQuery({
    queryKey: ['outlet', selectedOutletId],
    queryFn: async () => {
      if (!selectedOutletId) return null;
      return (await api.get(`/outlets/${selectedOutletId}`)).data;
    },
    enabled: !!selectedOutletId,
    initialData: selectedOutlet || undefined,
  });

  const activeOutlet = outletData || selectedOutlet;
  const outletStatus = activeOutlet ? getOutletStatus(activeOutlet) : null;
  const isOutletCurrentlyOpen = outletStatus?.isOpen ?? false;

  // Generated pickup slots based on outlet timings and prep minutes
  const availableSlots = useMemo(() => {
    return generatePickupSlots(activeOutlet, 6);
  }, [activeOutlet]);

  // Set default scheduled slot if switching to scheduled and none selected
  useEffect(() => {
    if (pickupType === 'scheduled' && !scheduledTime && availableSlots.length > 0) {
      setScheduledTime(availableSlots[0].value);
    }
  }, [pickupType, scheduledTime, availableSlots]);

  // Scheduled slot validation
  const slotValidation = useMemo(() => {
    if (pickupType === 'immediate') {
      if (!activeOutlet?.is_active) {
        return {
          isValid: false,
          error: `${activeOutlet?.name || 'Selected outlet'} is currently closed.`,
        };
      }
      if (!isOutletCurrentlyOpen) {
        return {
          isValid: false,
          error: `Immediate pickup is unavailable because ${
            activeOutlet?.name || 'the roastery'
          } is closed. Operating hours: ${formatTimeString(
            activeOutlet?.opening_time
          )} – ${formatTimeString(
            activeOutlet?.closing_time
          )}. Please select a future scheduled slot during open hours.`,
        };
      }
      return { isValid: true, error: null };
    }

    if (!scheduledTime) {
      return { isValid: false, error: 'Please choose a pickup time slot.' };
    }

    const targetDate = new Date(scheduledTime);
    if (isNaN(targetDate.getTime())) {
      return { isValid: false, error: 'Invalid pickup date/time format.' };
    }

    const validation = validatePickupSlot(activeOutlet, targetDate);
    return {
      isValid: validation.isValid,
      error: validation.error || null,
    };
  }, [pickupType, scheduledTime, activeOutlet, isOutletCurrentlyOpen]);

  // Handle open customizer modal for an item
  const handleEditItem = async (item: CartItem) => {
    setIsLoadingProduct(true);
    try {
      const res = await api.get(`/menu/${item.product_id}`);
      setEditingProduct(res.data);
      setEditingItem(item);
    } catch (err) {
      alert('Could not load item details for customization.');
    } finally {
      setIsLoadingProduct(false);
    }
  };

  // Order submission mutation (called via PaymentModal)
  const orderMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        outlet_id: selectedOutletId,
        pickup_type: pickupType,
        scheduled_pickup_time:
          pickupType === 'scheduled' && scheduledTime
            ? new Date(scheduledTime).toISOString()
            : null,
        points_to_redeem: loyaltyValidation.isValid ? effectivePointsToRedeem : 0,
        items: items.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          modifiers: item.selected_modifiers,
        })),
      };
      return (await api.post('/orders', payload)).data;
    },
    onSuccess: async (order) => {
      clearCart();
      await refreshUser();
      // Brief delay for the user to see the success state in payment modal before redirect
      setTimeout(() => {
        setIsPaymentModalOpen(false);
        navigate(`/orders/${order.id}`);
      }, 1000);
    },
    onError: (err: any) => {
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        setServerError(detail);
      } else if (Array.isArray(detail) && detail[0]?.msg) {
        setServerError(detail[0].msg);
      } else {
        setServerError('Failed to confirm order. Please verify your details and try again.');
      }
    },
  });

  const handleOpenPayment = () => {
    setServerError(null);

    if (!selectedOutletId) {
      setServerError('Please select a pickup roastery before proceeding.');
      return;
    }
    if (items.length === 0) {
      setServerError('Your cart is empty.');
      return;
    }
    if (!slotValidation.isValid) {
      setServerError(slotValidation.error);
      return;
    }
    if (!loyaltyValidation.isValid) {
      setServerError(loyaltyValidation.error);
      return;
    }

    setIsPaymentModalOpen(true);
  };

  // Empty cart view
  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Navbar />
        <div className="max-w-xl mx-auto text-center py-20 px-4">
          <div className="w-20 h-20 mx-auto bg-amber-100/70 text-amber-900 rounded-3xl flex items-center justify-center mb-5 shadow-inner">
            <Coffee size={36} />
          </div>
          <h2 className="text-2xl font-serif font-black text-stone-900">Your Cart is Empty</h2>
          <p className="text-sm text-stone-500 mt-2 mb-8 max-w-sm mx-auto">
            Experience our specialty single-origin coffees, handcrafted cold brews, and fresh
            pastries.
          </p>
          <button
            onClick={() => navigate('/menu')}
            className="px-8 py-3.5 bg-amber-900 hover:bg-amber-950 text-white rounded-2xl text-sm font-bold shadow-md shadow-amber-950/20 transition active:scale-98"
          >
            Explore Artisanal Menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-16">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Page Title & Cart Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-stone-500 mb-1">
              <Link to="/menu" className="hover:text-amber-900 transition">
                Menu
              </Link>
              <ChevronRight size={12} />
              <span className="text-stone-900 font-bold">Review Order</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-black text-stone-900">
              Cart & Checkout
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-stone-500 font-semibold bg-white border border-stone-200 px-3 py-1.5 rounded-full">
              {items.reduce((sum, i) => sum + i.quantity, 0)} items in cart
            </span>
            <button
              onClick={() => {
                if (confirm('Are you sure you want to clear your cart?')) {
                  clearCart();
                }
              }}
              className="text-xs text-stone-400 hover:text-red-600 font-semibold transition px-2 py-1"
            >
              Clear Cart
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* LEFT: Cart Items & Pickup Configuration */}
          <div className="lg:col-span-2 space-y-6">
            {/* 1. Pickup Outlet Card */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-stone-200 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-50 text-amber-900 rounded-lg">
                    <MapPin size={16} />
                  </div>
                  <h2 className="text-sm font-black text-stone-900 uppercase tracking-wider">
                    Pickup Roastery
                  </h2>
                </div>
                <button
                  onClick={() => navigate('/')}
                  className="text-xs font-bold text-amber-900 hover:text-amber-950 underline underline-offset-2"
                >
                  Change Outlet
                </button>
              </div>

              {selectedOutletId ? (
                <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-stone-900 text-sm sm:text-base">
                        {selectedOutletName}
                      </span>
                      {outletStatus && (
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                            outletStatus.isOpen
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {outletStatus.statusText}
                        </span>
                      )}
                    </div>
                    {activeOutlet && (
                      <div className="text-xs text-stone-500 mt-1 space-y-0.5">
                        <p>{activeOutlet.address}</p>
                        <p className="text-[11px] text-stone-400">
                          Hours: {formatTimeString(activeOutlet.opening_time)} –{' '}
                          {formatTimeString(activeOutlet.closing_time)}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-stone-600 font-semibold bg-white px-3 py-1.5 rounded-xl border border-stone-200 shrink-0 self-start sm:self-auto flex items-center gap-1.5">
                    <Clock size={13} className="text-amber-800" />
                    <span>~{activeOutlet?.avg_prep_minutes || 12} mins prep buffer</span>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 text-amber-900">
                    <AlertTriangle size={18} className="text-amber-700 shrink-0" />
                    <div>
                      <span className="font-bold text-xs block">No Roastery Outlet Selected</span>
                      <span className="text-[11px] text-amber-800/80 block">
                        Select a location to prepare your coffee fresh upon order.
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/')}
                    className="px-3.5 py-2 bg-amber-900 text-white rounded-xl text-xs font-bold shrink-0 hover:bg-amber-950 transition"
                  >
                    Select Outlet
                  </button>
                </div>
              )}
            </div>

            {/* 2. Order Items List with Customisation Breakdown & Edit Buttons */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-stone-200 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-black text-stone-900 uppercase tracking-wider">
                  Order Items ({items.length})
                </h2>
                <Link
                  to="/menu"
                  className="text-xs font-bold text-amber-900 hover:text-amber-950 flex items-center gap-1"
                >
                  <Plus size={14} />
                  <span>Add More Coffee</span>
                </Link>
              </div>

              <div className="divide-y divide-stone-100">
                {items.map((item) => {
                  const unitPrice = item.item_total / item.quantity;
                  return (
                    <div key={item.cart_item_id} className="py-4 first:pt-0 last:pb-0 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <h3 className="font-bold text-stone-900 text-sm sm:text-base">
                            {item.name}
                          </h3>
                          <div className="text-xs text-stone-400">
                            Base price: {formatCurrency(item.base_price)}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-extrabold text-stone-900 text-sm sm:text-base">
                            {formatCurrency(item.item_total)}
                          </div>
                          {item.quantity > 1 && (
                            <div className="text-[11px] text-stone-400">
                              {item.quantity} × {formatCurrency(unitPrice)}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Modifiers Pill Breakdown */}
                      {item.selected_modifiers && item.selected_modifiers.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {item.selected_modifiers.map((m, idx) => (
                            <span
                              key={`${m.modifier_id}-${idx}`}
                              className="text-[11px] font-medium px-2.5 py-1 bg-stone-100 text-stone-700 rounded-lg border border-stone-200/60 flex items-center gap-1"
                            >
                              <span className="capitalize text-stone-400 font-normal">
                                {m.group.replace(/[-_]/g, ' ')}:
                              </span>
                              <span className="font-semibold text-stone-800">{m.option_name}</span>
                              {m.price_delta > 0 && (
                                <span className="text-amber-900 font-bold">
                                  (+{formatCurrency(m.price_delta)})
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Action Bar: Quantity Stepper, Customize Button, Remove */}
                      <div className="flex items-center justify-between pt-1 text-xs">
                        {/* Inline Quantity Stepper */}
                        <div className="flex items-center border border-stone-200 rounded-xl bg-stone-50 p-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (item.quantity === 1) {
                                removeItem(item.cart_item_id);
                              } else {
                                updateQuantity(item.cart_item_id, item.quantity - 1);
                              }
                            }}
                            title={item.quantity === 1 ? 'Remove item' : 'Decrease quantity'}
                            className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-white rounded-lg transition"
                          >
                            <Minus size={13} />
                          </button>
                          <span className="px-2.5 font-bold text-stone-900 text-xs min-w-[24px] text-center">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.cart_item_id, item.quantity + 1)}
                            disabled={item.quantity >= 50}
                            title="Increase quantity"
                            className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-white rounded-lg disabled:opacity-30 transition"
                          >
                            <Plus size={13} />
                          </button>
                        </div>

                        {/* Edit Customization & Remove Buttons */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditItem(item)}
                            disabled={isLoadingProduct}
                            className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-950 font-bold rounded-xl border border-amber-200/80 transition"
                          >
                            <Edit3 size={13} className="text-amber-800" />
                            <span>Customize</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => removeItem(item.cart_item_id)}
                            title="Remove from cart"
                            className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Pickup Timing Options (Respects outlet timings and prep buffer) */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-stone-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-stone-900 uppercase tracking-wider">
                  Pickup Timing
                </h2>
                {activeOutlet && (
                  <span className="text-[11px] text-stone-500 font-medium">
                    Prep buffer: <strong>~{activeOutlet.avg_prep_minutes || 12} mins</strong>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Now / Immediate option */}
                <button
                  type="button"
                  onClick={() => setPickupType('immediate')}
                  className={`p-4 rounded-2xl border text-left flex items-start gap-3 transition ${
                    pickupType === 'immediate'
                      ? 'border-amber-900 bg-amber-50/70 text-amber-950 font-bold shadow-xs'
                      : 'border-stone-200 text-stone-600 hover:border-stone-300'
                  } ${!isOutletCurrentlyOpen ? 'opacity-70' : ''}`}
                >
                  <div
                    className={`p-2.5 rounded-xl mt-0.5 ${
                      pickupType === 'immediate'
                        ? 'bg-amber-900 text-white'
                        : 'bg-stone-100 text-stone-500'
                    }`}
                  >
                    <Clock size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="block text-xs font-bold text-stone-900">
                        Brew Now (Immediate)
                      </span>
                      {isOutletCurrentlyOpen ? (
                        <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                          Fastest
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                          Outlet Closed
                        </span>
                      )}
                    </div>
                    <span className="block text-[11px] text-stone-500 font-normal mt-1">
                      {isOutletCurrentlyOpen
                        ? `Ready in approx. ~${activeOutlet?.avg_prep_minutes || 12} minutes`
                        : 'Cannot brew now (outside open hours)'}
                    </span>
                  </div>
                </button>

                {/* Future Time Slot option */}
                <button
                  type="button"
                  onClick={() => {
                    setPickupType('scheduled');
                  }}
                  className={`p-4 rounded-2xl border text-left flex items-start gap-3 transition ${
                    pickupType === 'scheduled'
                      ? 'border-amber-900 bg-amber-50/70 text-amber-950 font-bold shadow-xs'
                      : 'border-stone-200 text-stone-600 hover:border-stone-300'
                  }`}
                >
                  <div
                    className={`p-2.5 rounded-xl mt-0.5 ${
                      pickupType === 'scheduled'
                        ? 'bg-amber-900 text-white'
                        : 'bg-stone-100 text-stone-500'
                    }`}
                  >
                    <Calendar size={18} />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-stone-900">
                      Schedule Future Slot
                    </span>
                    <span className="block text-[11px] text-stone-500 font-normal mt-1">
                      Pick a custom time or upcoming slot
                    </span>
                  </div>
                </button>
              </div>

              {/* Notice if user chooses immediate when outlet is closed */}
              {pickupType === 'immediate' && !isOutletCurrentlyOpen && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 text-xs flex items-start gap-2">
                  <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Roastery Currently Closed</span>
                    <span className="text-[11px] block mt-0.5 leading-relaxed">
                      {activeOutlet?.name || 'This outlet'} operates from{' '}
                      {formatTimeString(activeOutlet?.opening_time)} to{' '}
                      {formatTimeString(activeOutlet?.closing_time)}. Please switch to &quot;Schedule
                      Future Slot&quot; for upcoming hours, or choose another outlet.
                    </span>
                  </div>
                </div>
              )}

              {/* Scheduled Slots Container */}
              {pickupType === 'scheduled' && (
                <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-4 animate-fade-in">
                  {/* Selectable Quick Slot Pills */}
                  {availableSlots.length > 0 && (
                    <div>
                      <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider block mb-2">
                        Upcoming Available Slots Today:
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {availableSlots.map((slot) => {
                          const isSelected = scheduledTime === slot.value;
                          return (
                            <button
                              key={slot.value}
                              type="button"
                              onClick={() => setScheduledTime(slot.value)}
                              className={`p-2.5 rounded-xl border text-center transition ${
                                isSelected
                                  ? 'border-amber-900 bg-amber-900 text-white font-bold shadow-xs'
                                  : 'border-stone-200 bg-white text-stone-700 hover:border-amber-700'
                              }`}
                            >
                              <div className="text-xs font-bold">{slot.label}</div>
                              <div
                                className={`text-[10px] ${
                                  isSelected ? 'text-amber-200' : 'text-stone-400'
                                }`}
                              >
                                {slot.relativeLabel}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Custom datetime-local picker */}
                  <div className="space-y-1.5 pt-1 border-t border-stone-200/60">
                    <label className="text-xs font-bold text-stone-700 block">
                      Or Choose Specific Date & Time (IST)
                    </label>
                    <input
                      type="datetime-local"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono outline-none bg-white transition ${
                        slotValidation.error
                          ? 'border-rose-400 text-rose-950 bg-rose-50/50'
                          : 'border-stone-300 focus:border-amber-800'
                      }`}
                    />
                  </div>

                  {/* Slot validation error message */}
                  {slotValidation.error && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-1.5">
                      <AlertTriangle size={14} className="shrink-0 mt-0.5 text-rose-600" />
                      <span>{slotValidation.error}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Loyalty Rewards & Billing Summary */}
          <div className="space-y-6">
            {/* Loyalty Points Redemption Box */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-stone-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-50 text-amber-900 rounded-lg">
                    <Award size={16} />
                  </div>
                  <h3 className="text-sm font-black text-stone-900 uppercase tracking-wider">
                    Loyalty Rewards
                  </h3>
                </div>
                <span className="text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200/80 px-2.5 py-0.5 rounded-full">
                  {userBalance} pts available
                </span>
              </div>

              <div className="text-xs text-stone-500 space-y-1">
                <p>
                  1 point = <strong>₹1.00 discount</strong>.
                </p>
                <p className="text-[11px] text-stone-400">
                  Backend rule: Minimum redemption is <strong>50 points</strong>.
                </p>
              </div>

              {/* Status if user has insufficient points */}
              {userBalance < 50 ? (
                <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 text-xs text-stone-600 space-y-2">
                  <div className="flex items-center gap-2 text-stone-700 font-bold">
                    <Lock size={14} className="text-stone-400" />
                    <span>Redemption Locked (Min. 50 Pts)</span>
                  </div>
                  <p className="text-[11px] text-stone-500">
                    You currently have {userBalance} points. Earn {50 - userBalance} more points to
                    unlock ₹50 off your orders!
                  </p>
                  <div className="w-full bg-stone-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-amber-800 h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, (userBalance / 50) * 100)}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  {/* Points Input & Steppers */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-700 flex items-center justify-between">
                      <span>Points to Redeem</span>
                      {pointsInput > 0 && (
                        <span className="text-amber-900 font-extrabold">
                          -{formatCurrency(effectivePointsToRedeem)}
                        </span>
                      )}
                    </label>

                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0"
                        max={maxRedeemablePoints}
                        step="1"
                        value={pointsInput === 0 ? '' : pointsInput}
                        placeholder="0 (Min 50 to redeem)"
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                          setPointsInput(isNaN(val) ? 0 : val);
                        }}
                        className={`w-full px-3.5 py-2 rounded-xl border text-sm font-mono outline-none transition ${
                          loyaltyValidation.error
                            ? 'border-red-400 bg-red-50/50 text-red-950 focus:border-red-500'
                            : 'border-stone-300 focus:border-amber-800 bg-white'
                        }`}
                      />
                      {pointsInput > 0 && (
                        <button
                          type="button"
                          onClick={() => setPointsInput(0)}
                          className="px-2.5 py-2 text-xs text-stone-500 hover:text-stone-900 border border-stone-200 rounded-xl hover:bg-stone-50 transition"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Range slider for tactile control */}
                  <div className="pt-1">
                    <input
                      type="range"
                      min="0"
                      max={maxRedeemablePoints}
                      step="5"
                      value={effectivePointsToRedeem}
                      onChange={(e) => setPointsInput(Number(e.target.value))}
                      className="w-full accent-amber-900 cursor-pointer"
                    />
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setPointsInput(0)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                        pointsInput === 0
                          ? 'bg-stone-900 text-white border-stone-900'
                          : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                      }`}
                    >
                      None (0)
                    </button>
                    {userBalance >= 50 && (
                      <button
                        type="button"
                        onClick={() => setPointsInput(50)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                          pointsInput === 50
                            ? 'bg-amber-900 text-white border-amber-900'
                            : 'bg-white text-amber-900 border-amber-200 hover:bg-amber-50'
                        }`}
                      >
                        Min (50 pts)
                      </button>
                    )}
                    {userBalance >= 100 && maxRedeemablePoints >= 100 && (
                      <button
                        type="button"
                        onClick={() => setPointsInput(100)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                          pointsInput === 100
                            ? 'bg-amber-900 text-white border-amber-900'
                            : 'bg-white text-amber-900 border-amber-200 hover:bg-amber-50'
                        }`}
                      >
                        100 pts
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setPointsInput(maxRedeemablePoints)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                        pointsInput === maxRedeemablePoints && maxRedeemablePoints > 0
                          ? 'bg-amber-900 text-white border-amber-900'
                          : 'bg-white text-amber-900 border-amber-200 hover:bg-amber-50'
                      }`}
                    >
                      Max ({maxRedeemablePoints} pts)
                    </button>
                  </div>

                  {/* Validation Feedback Messages */}
                  {loyaltyValidation.error && (
                    <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-medium flex items-start gap-1.5">
                      <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                      <span>{loyaltyValidation.error}</span>
                    </div>
                  )}

                  {loyaltyValidation.warning && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-medium flex items-start gap-1.5">
                      <Info size={14} className="shrink-0 mt-0.5" />
                      <span>{loyaltyValidation.warning}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Financial Summary & Checkout Action */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-stone-200 shadow-xs space-y-5">
              <h3 className="text-sm font-black text-stone-900 uppercase tracking-wider">
                Payment Summary
              </h3>

              <div className="space-y-2.5 text-xs text-stone-600">
                <div className="flex justify-between items-center">
                  <span>Subtotal</span>
                  <span className="font-bold text-stone-900">{formatCurrency(subtotal)}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1">
                    <span>GST (5%)</span>
                    <span className="text-[10px] text-stone-400 font-mono">Quantized</span>
                  </span>
                  <span className="font-bold text-stone-900">{formatCurrency(tax)}</span>
                </div>

                {effectivePointsToRedeem > 0 && (
                  <div className="flex justify-between items-center text-green-700 font-bold bg-green-50/80 p-2 rounded-xl border border-green-200/60">
                    <span className="flex items-center gap-1">
                      <Check size={13} />
                      <span>Loyalty Discount ({effectivePointsToRedeem} pts)</span>
                    </span>
                    <span>-{formatCurrency(discountAmount)}</span>
                  </div>
                )}

                <div className="pt-3 border-t border-stone-200 flex justify-between items-baseline">
                  <div>
                    <span className="text-sm font-black text-stone-900 block">Total Payable</span>
                    <span className="text-[11px] text-stone-400 font-normal">
                      Includes all applicable taxes
                    </span>
                  </div>
                  <span className="text-xl font-serif font-black text-stone-900">
                    {formatCurrency(finalPayable)}
                  </span>
                </div>
              </div>

              {/* Earn Points Highlight Banner */}
              <div className="p-3 bg-amber-50/70 border border-amber-200/70 rounded-2xl flex items-center gap-2 text-amber-950 text-xs">
                <Sparkles size={16} className="text-amber-800 shrink-0" />
                <span>
                  You will earn <strong>+{pointsToEarn} points</strong> on this order upon pickup!
                </span>
              </div>

              {/* Server error alert banner */}
              {serverError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-medium space-y-1.5 animate-shake">
                  <div className="font-bold flex items-center gap-1.5 text-rose-900">
                    <AlertTriangle size={15} />
                    <span>Checkout Notice</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">{serverError}</p>
                </div>
              )}

              {/* Proceed to Payment CTA */}
              <button
                type="button"
                onClick={handleOpenPayment}
                disabled={
                  !selectedOutletId ||
                  !slotValidation.isValid ||
                  !loyaltyValidation.isValid ||
                  orderMutation.isPending
                }
                className="w-full py-4 bg-amber-900 hover:bg-amber-950 active:scale-[0.99] text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition shadow-lg shadow-amber-950/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ShieldCheck size={18} />
                <span>
                  {!selectedOutletId
                    ? 'Select Roastery Outlet'
                    : !slotValidation.isValid
                    ? 'Select Valid Pickup Slot'
                    : `Proceed to Pay • ${formatCurrency(finalPayable)}`}
                </span>
                <ArrowRight size={16} />
              </button>

              <p className="text-[11px] text-stone-400 text-center">
                Secure checkout with instant order routing to {selectedOutletName || 'outlet'}.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* CUSTOMIZATION MODAL FOR EDITING EXISTING CART ITEM */}
      {editingProduct && editingItem && (
        <CustomizerModal
          product={editingProduct}
          initialSelectedModifiers={editingItem.selected_modifiers}
          initialQuantity={editingItem.quantity}
          cartItemId={editingItem.cart_item_id}
          onClose={() => {
            setEditingProduct(null);
            setEditingItem(null);
          }}
        />
      )}

      {/* SIMULATED PAYMENT GATEWAY MODAL */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        amount={finalPayable}
        outletName={selectedOutletName || 'Roastery Outlet'}
        pickupType={pickupType}
        scheduledTimeText={
          pickupType === 'scheduled'
            ? availableSlots.find((s) => s.value === scheduledTime)?.label || scheduledTime
            : undefined
        }
        itemsCount={items.length}
        onConfirmPayment={async () => {
          await orderMutation.mutateAsync();
        }}
        onClose={() => setIsPaymentModalOpen(false)}
        isSubmitting={orderMutation.isPending}
        serverError={serverError}
        onClearServerError={() => setServerError(null)}
      />
    </div>
  );
};

export default CheckoutPage;