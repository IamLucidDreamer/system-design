const TIMEFRAME = 300;

class HitCounter {
  #totalHits = [];
  #timeframe;

  constructor(timeframe) {
    this.#timeframe = timeframe;
  }

  #evictHitOutsideWindow(timestamp) {
    while (
      this.#totalHits.length &&
      timestamp - this.#totalHits[0]  >= this.#timeframe
    ) {
      this.#totalHits.shift();
    }
  }

  hit(timestamp) {
    this.#evictHitOutsideWindow(timestamp);
    this.#totalHits.push(timestamp);
    return `New hit successful. Hits so far ${this.#totalHits.length}`;
  }

  getHits(timestamp) {
    this.#evictHitOutsideWindow(timestamp);
    return `Total Hits in last ${this.#timeframe}sec is ${this.#totalHits.length}`;
  }
}

const hitCounter = new HitCounter(TIMEFRAME);

console.log(hitCounter.getHits(0))
console.log(hitCounter.hit(1));
console.log(hitCounter.hit(2));
console.log(hitCounter.hit(2));
console.log(hitCounter.hit(2));
console.log(hitCounter.hit(2));
console.log(hitCounter.hit(2));
console.log(hitCounter.hit(4));
console.log(hitCounter.hit(5));
console.log(hitCounter.hit(7));
console.log(hitCounter.getHits(50));
console.log(hitCounter.hit(2000));
