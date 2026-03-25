export interface Product {
  id: string;
  p_id: number;
  name: string;
  price: number;
  category: string;
  image?: string;
  description: string;
  sizes: string[];
  p_attributes?: any;
  brand?: string;
  stock?: number;
  lowStockThreshold?: number;
  colour?: string;
  avg_rating?: number;
  ratingCount?: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
  size: string;
}

export interface OrderItem {
  productId: number;
  name: string;
  size: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  _id: string;
  orderId: string;
  userId: string;
  userEmail: string;
  items: OrderItem[];
  shippingAddress: {
    fullName: string;
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  loyaltyPointsEarned: number;
  loyaltyTierAtPurchase: string;
  status: "pending" | "paid" | "expired" | "cancelled";
  paymentMethod: string;
  expiresAt: string;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  lowStockCount: number;
}

export interface SalesDataPoint {
  date: string;
  revenue: number;
  orderCount: number;
}
