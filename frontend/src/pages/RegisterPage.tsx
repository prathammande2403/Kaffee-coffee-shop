import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Coffee, ArrowRight, User, Mail, Phone, Lock, AlertCircle, Award } from 'lucide-react';

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<{
    fullName?: string;
    email?: string;
    phone?: string;
    password?: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Client-side form validation
  const validateForm = () => {
    const errors: { fullName?: string; email?: string; phone?: string; password?: string } = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneClean = phone.replace(/[\s-]/g, '');

    if (!fullName.trim() || fullName.trim().length < 2) {
      errors.fullName = 'Full name must be at least 2 characters.';
    } else if (fullName.trim().length > 100) {
      errors.fullName = 'Full name cannot exceed 100 characters.';
    }

    if (!email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!emailRegex.test(email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!phoneClean) {
      errors.phone = 'Phone number is required.';
    } else if (!/^\+?[0-9]{10,15}$/.test(phoneClean)) {
      errors.phone = 'Phone number must be between 10 and 15 digits.';
    }

    if (!password) {
      errors.password = 'Password is required.';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters.';
    } else if (password.length > 128) {
      errors.password = 'Password cannot exceed 128 characters.';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const phoneClean = phone.replace(/[\s-]/g, '');
      await register(fullName.trim(), email.trim(), password, phoneClean);
      navigate('/menu');
    } catch (err: any) {
      if (err.response?.status === 400) {
        setError(
          err.response?.data?.detail ||
            'A user with this email or phone number already exists.'
        );
      } else if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else if (err.message === 'Network Error' || !err.response) {
        setError('Network error: Unable to connect to the roastery server. Check your connection.');
      } else {
        setError('Failed to create your account. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 selection:bg-amber-200 selection:text-amber-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 -right-20 w-80 h-80 bg-amber-200/30 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-1/4 -left-20 w-80 h-80 bg-orange-200/20 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-xl border border-stone-200/80">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <Link to="/" className="inline-block group mb-3">
            <div className="w-13 h-13 p-3 bg-amber-900 group-hover:bg-amber-950 text-amber-100 rounded-2xl flex items-center justify-center mx-auto shadow-md transition transform group-hover:scale-105">
              <Coffee size={26} />
            </div>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
            Join Kaffa Roasters
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 mt-1 flex items-center justify-center gap-1.5">
            <Award size={14} className="text-amber-700" />
            <span>Earn loyalty points on every handcrafted brew</span>
          </p>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="p-3.5 mb-5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5">
            <AlertCircle size={16} className="shrink-0 text-rose-600 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">
              Full Name
            </label>
            <div className="relative">
              <User
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none"
              />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (validationErrors.fullName)
                    setValidationErrors((prev) => ({ ...prev, fullName: undefined }));
                }}
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm text-stone-900 placeholder-stone-400 outline-none transition ${
                  validationErrors.fullName
                    ? 'border-rose-400 bg-rose-50/20 focus:border-rose-600'
                    : 'border-stone-200 focus:border-amber-800 focus:ring-2 focus:ring-amber-800/10'
                }`}
                placeholder="Alex Turner"
              />
            </div>
            {validationErrors.fullName && (
              <p className="text-[11px] text-rose-600 mt-1 font-semibold">
                {validationErrors.fullName}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none"
              />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (validationErrors.email)
                    setValidationErrors((prev) => ({ ...prev, email: undefined }));
                }}
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm text-stone-900 placeholder-stone-400 outline-none transition ${
                  validationErrors.email
                    ? 'border-rose-400 bg-rose-50/20 focus:border-rose-600'
                    : 'border-stone-200 focus:border-amber-800 focus:ring-2 focus:ring-amber-800/10'
                }`}
                placeholder="alex@coffee.com"
              />
            </div>
            {validationErrors.email && (
              <p className="text-[11px] text-rose-600 mt-1 font-semibold">
                {validationErrors.email}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">
              Phone Number
            </label>
            <div className="relative">
              <Phone
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none"
              />
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (validationErrors.phone)
                    setValidationErrors((prev) => ({ ...prev, phone: undefined }));
                }}
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm text-stone-900 placeholder-stone-400 outline-none transition ${
                  validationErrors.phone
                    ? 'border-rose-400 bg-rose-50/20 focus:border-rose-600'
                    : 'border-stone-200 focus:border-amber-800 focus:ring-2 focus:ring-amber-800/10'
                }`}
                placeholder="9123456780"
              />
            </div>
            {validationErrors.phone && (
              <p className="text-[11px] text-rose-600 mt-1 font-semibold">
                {validationErrors.phone}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none"
              />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (validationErrors.password)
                    setValidationErrors((prev) => ({ ...prev, password: undefined }));
                }}
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm text-stone-900 placeholder-stone-400 outline-none transition ${
                  validationErrors.password
                    ? 'border-rose-400 bg-rose-50/20 focus:border-rose-600'
                    : 'border-stone-200 focus:border-amber-800 focus:ring-2 focus:ring-amber-800/10'
                }`}
                placeholder="••••••••"
              />
            </div>
            {validationErrors.password && (
              <p className="text-[11px] text-rose-600 mt-1 font-semibold">
                {validationErrors.password}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-amber-900 hover:bg-amber-950 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition shadow-sm active:scale-[0.99] disabled:opacity-50"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Create Roastery Account</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        {/* Footer Link */}
        <p className="text-center text-xs text-stone-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="font-bold text-amber-900 hover:underline">
            Sign In here
          </Link>
        </p>
      </div>
    </div>
  );
};