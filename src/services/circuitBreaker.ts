import { logger } from './logService';

export enum CircuitState {
  CLOSED,
  OPEN,
  HALF_OPEN
}

export interface CircuitBreakerOptions {
  failureThreshold: number;    // Number of failures before opening
  resetTimeout: number;        // Time in ms to wait before attempting reset
  halfOpenSuccessThreshold: number; // Successes needed in half-open to close
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastError: Error | null = null;
  private nextAttemptTime: number = 0;
  
  private readonly options: CircuitBreakerOptions;
  private readonly serviceKey: string;
  
  constructor(serviceKey: string, options?: Partial<CircuitBreakerOptions>) {
    this.serviceKey = serviceKey;
    this.options = {
      failureThreshold: options?.failureThreshold || 5,
      resetTimeout: options?.resetTimeout || 30000, // 30 seconds
      halfOpenSuccessThreshold: options?.halfOpenSuccessThreshold || 2
    };
  }
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        logger.warn(`Circuit for ${this.serviceKey} is OPEN. Call rejected.`, 'CircuitBreaker', { nextAttempt: new Date(this.nextAttemptTime).toISOString() });
        throw new Error(`Circuit for ${this.serviceKey} is open. Last error: ${this.lastError?.message || 'Service unavailable'}`);
      }
      
      this.state = CircuitState.HALF_OPEN;
      this.successCount = 0;
    }
    
    try {
      const result = await fn();
      this.handleSuccess();
      return result;
    } catch (error) {
      this.handleFailure(error as Error);
      throw error;
    }
  }
  
  private handleSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.options.halfOpenSuccessThreshold) {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
      }
    } else if (this.state === CircuitState.CLOSED && this.failureCount > 0) {
      this.failureCount = 0;
    }
  }
  
  private handleFailure(error: Error): void {
    this.lastError = error;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.options.resetTimeout;
      logger.warn(`Circuit for ${this.serviceKey} REOPENED due to failure in HALF_OPEN state. Reset timeout: ${this.options.resetTimeout}ms`, 'CircuitBreaker', { error: error.message });
    } else if (this.state === CircuitState.CLOSED) {
      this.failureCount++;
      if (this.failureCount >= this.options.failureThreshold) {
        this.state = CircuitState.OPEN;
        this.nextAttemptTime = Date.now() + this.options.resetTimeout;
        logger.error(`Circuit for ${this.serviceKey} OPENED after ${this.failureCount} consecutive failures. Reset timeout: ${this.options.resetTimeout}ms`, 'CircuitBreaker');
      }
    }
  }
  
  getState(): CircuitState {
    return this.state;
  }
  
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttemptTime = 0;
  }
}

const circuitBreakers: Record<string, CircuitBreaker> = {};

export function getCircuitBreaker(serviceKey: string, options?: Partial<CircuitBreakerOptions>): CircuitBreaker {
  if (!circuitBreakers[serviceKey]) {
    circuitBreakers[serviceKey] = new CircuitBreaker(serviceKey, options);
  }
  return circuitBreakers[serviceKey];
}