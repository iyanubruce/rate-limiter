local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local leak_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local bucket = redis.call('HMGET', key, 'water', 'last_leak')
local water = tonumber(bucket[1]) or 0
local last_leak = tonumber(bucket[2]) or now

local time_passed = (now - last_leak) / 1000
local leaked = time_passed * leak_rate
water = math.max(0, water - leaked)

local allowed = 0
if water < capacity then
  water = water + 1
  allowed = 1
end

redis.call('HMSET', key, 'water', water, 'last_leak', now)
redis.call('EXPIRE', key, capacity / leak_rate)

local remaining = math.floor(capacity - water)
local reset_at = now + ((water / leak_rate) * 1000)

return {allowed, remaining, reset_at}