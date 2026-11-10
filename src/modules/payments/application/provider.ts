export type ProviderPayment = {
  method?: string;
  error_code?: string | null;
  error_reason?: string | null;
  amount_refunded?: number;
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
};
export type ProviderOrder = {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
};
export interface PaymentProvider {
  available(): boolean;
  publicKey(): string;
  verifyCheckout(
    orderId: string,
    paymentId: string,
    signature: string,
  ): boolean;
  findOrders(receipt: string): Promise<ProviderOrder[]>;
  orderPayments(orderId: string): Promise<ProviderPayment[]>;
  createOrder(
    amountPaise: number,
    receipt: string,
  ): Promise<{ id: string; amount: number; currency: string }>;
  fetchPayment(id: string): Promise<ProviderPayment>;
}
