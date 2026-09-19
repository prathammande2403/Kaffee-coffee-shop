import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { Navbar } from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatIST } from '../utils/formatters';
import { LoyaltyTransactionOut } from '../types';
import {
  Award,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  RotateCcw,
  Sparkles,
  ExternalLink,
  Search,
  Filter,
  Info,
  Calendar,
  Coffee,
  CheckCircle2,
} from 'lucide-react';

interface AugmentedTransaction extends LoyaltyTransactionOut {
  running_balance: number;
}

export const LoyaltyHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [filterType, setFilterType] = useState<'all' | 'earned' | 'redeemed'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Fetch real loyalty transaction ledger
  const {
    data: rawTransactions = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery<LoyaltyTransactionOut[]>({
    queryKey: ['loyalty-history'],
    queryFn: async () => {
      const res = await api.get('/auth/loyalty-history');
      return res.data;
    },
    enabled: !!user,
  });

  // Calculate accurate running balance for each transaction
  const computedTransactions = useMemo<AugmentedTransaction[]>(() => {
    if (!rawTransactions || rawTransactions.length === 0) return [];

    // Sort chronologically ascending to compute forward running balance
    const sortedAsc = [...rawTransactions].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const currentBalance = user?.loyalty_balance ?? 0;
    const totalDelta = sortedAsc.reduce((sum, tx) => sum + tx.points_change, 0);
    let running = currentBalance - totalDelta;

    const augmentedAsc: AugmentedTransaction[] = sortedAsc.map((tx) => {
      running += tx.points_change;
      return {
        ...tx,
        running_balance: Math.max(0, running),
      };
    });

    // Return in reverse chronological order (newest on top)
    return augmentedAsc.reverse();
  }, [rawTransactions, user?.loyalty_balance]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return computedTransactions.filter((tx) => {
      if (filterType === 'earned' && tx.points_change <= 0) return false;
      if (filterType === 'redeemed' && tx.points_change >= 0) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesOrder = tx.order_id?.toLowerCase().includes(q) ?? false;
        const matchesReason = tx.reason.toLowerCase().includes(q);
        return matchesOrder || matchesReason;
      }

      return true;
    });
  }, [computedTransactions, filterType, searchQuery]);

  // Aggregates
  const totalEarned = useMemo(() => {
    return computedTransactions
      .filter((t) => t.points_change > 0)
      .reduce((sum, t) => sum + t.points_change, 0);
  }, [computedTransactions]);

  const totalRedeemed = useMemo(() => {
    return Math.abs(
      computedTransactions
        .filter((t) => t.points_change < 0)
        .reduce((sum, t) => sum + t.points_change, 0)
    );
  }, [computedTransactions]);

  // Friendly reason label and badge
  const formatReason = (reason: string) => {
    switch (reason) {
      case 'ORDER_EARN':
        return {
          label: 'Order Reward Earned',
          desc: '1 point earned per ₹10 spent',
          badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
          icon: <ArrowUpRight size={14} className="text-emerald-600" />,
        };
      case 'CHECKOUT_REDEEM':
        return {
          label: 'Redeemed on Order',
          desc: '₹1.00 discount per point redeemed',
          badgeClass: 'bg-amber-50 text-amber-900 border-amber-200/80',
          icon: <ArrowDownLeft size={14} className="text-amber-700" />,
        };
      case 'CANCELLED_REFUND':
        return {
          label: 'Order Cancellation Refund',
          desc: 'Points refunded back to balance',
          badgeClass: 'bg-sky-50 text-sky-800 border-sky-200/80',
          icon: <RotateCcw size={14} className="text-sky-600" />,
        };
      case 'ORDER_REJECTED_REFUND':
        return {
          label: 'Roastery Rejection Refund',
          desc: 'Points refunded due to order rejection',
          badgeClass: 'bg-rose-50 text-rose-800 border-rose-200/80',
          icon: <RotateCcw size={14} className="text-rose-600" />,
        };
      case 'REVERSAL':
        return {
          label: 'Staff Order Reversal',
          desc: 'Reversed by store staff',
          badgeClass: 'bg-stone-100 text-stone-700 border-stone-200',
          icon: <RotateCcw size={14} className="text-stone-500" />,
        };
      default:
        return {
          label: reason.replace(/_/g, ' '),
          desc: 'Loyalty points transaction',
          badgeClass: 'bg-stone-100 text-stone-700 border-stone-200',
          icon: <Award size={14} className="text-stone-500" />,
        };
    }
  };

  const balance = user?.loyalty_balance ?? 0;
  const minThreshold = 50;
  const progressToMin = Math.min(100, (balance / minThreshold) * 100);

  return (
    <div className="min-h-screen bg-stone-50 selection:bg-amber-200 selection:text-amber-950 flex flex-col pb-16">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-8 flex-1 w-full space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-semibold text-stone-500">
          <Link to="/menu" className="hover:text-amber-900 transition">
            Menu
          </Link>
          <ChevronRight size={12} />
          <Link to="/profile" className="hover:text-amber-900 transition">
            Profile
          </Link>
          <ChevronRight size={12} />
          <span className="text-stone-900 font-bold">Loyalty History</span>
        </div>

        {/* Page Title & Refresh */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-black text-stone-900">
              Loyalty Points Ledger
            </h1>
            <p className="text-xs text-stone-500 mt-1">
              Audit trail of all points earned, redeemed, and refunded.
            </p>
          </div>

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 text-xs font-bold text-stone-700 transition"
          >
            <RotateCcw size={14} className={isRefetching ? 'animate-spin' : ''} />
            <span>Refresh Ledger</span>
          </button>
        </div>

        {/* Hero Balance & Summary Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Main Balance Card */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200/90 shadow-xs space-y-3 sm:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-stone-400 uppercase tracking-wider">
                Current Balance
              </span>
              <div className="p-1.5 bg-amber-50 text-amber-900 rounded-lg">
                <Award size={16} />
              </div>
            </div>
            <div>
              <div className="text-3xl font-serif font-black text-stone-900">
                {balance} <span className="text-sm font-sans font-bold text-stone-400">pts</span>
              </div>
              <p className="text-xs text-amber-900 font-semibold mt-0.5">
                Equivalent to {formatCurrency(balance)}
              </p>
            </div>

            {/* Threshold progress */}
            <div className="pt-2 border-t border-stone-100 space-y-1.5">
              <div className="flex justify-between text-[10px] font-bold text-stone-500">
                <span>Min. Redemption (50 pts)</span>
                <span>{balance >= 50 ? 'Unlocked' : `${50 - balance} pts left`}</span>
              </div>
              <div className="w-full bg-stone-100 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-amber-900 h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressToMin}%` }}
                />
              </div>
            </div>
          </div>

          {/* Lifetime Points Earned */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200/90 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-stone-400 uppercase tracking-wider">
                Lifetime Earned
              </span>
              <div className="p-1.5 bg-emerald-50 text-emerald-800 rounded-lg">
                <ArrowUpRight size={16} />
              </div>
            </div>
            <div className="text-2xl font-serif font-black text-emerald-800">
              +{totalEarned} <span className="text-xs font-sans font-bold text-stone-400">pts</span>
            </div>
            <p className="text-[11px] text-stone-500">
              Earned on completed orders at 1 pt per ₹10 spent.
            </p>
          </div>

          {/* Lifetime Points Redeemed */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200/90 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-stone-400 uppercase tracking-wider">
                Total Redeemed
              </span>
              <div className="p-1.5 bg-amber-50 text-amber-900 rounded-lg">
                <ArrowDownLeft size={16} />
              </div>
            </div>
            <div className="text-2xl font-serif font-black text-amber-950">
              -{totalRedeemed} <span className="text-xs font-sans font-bold text-stone-400">pts</span>
            </div>
            <p className="text-[11px] text-stone-500">
              Saved {formatCurrency(totalRedeemed)} across your checkouts.
            </p>
          </div>
        </div>

        {/* Filter Controls & Search */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="flex items-center gap-1.5 p-1 bg-stone-200/60 rounded-2xl w-full sm:w-auto">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                filterType === 'all'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              All ({computedTransactions.length})
            </button>
            <button
              onClick={() => setFilterType('earned')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                filterType === 'earned'
                  ? 'bg-white text-emerald-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <ArrowUpRight size={13} className="text-emerald-600" />
              <span>Earned</span>
            </button>
            <button
              onClick={() => setFilterType('redeemed')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                filterType === 'redeemed'
                  ? 'bg-white text-amber-950 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <ArrowDownLeft size={13} className="text-amber-700" />
              <span>Redeemed</span>
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
            />
            <input
              type="text"
              placeholder="Search by Order ID or reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-xs bg-white border border-stone-200 rounded-xl outline-none focus:border-amber-800 transition"
            />
          </div>
        </div>

        {/* Audit Ledger List */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <div className="w-8 h-8 border-3 border-amber-900 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-bold text-stone-500">Loading loyalty ledger...</span>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="bg-white rounded-3xl border border-stone-200/90 p-12 text-center space-y-4 shadow-xs">
            <div className="w-16 h-16 bg-stone-100 text-stone-400 rounded-2xl flex items-center justify-center mx-auto">
              <Award size={28} />
            </div>
            <h3 className="font-bold text-stone-800 text-base">No Loyalty Transactions Found</h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              {searchQuery
                ? `No transactions matching "${searchQuery}".`
                : filterType !== 'all'
                ? `No ${filterType} transactions recorded yet.`
                : 'Your loyalty points ledger is currently empty. Place and complete coffee orders to earn points!'}
            </p>
            <Link
              to="/menu"
              className="inline-block px-6 py-2.5 bg-amber-900 hover:bg-amber-950 text-white rounded-xl text-xs font-bold transition shadow-xs"
            >
              Order Coffee to Earn Points
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-stone-200/90 shadow-xs overflow-hidden divide-y divide-stone-100">
            {/* Table Header (Desktop) */}
            <div className="hidden sm:grid sm:grid-cols-12 px-6 py-3 bg-stone-50 text-[11px] font-black uppercase tracking-wider text-stone-400">
              <div className="col-span-5">Date & Transaction Type</div>
              <div className="col-span-3 text-center">Points Delta</div>
              <div className="col-span-2 text-center">Running Balance</div>
              <div className="col-span-2 text-right">Order Reference</div>
            </div>

            {/* Rows */}
            {filteredTransactions.map((tx) => {
              const meta = formatReason(tx.reason);
              const isPositive = tx.points_change > 0;

              return (
                <div
                  key={tx.id}
                  className="p-4 sm:px-6 sm:py-4 flex flex-col sm:grid sm:grid-cols-12 gap-2 sm:items-center hover:bg-stone-50/70 transition text-xs"
                >
                  {/* Date & Reason */}
                  <div className="sm:col-span-5 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${meta.badgeClass}`}
                      >
                        {meta.icon}
                        <span>{meta.label}</span>
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-400">{formatIST(tx.created_at)}</p>
                  </div>

                  {/* Points Delta */}
                  <div className="sm:col-span-3 flex sm:justify-center items-center gap-2">
                    <span
                      className={`text-sm sm:text-base font-serif font-black ${
                        isPositive ? 'text-emerald-700' : 'text-amber-900'
                      }`}
                    >
                      {isPositive ? `+${tx.points_change}` : tx.points_change} pts
                    </span>
                    <span className="text-[11px] text-stone-400">
                      ({formatCurrency(Math.abs(tx.points_change))})
                    </span>
                  </div>

                  {/* Running Balance */}
                  <div className="sm:col-span-2 flex sm:flex-col sm:items-center justify-between sm:justify-center text-xs">
                    <span className="sm:hidden text-stone-400 font-medium">Balance after:</span>
                    <div className="font-mono font-bold text-stone-800">
                      {tx.running_balance} pts
                    </div>
                  </div>

                  {/* Order Reference */}
                  <div className="sm:col-span-2 flex sm:justify-end items-center">
                    {tx.order_id ? (
                      <Link
                        to={`/orders/${tx.order_id}`}
                        className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-amber-900 hover:text-amber-950 bg-amber-50 hover:bg-amber-100/70 border border-amber-200/80 px-2.5 py-1 rounded-lg transition"
                        title="View referenced order"
                      >
                        <span>Order #{tx.order_id.slice(0, 8)}</span>
                        <ExternalLink size={11} />
                      </Link>
                    ) : (
                      <span className="text-[11px] text-stone-400 italic">
                        Account Credit
                      </span>
                    )}
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

export default LoyaltyHistoryPage;
