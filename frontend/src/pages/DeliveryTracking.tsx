import { useState, useEffect } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Package,
  Truck,
  CheckCircle,
  XCircle,
  RotateCcw,
  Clock,
  MapPin,
  Phone,
  FileText,
  Calendar,
} from "lucide-react";
import type { Delivery } from "@/lib/types";

const statusConfig: Record<
  string,
  { icon: React.ReactNode; color: string; label: string; bgColor: string }
> = {
  pending_pickup: {
    icon: <Package size={20} />,
    color: "text-amber-600",
    label: "Pending Pickup",
    bgColor: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
  },
  in_transit: {
    icon: <Truck size={20} />,
    color: "text-blue-600",
    label: "In Transit",
    bgColor: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
  },
  delivered: {
    icon: <CheckCircle size={20} />,
    color: "text-green-600",
    label: "Delivered",
    bgColor: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800",
  },
  failed: {
    icon: <XCircle size={20} />,
    color: "text-red-600",
    label: "Failed",
    bgColor: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800",
  },
  returned: {
    icon: <RotateCcw size={20} />,
    color: "text-gray-600",
    label: "Returned",
    bgColor: "bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-800",
  },
};

const methodLabels: Record<string, string> = {
  standard: "Standard Delivery (5-7 days)",
  express: "Express Delivery (2-3 days)",
  "same-day": "Same-Day Delivery",
};

const timeSlotLabels: Record<string, string> = {
  any: "Any Time",
  morning: "Morning (9 AM - 12 PM)",
  afternoon: "Afternoon (12 PM - 5 PM)",
  evening: "Evening (5 PM - 9 PM)",
};

