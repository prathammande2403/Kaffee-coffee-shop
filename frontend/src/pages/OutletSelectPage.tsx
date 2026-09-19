import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useCartStore } from '../store/useCartStore';
import { Outlet } from '../types';
import { getOutletStatus } from '../utils/formatters';
import {
  MapPin,
  Clock,
  Timer,
  ArrowRight,
  Coffee,
  CheckCircle2,
  Search,
  RotateCcw,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

export const OutletSelectPage: React.FC = () => {
  const navigate = useNavigate();
  const selectedOutletId = useCartStore((state) => state.selectedOutletId);
  const setOutlet = useCartStore((state) => state.setOutlet);

  const [searchQuery, setSearchQuery] = useState('');

  // Fetch all outlets from backend API
  const {
    data: outlets = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<Outlet[]>({
    queryKey: ['outlets'],
    queryFn: async () => {
      const res = await api.get('/outlets');
      return res.data;
    },
  });

  const handleSelect = (outlet: Outlet) => {
    setOutlet(outlet);
    navigate('/menu');
  };

  // Filter outlets by name or address
  const filteredOutlets = outlets.filter((outlet) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      outlet.name.toLowerCase().includes(q) ||
      outlet.address.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-stone-50 selection:bg-amber-200 selection:text-amber-950 flex flex-col justify-between">
      {/* Decorative top ambient glow */}
      <div className="fixed top-0 inset-x-0 h-80 bg-gradient-to-b from-amber-100/50 via-stone-50 to-transparent pointer-events-none -z-10" />

      <main className="max-w-3xl w-full mx-auto px-4 py-10 sm:py-16 flex-1 flex flex-col justify-center">
        {/* Hero Brand & Header */}
        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-100/80 border border-amber-200/80 text-amber-900 text-xs font-bold tracking-wide uppercase shadow-sm mb-4">
            <Coffee size={14} className="text-amber-800" />
            <span>Kaffa Artisan Roastery</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-stone-900 tracking-tight">
            Select Your Pickup Outlet
          </h1>
          <p className="text-sm sm:text-base text-stone-500 max-w-md mx-auto mt-2 leading-relaxed">
            Choose an artisanal roastery bar near you for express counter pickup and live batch brewing
          </p>

          {/* Quick Search Input */}
          {!isLoading && !isError && outlets.length > 0 && (
            <div className="mt-6 max-w-md mx-auto relative">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by outlet name or street address..."
                className="w-full pl-11 pr-4 py-3 bg-white border border-stone-200/90 rounded-2xl text-xs sm:text-sm text-stone-900 placeholder-stone-400 outline-none focus:border-amber-800 focus:ring-2 focus:ring-amber-800/10 shadow-sm transition"
              />
            </div>
          )}
        </div>

        {/* LOADING STATE */}
        {isLoading && (
          <div className="space-y-4 max-w-xl mx-auto w-full">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-6 bg-white rounded-3xl border border-stone-200/80 shadow-sm animate-pulse space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-stone-200/80" />
                    <div className="space-y-2">
                      <div className="w-36 h-4 bg-stone-200 rounded-md" />
                      <div className="w-52 h-3 bg-stone-100 rounded-md" />
                    </div>
                  </div>
                  <div className="w-20 h-6 bg-stone-100 rounded-full" />
                </div>
                <div className="flex gap-2 pt-2 border-t border-stone-100">
                  <div className="w-24 h-5 bg-stone-100 rounded-md" />
                  <div className="w-28 h-5 bg-stone-100 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ERROR STATE */}
        {isError && (
          <div className="max-w-md mx-auto w-full bg-white rounded-3xl p-8 border border-rose-200 shadow-sm text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-100">
              <AlertCircle size={24} />
            </div>
            <h3 className="text-base font-bold text-stone-900">Unable to load coffee outlets</h3>
            <p className="text-xs text-stone-500 mt-1 mb-6 leading-relaxed">
              {(error as any)?.response?.data?.detail ||
                'Could not establish connection to the roastery server. Please ensure the backend is running.'}
            </p>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-900 hover:bg-amber-950 text-white rounded-xl text-xs font-bold transition shadow-sm"
            >
              <RotateCcw size={14} />
              <span>Retry Connection</span>
            </button>
          </div>
        )}

        {/* EMPTY STATE */}
        {!isLoading && !isError && filteredOutlets.length === 0 && (
          <div className="max-w-md mx-auto w-full bg-white rounded-3xl p-8 border border-stone-200/80 shadow-sm text-center">
            <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto mb-4">
              <MapPin size={24} />
            </div>
            <h3 className="text-base font-bold text-stone-900">
              {searchQuery ? 'No matching outlets found' : 'No coffee outlets available'}
            </h3>
            <p className="text-xs text-stone-500 mt-1 mb-6">
              {searchQuery
                ? `No roasteries matched "${searchQuery}". Try a different keyword.`
                : 'Check back soon as we expand our artisanal coffee bars.'}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition"
              >
                Clear Search Filter
              </button>
            )}
          </div>
        )}

        {/* OUTLET LIST */}
        {!isLoading && !isError && filteredOutlets.length > 0 && (
          <div className="space-y-4 max-w-xl mx-auto w-full">
            {filteredOutlets.map((outlet) => {
              const status = getOutletStatus(outlet);
              const isCurrent = selectedOutletId === outlet.id;

              return (
                <div
                  key={outlet.id}
                  onClick={() => handleSelect(outlet)}
                  className={`group relative p-5 sm:p-6 bg-white rounded-3xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                    isCurrent
                      ? 'border-amber-800 ring-2 ring-amber-800/15 shadow-md bg-amber-50/10'
                      : 'border-stone-200/90 hover:border-amber-700/60 shadow-sm hover:shadow-md'
                  }`}
                >
                  {/* Top Bar: Icon, Name, Address, and Status Badge */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`p-3 rounded-2xl transition ${
                          isCurrent
                            ? 'bg-amber-900 text-amber-100 shadow-sm'
                            : 'bg-stone-100 text-stone-600 group-hover:bg-amber-100 group-hover:text-amber-900'
                        }`}
                      >
                        <MapPin size={22} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-extrabold text-stone-900 text-base sm:text-lg group-hover:text-amber-950 transition">
                            {outlet.name}
                          </h3>
                          {isCurrent && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-950 text-[10px] font-black uppercase tracking-wider">
                              <CheckCircle2 size={11} className="text-amber-800" />
                              Active Selection
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                          {outlet.address}
                        </p>
                      </div>
                    </div>

                    {/* Open/Closed Badge */}
                    <div
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border shrink-0 ${status.badgeClass}`}
                    >
                      <span className={`w-2 h-2 rounded-full ${status.dotClass}`} />
                      <span>{status.statusText}</span>
                    </div>
                  </div>

                  {/* Metadata Footer: Timings, Prep Time, and Call-to-Action */}
                  <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-2 text-xs flex-wrap">
                    <div className="flex items-center gap-3 text-stone-600">
                      {/* Timings */}
                      <div className="flex items-center gap-1.5 bg-stone-50 px-2.5 py-1 rounded-lg border border-stone-100">
                        <Clock size={13} className="text-stone-400" />
                        <span className="font-medium text-[11px]">
                          {status.timingsFormatted}
                        </span>
                      </div>

                      {/* Average Prep Time */}
                      <div className="flex items-center gap-1.5 bg-stone-50 px-2.5 py-1 rounded-lg border border-stone-100">
                        <Timer size={13} className="text-amber-700" />
                        <span className="font-semibold text-stone-800 text-[11px]">
                          ~{outlet.avg_prep_minutes} min prep
                        </span>
                      </div>
                    </div>

                    {/* Action Arrow */}
                    <div className="flex items-center gap-1 text-amber-900 font-bold group-hover:translate-x-0.5 transition transform text-xs">
                      <span>{isCurrent ? 'Explore Menu' : 'Select Outlet'}</span>
                      <ArrowRight size={14} className="group-hover:translate-x-1 transition transform" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Selected Outlet Quick Jump Bar (if already chosen and browsing) */}
        {selectedOutletId && (
          <div className="mt-8 text-center">
            <button
              onClick={() => navigate('/menu')}
              className="inline-flex items-center gap-2 text-xs font-bold text-amber-900 hover:text-amber-950 underline decoration-amber-300 hover:decoration-amber-900 underline-offset-4 transition"
            >
              <Sparkles size={14} />
              <span>Continue to menu with your current selection</span>
            </button>
          </div>
        )}
      </main>

      {/* Footer Branding & Quick Portals */}
      <footer className="py-6 px-4 text-center text-xs text-stone-400 border-t border-stone-200/80 mt-10">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>Kaffa Coffee Roasters • Handcrafted single origins & micro-lots</p>
          <div className="flex items-center gap-3 text-xs font-semibold">
            <Link to="/staff" className="text-stone-600 hover:text-stone-900 transition underline underline-offset-2">
              Staff & Admin Portal
            </Link>
            <span className="text-stone-300">•</span>
            <Link to="/login" className="text-amber-900 hover:text-amber-950 font-bold transition">
              Account Login
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};