import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSession, signOut } from "../../lib/auth-client";
import { api } from "../../lib/api";

type Seat = {
  id: string;
  label: string;
  price: number;
  status: "available" | "held" | "reserved";
  heldBy: string | null;
  heldUntil: string | null;
};

export function SeatsPage() {
  const { data: session } = useSession();
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

  function getSeatColor(seat: Seat) {
    if (seat.status === "reserved") return "bg-red-100 border-red-300";
    if (seat.status === "held" && seat.heldBy === session?.user?.id)
      return "bg-blue-100 border-blue-400";
    if (seat.status === "held") return "bg-yellow-100 border-yellow-300";
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
              {session?.user?.name}
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
          <div className="flex gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-green-200 border border-green-400" />
              Available
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-blue-200 border border-blue-400" />
              Held by you
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-yellow-200 border border-yellow-400" />
              Held by others
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-red-200 border border-red-400" />
              Reserved
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {seats.map((seat) => {
            const isMyHold =
              seat.status === "held" && seat.heldBy === session?.user?.id;
            const isActionable =
              seat.status === "available" || isMyHold;

            return (
              <div
                key={seat.id}
                className={`border-2 rounded-lg p-6 transition-colors ${getSeatColor(seat)}`}
              >
                <h3 className="text-lg font-semibold mb-1">{seat.label}</h3>
                <p className="text-2xl font-bold mb-3">
                  {formatPrice(seat.price)}
                </p>

                <p className="text-sm text-gray-500 mb-4 capitalize">
                  {seat.status === "held" && isMyHold
                    ? "Held by you"
                    : seat.status}
                </p>

                {seat.status === "available" && (
                  <button
                    onClick={() => handleHold(seat.id)}
                    disabled={actionLoading === seat.id}
                    className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {actionLoading === seat.id
                      ? "Holding..."
                      : "Select Seat"}
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

                {seat.status === "reserved" && (
                  <p className="text-sm text-red-600 font-medium">
                    This seat has been reserved
                  </p>
                )}

                {seat.status === "held" && !isMyHold && (
                  <p className="text-sm text-yellow-700 font-medium">
                    Currently held by another user
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {seats.some(
          (s) => s.status === "held" && s.heldBy === session?.user?.id
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
