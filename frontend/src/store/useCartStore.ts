import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CartItem, Outlet, SelectedModifier } from '../types';

interface CartState {
  selectedOutletId: string | null;
  selectedOutletName: string | null;
  selectedOutlet: Outlet | null;
  items: CartItem[];
  setOutlet: (outletOrId: Outlet | string, name?: string, outletObj?: Outlet) => void;
  addItem: (
    product: { id: string; name: string; base_price: number | string },
    quantity: number,
    modifiers: SelectedModifier[]
  ) => void;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  updateCartItem: (
    cartItemId: string,
    updatedModifiers: SelectedModifier[],
    updatedQuantity: number
  ) => void;
  loadItems: (outletId: string, outletName: string, items: CartItem[]) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getTax: () => number;
  getTotal: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      selectedOutletId: null,
      selectedOutletName: null,
      selectedOutlet: null,
      items: [],

      setOutlet: (outletOrId, name, outletObj) => {
        let id: string;
        let outletName: string;
        let fullOutlet: Outlet | null = null;

        if (typeof outletOrId === 'object' && outletOrId !== null) {
          id = outletOrId.id;
          outletName = outletOrId.name;
          fullOutlet = outletOrId;
        } else {
          id = outletOrId;
          outletName = name || '';
          fullOutlet = outletObj || null;
        }

        const currentId = get().selectedOutletId;
        if (currentId && currentId !== id) {
          // Reset cart if outlet changes to maintain inventory integrity
          set({
            selectedOutletId: id,
            selectedOutletName: outletName,
            selectedOutlet: fullOutlet,
            items: [],
          });
        } else {
          set({
            selectedOutletId: id,
            selectedOutletName: outletName,
            selectedOutlet: fullOutlet || get().selectedOutlet,
          });
        }
      },

      addItem: (product, quantity, modifiers) => {
        const modifierTotal = modifiers.reduce((sum, mod) => sum + Number(mod.price_delta), 0);
        const singleItemPrice = Number(product.base_price) + modifierTotal;
        
        // Match existing cart item by product_id and identical modifiers
        const modKey = modifiers.map((m) => m.modifier_id).sort().join('-');
        const cartItemId = `${product.id}-${modKey}`;

        const existingItem = get().items.find((i) => i.cart_item_id === cartItemId);

        if (existingItem) {
          set({
            items: get().items.map((i) =>
              i.cart_item_id === cartItemId
                ? {
                    ...i,
                    quantity: i.quantity + quantity,
                    item_total: (i.quantity + quantity) * singleItemPrice,
                  }
                : i
            ),
          });
        } else {
          const newItem: CartItem = {
            cart_item_id: cartItemId,
            product_id: product.id,
            name: product.name,
            base_price: Number(product.base_price),
            quantity,
            selected_modifiers: modifiers,
            item_total: quantity * singleItemPrice,
          };
          set({ items: [...get().items, newItem] });
        }
      },

      removeItem: (cartItemId) => {
        set({ items: get().items.filter((i) => i.cart_item_id !== cartItemId) });
      },

      updateQuantity: (cartItemId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(cartItemId);
          return;
        }
        set({
          items: get().items.map((i) => {
            if (i.cart_item_id === cartItemId) {
              const modifierTotal = i.selected_modifiers.reduce(
                (sum, mod) => sum + Number(mod.price_delta),
                0
              );
              const singlePrice = i.base_price + modifierTotal;
              return {
                ...i,
                quantity,
                item_total: quantity * singlePrice,
              };
            }
            return i;
          }),
        });
      },

      updateCartItem: (cartItemId, updatedModifiers, updatedQuantity) => {
        const existing = get().items.find((i) => i.cart_item_id === cartItemId);
        if (!existing) return;

        if (updatedQuantity <= 0) {
          get().removeItem(cartItemId);
          return;
        }

        const modifierTotal = updatedModifiers.reduce(
          (sum, mod) => sum + Number(mod.price_delta),
          0
        );
        const singlePrice = existing.base_price + modifierTotal;
        const modKey = updatedModifiers.map((m) => m.modifier_id).sort().join('-');
        const newCartItemId = `${existing.product_id}-${modKey}`;

        // If the new configuration matches an existing different cart item, merge them
        const existingTarget = get().items.find(
          (i) => i.cart_item_id === newCartItemId && i.cart_item_id !== cartItemId
        );

        if (existingTarget) {
          set({
            items: get().items
              .filter((i) => i.cart_item_id !== cartItemId)
              .map((i) =>
                i.cart_item_id === newCartItemId
                  ? {
                      ...i,
                      quantity: i.quantity + updatedQuantity,
                      item_total: (i.quantity + updatedQuantity) * singlePrice,
                    }
                  : i
              ),
          });
        } else {
          set({
            items: get().items.map((i) =>
              i.cart_item_id === cartItemId
                ? {
                    ...i,
                    cart_item_id: newCartItemId,
                    quantity: updatedQuantity,
                    selected_modifiers: updatedModifiers,
                    item_total: updatedQuantity * singlePrice,
                  }
                : i
            ),
          });
        }
      },

      loadItems: (outletId: string, outletName: string, rawItems: any[]) => {
        const formattedItems: CartItem[] = (rawItems || []).map((raw) => {
          const modifiers = raw.modifiers || raw.selected_modifiers || [];
          const modKey = modifiers
            .map((m: any) => m.modifier_id || m.id)
            .sort()
            .join('-');
          const cartItemId = raw.cart_item_id || `${raw.product_id}-${modKey}`;
          const qty = raw.quantity || 1;
          const unitPrice = Number(raw.unit_price || raw.base_price || 0);
          const modifierSum = modifiers.reduce(
            (sum: number, m: any) => sum + Number(m.price_delta || 0),
            0
          );
          const basePrice = Number(raw.base_price ?? Math.max(0, unitPrice - modifierSum));
          const itemTotal = Number(raw.item_total || unitPrice * qty);

          return {
            cart_item_id: cartItemId,
            product_id: raw.product_id,
            name: raw.name || raw.product_name,
            base_price: basePrice,
            quantity: qty,
            selected_modifiers: modifiers.map((m: any) => ({
              modifier_id: m.modifier_id || m.id,
              group: m.group || m.modifier_group || 'options',
              option_name: m.option_name,
              price_delta: Number(m.price_delta || 0),
            })),
            item_total: itemTotal,
          };
        });

        set({
          selectedOutletId: outletId,
          selectedOutletName: outletName,
          items: formattedItems,
        });
      },

      clearCart: () => set({ items: [] }),

      getSubtotal: () => {
        return get().items.reduce((sum, item) => sum + item.item_total, 0);
      },

      getTax: () => {
        // 5% GST quantized to 2 decimal places exactly as backend does
        return Math.round(get().getSubtotal() * 0.05 * 100) / 100;
      },

      getTotal: () => {
        return Math.round((get().getSubtotal() + get().getTax()) * 100) / 100;
      },
    }),
    {
      name: 'coffee-shop-cart',
    }
  )
);