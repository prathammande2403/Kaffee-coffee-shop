import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Role } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Role[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-8 h-8 border-4 border-amber-800 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl border border-stone-200 p-8 max-w-md w-full text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 bg-rose-100 text-rose-700 rounded-2xl flex items-center justify-center mx-auto">
            <span className="text-2xl font-black">🔒</span>
          </div>
          <h2 className="text-xl font-bold text-stone-900">Staff Privileges Required</h2>
          <p className="text-xs text-stone-500 leading-relaxed">
            This administration portal is restricted to authorized store staff and managers (roles:{' '}
            <code className="bg-stone-100 px-1.5 py-0.5 rounded font-mono font-bold text-stone-700">
              staff
            </code>{' '}
            or{' '}
            <code className="bg-stone-100 px-1.5 py-0.5 rounded font-mono font-bold text-stone-700">
              admin
            </code>
            ). Your account role is{' '}
            <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono font-bold text-amber-900">
              {user.role}
            </code>
            .
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <NavigateToMenuButton />
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const NavigateToMenuButton: React.FC = () => {
  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <a
        href="/login"
        className="flex-1 py-2.5 px-4 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-xl transition text-center"
      >
        Sign in as Staff
      </a>
      <a
        href="/menu"
        className="flex-1 py-2.5 px-4 border border-stone-300 hover:bg-stone-50 text-stone-700 text-xs font-bold rounded-xl transition text-center"
      >
        Return to Menu
      </a>
    </div>
  );
};