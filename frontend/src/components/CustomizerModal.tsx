import React, { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useCartStore } from '../store/useCartStore';
import { formatCurrency } from '../utils/formatters';
import { Product, ModifierOption, SelectedModifier } from '../types';
import { X, Heart, Plus, Minus, Check, Sparkles, Coffee } from 'lucide-react';

interface CustomizerModalProps {
  product: Product;
  initialSelectedModifiers?: SelectedModifier[];
  initialQuantity?: number;
  cartItemId?: string;
  onClose: () => void;
  onSave?: (modifiers: SelectedModifier[], quantity: number) => void;
}

// Helper to determine if a modifier group is single-choice (radio) or multi-choice (checkbox)
const isSingleChoiceGroup = (groupKey: string): boolean => {
  const normalized = groupKey.toLowerCase().trim();
  const singleChoiceKeywords = [
    'size',
    'milk',
    'sugar',
    'sweetness',
    'sweetener',
    'temperature',
    'temp',
    'base',
    'roast',
    'bean',
    'ice',
  ];
  return singleChoiceKeywords.some((k) => normalized.includes(k));
};

// Human-friendly group display titles
const getGroupTitle = (groupKey: string): string => {
  const normalized = groupKey.toLowerCase().replace(/[-_]/g, ' ').trim();
  if (normalized === 'size') return 'Choose Size';
  if (normalized === 'milk') return 'Milk Preference';
  if (normalized === 'sugar') return 'Sugar / Sweetness Level';
  if (normalized.includes('add') || normalized.includes('extra')) return 'Add-ons & Extras';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

export const CustomizerModal: React.FC<CustomizerModalProps> = ({
  product,
  initialSelectedModifiers,
  initialQuantity = 1,
  cartItemId,
  onClose,
  onSave,
}) => {
  const queryClient = useQueryClient();
  const addItem = useCartStore((state) => state.addItem);
  const updateCartItem = useCartStore((state) => state.updateCartItem);

  const [quantity, setQuantity] = useState<number>(Math.max(1, Math.min(50, initialQuantity)));
  const [presetLabel, setPresetLabel] = useState('');
  const [showPresetInput, setShowPresetInput] = useState(false);
  const [favoriteSuccess, setFavoriteSuccess] = useState(false);

  // Group modifiers dynamically by modifier_group (or group fallback)
  const groupedModifiers = useMemo(() => {
    return (product.modifiers || []).reduce<Record<string, ModifierOption[]>>((acc, mod) => {
      const groupKey = (mod.modifier_group || mod.group || 'add_ons').toLowerCase().trim();
      if (!acc[groupKey]) {
        acc[groupKey] = [];
      }
      acc[groupKey].push(mod);
      return acc;
    }, {});
  }, [product.modifiers]);

  // Initialize selections
  // For single-choice groups: store one ModifierOption per group
  // For multi-choice groups: store an array of ModifierOption
  const [singleSelections, setSingleSelections] = useState<Record<string, ModifierOption>>(() => {
    const initial: Record<string, ModifierOption> = {};

    Object.entries(groupedModifiers).forEach(([groupKey, options]) => {
      if (isSingleChoiceGroup(groupKey)) {
        // If initialSelectedModifiers supplied, match by modifier_id
        if (initialSelectedModifiers && initialSelectedModifiers.length > 0) {
          const match = initialSelectedModifiers.find(
            (m) => (m.group || '').toLowerCase().trim() === groupKey
          );
          if (match) {
            const found = options.find((opt) => opt.id === match.modifier_id);
            if (found) {
              initial[groupKey] = found;
              return;
            }
          }
        }
        // Default: pick the first option with price_delta === 0, or the first available option
        const zeroDeltaOption = options.find((opt) => Number(opt.price_delta) === 0);
        initial[groupKey] = zeroDeltaOption || options[0];
      }
    });

    return initial;
  });

  const [multiSelections, setMultiSelections] = useState<Record<string, ModifierOption[]>>(() => {
    const initial: Record<string, ModifierOption[]> = {};

    Object.entries(groupedModifiers).forEach(([groupKey, options]) => {
      if (!isSingleChoiceGroup(groupKey)) {
        if (initialSelectedModifiers && initialSelectedModifiers.length > 0) {
          const matchedOptions = options.filter((opt) =>
            initialSelectedModifiers.some((m) => m.modifier_id === opt.id)
          );
          initial[groupKey] = matchedOptions;
        } else {
          initial[groupKey] = [];
        }
      }
    });

    return initial;
  });

  // Handle single choice selection (radio button behavior)
  const handleSingleSelect = (groupKey: string, option: ModifierOption) => {
    setSingleSelections((prev) => ({
      ...prev,
      [groupKey]: option,
    }));
  };

  // Handle multi-choice toggle (checkbox behavior)
  const handleMultiToggle = (groupKey: string, option: ModifierOption) => {
    setMultiSelections((prev) => {
      const currentList = prev[groupKey] || [];
      const isAlreadySelected = currentList.some((o) => o.id === option.id);
      return {
        ...prev,
        [groupKey]: isAlreadySelected
          ? currentList.filter((o) => o.id !== option.id)
          : [...currentList, option],
      };
    });
  };

  // Compile active selected modifiers into array for pricing and order payload
  const activeSelectedModifiers = useMemo<SelectedModifier[]>(() => {
    const list: SelectedModifier[] = [];

    // Single choice selections
    Object.entries(singleSelections).forEach(([groupKey, opt]) => {
      if (opt) {
        list.push({
          modifier_id: opt.id,
          group: opt.modifier_group || opt.group || groupKey,
          option_name: opt.option_name,
          price_delta: Number(opt.price_delta),
        });
      }
    });

    // Multi choice selections
    Object.entries(multiSelections).forEach(([groupKey, opts]) => {
      (opts || []).forEach((opt) => {
        list.push({
          modifier_id: opt.id,
          group: opt.modifier_group || opt.group || groupKey,
          option_name: opt.option_name,
          price_delta: Number(opt.price_delta),
        });
      });
    });

    return list;
  }, [singleSelections, multiSelections]);

  // LIVE PRICING CALCULATION
  const basePrice = Number(product.base_price);
  const modifierDeltaSum = useMemo(() => {
    return activeSelectedModifiers.reduce((acc, m) => acc + m.price_delta, 0);
  }, [activeSelectedModifiers]);

  const unitPrice = basePrice + modifierDeltaSum;
  const lineTotal = unitPrice * quantity;

  // Handle Add to Cart or Update existing item
  const handleSave = () => {
    if (onSave) {
      onSave(activeSelectedModifiers, quantity);
      onClose();
      return;
    }

    if (cartItemId) {
      // Editing existing item in cart
      updateCartItem(cartItemId, activeSelectedModifiers, quantity);
    } else {
      // Adding fresh item
      addItem(
        { id: product.id, name: product.name, base_price: basePrice },
        quantity,
        activeSelectedModifiers
      );
    }
    onClose();
  };

  // Save customized drink as a favorite preset
  const saveFavoriteMutation = useMutation({
    mutationFn: async () => {
      return (
        await api.post('/favorites', {
          product_id: product.id,
          label: presetLabel.trim() || `${product.name} (Custom)`,
          selected_modifiers: activeSelectedModifiers,
        })
      ).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      setFavoriteSuccess(true);
      setShowPresetInput(false);
      setTimeout(() => setFavoriteSuccess(false), 3000);
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to save favorite preset');
    },
  });

  const hasModifiers = Object.keys(groupedModifiers).length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/70 backdrop-blur-sm animate-fade-in"
    >
      <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border border-stone-200">
        {/* Header */}
        <div className="relative p-5 border-b border-stone-100 flex items-start justify-between bg-stone-50/50">
          <div className="flex items-center gap-3.5 pr-6">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-14 h-14 object-cover rounded-2xl border border-stone-200 shadow-sm shrink-0"
              />
            ) : (
              <div className="w-14 h-14 bg-amber-100/60 text-amber-900 rounded-2xl flex items-center justify-center shrink-0">
                <Coffee size={24} />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif font-black text-stone-900 text-lg sm:text-xl">
                  {product.name}
                </h3>
                {cartItemId && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded-full text-[10px] font-bold">
                    Editing
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500 line-clamp-1 mt-0.5">
                {product.description || 'Artisanal craft beverage'}
              </p>
              <div className="text-xs font-bold text-amber-900 mt-1 flex items-center gap-2">
                <span>Base: {formatCurrency(basePrice)}</span>
                {modifierDeltaSum > 0 && (
                  <span className="text-stone-500 font-normal">
                    (+{formatCurrency(modifierDeltaSum)} mods) ={' '}
                    <strong className="text-stone-900">{formatCurrency(unitPrice)}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-full hover:bg-stone-200 text-stone-400 hover:text-stone-700 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Customization Options Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 divide-y divide-stone-100">
          {!hasModifiers ? (
            <div className="text-center py-6 text-stone-500 text-xs">
              <p className="font-semibold text-stone-700">No customizable options for this item.</p>
              <p className="mt-1">Prepared fresh according to our signature recipe.</p>
            </div>
          ) : (
            Object.entries(groupedModifiers).map(([groupKey, options], idx) => {
              const isSingle = isSingleChoiceGroup(groupKey);
              const groupTitle = getGroupTitle(groupKey);

              return (
                <div key={groupKey} className={idx > 0 ? 'pt-5' : ''}>
                  <div className="flex items-center justify-between mb-2.5">
                    <h4 className="text-xs font-black uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                      <span>{groupTitle}</span>
                      <span className="text-[10px] font-semibold text-stone-400 normal-case tracking-normal">
                        ({isSingle ? 'Pick 1' : 'Optional'})
                      </span>
                    </h4>
                    {isSingle && (
                      <span className="text-[10px] font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
                        Required
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {options.map((opt) => {
                      const delta = Number(opt.price_delta);
                      const isSelected = isSingle
                        ? singleSelections[groupKey]?.id === opt.id
                        : (multiSelections[groupKey] || []).some((o) => o.id === opt.id);

                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            if (isSingle) {
                              handleSingleSelect(groupKey, opt);
                            } else {
                              handleMultiToggle(groupKey, opt);
                            }
                          }}
                          className={`relative p-3 rounded-2xl border text-left flex items-center justify-between transition-all ${
                            isSelected
                              ? 'border-amber-900 bg-amber-50/70 text-amber-950 font-bold shadow-sm ring-1 ring-amber-900/20'
                              : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50/50 text-stone-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            {/* Visual Indicator: Radio vs Checkbox */}
                            <div
                              className={`w-4 h-4 rounded-${
                                isSingle ? 'full' : 'md'
                              } border flex items-center justify-center transition-colors ${
                                isSelected
                                  ? 'bg-amber-900 border-amber-900 text-white'
                                  : 'border-stone-300 bg-white'
                              }`}
                            >
                              {isSelected && <Check size={11} strokeWidth={3} />}
                            </div>
                            <span className="text-xs">{opt.option_name}</span>
                          </div>

                          <span
                            className={`text-xs font-semibold ${
                              delta > 0
                                ? 'text-amber-900 font-bold'
                                : 'text-stone-400 font-normal'
                            }`}
                          >
                            {delta > 0 ? `+${formatCurrency(delta)}` : 'Included'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}

          {/* Favorite Preset Section */}
          <div className="pt-5">
            {favoriteSuccess ? (
              <div className="p-2.5 bg-green-50 border border-green-200 rounded-xl text-green-800 text-xs font-bold flex items-center gap-1.5">
                <Check size={14} /> Saved drink configuration to your favorites!
              </div>
            ) : !showPresetInput ? (
              <button
                type="button"
                onClick={() => setShowPresetInput(true)}
                className="text-xs text-amber-900 font-bold flex items-center gap-1.5 hover:underline py-1"
              >
                <Heart size={14} className="text-amber-800" />
                <span>Save this drink customization as a favorite preset</span>
              </button>
            ) : (
              <div className="space-y-2 p-3 bg-stone-50 rounded-2xl border border-stone-200">
                <label className="block text-[11px] font-bold text-stone-600">
                  Preset Name (e.g. &quot;My Morning Cortado&quot;)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Extra Strong Oat Roast"
                    value={presetLabel}
                    onChange={(e) => setPresetLabel(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs border border-stone-300 rounded-xl outline-none focus:border-amber-800 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => saveFavoriteMutation.mutate()}
                    disabled={saveFavoriteMutation.isPending}
                    className="px-4 py-1.5 bg-stone-900 text-white text-xs font-bold rounded-xl hover:bg-black transition disabled:opacity-50"
                  >
                    {saveFavoriteMutation.isPending ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPresetInput(false)}
                    className="px-2.5 py-1.5 text-xs text-stone-500 hover:text-stone-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer with Quantity & Live Total */}
        <div className="p-4 sm:p-5 border-t border-stone-200 bg-stone-50/80 flex items-center justify-between gap-3 sm:gap-4">
          {/* Quantity Stepper */}
          <div className="flex items-center border border-stone-300 rounded-2xl bg-white shadow-xs p-0.5">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              aria-label="Decrease quantity"
              className="p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl disabled:opacity-30 disabled:hover:bg-transparent transition"
            >
              <Minus size={15} />
            </button>
            <span className="px-3 text-xs font-black text-stone-900 min-w-[28px] text-center">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(50, q + 1))}
              disabled={quantity >= 50}
              aria-label="Increase quantity"
              className="p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl disabled:opacity-30 disabled:hover:bg-transparent transition"
            >
              <Plus size={15} />
            </button>
          </div>

          {/* Add to Order / Update Item Button */}
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-3.5 px-4 bg-amber-900 hover:bg-amber-950 active:scale-[0.99] text-white rounded-2xl text-xs sm:text-sm font-bold transition flex items-center justify-between shadow-md shadow-amber-950/15"
          >
            <span className="flex items-center gap-1.5">
              <Sparkles size={15} className="text-amber-300" />
              <span>{cartItemId ? 'Update Customization' : 'Add to Order'}</span>
            </span>
            <span className="font-extrabold tracking-tight bg-amber-950/50 px-2.5 py-1 rounded-lg">
              {formatCurrency(lineTotal)}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};