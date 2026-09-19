export type Role = 'customer' | 'staff' | 'admin';
export type OrderStatus =
  | 'ORDER_RECEIVED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REJECTED';
export type PickupType = 'immediate' | 'scheduled';
export type PaymentStatus = 'PENDING' | 'PAID' | 'REFUNDED';

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: Role;
  loyalty_balance: number;
  created_at: string;
}

export interface Outlet {
  id: string;
  name: string;
  address: string;
  is_active: boolean;
  opening_time: string; // e.g., "07:00:00"
  closing_time: string; // e.g., "23:00:00"
  avg_prep_minutes: number;
  city?: string; // Optional backwards compatibility
}

export interface ModifierOption {
  id: string;
  modifier_group: string;
  group?: string; // Fallback alias
  option_name: string;
  price_delta: number | string;
  is_available?: boolean;
}

export interface Product {
  id: string;
  name: string;
  description?: string | null;
  base_price: number | string;
  category: string;
  image_url?: string | null;
  is_available: boolean;
  modifiers?: ModifierOption[];
}

export interface SelectedModifier {
  modifier_id: string;
  group: string;
  option_name: string;
  price_delta: number;
}

export interface CartItem {
  cart_item_id: string;
  product_id: string;
  name: string;
  base_price: number;
  quantity: number;
  selected_modifiers: SelectedModifier[];
  item_total: number;
}

export interface OrderItemOut {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: string;
  total_price: string;
  selected_modifiers: SelectedModifier[];
}

export interface OrderOut {
  id: string;
  outlet_id: string;
  user_id: string;
  status: OrderStatus;
  pickup_type: PickupType;
  scheduled_pickup_time?: string;
  subtotal: string;
  tax: string;
  discount_amount: string;
  points_redeemed: number;
  final_payable: string;
  payment_status: PaymentStatus;
  created_at: string;
  items: OrderItemOut[];
}

export interface FavoriteItem {
  id: string;
  product_id: string;
  product_name: string;
  product_image?: string;
  base_price: number;
  label?: string;
  selected_modifiers: SelectedModifier[];
  calculated_price: number;
  is_available: boolean;
  created_at: string;
}

export interface LoyaltyTransactionOut {
  id: string;
  order_id?: string | null;
  points_change: number;
  reason: string;
  created_at: string;
}