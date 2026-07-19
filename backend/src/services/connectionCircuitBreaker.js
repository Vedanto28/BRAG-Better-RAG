export class ConnectionCircuitBreaker {
  constructor(providerName, maxAttempts = 3, windowMs = 60000) {
    this.providerName = providerName;
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
    this.attempts = [];
    this.tripped = false;
    this.trippedAt = null;
  }

  recordAttempt() {
    const now = Date.now();
    // Keep only attempts within the window
    this.attempts = this.attempts.filter(t => now - t < this.windowMs);
    this.attempts.push(now);

    if (this.attempts.length > this.maxAttempts) {
      this.tripped = true;
      this.trippedAt = now;
      console.warn(`[CircuitBreaker] Provider ${this.providerName} connection circuit tripped. Too many reconnect attempts (${this.attempts.length} > ${this.maxAttempts}) in ${this.windowMs}ms. Failing closed.`);
      return false; // Tripped engaged
    }
    return true; // OK
  }

  isTripped() {
    return this.tripped;
  }

  reset() {
    this.attempts = [];
    this.tripped = false;
    this.trippedAt = null;
    console.log(`[CircuitBreaker] Provider ${this.providerName} connection circuit reset.`);
  }
}
