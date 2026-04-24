const COOLDOWN_PERIOD = 10;

class RateLimitedLogger {
  #loggerStore = new Map();
  #cooldownPeriod;

  constructor(cooldownPeriod) {
    this.#cooldownPeriod = cooldownPeriod;
  }

  log(timestamp, message) {
    const lastSeen = this.#loggerStore.get(message);
    if(lastSeen === undefined ||timestamp - lastSeen >= this.#cooldownPeriod)
    {
      this.#loggerStore.set(message, timestamp)
      return message
    }
    return 'Log Blocked'
  }
}

const logger = new RateLimitedLogger(COOLDOWN_PERIOD);

console.log(logger.log(1, "Testing"));
console.log(logger.log(2, "Testing"));
console.log(logger.log(40, "Testing 1"));
console.log(logger.log(40, "Testing 2"));
console.log(logger.log(40, "Testing 3"));
console.log(logger.log(41, "Testing 3"));
console.log(logger.log(23, "Testing"));
console.log(logger.log(25, "Testing"));
console.log(logger.log(40, "Testing"));
console.log(logger.log(45, "Testing"));
console.log(logger.log(50, "Testing"));
