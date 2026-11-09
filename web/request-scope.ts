// Invalidates asynchronous completions when the account, resource or view changes.
export class RequestScope {
  private key = "";
  private generation = 0;
  update(key: string) {
    if (this.key !== key) {
      this.key = key;
      this.invalidate();
    }
  }
  invalidate() {
    this.generation++;
  }
  capture() {
    const generation = this.generation;
    return () => generation === this.generation;
  }
}
