export interface ReservationExpiryPort {
  expireBatch(limit: number): Promise<number>;
}
export class ReservationExpiry {
  constructor(private port: ReservationExpiryPort) {}
  sweep() {
    return this.port.expireBatch(100);
  }
}
