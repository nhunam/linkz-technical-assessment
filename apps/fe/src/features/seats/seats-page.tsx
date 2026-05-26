import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useUser } from "../../lib/auth-client";
import { api } from "../../lib/api";

type Seat = {
  id: string;
  label: string;
  price: number;
  status: "available" | "held" | "reserved";
  heldBy: string | null;
  heldUntil: string | null;
  reservedBy: string | null;
};

export function SeatsPage() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();
  const [seats, setSeats] = useState<Seat[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  const fetchSeats = useCallback(async () => {
    try {
      const data = await api.getSeats();
      setSeats(data.seats);
    } catch {
      setError("Failed to load seats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSeats();
    const interval = setInterval(fetchSeats, 5000);
    return () => clearInterval(interval);
  }, [fetchSeats]);

  async function handleHold(seatId: string) {
    setError("");
    setActionLoading(seatId);
    try {
      await api.holdSeat(seatId);
      await fetchSeats();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRelease(seatId: string) {
    setError("");
    setActionLoading(seatId);
    try {
      await api.releaseSeat(seatId);
      await fetchSeats();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleProceedToPayment(seatId: string) {
    navigate(`/payment/${seatId}`);
  }

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  function getSeatState(seat: Seat) {
    const isMine = seat.heldBy === user?.id || seat.reservedBy === user?.id;
    if (isMine) return "mine" as const;
    if (seat.status === "available") return "available" as const;
    return "unavailable" as const;
  }

  function getSeatColor(seat: Seat) {
    const state = getSeatState(seat);
    if (state === "mine") return "bg-blue-50 border-blue-400";
    if (state === "unavailable") return "bg-gray-100 border-gray-300 opacity-60";
    return "bg-green-50 border-green-300 hover:bg-green-100";
  }

  function formatPrice(cents: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading seats...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">Seat Reservation</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {user?.fullName}
            </span>
            <button
              onClick={handleSignOut}
              className="text-sm text-red-600 hover:underline"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded mb-6 text-sm">
            {error}
          </div>
        )}

        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Available Seats</h2>
          <div className="flex gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-green-200 border border-green-400" />
              Available
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-blue-200 border border-blue-400" />
              Yours
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-gray-200 border border-gray-400" />
              Unavailable
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {seats.map((seat) => {
            const state = getSeatState(seat);
            const isMyHold = seat.status === "held" && seat.heldBy === user?.id;
            const isMyReservation = seat.status === "reserved" && seat.reservedBy === user?.id;

            return (
              <div
                key={seat.id}
                className={`border-2 rounded-lg p-6 transition-colors ${getSeatColor(seat)}`}
              >
                <h3 className="text-lg font-semibold mb-1">{seat.label}</h3>
                <p className="text-2xl font-bold mb-3">
                  {formatPrice(seat.price)}
                </p>

                <p className="text-sm text-gray-500 mb-4">
                  {state === "mine" && isMyHold && "Held by you"}
                  {state === "mine" && isMyReservation && "Reserved by you"}
                  {state === "available" && "Available"}
                  {state === "unavailable" && "Unavailable"}
                </p>

                {state === "available" && (
                  <button
                    onClick={() => handleHold(seat.id)}
                    disabled={actionLoading === seat.id}
                    className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {actionLoading === seat.id ? "Holding..." : "Select Seat"}
                  </button>
                )}

                {isMyHold && (
                  <div className="space-y-2">
                    <button
                      onClick={() => handleProceedToPayment(seat.id)}
                      className="w-full py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                    >
                      Proceed to Payment
                    </button>
                    <button
                      onClick={() => handleRelease(seat.id)}
                      disabled={actionLoading === seat.id}
                      className="w-full py-2 px-4 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50 transition-colors"
                    >
                      Release
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {seats.some(
          (s) => s.status === "held" && s.heldBy === user?.id
        ) && (
          <p className="mt-4 text-sm text-gray-500 text-center">
            Your hold expires in 10 minutes. Complete payment to confirm your
            reservation.
          </p>
        )}
      </main>
    </div>
  );
}
