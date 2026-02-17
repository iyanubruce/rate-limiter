local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1])
local last_refill = tonumber(bucket[2])

if tokens == nil then
  tokens = limit
  last_refill = now
else
  local time_passed = now - last_refill
  local tokens_to_add = math.floor(time_passed / 1000) * (limit / window)
  tokens = math.min(limit, tokens + tokens_to_add)
  last_refill = now
end

local allowed = 0
if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
end

redis.call('HMSET', key, 'tokens', tokens, 'last_refill', last_refill)
redis.call('EXPIRE', key, window * 2)

return {allowed, math.floor(tokens), last_refill + (window * 1000)}