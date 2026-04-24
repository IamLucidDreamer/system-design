const WINDOW_SIZE = 600;
const RATE_LIMIT = 5;

class RateLimiter {
  #userRequestMap = new Map();
  #windowSize;
  #rateLimit;
  
  constructor(windowSize, rateLimit) {
    this.#windowSize = windowSize
    this.#rateLimit = rateLimit
  }

  #getOrCreateUserData(userId) {
    let arr = [];
    const userExists = this.#userRequestMap.has(userId);
    if (userExists) {
      arr = this.#userRequestMap.get(userId);
      return arr;
    }
    this.#userRequestMap.set(userId, arr);
    return arr;
  }

  allowRequest(userId, timestamp) {
    const userData = this.#getOrCreateUserData(userId);
    while (userData.length && userData[0] <= timestamp - this.#windowSize) {
      userData.shift();
    }
    if (userData.length < this.#rateLimit) {
      userData.push(timestamp);
      return `Request successfully approved. For user ${userId} remaining requests ${this.#rateLimit - userData.length}`;
    } else {
      return `Request Rate Limited successfully. Next request allowed in ${userData[0] + this.#windowSize - timestamp}`;
    }
  }
}

const rateLimiter = new RateLimiter(WINDOW_SIZE, RATE_LIMIT);

console.log(rateLimiter.allowRequest(1, 5));
console.log(rateLimiter.allowRequest(1, 15));
console.log(rateLimiter.allowRequest(1, 25));
console.log(rateLimiter.allowRequest(1, 55));
console.log(rateLimiter.allowRequest(1, 65));
console.log(rateLimiter.allowRequest(1, 75));
console.log(rateLimiter.allowRequest(1, 625));
console.log(rateLimiter.allowRequest(1, 645));
console.log(rateLimiter.allowRequest(1, 655));
console.log(rateLimiter.allowRequest(1, 665));
console.log(rateLimiter.allowRequest(1, 675));
console.log(rateLimiter.allowRequest(2, 5));
console.log(rateLimiter.allowRequest(2, 15));
console.log(rateLimiter.allowRequest(2, 25));
console.log(rateLimiter.allowRequest(2, 25));
console.log(rateLimiter.allowRequest(2, 45));
console.log(rateLimiter.allowRequest(2, 55));
