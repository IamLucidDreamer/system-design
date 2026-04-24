class Node {
  val;
  next;
  prev;
  constructor(val) {
    this.val = val;
    this.next = null;
    this.prev = null;
  }
}

class Dll {
    #size = 0
  constructor() {
    this.head = new Node(null);
    this.tail = new Node(null);
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  _add(node){
    node.prev = this.tail.prev
    node.next = this.tail

    this.tail.prev.next = node
    this.tail.prev = node
    this.#size++
  }
  _remove(node){
    node.prev.next = node.next
    node.next.prev = node.prev
    this.#size--
  }

  print(){
    let curr = this.head.next
    while(curr !== this.tail)
    {
        console.log(curr.val)
        curr = curr.next
    }
    console.log(`Size of the List ${this.#size}`)
  }
}

const dll = new Dll()

const n1 = new Node(1);
const n2 = new Node(2);
const n3 = new Node(3);

dll._add(n1)
dll._add(n2)
dll._add(n3)
dll.print()

dll._remove(n2)

dll.print()