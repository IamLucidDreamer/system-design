const CAPACITY = 5;

class Node {
  constructor(key, value) {
    this.key = key;
    this.value = value;
    this.next = null;
    this.prev = null;
  }
}

class Dll {
  #size = 0;

  constructor() {
    this.head = new Node(null);
    this.tail = new Node(null);
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  _add(node) {
    node.prev = this.tail.prev;
    node.next = this.tail;

    this.tail.prev.next = node;
    this.tail.prev = node;
    this.#size++;
    return;
  }

  _remove(node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
    this.#size--;
    return;
  }

  _getDllSize() {
    return this.#size;
  }

  _evictFirstElement() {
    const firstNode = this.head.next;
    this._remove(firstNode);
    return firstNode;
  }
}

class LruCache {
  #dll = new Dll();
  #dataMap = new Map();
  #capacity;

  constructor(capacity) {
    this.#capacity = capacity;
  }

  #evictIfNeeded() {
    if (this.#dataMap.size >= this.#capacity) {
      const lru = this.#dll._evictFirstElement();
      this.#dataMap.delete(lru.key);
    }
  }

  put(key, value) {
    if (this.#dataMap.has(key)) {
      const node = this.#dataMap.get(key);
      node.value = value;
      this.#dll._remove(node);
      this.#dll._add(node);
      return;
    }
    this.#evictIfNeeded();
    const node = new Node(key, value);
    this.#dataMap.set(key, node);
    this.#dll._add(node);
  }

  get(key) {
    if (!this.#dataMap.has(key)) {
      return -1;
    }
    const dataNode = this.#dataMap.get(key);
    this.#dll._remove(dataNode);
    this.#dll._add(dataNode);
    return dataNode.value;
  }
}

const lruCache = new LruCache(CAPACITY);

lruCache.put("name", "manas");
lruCache.put("name2", "manas");
console.log(lruCache.get("o"));
console.log(lruCache.get("name"));
lruCache.put("name2", "testing");
lruCache.put("name", "test");
console.log(lruCache.get("name2"));
console.log(lruCache.get("name"));
