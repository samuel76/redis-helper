export interface RedisConfig {
  url?: string;
  keyPrefix?: string;
  defaultTtl?: number;
  socket?: {
    reconnectStrategy?: (retries: number) => number;
    connectTimeout?: number;
  };
}

export interface RedisClient {
  isReady: boolean;
  connect(): Promise<void>;
  quit(): Promise<void>;
  disconnect(): Promise<void>;
  
  // Basic key-value operations
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  setEx(key: string, seconds: number, value: string): Promise<void>;
  del(...keys: string[]): Promise<number>;
  exists(...keys: string[]): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
  
  // Hash operations
  hGet(key: string, field: string): Promise<string | null>;
  hSet(key: string, field: string, value: string): Promise<number>;
  hGetAll(key: string): Promise<Record<string, string>>;
  hDel(key: string, ...fields: string[]): Promise<number>;
  
  // List operations
  lPush(key: string, ...elements: string[]): Promise<number>;
  rPush(key: string, ...elements: string[]): Promise<number>;
  lPop(key: string): Promise<string | null>;
  rPop(key: string): Promise<string | null>;
  lRange(key: string, start: number, stop: number): Promise<string[]>;
  
  // Set operations
  sAdd(key: string, ...members: string[]): Promise<number>;
  sMembers(key: string): Promise<string[]>;
  sRem(key: string, ...members: string[]): Promise<number>;
  
  // Sorted set operations
  zAdd(key: string, score: number, member: string): Promise<number>;
  zRange(key: string, start: number, stop: number): Promise<string[]>;
  zRem(key: string, ...members: string[]): Promise<number>;
  
  // Counter operations
  incr(key: string): Promise<number>;
  decr(key: string): Promise<number>;
  incrBy(key: string, increment: number): Promise<number>;
  decrBy(key: string, decrement: number): Promise<number>;
  
  // Pub/Sub operations
  publish(channel: string, message: string): Promise<number>;
  subscribe(channel: string, listener: (message: string, channel: string) => void): Promise<void>;
  unsubscribe(...channels: string[]): Promise<void>;
  pSubscribe(pattern: string, listener: (message: string, channel: string) => void): Promise<void>;
  pUnsubscribe(...patterns: string[]): Promise<void>;
  
  // Advanced operations
  keys(pattern: string): Promise<string[]>;
  scan(cursor: number, options?: { MATCH?: string; COUNT?: number }): Promise<{ cursor: number; keys: string[] }>;
}

/**
 * Initialize Redis with custom configuration
 * @param userConfig - Optional configuration to override defaults
 * @returns Promise that resolves when Redis is connected
 */
export function initRedis(userConfig?: RedisConfig): Promise<void>;

/**
 * Check if Redis is initialized and ready for operations
 * @returns True if Redis client is connected and ready
 */
export function isRedisReady(): boolean;

/**
 * Get Redis client instance for advanced operations
 * @returns Redis client instance
 * @throws Error if Redis client is not initialized
 */
export function getRedisClient(): RedisClient;

/**
 * Get Redis publisher instance for pub/sub operations
 * @returns Redis publisher instance
 * @throws Error if Redis publisher is not initialized
 */
export function getRedisPublisher(): RedisClient;

/**
 * Get Redis subscriber instance for pub/sub operations
 * @returns Redis subscriber instance
 * @throws Error if Redis subscriber is not initialized
 */
export function getRedisSubscriber(): RedisClient;

/**
 * Set data in Redis with optional TTL
 * @param key - Redis key (will be prefixed)
 * @param value - Value to store (objects will be JSON stringified)
 * @param ttl - Time to live in seconds (optional, uses default TTL if not specified)
 * @returns Promise that resolves when data is set
 */
export function setData(key: string, value: any, ttl?: number): Promise<void>;

/**
 * Get data from Redis
 * @param key - Redis key (will be prefixed)
 * @param parseJson - Whether to parse as JSON (default: true)
 * @returns Promise that resolves to the data or null if not found
 */
export function getData<T = any>(key: string, parseJson?: boolean): Promise<T | null>;

/**
 * Get data from cache or execute handler function if not found (Cache-Aside Pattern)
 * @param key - Cache key (will be prefixed)
 * @param handler - Function to execute if cache miss occurs
 * @param ttl - TTL for cached data in seconds (optional, uses default TTL if not specified)
 * @param parseJson - Whether to parse cached data as JSON (default: true)
 * @returns Promise that resolves to cached data or handler result
 */
export function getOrSet<T>(
  key: string,
  handler: () => Promise<T>,
  ttl?: number,
  parseJson?: boolean
): Promise<T>;

/**
 * Delete data from Redis
 * @param key - Redis key to delete (will be prefixed)
 * @returns Promise that resolves to number of keys deleted (0 or 1)
 */
export function deleteData(key: string): Promise<number>;

/**
 * Check if key exists in Redis
 * @param key - Redis key to check (will be prefixed)
 * @returns Promise that resolves to true if key exists, false otherwise
 */
export function exists(key: string): Promise<boolean>;

/**
 * Set TTL for existing key
 * @param key - Redis key (will be prefixed)
 * @param ttl - Time to live in seconds
 * @returns Promise that resolves to true if TTL was set, false if key doesn't exist
 */
export function setTTL(key: string, ttl: number): Promise<boolean>;

/**
 * Get TTL for key
 * @param key - Redis key (will be prefixed)
 * @returns Promise that resolves to TTL in seconds, -1 if no TTL, -2 if key doesn't exist
 */
export function getTTL(key: string): Promise<number>;

/**
 * Publish message to Redis channel
 * @param channel - Channel name (not prefixed)
 * @param message - Message to publish (objects will be JSON stringified)
 * @returns Promise that resolves when message is published
 */
export function publish(channel: string, message: any): Promise<void>;

/**
 * Subscribe to Redis channel
 * @param channel - Channel name to subscribe to (not prefixed)
 * @param callback - Callback function that receives messages (automatically parses JSON)
 * @returns Promise that resolves when subscription is active
 */
export function subscribe(
  channel: string,
  callback: (message: any) => void
): Promise<void>;

/**
 * Gracefully close all Redis connections
 * @returns Promise that resolves when all connections are closed
 */
export function closeRedis(): Promise<void>;

/**
 * Get current Redis configuration
 * @returns Copy of current configuration object
 */
export function getConfig(): RedisConfig;

/**
 * Check if Redis is available (ready and circuit breaker is closed)
 * @returns True if Redis is available for operations, false if down or circuit is open
 */
export function isAvailable(): boolean;