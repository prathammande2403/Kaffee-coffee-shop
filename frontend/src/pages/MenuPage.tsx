import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { Navbar } from '../components/Navbar';
import { CustomizerModal } from '../components/CustomizerModal';
import {
  formatCurrency,
  getOutletStatus,
  normalizeCategorySlug,
  getCategoryMeta,
} from '../utils/formatters';
import { Product, FavoriteItem } from '../types';
import { useCartStore } from '../store/useCartStore';
import {
  Plus,
  Heart,
  MapPin,
  Clock,
  Timer,
  Search,
  RotateCcw,
  AlertCircle,
  AlertTriangle,
  Coffee,
  Sparkles,
  CupSoda,
  Croissant,
  PlusCircle,
  SlidersHorizontal,
  XCircle,
  ArrowRight,
  Check,
} from 'lucide-react';

export const MenuPage: React.FC = () => {
  const selectedOutletId = useCartStore((state) => state.selectedOutletId);
  const selectedOutlet = useCartStore((state) => state.selectedOutlet);
  const addItem = useCartStore((state) => state.addItem);

  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null);
  const [addedAnimationId, setAddedAnimationId] = useState<string | null>(null);

  // Fetch menu scoped to selected outlet
  const {
    data: products = [],
    isLoading: isMenuLoading,
    isError: isMenuError,
    error: menuError,
    refetch: refetchMenu,
  } = useQuery<Product[]>({
    queryKey: ['menu', selectedOutletId],
    queryFn: async () => {
      const endpoint = selectedOutletId
        ? `/menu?outlet_id=${selectedOutletId}`
        : '/menu';
      const res = await api.get(endpoint);
      return res.data;
    },
  });

  // Fetch saved favorite presets
  const { data: favorites = [] } = useQuery<FavoriteItem[]>({
    queryKey: ['favorites'],
    queryFn: async () => {
      try {
        const res = await api.get('/favorites');
        return res.data;
      } catch {
        return [];
      }
    },
  });

  // Filter products by search query
  const searchedProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        p.category.toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  // Extract distinct category slugs
  const categorySlugs = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      set.add(normalizeCategorySlug(p.category));
    });
    return Array.from(set);
  }, [products]);

  // Group products by canonical category
  const groupedProducts = useMemo(() => {
    const map: Record<string, Product[]> = {};
    searchedProducts.forEach((p) => {
      const slug = normalizeCategorySlug(p.category);
      if (!map[slug]) map[slug] = [];
      map[slug].push(p);
    });
    return map;
  }, [searchedProducts]);

  // Category Icon helper
  const renderCategoryIcon = (slug: string, size = 16) => {
    switch (slug) {
      case 'hot_coffee':
        return <Coffee size={size} />;
      case 'cold_coffee':
        return <CupSoda size={size} />;
      case 'matcha':
        return <Sparkles size={size} />;
      case 'food':
        return <Croissant size={size} />;
      case 'add_ons':
      case 'add_on':
        return <PlusCircle size={size} />;
      default:
        return <Coffee size={size} />;
    }
  };

  // Quick 1-click add for products without modifiers
  const handleDirectAdd = (product: Product) => {
    if (!product.modifiers || product.modifiers.length === 0) {
      addItem(
        { id: product.id, name: product.name, base_price: product.base_price },
        1,
        []
      );
      setAddedAnimationId(product.id);
      setTimeout(() => setAddedAnimationId(null), 1200);
    } else {
      setCustomizingProduct(product);
    }
  };

  const outletStatus = selectedOutlet ? getOutletStatus(selectedOutlet) : null;

  return (
    <div className="min-h-screen bg-stone-50 selection:bg-amber-200 selection:text-amber-950 flex flex-col">
      <Navbar />

      {/* OUTLET STATUS OR MISSING PROMPT BANNER */}
      <div className="bg-white border-b border-stone-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)] sticky top-16 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 sm:py-3.5 flex items-center justify-between gap-4 flex-wrap">
          {selectedOutlet ? (
            <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-100/70 text-amber-900">
                  <MapPin size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                      Pickup Outlet
                    </span>
                    {outletStatus && (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${outletStatus.badgeClass}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${outletStatus.dotClass}`} />
                        <span>{outletStatus.statusText}</span>
                      </span>
                    )}
                  </div>
                  <h2 className="font-extrabold text-stone-900 text-sm sm:text-base leading-tight">
                    {selectedOutlet.name}
                  </h2>
                </div>
              </div>

              {/* Timings & Prep time pills */}
              <div className="hidden md:flex items-center gap-2 text-stone-500 text-xs">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-100/80 border border-stone-200/50">
                  <Clock size={13} className="text-stone-400" />
                  <span className="text-[11px]">{outletStatus?.timingsFormatted}</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50/80 border border-amber-200/60 text-amber-900">
                  <Timer size={13} className="text-amber-700" />
                  <span className="text-[11px] font-semibold">
                    ~{selectedOutlet.avg_prep_minutes} min prep
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h4 className="font-bold text-stone-900 text-xs sm:text-sm">
                  No Pickup Roastery Selected
                </h4>
                <p className="text-[11px] sm:text-xs text-stone-500">
                  Choose your pickup bar to view live inventory and order
                </p>
              </div>
            </div>
          )}

          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-stone-100 hover:bg-amber-100 text-stone-700 hover:text-amber-900 text-xs font-bold transition border border-stone-200/80"
          >
            <span>{selectedOutlet ? 'Switch Outlet' : 'Select Outlet Now'}</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8 flex-1 w-full">
        {/* HERO BAR & SEARCH */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight flex items-center gap-2">
              <span>Artisan Coffee Menu</span>
              <Sparkles size={20} className="text-amber-600" />
            </h1>
            <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
              Hand-poured specialty roasts, ceremonial grade matcha & fresh bakery
            </p>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search coffee, tea, croissants..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-2xl text-xs sm:text-sm text-stone-900 placeholder-stone-400 outline-none focus:border-amber-800 focus:ring-2 focus:ring-amber-800/10 shadow-sm transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-700"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* CATEGORY PILLS BAR */}
        <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-none mb-8 border-b border-stone-200/70">
          <button
            onClick={() => setActiveCategory('ALL')}
            className={`px-4 py-2 rounded-2xl text-xs font-extrabold whitespace-nowrap transition flex items-center gap-2 ${
              activeCategory === 'ALL'
                ? 'bg-amber-900 text-white shadow-sm'
                : 'bg-white text-stone-600 border border-stone-200/90 hover:bg-stone-100'
            }`}
          >
            <SlidersHorizontal size={14} />
            <span>All Categories</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                activeCategory === 'ALL'
                  ? 'bg-amber-800/80 text-amber-100'
                  : 'bg-stone-100 text-stone-500'
              }`}
            >
              {products.length}
            </span>
          </button>

          {favorites.length > 0 && (
            <button
              onClick={() => setActiveCategory('FAVORITES')}
              className={`px-4 py-2 rounded-2xl text-xs font-extrabold whitespace-nowrap transition flex items-center gap-2 ${
                activeCategory === 'FAVORITES'
                  ? 'bg-amber-900 text-white shadow-sm'
                  : 'bg-white text-stone-600 border border-stone-200/90 hover:bg-stone-100'
              }`}
            >
              <Heart size={14} className="text-rose-500 fill-rose-500" />
              <span>Saved Presets</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  activeCategory === 'FAVORITES'
                    ? 'bg-amber-800/80 text-amber-100'
                    : 'bg-stone-100 text-stone-500'
                }`}
              >
                {favorites.length}
              </span>
            </button>
          )}

          {categorySlugs.map((slug) => {
            const meta = getCategoryMeta(slug);
            const count = products.filter(
              (p) => normalizeCategorySlug(p.category) === slug
            ).length;

            return (
              <button
                key={slug}
                onClick={() => setActiveCategory(slug)}
                className={`px-4 py-2 rounded-2xl text-xs font-extrabold whitespace-nowrap transition flex items-center gap-2 ${
                  activeCategory === slug
                    ? 'bg-amber-900 text-white shadow-sm'
                    : 'bg-white text-stone-600 border border-stone-200/90 hover:bg-stone-100'
                }`}
              >
                {renderCategoryIcon(slug, 14)}
                <span>{meta.title}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    activeCategory === slug
                      ? 'bg-amber-800/80 text-amber-100'
                      : 'bg-stone-100 text-stone-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* LOADING STATE SKELETON */}
        {isMenuLoading && (
          <div className="space-y-8">
            {[1, 2].map((section) => (
              <div key={section} className="space-y-4">
                <div className="w-48 h-6 bg-stone-200 rounded-lg animate-pulse" />
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="bg-white rounded-3xl border border-stone-200/80 p-4 shadow-sm animate-pulse flex flex-col justify-between h-80"
                    >
                      <div className="w-full h-40 bg-stone-200 rounded-2xl mb-3" />
                      <div className="space-y-2">
                        <div className="w-3/4 h-4 bg-stone-200 rounded" />
                        <div className="w-full h-3 bg-stone-100 rounded" />
                        <div className="w-2/3 h-3 bg-stone-100 rounded" />
                      </div>
                      <div className="flex justify-between items-center pt-4 mt-2 border-t border-stone-100">
                        <div className="w-16 h-5 bg-stone-200 rounded" />
                        <div className="w-10 h-10 bg-stone-200 rounded-xl" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ERROR STATE */}
        {isMenuError && (
          <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-3xl border border-rose-200 shadow-sm text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-100">
              <AlertCircle size={24} />
            </div>
            <h3 className="text-base font-bold text-stone-900">Failed to load roastery menu</h3>
            <p className="text-xs text-stone-500 mt-1 mb-6 leading-relaxed">
              {(menuError as any)?.response?.data?.detail ||
                'Unable to retrieve menu items for this outlet. Please check network connection.'}
            </p>
            <button
              onClick={() => refetchMenu()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-900 hover:bg-amber-950 text-white rounded-xl text-xs font-bold transition shadow-sm"
            >
              <RotateCcw size={14} />
              <span>Retry Menu</span>
            </button>
          </div>
        )}

        {/* EMPTY STATE */}
        {!isMenuLoading && !isMenuError && searchedProducts.length === 0 && (
          <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-3xl border border-stone-200/80 shadow-sm text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center mx-auto mb-4 border border-amber-100">
              <Coffee size={28} />
            </div>
            <h3 className="text-base font-bold text-stone-900">
              {searchQuery ? 'No items match your search' : 'No items found in this section'}
            </h3>
            <p className="text-xs text-stone-500 mt-1 mb-6 leading-relaxed">
              {searchQuery
                ? `We couldn't find any roast or treat matching "${searchQuery}".`
                : 'Try picking a different category tab above.'}
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setActiveCategory('ALL');
              }}
              className="px-5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition"
            >
              Reset Filters & View Full Menu
            </button>
          </div>
        )}

        {/* SAVED FAVORITES PRESETS RIBBON */}
        {!isMenuLoading &&
          !isMenuError &&
          (activeCategory === 'ALL' || activeCategory === 'FAVORITES') &&
          favorites.length > 0 &&
          !searchQuery && (
            <div className="mb-12">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
                    <Heart size={16} className="fill-rose-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-stone-900 tracking-tight">
                      Saved Custom Presets
                    </h2>
                    <p className="text-xs text-stone-500">
                      Your personalized bean, milk & syrup combinations
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-stone-400">
                  {favorites.length} {favorites.length === 1 ? 'preset' : 'presets'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {favorites.map((fav) => (
                  <div
                    key={fav.id}
                    className="p-4 bg-gradient-to-br from-amber-50/70 to-orange-50/40 border border-amber-200/80 rounded-3xl shadow-sm flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-extrabold text-stone-900 text-sm">
                          {fav.label || fav.product_name}
                        </h4>
                        <span className="text-[10px] uppercase tracking-wider font-black px-2 py-0.5 rounded-full bg-amber-200/70 text-amber-950">
                          Custom
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-500 mt-1 line-clamp-2">
                        {fav.selected_modifiers.length > 0
                          ? fav.selected_modifiers
                              .map((m) => m.option_name)
                              .join(' • ')
                          : 'Standard Brew'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-amber-200/40">
                      <span className="text-sm font-black text-stone-900">
                        {formatCurrency(fav.calculated_price)}
                      </span>
                      <button
                        onClick={() =>
                          addItem(
                            {
                              id: fav.product_id,
                              name: fav.label || fav.product_name,
                              base_price: fav.base_price,
                            },
                            1,
                            fav.selected_modifiers
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-900 hover:bg-amber-950 text-white text-xs font-bold transition shadow-sm"
                        title="1-Click Add Preset"
                      >
                        <Plus size={14} />
                        <span>1-Tap Add</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        {/* PRODUCTS GROUPED OR FILTERED LIST */}
        {!isMenuLoading && !isMenuError && (
          <div className="space-y-12">
            {activeCategory === 'ALL'
              ? // Grouped view across categories
                categorySlugs.map((slug) => {
                  const items = groupedProducts[slug] || [];
                  if (items.length === 0) return null;
                  const meta = getCategoryMeta(slug);

                  return (
                    <section key={slug} id={`section-${slug}`} className="space-y-4">
                      {/* Section Category Header */}
                      <div className="flex items-center justify-between border-b border-stone-200/70 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-xl bg-stone-100 text-stone-800">
                            {renderCategoryIcon(slug, 18)}
                          </div>
                          <div>
                            <h2 className="text-lg sm:text-xl font-black text-stone-900 tracking-tight">
                              {meta.title}
                            </h2>
                            <p className="text-xs text-stone-500">{meta.subtitle}</p>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-stone-400">
                          {items.length} {items.length === 1 ? 'item' : 'items'}
                        </span>
                      </div>

                      {/* Products Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                        {items.map((product) => renderProductCard(product))}
                      </div>
                    </section>
                  );
                })
              : activeCategory !== 'FAVORITES' && (
                  // Specific Category View
                  <section className="space-y-4">
                    {(() => {
                      const items = groupedProducts[activeCategory] || [];
                      const meta = getCategoryMeta(activeCategory);

                      return (
                        <>
                          <div className="flex items-center justify-between border-b border-stone-200/70 pb-3">
                            <div className="flex items-center gap-2.5">
                              <div className="p-2 rounded-xl bg-stone-100 text-stone-800">
                                {renderCategoryIcon(activeCategory, 18)}
                              </div>
                              <div>
                                <h2 className="text-lg sm:text-xl font-black text-stone-900 tracking-tight">
                                  {meta.title}
                                </h2>
                                <p className="text-xs text-stone-500">{meta.subtitle}</p>
                              </div>
                            </div>
                            <span className="text-xs font-bold text-stone-400">
                              {items.length} {items.length === 1 ? 'item' : 'items'}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                            {items.map((product) => renderProductCard(product))}
                          </div>
                        </>
                      );
                    })()}
                  </section>
                )}
          </div>
        )}
      </main>

      {/* CUSTOMIZER MODAL */}
      {customizingProduct && (
        <CustomizerModal
          product={customizingProduct}
          onClose={() => setCustomizingProduct(null)}
        />
      )}
    </div>
  );

  // Render individual product card with availability styling
  function renderProductCard(product: Product) {
    const isAvailable = product.is_available;
    const hasModifiers = product.modifiers && product.modifiers.length > 0;
    const isJustAdded = addedAnimationId === product.id;

    return (
      <div
        key={product.id}
        className={`group bg-white rounded-3xl border transition-all duration-200 flex flex-col justify-between overflow-hidden ${
          isAvailable
            ? 'border-stone-200/80 hover:border-amber-800/40 hover:shadow-lg shadow-sm'
            : 'border-stone-200/60 bg-stone-50/50 opacity-80'
        }`}
      >
        <div>
          {/* Card Media Container */}
          <div className="h-44 w-full bg-stone-100 relative overflow-hidden flex items-center justify-center">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
                className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
                  !isAvailable ? 'grayscale contrast-75' : ''
                }`}
              />
            ) : null}

            {/* Fallback Illustration when no image or image fails */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-stone-300 pointer-events-none -z-0">
              <Coffee size={40} className="mb-1 opacity-40 text-stone-400" />
              <span className="font-serif italic text-xs text-stone-400 font-bold">
                Kaffa Artisan
              </span>
            </div>

            {/* Availability Status Ribbon */}
            {!isAvailable && (
              <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-[1px] flex items-center justify-center p-3 text-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-900/90 text-white text-[11px] font-black uppercase tracking-wider shadow-lg border border-stone-700">
                  <XCircle size={13} className="text-rose-400" />
                  <span>Sold Out</span>
                </span>
              </div>
            )}

            {/* Modifiers Pill */}
            {isAvailable && hasModifiers && (
              <div className="absolute bottom-2.5 left-2.5">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-stone-900/75 backdrop-blur-sm text-stone-100 text-[10px] font-bold shadow-sm">
                  <SlidersHorizontal size={10} />
                  <span>Customizable</span>
                </span>
              </div>
            )}
          </div>

          {/* Details Body */}
          <div className="p-4 sm:p-5">
            <h3
              className={`font-black text-sm sm:text-base leading-snug line-clamp-1 ${
                isAvailable ? 'text-stone-900 group-hover:text-amber-950' : 'text-stone-500'
              }`}
            >
              {product.name}
            </h3>

            <p className="text-xs text-stone-400 mt-1 line-clamp-2 leading-relaxed">
              {product.description || 'Artisan preparation with specialty roasted beans.'}
            </p>
          </div>
        </div>

        {/* Footer: Price & Add/Customize Button */}
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-2 flex items-center justify-between gap-2 border-t border-stone-100">
          <div>
            <span className="text-[10px] text-stone-400 uppercase font-bold block">
              Starting from
            </span>
            <span
              className={`font-black text-base sm:text-lg ${
                isAvailable ? 'text-stone-900' : 'text-stone-400'
              }`}
            >
              {formatCurrency(product.base_price)}
            </span>
          </div>

          {isAvailable ? (
            <button
              onClick={() => handleDirectAdd(product)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95 ${
                isJustAdded
                  ? 'bg-emerald-600 text-white'
                  : hasModifiers
                  ? 'bg-amber-900 hover:bg-amber-950 text-white'
                  : 'bg-stone-900 hover:bg-black text-white'
              }`}
              title={hasModifiers ? 'Customize Drink' : 'Quick Add to Order'}
            >
              {isJustAdded ? (
                <>
                  <Check size={14} />
                  <span>Added</span>
                </>
              ) : hasModifiers ? (
                <>
                  <SlidersHorizontal size={13} />
                  <span>Customize</span>
                </>
              ) : (
                <>
                  <Plus size={14} />
                  <span>Add</span>
                </>
              )}
            </button>
          ) : (
            <button
              disabled
              className="px-3.5 py-2 rounded-xl bg-stone-100 text-stone-400 text-xs font-bold cursor-not-allowed border border-stone-200/60"
            >
              Unavailable
            </button>
          )}
        </div>
      </div>
    );
  }
};