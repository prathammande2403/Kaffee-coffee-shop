import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCartStore } from '../store/useCartStore';
import { Coffee, ShoppingBag, MapPin, Award, LogOut, User as UserIcon, Shield, Clock } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const selectedOutletName = useCartStore((state) => state.selectedOutletName);
  const items = useCartStore((state) => state.items);
  const totalCartCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-stone-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <Link to="/menu" className="flex items-center gap-2">
          <div className="p-2 bg-amber-900 text-amber-100 rounded-xl">
            <Coffee size={20} />
          </div>
          <span className="font-serif font-black text-xl text-stone-900 tracking-tight">Kaffa</span>
        </Link>

        {/* Outlet Switcher Pill */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-100 hover:bg-amber-100/60 text-stone-700 hover:text-amber-900 text-xs font-semibold transition border border-stone-200/80"
          title="Switch pickup outlet location"
        >
          <MapPin size={13} className="text-amber-800 shrink-0" />
          <span className="max-w-[120px] sm:max-w-[180px] truncate">
            {selectedOutletName || 'Select Outlet'}
          </span>
        </button>

        {/* Actions & User Info */}
        <div className="flex items-center gap-3">
          {user && (
            <>
              <Link
                to="/loyalty"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100/70 border border-amber-200 rounded-full text-amber-900 text-xs font-bold transition shadow-sm"
                title="View Loyalty Points Ledger"
              >
                <Award size={14} className="text-amber-700" />
                <span>{user.loyalty_balance} pts</span>
              </Link>

              <Link
                to="/orders"
                className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 hover:text-stone-900 transition"
                title="My Orders & Live Status Tracking"
              >
                <Clock size={18} />
              </Link>
            </>
          )}

          {user?.role === 'staff' || user?.role === 'admin' ? (
            <Link
              to="/staff"
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-stone-800 text-white text-xs font-bold hover:bg-black transition"
            >
              <Shield size={14} />
              <span className="hidden sm:inline">Staff</span>
            </Link>
          ) : null}

          {/* Cart Button */}
          <Link
            to="/checkout"
            className="relative p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 transition"
          >
            <ShoppingBag size={20} />
            {totalCartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-800 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">
                {totalCartCount}
              </span>
            )}
          </Link>

          {/* User Profile & Auth state */}
          {user ? (
            <div className="flex items-center gap-1">
              <Link
                to="/profile"
                className="p-2 rounded-xl bg-stone-100 hover:bg-amber-100/60 text-stone-800 hover:text-amber-950 transition"
                title="View Profile & Orders"
              >
                <UserIcon size={18} />
              </Link>
              <button
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                title="Sign Out"
                className="p-2 rounded-xl text-stone-500 hover:text-red-600 hover:bg-red-50 transition"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-900 hover:bg-amber-950 text-white text-xs font-bold transition"
            >
              <UserIcon size={14} />
              <span>Login</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};