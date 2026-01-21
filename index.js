import { createClient } from 'redis';

// State internal library
let redisClient = null;
let redisPublisher = null;
let redisSubscriber = null;

// State for Circuit Breaker
let isCircuitOpen = false;
let failureCount = 0;
const FAILURE_THRESHOLD = 3; // How many failures before the circuit opens
const RECOVERY_TIME = 30000; // 30 seconds wait time before retrying

let currentConfig = {
    url: 'redis://localhost:6379',
    keyPrefix: 'myapp:',
    defaultTtl: 3600,
    socket: {
        reconnectStrategy: (retries) => {
            // Auto-Reconnect: Maximum delay 3 seconds between attempts
            return Math.min(retries * 100, 3000);
        },
        connectTimeout: 10000,
    }
};

/**
 * Open the circuit (Stop using Redis temporarily)
 */
const openCircuit = () => {
    if (!isCircuitOpen) {
        isCircuitOpen = true;
        console.warn('⚠️ Redis Circuit OPEN: Skipping Redis operations for a while.');
        setTimeout(() => {
            isCircuitOpen = false;
            failureCount = 0;
            console.log('🛡️ Redis Circuit CLOSED: Retrying Redis operations...');
        }, RECOVERY_TIME);
    }
};

/**
 * Check if Redis is ready to be used
 */
const isAvailable = () => {
    return redisClient && redisClient.isReady && !isCircuitOpen;
};


/**
 * Initialize Redis with custom configuration
 * @param {Object} userConfig - Override default configuration
 */
const initRedis = async (userConfig = {}) => {
    try {
        currentConfig = { 
            ...currentConfig, 
            ...userConfig,
            socket: { ...currentConfig.socket, ...userConfig.socket } 
        };

        const baseOptions = { url: currentConfig.url, socket: currentConfig.socket };
        
        redisClient = createClient(baseOptions);
        redisPublisher = createClient(baseOptions);
        redisSubscriber = createClient(baseOptions);

        // Event Listeners untuk monitoring
        redisClient.on('error', (err) => {
            console.error('❌ Redis Error:', err.message);
            failureCount++;
            if (failureCount >= FAILURE_THRESHOLD) openCircuit();
        });

        redisClient.on('connect', () => console.log('✅ Redis Connected'));
        redisClient.on('ready', () => {
            console.log('🚀 Redis Ready');
            isCircuitOpen = false;
            failureCount = 0;
        });

        await Promise.all([
            redisClient.connect(),
            redisPublisher.connect(),
            redisSubscriber.connect()
        ]);

    } catch (error) {
        console.error('🔥 Failed to init Redis:', error);
        openCircuit();
    }
};

/**
 * Check if Redis is initialized and ready
 */
const isRedisReady = () => {
    return redisClient && redisClient.isReady
}

/**
 * Get Redis client instance
 */
const getRedisClient = () => {
    if (!redisClient) {
        throw new Error('Redis client not initialized. Call initRedis() first.')
    }
    return redisClient
}

/**
 * Get Redis publisher instance
 */
const getRedisPublisher = () => {
    if (!redisPublisher) {
        throw new Error('Redis publisher not initialized. Call initRedis() first.')
    }
    return redisPublisher
}

/**
 * Get Redis subscriber instance
 */
const getRedisSubscriber = () => {
    if (!redisSubscriber) {
        throw new Error('Redis subscriber not initialized. Call initRedis() first.')
    }
    return redisSubscriber
}

/**
 * Generate prefixed key
 * @param {string} key - The key to prefix
 * @returns {string} - Prefixed key
 */
const getKey = (key) => {
    return `${currentConfig.keyPrefix}${key}`
}

/**
 * Set data in Redis with optional TTL
 * @param {string} key - Redis key
 * @param {any} value - Value to store (will be JSON stringified if object)
 * @param {number} ttl - Time to live in seconds (optional)
 */
