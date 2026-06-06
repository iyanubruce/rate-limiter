local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local now = tonumber(ARGV[3]) -- Expecting a Millisecond Timestamp
local weight = tonumber(ARGV[4]) or 1

local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1])
local last_refill = tonumber(bucket[2])

if tokens == nil then
  tokens = limit
  last_refill = now
else
  -- 1. FIX: Keep fractional time values to ensure ultra-smooth, continuous refills
  local time_passed_seconds = (now - last_refill) / 1000
  local refill_rate_per_second = limit / window
  
  local tokens_to_add = time_passed_seconds * refill_rate_per_second
  tokens = math.min(limit, tokens + tokens_to_add)
  
  -- 2. PERFORMANCE OPTIMIZATION: Only advance the refill timestamp if tokens actually updated
  if tokens_to_add > 0 then
    last_refill = now
  end
end

local allowed = 0
-- 3. FIX: Only approve the request if the bucket holds enough tokens to cover the weight
if tokens >= weight then
  tokens = tokens - weight
  allowed = 1
end

redis.call('HMSET', key, 'tokens', tokens, 'last_refill', last_refill)
redis.call('EXPIRE', key, window * 2)

-- Calculate when the bucket will completely refill back to max
local time_to_fill_ms = ((limit - tokens) / (limit / window)) * 1000
local reset_at = now + math.ceil(time_to_fill_ms)

return {allowed, math.floor(tokens), reset_at}
