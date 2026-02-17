local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window_start = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local window_ms = tonumber(ARGV[4])

redis.call('ZREMRANGEBYSCORE', key, 0, window_start)
local current = redis.call('ZCARD', key)

local allowed = 0
if current < limit then
  redis.call('ZADD', key, now, now)
  allowed = 1
  current = current + 1
end

redis.call('EXPIRE', key, math.ceil(window_ms / 1000))

local remaining = math.max(0, limit - current)
local reset_at = now + window_ms

return {allowed, remaining, reset_at}