const setData = async (key, value, ttl = currentConfig.defaultTtl) => {
    try {
        if (!isAvailable()) {
            console.warn(`Redis not available for setData key: ${key}`);
            return;
        }
        
        const prefixedKey = getKey(key);
        const stringValue = typeof value === 'string' ? value : JSON.stringify(value)
    
        if (ttl) await redisClient.setEx(prefixedKey, ttl, stringValue);
        else await redisClient.set(prefixedKey, stringValue);
    } catch (error) {
        console.error(`Error setting Redis key ${key}:`, error);
        failureCount++;
        if (failureCount >= FAILURE_THRESHOLD) openCircuit();
        throw error;
    }
}

/**
 * Get data from Redis
 * @param {string} key - Redis key
 * @param {boolean} parseJson - Whether to parse as JSON (default: true)
 * @returns {any|null} - Retrieved data or null if not found
 */
const getData = async (key, parseJson = true) => {
    try {
        if (!isAvailable()) {
            console.warn(`Redis not available for getData key: ${key}`);
            return null;
        }
        const value = await redisClient.get(getKey(key));
        if (!value) return null;
        if (parseJson) {
            try { return JSON.parse(value); } catch { return value; }
        }
        return value;
    } catch (error) {
        console.error(`Error getting Redis key ${key}:`, error);
        failureCount++;
        if (failureCount >= FAILURE_THRESHOLD) openCircuit();
        throw error;
    }
}

/**
 * Get data from cache or execute handler function if not found
 * This is the main function for cache-aside pattern
 * @param {string} key - Cache key
 * @param {Function} handler - Function to execute if key not found
 * @param {number} ttl - TTL for cached data (optional)
 * @param {boolean} parseJson - Whether to parse as JSON (default: true)
 * @returns {any} - Data from cache or handler
 */
const getOrSet = async (key, handler, ttl = currentConfig.defaultTtl, parseJson = true) => {
    try {
        // Check if Redis is available (includes circuit breaker check)
        if (!isAvailable()) {
            console.warn(`Redis not available for key ${key}, executing handler directly`);
            return await handler();
        }
        
        // Try to get from cache first
        const cachedData = await getData(key, parseJson)
        
        if (cachedData !== null) {
            console.log(`Cache HIT for key: ${key}`)
            return cachedData
        }
        
        console.log(`Cache MISS for key: ${key}, executing handler...`)
        
        // Execute handler to get fresh data
        const freshData = await handler()
        
        // Cache the result if it's not null/undefined
        if (freshData !== null && freshData !== undefined) {
            await setData(key, freshData, ttl)
            console.log(`Cached data for key: ${key} with TTL: ${ttl}s`)
        }
        
        return freshData
    } catch (error) {
        console.error(`Error in getOrSet for key ${key}:`, error)
        
        // In case of Redis error, still try to execute handler
        console.log('Executing handler due to Redis error...')
        return await handler()
    }
}

/**
 * Delete data from Redis
 * @param {string} key - Redis key to delete
 * @returns {number} - Number of keys deleted
 */
const deleteData = async (key) => {
    try {
        if (!isAvailable()) {
            console.warn(`Redis not available for deleteData key: ${key}`);
            return 0;
        }
        const client = getRedisClient();
        const prefixedKey = getKey(key);
        return await client.del(prefixedKey);
    } catch (error) {
        console.error(`Error deleting Redis key ${key}:`, error);
        failureCount++;
        if (failureCount >= FAILURE_THRESHOLD) openCircuit();
        throw error;
    }
}

/**
 * Check if key exists in Redis
 * @param {string} key - Redis key
 * @returns {boolean} - True if key exists
 */
const exists = async (key) => {
    try {
        if (!isAvailable()) {
            console.warn(`Redis not available for exists key: ${key}`);
            return false;
        }
        const client = getRedisClient();
        const prefixedKey = getKey(key);
        const result = await client.exists(prefixedKey);
        return result === 1;
    } catch (error) {
        console.error(`Error checking Redis key existence ${key}:`, error);
        failureCount++;
        if (failureCount >= FAILURE_THRESHOLD) openCircuit();
        throw error;
    }
}

