const ORDER_STATUS_ENUMS = Object.freeze({
  PLACED: "PLACED",
  ACCEPTED: "ACCEPTED",
  IN_TRANSIT: "IN_TRANSIT",
  DELIVERED: "DELIVERED",
  CANCELED: "CANCELED",
});

class User {
  #id;
  #name;
  constructor(id, name) {
    this.#id = id;
    this.#name = name;
  }

  getUserDetails() {
    return {
      id: this.#id,
      name: this.#name,
    };
  }
}

class DeliveryPartner extends User {
  #isAssigned;
  constructor(id, name) {
    super(id, name);
    this.#isAssigned = false;
  }
  getIsAssigned() {
    return this.#isAssigned;
  }

  changeAssignmentStatus(status) {
    this.#isAssigned = status;
  }
}

class Restaurant {
  #id;
  #name;
  constructor(id, name) {
    this.#id = id;
    this.#name = name;
  }
  getRestaurantDetails() {
    return {
      id: this.#id,
      name: this.#name,
    };
  }
}

class Order {
  static #validTransitions = Object.freeze({
    PLACED:     ["ACCEPTED", "CANCELED"],
    ACCEPTED:   ["IN_TRANSIT", "CANCELED"],
    IN_TRANSIT: ["DELIVERED"],
    DELIVERED:  [],
    CANCELED:   [],
  });

  #id;
  #user;
  #deliveryPartner;
  #restaurant;
  #status;
  constructor(id, user, restaurant) {
    this.#id = id;
    this.#user = user;
    this.#restaurant = restaurant;
    this.#status = ORDER_STATUS_ENUMS.PLACED;
    this.#deliveryPartner = null;
  }

  #transition(newStatus) {
    const allowed = Order.#validTransitions[this.#status];
    if (!allowed.includes(newStatus)) {
        console.log("Invalid Transaction Change")
      return null
    }
    this.#status = newStatus;
  }

  acceptOrder() {
    this.#transition(ORDER_STATUS_ENUMS.ACCEPTED);
  }

  cancelOrder() {
    const deliveryPartner = this.#deliveryPartner;
    if (deliveryPartner && deliveryPartner.getIsAssigned()) {
      deliveryPartner.changeAssignmentStatus(false);
    }
    this.#transition(ORDER_STATUS_ENUMS.CANCELED);
  }

  assignDeliveryPartner(deliveryPartner) {
    this.#deliveryPartner = deliveryPartner;
    deliveryPartner.changeAssignmentStatus(true);
  }

  pickUpOrder() {
    this.#transition(ORDER_STATUS_ENUMS.IN_TRANSIT);
  }

  deliverOrder() {
    this.#transition(ORDER_STATUS_ENUMS.DELIVERED);
  }

  getOrderDetails() {
    return {
      id: this.#id,
      status: this.#status,
      user: this.#user.getUserDetails(),
      restaurant: this.#restaurant.getRestaurantDetails(),
      deliveryPartner: this.#deliveryPartner
        ? this.#deliveryPartner.getUserDetails()
        : "NOT_ASSIGNED",
    };
  }
}

class MatchDeliveryPartner {
  matchDeliveryPartnerWithOrder(deliveryPartners) {
    for (const partner of deliveryPartners) {
      if (!partner.getIsAssigned()) {
        return partner;
      }
    }
    return null;
  }
}

class FoodDelivery {
  #restaurants = [];
  #deliveryPartners = [];
  #matchDeliveryPartner;

  constructor(matchDeliveryPartner = new MatchDeliveryPartner()) {
    this.#matchDeliveryPartner = matchDeliveryPartner;
  }

  addRestaurant(id, name) {
    const addedRestaurant = new Restaurant(id, name);
    this.#restaurants.push(addedRestaurant);
    return addedRestaurant;
  }

  addUser(id, name) {
    return new User(id, name);
  }

  addDeliveryPartner(id, name) {
    const addedDeliveryPartner = new DeliveryPartner(id, name);
    this.#deliveryPartners.push(addedDeliveryPartner);
    return addedDeliveryPartner;
  }

  placeOrder(id, user, restaurant) {
    return new Order(id, user, restaurant);
  }

  acceptOrder(order) {
    order.acceptOrder();
  }

  assignDeliveryPartner(order) {
    const assignedPartner =
      this.#matchDeliveryPartner.matchDeliveryPartnerWithOrder(
        this.#deliveryPartners,
      );
    if (assignedPartner) {
      return order.assignDeliveryPartner(assignedPartner);
    }
  }

  pickUpOrder(order) {
    order.pickUpOrder();
  }

  deliverOrder(order) {
    order.deliverOrder();
  }
}

const foodDelivery = new FoodDelivery();
const user1 = foodDelivery.addUser(1, "Manas");
console.log(user1.getUserDetails());
const restaurant1 = foodDelivery.addRestaurant(1, "D-Manoj");
console.log(restaurant1.getRestaurantDetails());
const deliveryPartner1 = foodDelivery.addDeliveryPartner(2, "Manoj");
console.log(
  deliveryPartner1.getUserDetails(),
  deliveryPartner1.getIsAssigned(),
);
const order1 = foodDelivery.placeOrder(1, user1, restaurant1);
console.log(order1.getOrderDetails());
foodDelivery.acceptOrder(order1);
console.log(order1.getOrderDetails());
foodDelivery.assignDeliveryPartner(order1);
console.log(order1.getOrderDetails());
foodDelivery.pickUpOrder(order1);
console.log(order1.getOrderDetails());
foodDelivery.deliverOrder(order1);
console.log(order1.getOrderDetails());
