import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { api } from "../../lib/api";

declare const process: { env: Record<string, string | undefined> };
const stripePromise = loadStripe(
  process.env.PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

type PaymentState =
  | { step: "loading" }
  | {
      step: "checkout";
      payment: any;
      clientSecret: string;
      seatLabel: string;
    }
  | { step: "success"; reservation: any }
  | { step: "error"; message: string };

export function PaymentPage() {
  const { seatId } = useParams<{ seatId: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<PaymentState>({ step: "loading" });

  const initRef = useRef(false);

  useEffect(() => {
    if (!seatId || initRef.current) return;
    initRef.current = true;

    async function initPayment() {
      try {
        const seatsData = await api.getSeats();
        const seat = seatsData.seats.find((s: any) => s.id === seatId);
        const seatLabel = seat?.label || "Unknown Seat";

        const { payment, clientSecret } = await api.createPayment(seatId!);
        setState({ step: "checkout", payment, clientSecret, seatLabel });
      } catch (err: any) {
        setState({ step: "error", message: err.message });
      }
    }

    initPayment();
  }, [seatId]);

  function formatPrice(cents: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
        {state.step === "loading" && (
          <p className="text-center text-gray-500">Preparing payment...</p>
        )}

        {state.step === "checkout" && (
          <Elements
            stripe={stripePromise}
            options={{ clientSecret: state.clientSecret }}
          >
            <CheckoutForm
              payment={state.payment}
              seatLabel={state.seatLabel}
              formatPrice={formatPrice}
              onSuccess={(reservation) =>
                setState({ step: "success", reservation })
              }
              onError={(message) => setState({ step: "error", message })}
              onCancel={() => navigate("/")}
            />
          </Elements>
        )}

        {state.step === "success" && (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-green-700 mb-2">
              Reservation Confirmed!
            </h2>
            <p className="text-gray-600 mb-6">
              Your seat has been successfully reserved.
            </p>
            <button
              onClick={() => navigate("/")}
              className="py-2 px-6 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Back to Seats
            </button>
          </div>
        )}

        {state.step === "error" && (
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-red-700 mb-2">
              Payment Failed
            </h2>
            <p className="text-gray-600 mb-6">{state.message}</p>
            <button
              onClick={() => navigate("/")}
              className="py-2 px-6 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Back to Seats
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CheckoutForm({
  payment,
  seatLabel,
  formatPrice,
  onSuccess,
  onError,
  onCancel,
}: {
  payment: any;
  seatLabel: string;
  formatPrice: (cents: number) => string;
  onSuccess: (reservation: any) => void;
  onError: (message: string) => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);

    const { error } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (error) {
      setProcessing(false);
      onError(error.message || "Payment failed");
      return;
    }

    // Payment succeeded on Stripe side -- poll for webhook to process reservation
    const maxAttempts = 15;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const result = await api.getPaymentStatus(payment.id);
        if (result.payment.status === "completed" && result.reservation) {
          onSuccess(result.reservation);
          return;
        }
        if (result.payment.status === "failed" || result.payment.status === "refunded") {
          onError("Payment was processed but seat reservation failed.");
          return;
        }
      } catch {
        // Keep polling
      }
    }

    onError("Payment processed but reservation is taking longer than expected. Please check back.");
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1 className="text-2xl font-bold text-center mb-6">Confirm Payment</h1>

      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <div className="flex justify-between mb-2">
          <span className="text-gray-600">Seat</span>
          <span className="font-semibold">{seatLabel}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Amount</span>
          <span className="font-semibold">
            {formatPrice(payment.amount)}
          </span>
        </div>
      </div>

      <div className="mb-6">
        <PaymentElement options={{ layout: "tabs" }} />
      </div>

      {processing ? (
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-gray-600 text-sm">Processing payment...</p>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            type="submit"
            disabled={!stripe || !elements}
            className="w-full py-3 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 font-semibold transition-colors disabled:opacity-50"
          >
            Pay {formatPrice(payment.amount)}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full py-2 px-4 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </form>
  );
}