export default function DeliveryTracking() {
  const { deliveryId } = useParams<{ deliveryId: string }>();
  const { user, token, loading } = useAuth();
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [loadingDelivery, setLoadingDelivery] = useState(true);

  useEffect(() => {
    if (!token || !deliveryId) return;
    apiFetch<Delivery>(`/deliveries/${deliveryId}`, { token })
      .then(setDelivery)
      .catch(() => toast.error("Failed to load delivery"))
      .finally(() => setLoadingDelivery(false));
  }, [token, deliveryId]);

  if (!loading && !user) return <Navigate to="/auth" />;

  if (loadingDelivery) {
    return (
      <main className="min-h-[70vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </main>
    );
  }

  if (!delivery) {
    return (
      <main className="min-h-[70vh] flex flex-col items-center justify-center px-6 py-16 space-y-4">
        <Package size={48} className="text-muted-foreground" />
        <p className="font-body text-muted-foreground">Delivery not found</p>
        <Button asChild variant="outline" className="rounded-sm font-body uppercase tracking-widest text-sm">
          <Link to="/orders">Back to Orders</Link>
        </Button>
      </main>
    );
  }

  const sc = statusConfig[delivery.status] || statusConfig.pending_pickup;
  const steps = ["pending_pickup", "in_transit", "delivered"];
  const currentStepIndex = steps.indexOf(delivery.status);
  const isFailed = delivery.status === "failed" || delivery.status === "returned";

  return (
    <main className="min-h-[70vh] py-12 px-6">
      <div className="container mx-auto max-w-3xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-wider text-foreground">
              Delivery Tracking
            </h1>
            <p className="font-body text-sm text-muted-foreground mt-1">
              {delivery.deliveryId}
            </p>
          </div>
          <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-sm text-sm font-body border ${sc.bgColor} ${sc.color}`}>
            {sc.icon}
            {sc.label}
          </span>
        </div>

        {/* Progress Bar */}
        {!isFailed && (
          <div className="mb-10">
            <div className="flex items-center justify-between relative">
              {steps.map((step, i) => {
                const stepSc = statusConfig[step];
                const isCompleted = i <= currentStepIndex;
                const isCurrent = i === currentStepIndex;
                return (
                  <div key={step} className="flex flex-col items-center z-10 relative">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                        isCompleted
                          ? "bg-foreground border-foreground text-background"
                          : "bg-background border-border text-muted-foreground"
                      } ${isCurrent ? "ring-2 ring-offset-2 ring-foreground" : ""}`}
                    >
                      {stepSc.icon}
                    </div>
                    <p className={`font-body text-xs mt-2 ${isCompleted ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                      {stepSc.label}
                    </p>
                  </div>
                );
              })}
              {/* Connecting line */}
              <div className="absolute top-5 left-[10%] right-[10%] h-0.5 bg-border -z-0">
                <div
                  className="h-full bg-foreground transition-all"
                  style={{ width: `${Math.min(100, (currentStepIndex / (steps.length - 1)) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Delivery Info */}
          <div className="border border-border rounded-sm p-6 space-y-4">
            <h2 className="font-display text-lg tracking-wider text-foreground">Delivery Info</h2>
            <div className="space-y-3 font-body text-sm">
              <div className="flex items-start gap-2">
                <MapPin size={16} className="text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-foreground">{delivery.deliveryAddress.street}</p>
                  <p className="text-muted-foreground">
                    {delivery.deliveryAddress.city}, {delivery.deliveryAddress.state} {delivery.deliveryAddress.zip}
                  </p>
                  <p className="text-muted-foreground">{delivery.deliveryAddress.country}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Package size={16} className="text-muted-foreground shrink-0" />
                <span className="text-foreground">{delivery.recipientName}</span>
              </div>
              {delivery.contactNumber && (
                <div className="flex items-center gap-2">
                  <Phone size={16} className="text-muted-foreground shrink-0" />
                  <span className="text-foreground">{delivery.contactNumber}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Truck size={16} className="text-muted-foreground shrink-0" />
                <span className="text-foreground">{methodLabels[delivery.deliveryMethod] || delivery.deliveryMethod}</span>
              </div>
              {delivery.scheduledDate && (
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-muted-foreground shrink-0" />
                  <span className="text-foreground">
                    {new Date(delivery.scheduledDate).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                    {" - "}
                    {timeSlotLabels[delivery.scheduledTimeSlot] || delivery.scheduledTimeSlot}
                  </span>
                </div>
              )}
              {!delivery.scheduledDate && delivery.scheduledTimeSlot !== "any" && (
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-muted-foreground shrink-0" />
                  <span className="text-foreground">
                    {timeSlotLabels[delivery.scheduledTimeSlot]}
                  </span>
                </div>
              )}
              {delivery.deliveryNotes && (
                <div className="flex items-start gap-2">
                  <FileText size={16} className="text-muted-foreground shrink-0 mt-0.5" />
                  <span className="text-muted-foreground italic">{delivery.deliveryNotes}</span>
                </div>
              )}
            </div>

            {delivery.deliveredAt && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="font-body text-sm text-green-600 font-medium">
                    Delivered on {new Date(delivery.deliveredAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  {delivery.proofOfDelivery && (
                    <p className="font-body text-xs text-muted-foreground">
                      Proof: {delivery.proofOfDelivery}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Status History */}
          <div className="border border-border rounded-sm p-6 space-y-4">
            <h2 className="font-display text-lg tracking-wider text-foreground">Status History</h2>
            <div className="space-y-4">
              {delivery.statusHistory
                .slice()
                .reverse()
                .map((entry, i) => {
                  const entrySc = statusConfig[entry.status] || statusConfig.pending_pickup;
                  return (
                    <div key={i} className="flex gap-3">
                      <div className={`shrink-0 mt-0.5 ${entrySc.color}`}>
                        {entrySc.icon}
                      </div>
                      <div>
                        <p className="font-body text-sm font-medium text-foreground">
                          {entrySc.label}
                        </p>
                        <p className="font-body text-xs text-muted-foreground">
                          {new Date(entry.timestamp).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        {entry.note && (
                          <p className="font-body text-xs text-muted-foreground mt-1">
                            {entry.note}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Order Summary */}
        <div className="mt-6 border border-border rounded-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-body text-sm text-muted-foreground">Order</p>
              <p className="font-display text-sm font-medium text-foreground">{delivery.orderId}</p>
            </div>
            <div className="text-right">
              <p className="font-body text-sm text-muted-foreground">{delivery.itemCount} item{delivery.itemCount > 1 ? "s" : ""}</p>
              <p className="font-display text-sm font-medium text-foreground">LKR {delivery.orderTotal.toLocaleString()}</p>
            </div>
          </div>
          {delivery.deliveryFee > 0 && (
            <p className="font-body text-xs text-muted-foreground mt-2">
              Delivery fee: LKR {delivery.deliveryFee.toLocaleString()}
            </p>
          )}
        </div>

        <div className="flex gap-4 mt-8 justify-center">
          <Button asChild variant="outline" className="rounded-sm font-body uppercase tracking-widest text-sm">
            <Link to="/orders">Back to Orders</Link>
          </Button>
          <Button asChild className="bg-foreground text-background hover:bg-foreground/90 rounded-sm font-body uppercase tracking-widest text-sm">
            <Link to="/shop">Continue Shopping</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
