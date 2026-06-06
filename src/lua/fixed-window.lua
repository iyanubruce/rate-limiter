local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2]) -- Duration in seconds
local now = tonumber(ARGV[3])    -- Current millisecond timestamp
local weight = tonumber(ARGV[4]) or 1

-- 1. Get the current weight consumed in this specific static window block
local current_usage = tonumber(redis.call('GET', key)) or 0

-- 2. Validate if the incoming request weight pushes us past the organization's limit
if current_usage + weight > limit then
    -- Blocked: Return 0 (false), the remaining capacity left, and the natural window reset time
    local current_window_timestamp = math.floor(now / (window * 1000)) * (window * 1000)
    local reset_at = current_window_timestamp + (window * 1000)
    return {0, math.max(0, limit - current_usage), reset_at}
else
    -- 3. Allowed: Atomically increment the window counter by the weight value
    local new_usage = redis.call('INCRBY', key, weight)
    
    -- If this is the very first request initializing this time block, set the expiry TTL
    if new_usage == weight then
        redis.call('EXPIRE', key, window)
    end
    
    -- Calculate when this current window block naturally resets
    local current_window_timestamp = math.floor(now / (window * 1000)) * (window * 1000)
    local reset_at = current_window_timestamp + (window * 1000)
    
    -- Return 1 (true), the remaining available capacity left, and the reset time
    return {1, math.max(0, limit - new_usage), reset_at}
end
