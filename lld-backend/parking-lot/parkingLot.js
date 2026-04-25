class Vehicle {
  #type;
  #numberPlate;
  constructor(type, numberPlate) {
    this.#type = type;
    this.#numberPlate = numberPlate;
  }

  getVehicleType() {
    return this.#type;
  }

  getVehicleNumberPlate() {
    return this.#numberPlate;
  }
}

class Slot {
  #id;
  #size;
  #isOccupied;
  #vehicle;

  constructor(id, size) {
    this.#id = id;
    this.#size = size;
    this.#isOccupied = false;
    this.#vehicle = null;
  }

  isAvailable() {
    return !this.#isOccupied;
  }

  isSlotCompatible(type) {
    switch (type) {
      case "BIKE":
        return true;
      case "CAR":
        return this.#size === "MEDIUM" || this.#size === "LARGE";
      case "TRUCK":
        return this.#size === "LARGE";
      default:
        return false;
    }
  }

  assignVehicle(vehicle) {
    this.#vehicle = vehicle;
    this.#isOccupied = true;
  }

  removeVehicle() {
    this.#vehicle = null;
    this.#isOccupied = false;
  }

  getSize() {
    return this.#size;
  }

  getId() {
    return this.#id;
  }
}

class ParkingFloor {
  #floorNumber;
  #slots;

  constructor(floorNumber, slots) {
    this.#floorNumber = floorNumber;
    this.#slots = slots;
  }

  getFloorNumber() {
    return this.#floorNumber;
  }

  getSlots() {
    return [...this.#slots];
  }
}

class Ticket {
  #ticketId;
  #slot;
  #vehicle;
  #startTime;

  constructor(ticketId, slot, vehicle, startTime) {
    this.#ticketId = ticketId;
    this.#slot = slot;
    this.#vehicle = vehicle;
    this.#startTime = startTime;
  }

  getSlot() {
    return this.#slot;
  }

  getStartTime() {
    return this.#startTime;
  }
}

class ParkingLot {
  #floors;
  constructor(floors) {
    this.#floors = floors;
  }

  #calculateFee(duration) {
    const seconds = Math.ceil(duration / 1000);
    return seconds * 1; 
  }

  park(vehicle) {
    //TODO : Convert to Map and queue based lookup for efficiency
    for (const floor of this.#floors) {
      for (const slot of floor.getSlots()) {
        if (
          slot.isAvailable() &&
          slot.isSlotCompatible(vehicle.getVehicleType())
        ) {
          slot.assignVehicle(vehicle);
          const now = Date.now();
          console.log(
            "Vehicle Parked:",
            vehicle.getVehicleType(),
            vehicle.getVehicleNumberPlate(),
          );
          return new Ticket(now, slot, vehicle, now);
        }
      }
    }
    console.log(
      "Parking Full:",
      vehicle.getVehicleType(),
      vehicle.getVehicleNumberPlate(),
    );
    return null;
  }

  unPark(ticket) {
    if (!ticket) {
      console.log("Invalid Ticket");
      return;
    }
    const slot = ticket.getSlot();
    if (!slot) {
      console.log("Invalid Ticket");
      return;
    }
    slot.removeVehicle();
    const startTime = ticket.getStartTime();
    const duration = Date.now() - startTime;
    const fee = this.#calculateFee(duration);
    return fee;
  }
}

// AI generated Tests
function randomDelay(min = 5500, max = 10000) {
  return new Promise(resolve =>
    setTimeout(resolve, Math.floor(Math.random() * (max - min + 1)) + min)
  );
}

async function runTests() {
  const floor1 = new ParkingFloor(0, [
    new Slot(1, "SMALL"),
    new Slot(2, "MEDIUM"),
    new Slot(3, "LARGE"),
  ]);
  const floor2 = new ParkingFloor(1, [
    new Slot(4, "SMALL"),
    new Slot(5, "MEDIUM"),
  ]);
  const parkingLot = new ParkingLot([floor1, floor2]);

  const vehicles = [
    new Vehicle("BIKE",  "MH-01"),  // fits SMALL
    new Vehicle("CAR",   "MH-02"),  // fits MEDIUM or LARGE
    new Vehicle("TRUCK", "MH-03"),  // fits LARGE only
    new Vehicle("TRUCK", "MH-04"),  // should be blocked (no LARGE left)
    new Vehicle("BIKE",  "MH-05"),  // fits SMALL (floor2 slot4)
    new Vehicle("CAR",   "MH-06"),  // fits MEDIUM (floor2 slot5)
    new Vehicle("BIKE",  "MH-07"),  // parking full — all slots taken
    new Vehicle("CAR",   "MH-08"),  // invalid type test
  ];

  console.log("\n--- PARKING PHASE ---");
  const tickets = vehicles.map(v => parkingLot.park(v));

  console.log("\n--- UNPARK PHASE (random delays) ---");
  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];
    const vehicle = vehicles[i];

    if (!ticket) {
      console.log(`[${vehicle.getVehicleNumberPlate()}] No ticket — was not parked, skipping unpark`);
      continue;
    }

    await randomDelay();
    const fee = parkingLot.unPark(ticket);
    console.log(
      `[${vehicle.getVehicleNumberPlate()}] ${vehicle.getVehicleType()} unparked | Fee: ₹${fee}`
    );
  }

  console.log("\n--- RE-PARK AFTER UNPARK (slot reuse test) ---");
  const reParkedVehicle = new Vehicle("TRUCK", "MH-09");
  const reParkedTicket = parkingLot.park(reParkedVehicle);
  if (reParkedTicket) {
    await randomDelay(1000, 2000);
    const fee = parkingLot.unPark(reParkedTicket);
    console.log(`[MH-09] TRUCK re-parked and unparked | Fee: ₹${fee}`);
  }

  console.log("\n--- INVALID TICKET TEST ---");
  parkingLot.unPark(null);
}

runTests();
