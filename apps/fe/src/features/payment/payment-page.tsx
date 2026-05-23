import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";

type PaymentState =
  | { step: "loading" }
  | { step: "confirm"; payment: any; seatLabel: string }
  | { step: "processing" }
  | { step: "success"; reservation: any }
  | { step: "error"; message: string };

export function PaymentPage() {
  const { seatId } = useParams<{ seatId: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<PaymentState>({ step: "loading" });

  useEffect(() => {
    if (!seatId) return;

    async function initPayment() {
      try {
        const seatsData = await api.getSeats();
        const seat = seatsData.seats.find((s: any) => s.id === seatId);
        const seatLabel = seat?.label || "Unknown Seat";

        const { payment } = await api.createPayment(seatId!);
        setState({ step: "confirm", payment, seatLabel });
      } catch (err: any) {
        setState({ step: "error", message: err.message });
      }
    }

    initPayment();
  }, [seatId]);

  async function handleConfirm() {
    if (state.step !== "confirm") return;

    setState({ step: "processing" });

    // Simulate payment gateway delay (1-3 seconds)
    await new Promise((resolve) =>
      setTimeout(resolve, 1000 + Math.random() * 2000)
    );

    try {
      const result = await api.confirmPayment(state.payment.id);
      setState({ step: "success", reservation: result.reservation });
    } catch (err: any) {
      setState({ step: "error", message: err.message });
    }
  }

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

        {state.step === "confirm" && (
          <>
            <h1 className="text-2xl font-bold text-center mb-6">
              Confirm Payment
            </h1>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Seat</span>
                <span className="font-semibold">{state.seatLabel}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Amount</span>
                <span className="font-semibold">
                  {formatPrice(state.payment.amount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Payment method</span>
                <span className="text-sm text-gray-500">
                  Mock Payment (Demo)
                </span>
              </div>
            </div>

            <p className="text-xs text-gray-400 mb-4 text-center">
              This is a mock payment for demonstration purposes. No real charge
              will be made.
            </p>

            <div className="space-y-2">
              <button
                onClick={handleConfirm}
                className="w-full py-3 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 font-semibold transition-colors"
              >
                Pay {formatPrice(state.payment.amount)}
              </button>
              <button
                onClick={() => navigate("/")}
                className="w-full py-2 px-4 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {state.step === "processing" && (
          <div className="text-center">
            <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-600 font-medium">Processing payment...</p>
            <p className="text-sm text-gray-400 mt-1">
              Please do not close this page
            </p>
          </div>
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
