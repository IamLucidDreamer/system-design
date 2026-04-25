class User {
  #id;
  #name;
  constructor(id, name) {
    this.#id = id;
    this.#name = name;
  }

  getId() {
    return this.#id;
  }

  getName() {
    return this.#name;
  }
}

class Driver extends User {
  #available;

  constructor(id, name, available) {
    super(id, name);
    this.#available = available;
  }

  isAvailable() {
    return this.#available === "ONLINE";
  }

  setAvailability(status) {
    this.#available = status;
  }

  getDetails() {
    return {
      id: this.getId(),
      name: this.getName(),
      available: this.#available,
    };
  }
}

class Ride {
  #id;
  #status;
  #pickup;
  #destination;
  #driver;
  #passenger;
  constructor(id, pickup, destination, passenger) {
    this.#id = id;
    this.#status = "REQUESTED";
    this.#pickup = pickup;
    this.#destination = destination;
    this.#driver = null;
    this.#passenger = passenger;
  }

  assignDriver(driver) {
    this.#driver = driver;
    this.#driver.setAvailability("IN_RIDE");
    this.startRide();
  }

  startRide() {
    this.#status = "ONGOING";
  }

  markComplete() {
    this.#status = "COMPLETE";
  }

  cancelRide() {
    this.#status = "CANCELED";
  }

  getStatus() {
    return this.#status;
  }

  getDriver() {
    return this.#driver;
  }
}

class DriverMatcher {
  matchRideWithDriver( drivers) {
    const getAvailableDrivers = drivers.filter((driver) =>
      driver.isAvailable(),
    );
    if (getAvailableDrivers.length === 0) {
      return null;
    }
    const driver = getAvailableDrivers[0];
    return driver
  }
}

class RideBooking {
  #drivers = [];
  #driverMatcher
  constructor( matcher = new DriverMatcher()){
    this.#driverMatcher = matcher
  }
  registerPassenger(id, name) {
    return new User(id, name);
  }

  registerDriver(id, name) {
    this.#drivers.push(new Driver(id, name, "ONLINE"));
  }

  requestRide(id, pickup, destination, passenger) {
    const ride = new Ride(id, pickup, destination, passenger);
    const assignedDriver = this.#driverMatcher.matchRideWithDriver( this.#drivers)
     if(assignedDriver) ride.assignDriver(assignedDriver)
    return ride
  }

  checkRideAssignmentStatus(ride) {
    if (ride.getStatus() !== "REQUESTED") return ride;
    const assignedDriver = this.#driverMatcher.matchRideWithDriver( this.#drivers)
    if(assignedDriver) ride.assignDriver(assignedDriver)
    return ride
  }

  markComplete(ride) {
    const driver = ride.getDriver();
    ride.markComplete();
    if (driver) {
      driver.setAvailability("ONLINE");
    }
  }
}

// AI generated Tests
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  const rideBooking = new RideBooking();

  // Register drivers
  rideBooking.registerDriver(1, "Ramesh");
  rideBooking.registerDriver(2, "Suresh");
  rideBooking.registerDriver(3, "Mahesh");

  // Register passengers
  const manas = rideBooking.registerPassenger(10, "Manas");
  const priya = rideBooking.registerPassenger(11, "Priya");
  const aman = rideBooking.registerPassenger(12, "Aman");
  const shruti = rideBooking.registerPassenger(13, "Shruti");
  const karan = rideBooking.registerPassenger(14, "Karan");

  console.log("\n--- TEST 1: Normal ride assignment ---");
  const ride1 = rideBooking.requestRide(1, "Andheri", "Bandra", manas);
  console.log(`Manas ride status: ${ride1.getStatus()}`); // ONGOING

  console.log("\n--- TEST 2: Second ride gets second driver ---");
  const ride2 = rideBooking.requestRide(2, "Dadar", "Kurla", priya);
  console.log(`Priya ride status: ${ride2.getStatus()}`); // ONGOING

  console.log("\n--- TEST 3: Third ride gets third driver ---");
  const ride3 = rideBooking.requestRide(3, "Powai", "Thane", aman);
  console.log(`Aman ride status: ${ride3.getStatus()}`); // ONGOING

  console.log("\n--- TEST 4: No drivers available — ride stays REQUESTED ---");
  const ride4 = rideBooking.requestRide(4, "Colaba", "Worli", shruti);
  console.log(`Shruti ride status: ${ride4.getStatus()}`); // REQUESTED

  console.log("\n--- TEST 5: Complete ride1 — frees Ramesh ---");
  rideBooking.markComplete(ride1);
  console.log(`Manas ride status after complete: ${ride1.getStatus()}`); // COMPLETE
  console.log(`Ramesh available: ${ride1.getDriver().isAvailable()}`); // true

  console.log(
    "\n--- TEST 6: checkRideAssignmentStatus assigns freed driver to pending ride ---",
  );
  rideBooking.checkRideAssignmentStatus(ride4);
  console.log(`Shruti ride status after retry: ${ride4.getStatus()}`); // ONGOING

  console.log(
    "\n--- TEST 7: checkRideAssignmentStatus on ONGOING ride — should do nothing ---",
  );
  rideBooking.checkRideAssignmentStatus(ride1);
  console.log(`Manas ride status unchanged: ${ride1.getStatus()}`); // COMPLETE

  console.log(
    "\n--- TEST 8: Karan requests ride after all drivers busy again ---",
  );
  const ride5 = rideBooking.requestRide(5, "Juhu", "Santacruz", karan);
  console.log(`Karan ride status: ${ride5.getStatus()}`); // REQUESTED (all 3 drivers IN_RIDE)

  console.log("\n--- TEST 9: Complete ride2 and retry for Karan ---");
  await sleep(1000);
  rideBooking.markComplete(ride2);
  rideBooking.checkRideAssignmentStatus(ride5);
  console.log(`Karan ride status after retry: ${ride5.getStatus()}`); // ONGOING

  console.log("\n--- TEST 10: Cancel a ride ---");
  const ride6 = rideBooking.requestRide(6, "Malad", "Goregaon", shruti);
  console.log(`Shruti new ride status: ${ride6.getStatus()}`);
  ride6.cancelRide();
  console.log(`Shruti ride status after cancel: ${ride6.getStatus()}`); // CANCELED
}

runTests();
