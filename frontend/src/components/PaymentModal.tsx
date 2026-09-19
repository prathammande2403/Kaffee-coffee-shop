import React, { useState } from 'react';
import { formatCurrency } from '../utils/formatters';
import {
  X,
  CreditCard,
  Smartphone,
  Building,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ArrowRight,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  amount: number;
  outletName: string;
  pickupType: 'immediate' | 'scheduled';
  scheduledTimeText?: string;
  itemsCount: number;
  onConfirmPayment: () => Promise<void>;
  onClose: () => void;
  isSubmitting: boolean;
  serverError: string | null;
  onClearServerError: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  amount,
  outletName,
  pickupType,
  scheduledTimeText,
  itemsCount,
  onConfirmPayment,
  onClose,
  isSubmitting,
  serverError,
  onClearServerError,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [simulateFailure, setSimulateFailure] = useState<boolean>(false);
  const [localProcessing, setLocalProcessing] = useState<boolean>(false);
  const [localFailure, setLocalFailure] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<boolean>(false);

  // Form Fields
  const [upiId, setUpiId] = useState('alex@okaxis');
  const [cardNumber, setCardNumber] = useState('4532 •••• •••• 8829');
  const [cardExpiry, setCardExpiry] = useState('08/28');
  const [cardCvv, setCardCvv] = useState('321');
  const [cardHolder, setCardHolder] = useState('Alex Turner');

  if (!isOpen) return null;

  const handlePay = async () => {
    setLocalFailure(null);
    onClearServerError();
    setLocalProcessing(true);

    // Test Payment Simulation step
    if (simulateFailure) {
      setTimeout(() => {
        setLocalProcessing(false);
        setLocalFailure(
          'Payment Gateway Failure: Simulated 3D-Secure bank decline (ERR_PAYMENT_SIMULATED_DECLINE). Your cart items have been preserved.'
        );
      }, 1200);
      return;
    }

    try {
      // Realistic gateway authorization handshake
      await new Promise((resolve) => setTimeout(resolve, 800));
      // Call the real backend confirm-payment / order endpoint
      await onConfirmPayment();
      setPaymentSuccess(true);
    } catch (err: any) {
      // Backend error will be handled through serverError prop
      setLocalProcessing(false);
    } finally {
      if (!serverError) {
        setLocalProcessing(false);
      }
    }
  };

  const isBusy = localProcessing || isSubmitting;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/70 backdrop-blur-sm animate-fade-in"
    >
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-stone-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-900 text-white rounded-xl shadow-xs">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-sm sm:text-base">
                Simulated Payment Gateway
              </h3>
              <p className="text-[11px] text-stone-400 font-medium flex items-center gap-1">
                <Lock size={10} /> 256-Bit SSL Encrypted Sandbox
              </p>
            </div>
          </div>

          {!isBusy && !paymentSuccess && (
            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200/60 transition"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Modal Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {paymentSuccess ? (
            <div className="py-8 text-center space-y-3 animate-fade-in">
              <div className="w-16 h-16 bg-green-100 text-green-700 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 size={36} />
              </div>
              <h4 className="font-bold text-lg text-stone-900">Payment Authorized!</h4>
              <p className="text-xs text-stone-500 max-w-xs mx-auto">
                Your order has been transmitted to {outletName}. Redirecting to live tracking...
              </p>
            </div>
          ) : (
            <>
              {/* Order Amount Snapshot */}
              <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-amber-950/70 uppercase tracking-wider block">
                    Amount Payable
                  </span>
                  <span className="text-xl sm:text-2xl font-serif font-black text-amber-950 block">
                    {formatCurrency(amount)}
                  </span>
                </div>
                <div className="text-right text-xs text-stone-600">
                  <span className="font-bold block text-stone-800">{outletName}</span>
                  <span className="text-[11px] text-stone-500 block mt-0.5">
                    {pickupType === 'immediate'
                      ? 'Brew Now'
                      : scheduledTimeText || 'Scheduled'}
                  </span>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-2 uppercase tracking-wider">
                  Select Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('upi')}
                    disabled={isBusy}
                    className={`p-3 rounded-2xl border text-center transition flex flex-col items-center gap-1.5 ${
                      paymentMethod === 'upi'
                        ? 'border-amber-900 bg-amber-50/80 text-amber-950 font-bold ring-1 ring-amber-900/30'
                        : 'border-stone-200 text-stone-600 hover:border-stone-300'
                    }`}
                  >
                    <Smartphone size={18} />
                    <span className="text-xs">UPI Apps</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    disabled={isBusy}
                    className={`p-3 rounded-2xl border text-center transition flex flex-col items-center gap-1.5 ${
                      paymentMethod === 'card'
                        ? 'border-amber-900 bg-amber-50/80 text-amber-950 font-bold ring-1 ring-amber-900/30'
                        : 'border-stone-200 text-stone-600 hover:border-stone-300'
                    }`}
                  >
                    <CreditCard size={18} />
                    <span className="text-xs">Cards</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('netbanking')}
                    disabled={isBusy}
                    className={`p-3 rounded-2xl border text-center transition flex flex-col items-center gap-1.5 ${
                      paymentMethod === 'netbanking'
                        ? 'border-amber-900 bg-amber-50/80 text-amber-950 font-bold ring-1 ring-amber-900/30'
                        : 'border-stone-200 text-stone-600 hover:border-stone-300'
                    }`}
                  >
                    <Building size={18} />
                    <span className="text-xs">NetBanking</span>
                  </button>
                </div>
              </div>

              {/* Method Specific Form */}
              {paymentMethod === 'upi' && (
                <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 space-y-2.5">
                  <label className="block text-[11px] font-bold text-stone-600">
                    Virtual Payment Address (VPA / UPI ID)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      disabled={isBusy}
                      className="flex-1 px-3 py-2 text-xs border border-stone-300 rounded-xl bg-white font-mono outline-none focus:border-amber-800"
                    />
                    <span className="px-2.5 py-1.5 bg-green-50 border border-green-200 text-green-800 text-[10px] font-extrabold rounded-xl flex items-center gap-1">
                      <CheckCircle2 size={12} /> Verified
                    </span>
                  </div>
                  <div className="flex gap-1.5 text-[10px] text-stone-400 pt-1">
                    <span>Quick:</span>
                    <button
                      type="button"
                      onClick={() => setUpiId('alex@okaxis')}
                      className="text-stone-700 underline font-semibold"
                    >
                      Google Pay
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setUpiId('alex@ybl')}
                      className="text-stone-700 underline font-semibold"
                    >
                      PhonePe
                    </button>
                  </div>
                </div>
              )}

              {paymentMethod === 'card' && (
                <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 space-y-2.5 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">
                      Card Number
                    </label>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      disabled={isBusy}
                      className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white font-mono outline-none focus:border-amber-800"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-stone-600 mb-1">
                        Expiry Date
                      </label>
                      <input
                        type="text"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        disabled={isBusy}
                        className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white font-mono outline-none focus:border-amber-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-stone-600 mb-1">
                        CVV
                      </label>
                      <input
                        type="password"
                        maxLength={4}
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        disabled={isBusy}
                        className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white font-mono outline-none focus:border-amber-800"
                      />
                    </div>
                  </div>
                </div>
              )}

              {paymentMethod === 'netbanking' && (
                <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 text-xs text-stone-600 space-y-2">
                  <span className="font-bold text-stone-800 block">Popular Banks</span>
                  <div className="grid grid-cols-2 gap-2">
                    {['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank'].map((b) => (
                      <button
                        key={b}
                        type="button"
                        className="p-2 border border-stone-200 bg-white rounded-xl text-left font-medium hover:border-amber-800 text-[11px]"
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Gateway Simulation Mode Toggle (For testing failure states vs success) */}
              <div className="p-3.5 bg-stone-100/70 border border-stone-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-stone-700">
                  <span className="flex items-center gap-1.5">
                    <Sparkles size={14} className="text-amber-800" />
                    <span>Test Gateway Simulation Mode</span>
                  </span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-white border border-stone-200 text-stone-600">
                    QA Tester
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setSimulateFailure(false)}
                    disabled={isBusy}
                    className={`py-2 px-2.5 rounded-xl border font-bold transition flex items-center justify-center gap-1.5 ${
                      !simulateFailure
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-xs'
                        : 'border-stone-200 bg-white text-stone-600'
                    }`}
                  >
                    <CheckCircle2 size={13} className="text-emerald-600" />
                    <span>Success (Pass)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSimulateFailure(true)}
                    disabled={isBusy}
                    className={`py-2 px-2.5 rounded-xl border font-bold transition flex items-center justify-center gap-1.5 ${
                      simulateFailure
                        ? 'border-red-600 bg-red-50 text-red-900 shadow-xs'
                        : 'border-stone-200 bg-white text-stone-600'
                    }`}
                  >
                    <AlertTriangle size={13} className="text-red-600" />
                    <span>Fail Payment</span>
                  </button>
                </div>
                <p className="text-[10px] text-stone-400">
                  {simulateFailure
                    ? '⚠️ Will simulate an authentic 3D-Secure payment failure without placing order.'
                    : '⚡ Will authorize payment and call the backend POST /api/orders endpoint.'}
                </p>
              </div>

              {/* Local Gateway Failure Feedback */}
              {localFailure && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-red-800 text-xs space-y-1.5 animate-shake">
                  <div className="font-bold flex items-center gap-1.5 text-red-900">
                    <AlertTriangle size={15} />
                    <span>Transaction Failed</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">{localFailure}</p>
                </div>
              )}

              {/* Server-side Error Feedback (e.g. Outlet Closed, Item unavailable) */}
              {serverError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 text-xs space-y-1.5 animate-shake">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle size={15} className="text-rose-700" />
                    <span>Order Confirmation Rejected</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">{serverError}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer CTA */}
        {!paymentSuccess && (
          <div className="p-4 sm:p-5 border-t border-stone-200 bg-stone-50/80 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              className="px-4 py-3 border border-stone-300 rounded-2xl text-xs font-bold text-stone-700 hover:bg-white transition disabled:opacity-40"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handlePay}
              disabled={isBusy}
              className="flex-1 py-3.5 px-4 bg-amber-900 hover:bg-amber-950 active:scale-[0.99] text-white rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition shadow-lg shadow-amber-950/20 disabled:opacity-50"
            >
              {isBusy ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Authorizing Payment...</span>
                </>
              ) : (
                <>
                  <span>
                    {localFailure
                      ? 'Retry Payment'
                      : `Confirm & Pay ${formatCurrency(amount)}`}
                  </span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
