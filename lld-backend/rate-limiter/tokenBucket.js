const RATE_LIMIT = 5; // Max Tokens
const REFILL_RATE = 0.1; // Every 1 token per 10sec

class RateLimiter {
  #rateLimitCounterDetail = new Map()
  #rateLimit
  #refillRate

  constructor(rateLimit, refillRate)
  {
    this.#rateLimit = rateLimit
    this.#refillRate = refillRate
  }

  #checkOrCreateUserExist(userId, timestamp) {
    if (!this.#rateLimitCounterDetail.has(userId)) {
        this.#rateLimitCounterDetail.set(userId, {
        token:  this.#rateLimit,
        lastRefill: timestamp,
      });
      return
    }
  }

  #getUserData(userId) {
      return this.#rateLimitCounterDetail.get(userId);
  }

  #calculateRefillInToken(userData, timestamp) {
    const lastRefill = userData.lastRefill;
    const timeElapsed = timestamp - lastRefill;
    const tokenToAdd = timeElapsed * this.#refillRate;
    return tokenToAdd;
  }

  #checkRateLimit(updatedToken, userId, timestamp) {
    if (updatedToken >= 1) {
      this.#rateLimitCounterDetail.set(userId, {
        token: updatedToken - 1,
        lastRefill: timestamp,
      });
      return `Request Processed Successfully. Remaining Limit: ${(updatedToken - 1).toFixed(2)} LastRefill: ${timestamp}sec for UserId ${userId}`;
    } else {
      this.#rateLimitCounterDetail.set(userId, {
        token: updatedToken,
        lastRefill: timestamp,
      });
      return `Request Rate Limited Successfully. Next refill in ${((1 - updatedToken) / this.#refillRate).toFixed(2)}sec for UserId ${userId}`;
    }
  }

  allowRequest(userId, timestamp) {
    this.#checkOrCreateUserExist(userId, timestamp);
    const userData = this.#getUserData(userId);
    const tokenToAddInBucket = this.#calculateRefillInToken(userData, timestamp);
    if (tokenToAddInBucket < 0) {
      return "Something went wrong";
    }
    let updatedToken = userData.token + tokenToAddInBucket;
    updatedToken = updatedToken >=  this.#rateLimit ?  this.#rateLimit : updatedToken;
    const result = this.#checkRateLimit(updatedToken, userId, timestamp);
    return result;
  }
}

const rateLimiter = new RateLimiter(RATE_LIMIT, REFILL_RATE)

console.log(rateLimiter.allowRequest(1, 1));
console.log(rateLimiter.allowRequest(1, 2));
console.log(rateLimiter.allowRequest(1, 3));
console.log(rateLimiter.allowRequest(1, 15));
console.log(rateLimiter.allowRequest(1, 65));
console.log(rateLimiter.allowRequest(1, 75));
console.log(rateLimiter.allowRequest(1, 87));
console.log(rateLimiter.allowRequest(1, 88));
console.log(rateLimiter.allowRequest(1, 89));
console.log(rateLimiter.allowRequest(1, 95));
console.log(rateLimiter.allowRequest(1, 97));
console.log(rateLimiter.allowRequest(1, 98));
console.log(rateLimiter.allowRequest(1, 99));
console.log(rateLimiter.allowRequest(1, 100));
console.log(rateLimiter.allowRequest(2, 14));
console.log(rateLimiter.allowRequest(2, 32));
console.log(rateLimiter.allowRequest(2, 33));
console.log(rateLimiter.allowRequest(2, 35));
console.log(rateLimiter.allowRequest(2, 65));
