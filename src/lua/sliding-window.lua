local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window_start = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local window_ms = tonumber(ARGV[4])
local weight = tonumber(ARGV[5]) or 1

-- 1. Remove expired logs older than the current sliding frame
redis.call('ZREMRANGEBYSCORE', key, 0, window_start)

-- 2. Fetch all remaining active items
local active_entries = redis.call('ZRANGEBYSCORE', key, window_start, now)

-- 3. Loop through elements to find total weight
local current_total_weight = 0
for _, entry in ipairs(active_entries) do
    local colon_idx = string.find(entry, ":")
    if colon_idx then
        -- Read everything after the timestamp colon
        local entry_weight = tonumber(string.sub(entry, colon_idx + 1))
        current_total_weight = current_total_weight + (entry_weight or 1)
    end
end

-- 4. Check capacity and log the new request securely
local allowed = 0
if current_total_weight + weight <= limit then
    allowed = 1
    current_total_weight = current_total_weight + weight
    
    -- FIX: Append a microsecond or math.random value so identical 
    -- millisecond timestamps create separate unique rows in the sorted set
    local unique_id = now .. ":" .. weight .. ":" .. math.random(1000, 9999)
    redis.call('ZADD', key, now, unique_id)
end

-- 5. Refresh expiration window TTL
redis.call('EXPIRE', key, math.ceil(window_ms / 1000))

local remaining = math.max(0, limit - current_total_weight)
local reset_at = now + window_ms

return {allowed, remaining, reset_at}
