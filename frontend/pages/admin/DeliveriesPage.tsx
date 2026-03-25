import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import type { Delivery } from "@/lib/types";

const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  pending_pickup: { icon: <Package size={12} />, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400", label: "Pending Pickup" },
  in_transit: { icon: <Truck size={12} />, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400", label: "In Transit" },
  delivered: { icon: <CheckCircle size={12} />, color: "text-green-600 bg-green-50 dark:bg-green-950/30 dark:text-green-400", label: "Delivered" },
  failed: { icon: <XCircle size={12} />, color: "text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400", label: "Failed" },
  returned: { icon: <RotateCcw size={12} />, color: "text-gray-500 bg-gray-50 dark:bg-gray-900/30 dark:text-gray-400", label: "Returned" },
};

const statusFilters = ["all", "pending_pickup", "in_transit", "delivered", "failed", "returned"];
const statusLabels: Record<string, string> = {
  all: "All",
  pending_pickup: "Pending",
  in_transit: "In Transit",
  delivered: "Delivered",
  failed: "Failed",
  returned: "Returned",
};

const nextStatusMap: Record<string, string[]> = {
  pending_pickup: ["in_transit", "failed"],
  in_transit: ["delivered", "failed"],
  failed: ["pending_pickup", "returned"],
  delivered: [],
  returned: [],
};

interface DeliveryStats {
  byStatus: Record<string, number>;
  byMethod: Record<string, number>;
  totalDeliveries: number;
  totalFees: number;
}

export default function DeliveriesPage() {
  const { token } = useAuth();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DeliveryStats | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState("");
  const [proofInput, setProofInput] = useState("");

  const fetchDeliveries = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const statusParam = filter !== "all" ? `&status=${filter}` : "";
      const data = await apiFetch<{ deliveries: Delivery[]; total: number }>(
        `/admin/deliveries?page=${page}${statusParam}`,
        { token }
      );
      setDeliveries(data.deliveries);
      setTotal(data.total);
    } catch {
      toast.error("Failed to load deliveries");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!token) return;
    try {
      const data = await apiFetch<DeliveryStats>("/admin/deliveries/stats", { token });
      setStats(data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchDeliveries();
    fetchStats();
  }, [token, page, filter]);

  const handleStatusUpdate = async (deliveryId: string, newStatus: string) => {
    if (!token) return;
    try {
      await apiFetch(`/admin/deliveries/${deliveryId}/status`, {
        method: "PUT",
        token,
        body: {
          status: newStatus,
          note: statusNote,
          proofOfDelivery: newStatus === "delivered" ? proofInput : undefined,
        },
      });
      toast.success(`Delivery updated to ${statusConfig[newStatus]?.label || newStatus}`);
      setStatusNote("");
      setProofInput("");
      setExpandedId(null);
      fetchDeliveries();
      fetchStats();
    } catch (err: any) {
      toast.error(err.message || "Failed to update delivery");
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold tracking-wider text-foreground">
        Delivery Dashboard
      </h1>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="border border-border rounded-sm p-4">
            <p className="font-body text-xs uppercase tracking-wider text-muted-foreground">Total Deliveries</p>
            <p className="font-display text-2xl text-foreground">{stats.totalDeliveries}</p>
          </div>
          <div className="border border-border rounded-sm p-4">
            <p className="font-body text-xs uppercase tracking-wider text-muted-foreground">Pending Pickup</p>
            <p className="font-display text-2xl text-amber-600">{stats.byStatus.pending_pickup || 0}</p>
          </div>
          <div className="border border-border rounded-sm p-4">
            <p className="font-body text-xs uppercase tracking-wider text-muted-foreground">In Transit</p>
            <p className="font-display text-2xl text-blue-600">{stats.byStatus.in_transit || 0}</p>
          </div>
          <div className="border border-border rounded-sm p-4">
            <p className="font-body text-xs uppercase tracking-wider text-muted-foreground">Delivered</p>
            <p className="font-display text-2xl text-green-600">{stats.byStatus.delivered || 0}</p>
          </div>
        </div>
      )}

      {/* Status Filters */}
      <div className="flex gap-2 flex-wrap">
        {statusFilters.map((s) => (
          <button
            key={s}
            onClick={() => {
              setFilter(s);
              setPage(1);
            }}
            className={`font-body text-xs uppercase tracking-wider px-3 py-1.5 rounded-sm transition-colors ${
              filter === s
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            {statusLabels[s]}
          </button>
        ))}
      </div>

      <p className="font-body text-sm text-muted-foreground">{total} deliveries</p>

      {loading ? (
        <p className="font-body text-muted-foreground py-8 text-center">Loading...</p>
      ) : deliveries.length === 0 ? (
        <p className="font-body text-muted-foreground py-8 text-center">No deliveries found</p>
      ) : (
        <div className="space-y-4">
          {deliveries.map((delivery) => {
            const sc = statusConfig[delivery.status] || statusConfig.pending_pickup;
            const isExpanded = expandedId === delivery.deliveryId;
            const nextStatuses = nextStatusMap[delivery.status] || [];

            return (
              <div key={delivery.deliveryId} className="border border-border rounded-sm overflow-hidden">
                {/* Summary Row */}
                <div
                  className="p-4 flex items-center gap-4 cursor-pointer hover:bg-secondary/10"
                  onClick={() => setExpandedId(isExpanded ? null : delivery.deliveryId)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-body text-sm font-medium text-foreground">{delivery.deliveryId}</p>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-body ${sc.color}`}>
                        {sc.icon} {sc.label}
                      </span>
                    </div>
                    <p className="font-body text-xs text-muted-foreground">
                      Order: {delivery.orderId} · {delivery.recipientName}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-body text-sm text-foreground">
                      {delivery.deliveryAddress.city}
                    </p>
                    <p className="font-body text-xs text-muted-foreground">
                      {delivery.deliveryMethod} · {delivery.itemCount} item{delivery.itemCount > 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-body text-xs text-muted-foreground">
                      {new Date(delivery.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-border p-4 bg-secondary/5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <h3 className="font-body text-xs uppercase tracking-wider text-muted-foreground font-medium">
                          Delivery Details
                        </h3>
                        <div className="space-y-1 font-body text-sm">
                          <div className="flex items-center gap-2">
                            <Package size={14} className="text-muted-foreground" />
                            <span>{delivery.recipientName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone size={14} className="text-muted-foreground" />
                            <span>{delivery.contactNumber || "N/A"}</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <MapPin size={14} className="text-muted-foreground shrink-0 mt-0.5" />
                            <span>
                              {delivery.deliveryAddress.street}, {delivery.deliveryAddress.city},{" "}
                              {delivery.deliveryAddress.state} {delivery.deliveryAddress.zip}
                            </span>
                          </div>
                          {delivery.scheduledDate && (
                            <div className="flex items-center gap-2">
                              <Clock size={14} className="text-muted-foreground" />
                              <span>
                                {new Date(delivery.scheduledDate).toLocaleDateString()} -{" "}
                                {delivery.scheduledTimeSlot}
                              </span>
                            </div>
                          )}
                          {delivery.deliveryNotes && (
                            <p className="text-xs text-muted-foreground italic mt-1">
                              Notes: {delivery.deliveryNotes}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h3 className="font-body text-xs uppercase tracking-wider text-muted-foreground font-medium">
                          Status History
                        </h3>
                        <div className="space-y-2">
                          {delivery.statusHistory
                            .slice()
                            .reverse()
                            .map((entry, i) => {
                              const eSc = statusConfig[entry.status] || statusConfig.pending_pickup;
                              return (
                                <div key={i} className="flex items-start gap-2 font-body text-xs">
                                  <span className={eSc.color}>{eSc.icon}</span>
                                  <div>
                                    <span className="text-foreground font-medium">{eSc.label}</span>
                                    <span className="text-muted-foreground ml-2">
                                      {new Date(entry.timestamp).toLocaleString()}
                                    </span>
                                    {entry.note && (
                                      <p className="text-muted-foreground">{entry.note}</p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    </div>

                    {delivery.deliveredAt && (
                      <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-sm p-3">
                        <p className="font-body text-sm text-green-700 dark:text-green-400">
                          Delivered on{" "}
                          {new Date(delivery.deliveredAt).toLocaleString()}
                        </p>
                        {delivery.proofOfDelivery && (
                          <p className="font-body text-xs text-green-600 mt-1">
                            Proof: {delivery.proofOfDelivery}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Status Update Actions */}
                    {nextStatuses.length > 0 && (
                      <>
                        <Separator />
                        <div className="space-y-3">
                          <h3 className="font-body text-xs uppercase tracking-wider text-muted-foreground font-medium">
                            Update Status
                          </h3>
                          <div className="flex gap-2">
                            <Input
                              value={statusNote}
                              onChange={(e) => setStatusNote(e.target.value)}
                              placeholder="Status note (optional)"
                              className="rounded-sm font-body text-sm flex-1"
                            />
                          </div>
                          {nextStatuses.includes("delivered") && (
                            <Input
                              value={proofInput}
                              onChange={(e) => setProofInput(e.target.value)}
                              placeholder="Proof of delivery (e.g., signature, photo ref)"
                              className="rounded-sm font-body text-sm"
                            />
                          )}
                          <div className="flex gap-2">
                            {nextStatuses.map((ns) => {
                              const nsSc = statusConfig[ns];
                              return (
                                <Button
                                  key={ns}
                                  size="sm"
                                  onClick={() => handleStatusUpdate(delivery.deliveryId, ns)}
                                  className={`rounded-sm font-body text-xs ${
                                    ns === "delivered"
                                      ? "bg-green-600 hover:bg-green-700 text-white"
                                      : ns === "failed" || ns === "returned"
                                      ? "bg-red-600 hover:bg-red-700 text-white"
                                      : ""
                                  }`}
                                >
                                  {nsSc?.label || ns}
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
          className="rounded-sm font-body text-xs"
        >
          Previous
        </Button>
        <span className="font-body text-sm text-muted-foreground self-center">Page {page}</span>
        <Button
          variant="outline"
          size="sm"
          disabled={deliveries.length < 20}
          onClick={() => setPage(page + 1)}
          className="rounded-sm font-body text-xs"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
