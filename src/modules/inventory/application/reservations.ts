import { validateComponents, type Component } from "../domain/reservation.ts";
export interface ReservationPort {
  reserve(ownerId: string, key: string, items: Component[]): Promise<unknown>;
  get(ownerId: string, id: string): Promise<unknown>;
  release(ownerId: string, id: string): Promise<unknown>;
}
export class Reservations {
  constructor(private readonly port: ReservationPort) {}
  reserve(ownerId: string, key: string, items: Component[]) {
    return this.port.reserve(ownerId, key, validateComponents(items));
  }
  get(ownerId: string, id: string) {
    return this.port.get(ownerId, id);
  }
  release(ownerId: string, id: string) {
    return this.port.release(ownerId, id);
  }
}