/**
 * Set TTL for existing key
 * @param {string} key - Redis key
 * @param {number} ttl - Time to live in seconds
 * @returns {boolean} - True if TTL was set
 */
const setTTL = async (key, ttl) => {
    try {
        if (!isAvailable()) {
            console.warn(`Redis not available for setTTL key: ${key}`);
            return false;
        }
        const client = getRedisClient();
        const prefixedKey = getKey(key);
        const result = await client.expire(prefixedKey, ttl);
        return result === 1;
    } catch (error) {
        console.error(`Error setting TTL for Redis key ${key}:`, error);
        failureCount++;
        if (failureCount >= FAILURE_THRESHOLD) openCircuit();
        throw error;
    }
}

/**
 * Get TTL for key
 * @param {string} key - Redis key
 * @returns {number} - TTL in seconds, -1 if no TTL, -2 if key doesn't exist
 */
const getTTL = async (key) => {
    try {
        if (!isAvailable()) {
            console.warn(`Redis not available for getTTL key: ${key}`);
            return -2;
        }
        const client = getRedisClient();
        const prefixedKey = getKey(key);
        return await client.ttl(prefixedKey);
    } catch (error) {
        console.error(`Error getting TTL for Redis key ${key}:`, error);
        failureCount++;
        if (failureCount >= FAILURE_THRESHOLD) openCircuit();
        throw error;
    }
}

/**
 * Publish message to Redis channel
 * @param {string} channel - Channel name
 * @param {any} message - Message to publish
 */
const publish = async (channel, message) => {
    try {
        if (!isAvailable()) {
            console.warn(`Redis not available for publish to channel: ${channel}`);
            return;
        }
        const publisher = getRedisPublisher();
        const stringMessage = typeof message === 'string' ? message : JSON.stringify(message);
        await publisher.publish(channel, stringMessage);
    } catch (error) {
        console.error(`Error publishing to channel ${channel}:`, error);
        failureCount++;
        if (failureCount >= FAILURE_THRESHOLD) openCircuit();
        throw error;
    }
}

/**
 * Subscribe to Redis channel
 * @param {string} channel - Channel name
 * @param {Function} callback - Callback function for messages
 */
const subscribe = async (channel, callback) => {
    try {
        if (!isAvailable()) {
            console.warn(`Redis not available for subscribe to channel: ${channel}`);
            return;
        }
        const subscriber = getRedisSubscriber();
        await subscriber.subscribe(channel, (message) => {
            try {
                const parsedMessage = JSON.parse(message);
                callback(parsedMessage);
            } catch (parseError) {
                callback(message);
            }
        });
    } catch (error) {
        console.error(`Error subscribing to channel ${channel}:`, error);
        failureCount++;
        if (failureCount >= FAILURE_THRESHOLD) openCircuit();
        throw error;
    }
}

/**
 * Gracefully close all Redis connections
 */
const closeRedis = async () => {
    try {
        console.log('Closing Redis connections...')
        
        const closePromises = []
        
        if (redisClient) {
            closePromises.push(redisClient.quit())
        }
        
        if (redisPublisher) {
            closePromises.push(redisPublisher.quit())
        }
        
        if (redisSubscriber) {
            closePromises.push(redisSubscriber.quit())
        }
        
        await Promise.all(closePromises)
        console.log('All Redis connections closed successfully')
    } catch (error) {
        console.error('Error closing Redis connections:', error)
        throw error
    }
}

/**
 * Get current Redis configuration
 * @returns {Object} - Current configuration object
 */
const getConfig = () => ({ ...currentConfig });

export {
    initRedis,
    isRedisReady,
    getRedisClient,
    getRedisPublisher,
    getRedisSubscriber,
    setData,
    getData,
    getOrSet,
    deleteData,
    exists,
    setTTL,
    getTTL,
    publish,
    subscribe,
    closeRedis,
    getConfig,
    isAvailable,
}
