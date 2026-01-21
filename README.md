# Redis Helper

A lightweight, production-ready Redis helper library for Node.js with built-in **cache-aside pattern**, **Pub/Sub support**, **circuit breaker protection**, and **automatic reconnection**.

![npm version](https://img.shields.io/npm/v/@samuel-pro-tech%2fredis-helper)
![npm license](https://img.shields.io/npm/l/@samuel-pro-tech%2fredis-helper)

## ✨ Features

- 🚀 **Cache-Aside Pattern**: Built-in `getOrSet()` for efficient caching
- 🛡️ **Circuit Breaker**: Automatic failure detection and recovery
- 🔄 **Auto-Reconnect**: Resilient connection management
- 📡 **Pub/Sub Support**: Publisher/Subscriber pattern implementation
- 🏷️ **Key Prefixing**: Organized namespace management
- ⚡ **Performance**: Minimal overhead with optimal Redis operations
- 🔧 **TypeScript Ready**: Full type definitions included

## 📦 Installation

```bash
npm install @samuel-pro-tech/redis-helper
```

## 🚀 Quick Start

```javascript
import { initRedis, getOrSet, setData, getData } from '@samuel-pro-tech/redis-helper'

// Initialize Redis connection
await initRedis({
  url: 'redis://localhost:6379',
  keyPrefix: 'myapp:',
  defaultTtl: 3600 // 1 hour
})

// Cache-aside pattern: Get from cache or execute function
const userData = await getOrSet('user:123', async () => {
  // This function runs only if cache miss
  return await fetchUserFromDatabase(123)
}, 1800) // Cache for 30 minutes

// Direct cache operations
await setData('session:abc', { userId: 123, role: 'admin' }, 7200)
const session = await getData('session:abc')
```

## 🔧 Configuration

### Default Configuration
```javascript
const defaultConfig = {
  url: 'redis://localhost:6379',
  keyPrefix: 'myapp:',
  defaultTtl: 3600, // 1 hour in seconds
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
    connectTimeout: 10000
  }
}
```

### Custom Configuration
```javascript
await initRedis({
  url: 'redis://username:password@host:port',
  keyPrefix: 'production:',
  defaultTtl: 7200,
  socket: {
    connectTimeout: 5000,
    reconnectStrategy: (retries) => Math.min(retries * 50, 1000)
  }
})
```

## 📚 API Reference

### Core Functions

#### `initRedis(config?)`
Initialize Redis connection with optional configuration.
```javascript
await initRedis({
  url: 'redis://localhost:6379',
  keyPrefix: 'app:',
  defaultTtl: 3600
})
```

#### `getOrSet(key, handler, ttl?, parseJson?)`
Cache-aside pattern: Get from cache or execute handler function.
```javascript
const result = await getOrSet('expensive-query', async () => {
  return await expensiveDatabaseQuery()
}, 1800) // Cache for 30 minutes

// With custom parsing
const rawResult = await getOrSet('raw-data', async () => {
  return 'plain text data'
}, 3600, false) // Don't parse as JSON
```

#### `setData(key, value, ttl?)`
Store data in Redis with optional TTL.
```javascript
await setData('user:123', { name: 'John', age: 30 }, 3600)
await setData('counter', 42) // Uses default TTL
await setData('permanent', 'data', 0) // No expiration
```

#### `getData(key, parseJson?)`
Retrieve data from Redis.
```javascript
const user = await getData('user:123') // Returns parsed object
const rawData = await getData('user:123', false) // Returns string
const notFound = await getData('nonexistent') // Returns null
```

### Data Management Functions

#### `deleteData(key)`
Delete data from Redis.
```javascript
const deletedCount = await deleteData('user:123')
console.log(`Deleted ${deletedCount} keys`) // 1 if key existed, 0 if not
```

#### `exists(key)`
Check if key exists in Redis.
```javascript
const userExists = await exists('user:123')
if (userExists) {
  console.log('User found in cache')
}
```

#### `setTTL(key, ttl)`
Set TTL for existing key.
```javascript
const success = await setTTL('user:123', 7200) // 2 hours
console.log(success ? 'TTL set' : 'Key not found')
```

#### `getTTL(key)`
Get TTL for key.
```javascript
const ttl = await getTTL('user:123')
if (ttl > 0) console.log(`Expires in ${ttl} seconds`)
else if (ttl === -1) console.log('No expiration set')
else if (ttl === -2) console.log('Key does not exist')
```

### Pub/Sub Functions

#### `publish(channel, message)`
Publish message to Redis channel.
```javascript
// Publish object
await publish('user-events', { 
  type: 'login', 
  userId: 123, 
  timestamp: Date.now() 
})

// Publish string
await publish('notifications', 'System maintenance in 5 minutes')
```

#### `subscribe(channel, callback)`
Subscribe to Redis channel.
```javascript
// Subscribe to user events
await subscribe('user-events', (message) => {
  console.log('User event:', message)
  // Handle the event based on message.type
})

// Subscribe to notifications
await subscribe('notifications', (message) => {
  console.log('Notification:', message)
})
```

### Connection Management

#### `isRedisReady()`
Check if Redis client is initialized and ready.
```javascript
if (isRedisReady()) {
  console.log('Redis is connected and ready')
} else {
  console.log('Redis is not ready')
}
```

#### `isAvailable()`
Check if Redis is available (includes circuit breaker status).
```javascript
if (isAvailable()) {
  console.log('Redis is available for operations')
} else {
  console.log('Redis unavailable (down or circuit breaker open)')
}
```

#### `getRedisClient()` | `getRedisPublisher()` | `getRedisSubscriber()`
Get Redis client instances for advanced operations.
```javascript
// Get main client for custom commands
const client = getRedisClient()
await client.hSet('hash:key', 'field', 'value')

// Get publisher for custom pub/sub
const publisher = getRedisPublisher()
await publisher.publish('custom:channel', 'message')

// Get subscriber for custom subscriptions
const subscriber = getRedisSubscriber()
await subscriber.pSubscribe('pattern:*', (message, channel) => {
  console.log(`Pattern message from ${channel}:`, message)
})
```

#### `getConfig()`
Get current Redis configuration.
```javascript
const config = getConfig()
console.log('Current prefix:', config.keyPrefix)
console.log('Default TTL:', config.defaultTtl)
console.log('Redis URL:', config.url)
```

#### `closeRedis()`
Gracefully close all Redis connections.
```javascript
// Graceful shutdown
await closeRedis()
console.log('All Redis connections closed')
```

## 🛡️ Circuit Breaker

The library includes built-in circuit breaker protection:

- **Failure Threshold**: 3 consecutive failures
- **Recovery Time**: 30 seconds
- **Automatic Fallback**: Functions continue to work even when Redis is down

```javascript
// Even if Redis is down, this will execute the handler
const data = await getOrSet('key', () => fetchFromDatabase())
```

## 💡 Usage Examples

### Basic Caching
```javascript
import { initRedis, getOrSet, setData, getData } from '@samuel-pro-tech/redis-helper'

// Initialize
await initRedis({ keyPrefix: 'myapp:', defaultTtl: 3600 })

// Cache expensive operations
const userData = await getOrSet(`user:${userId}`, async () => {
  return await db.user.findById(userId)
}, 1800) // Cache for 30 minutes
```

### Session Management
```javascript
// Store session
await setData(`session:${sessionId}`, {
  userId: 123,
  role: 'admin',
  loginTime: Date.now()
}, 86400) // 24 hours

// Retrieve session
const session = await getData(`session:${sessionId}`)
if (session) {
  console.log('User authenticated:', session.userId)
}

// Extend session
await setTTL(`session:${sessionId}`, 86400) // Extend by 24 hours

// Logout
await deleteData(`session:${sessionId}`)
```

### Pub/Sub Messaging
```javascript
// Real-time notifications
await subscribe('user:notifications', async (notification) => {
  await sendEmailNotification(notification.email, notification.message)
})

// Send notification
await publish('user:notifications', {
  userId: 123,
  email: 'user@example.com',
  message: 'Your order has been shipped!'
})
```

### Data Analytics
```javascript
// Increment counters
const client = getRedisClient()
await client.incr('myapp:page:views')
await client.hincrBy('myapp:user:stats', `user:${userId}`, 1)

// Get statistics
const pageViews = await client.get('myapp:page:views')
const userStats = await client.hGetAll('myapp:user:stats')
```

### Background Jobs with Circuit Breaker
```javascript
const processJob = async (jobData) => {
  // Try to get cached result first
  const cached = await getOrSet(`job:result:${jobData.id}`, async () => {
    // This will run even if Redis is down
    const result = await heavyProcessing(jobData)
    return result
  }, 3600)
  
  return cached
}

// Circuit breaker automatically handles Redis failures
const result = await processJob({ id: 'job-123', data: 'process-this' })
```

## ⚠️ Error Handling

### Graceful Degradation
```javascript
try {
  const data = await getData('user:123')
  if (data) {
    return data // Cache hit
  }
} catch (error) {
  console.error('Redis error, falling back to database:', error)
}

// Always fallback to primary data source
return await database.getUser(123)
```

### Circuit Breaker States
```javascript
// Check availability before operations
if (isAvailable()) {
  await setData('key', 'value')
} else {
  console.log('Redis circuit breaker is open, skipping cache')
}

// Use getOrSet for automatic fallback
const data = await getOrSet('key', async () => {
  return await fetchFromDatabase() // Always executes if Redis is down
})
```

### Connection Monitoring
```javascript
// Monitor connection status
setInterval(() => {
  if (isRedisReady()) {
    console.log('✅ Redis: Connected')
  } else {
    console.log('❌ Redis: Disconnected')
  }
  
  if (isAvailable()) {
    console.log('🟢 Circuit: Closed')
  } else {
    console.log('🔴 Circuit: Open')
  }
}, 30000) // Check every 30 seconds
```

## 🚀 Production Usage

### Environment Setup
```bash
# .env file
REDIS_URL=redis://username:password@host:port
REDIS_PREFIX=production:
REDIS_TTL=3600
```

```javascript
import { initRedis } from '@samuel-pro-tech/redis-helper'

await initRedis({
  url: process.env.REDIS_URL,
  keyPrefix: process.env.REDIS_PREFIX,
  defaultTtl: parseInt(process.env.REDIS_TTL)
})
```

### Graceful Shutdown
```javascript
process.on('SIGTERM', async () => {
  await closeRedis()
  process.exit(0)
})
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🔗 Links

- [npm package](https://www.npmjs.com/package/@samuel-pro-tech/redis-helper)
- [GitHub repository](https://github.com/samuel76/redis-helper)
- [Report issues](https://github.com/samuel76/redis-helper/issues)
