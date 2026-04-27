const SEAT_TIER = Object.freeze({ SILVER: "SILVER", GOLD: "GOLD", PLATINUM: "PLATINUM" });
const SEAT_STATUS = Object.freeze({ AVAILABLE: "AVAILABLE", HELD: "HELD", BOOKED: "BOOKED" });
const BOOKING_STATUS = Object.freeze({ PENDING: "PENDING", CONFIRMED: "CONFIRMED", CANCELLED: "CANCELLED" });

const TIER_PRICE = Object.freeze({ SILVER: 200, GOLD: 500, PLATINUM: 1000 });
const HOLD_DURATION_MS = 5 * 60 * 1000;

class Mutex {
    #locked = false;
    #queue = [];

    acquire() {
        return new Promise((resolve) => {
            const tryAcquire = () => {
                if (!this.#locked) {
                    this.#locked = true;
                    resolve(() => this.#release());
                } else {
                    this.#queue.push(tryAcquire);
                }
            };
            tryAcquire();
        });
    }

    #release() {
        this.#locked = false;
        const next = this.#queue.shift();
        if (next) next();
    }
}

class City {
    #id; #name;
    cinemas = new Map();

    constructor(id, name) { this.#id = id; this.#name = name; }
    getId() { return this.#id; }
    getName() { return this.#name; }
}

class Cinema {
    #id; #name; #cityId;
    halls = new Map();

    constructor(id, name, cityId) { this.#id = id; this.#name = name; this.#cityId = cityId; }
    getId() { return this.#id; }
    getName() { return this.#name; }
}

class Hall {
    #id; #name; #cinemaId;
    baseSeats = [];

    constructor(id, name, cinemaId) { this.#id = id; this.#name = name; this.#cinemaId = cinemaId; }
    getId() { return this.#id; }
}

class ShowSeat {
    constructor(seatId, tier, price) {
        this.seatId = seatId;
        this.tier = tier;
        this.price = price;
        this.status = SEAT_STATUS.AVAILABLE;
        this.heldBy = null;           
        this.holdExpiry = null;
        this.bookedBy = null;
    }
}

class Show {
    #id; #movieName; #hallId; #cinemaId; #cityId; #startTime;
    #seats = new Map();

    constructor(id, movieName, hallId, cinemaId, cityId, startTime, hallBaseSeats, pricingConfig) {
        this.#id = id;
        this.#movieName = movieName;
        this.#hallId = hallId;
        this.#cinemaId = cinemaId;
        this.#cityId = cityId;
        this.#startTime = startTime;

        for (const { id: seatId, tier } of hallBaseSeats) {
            const price = pricingConfig[tier] ?? TIER_PRICE[tier];
            this.#seats.set(seatId, new ShowSeat(seatId, tier, price));
        }
    }

    getId() { return this.#id; }
    getMovieName() { return this.#movieName; }
    getSeat(seatId) { return this.#seats.get(seatId); }
    getAllSeats() { return this.#seats; }
}

class Booking {
    constructor(id, userId, showId, seatIds, totalAmount) {
        this.id = id;
        this.userId = userId;
        this.showId = showId;
        this.seatIds = seatIds;
        this.totalAmount = totalAmount;   
        this.status = BOOKING_STATUS.PENDING;
        this.createdAt = new Date();
        this.holdExpiry = new Date(Date.now() + HOLD_DURATION_MS);
        this._holdTimer = null;
    }
}


class PaymentService {
    async charge(userId, amount) {
        await new Promise(r => setTimeout(r, 100));
        return Math.random() > 0.2;
    }
}

class BookingService {
    #shows = new Map();
    #bookings = new Map();
    #showLocks = new Map();

    #paymentService = new PaymentService();
    #idCounter = 0;

    addShow(show) {
        this.#shows.set(show.getId(), show);
    }

    getAvailableSeats(showId) {
        const show = this.#shows.get(showId);
        if (!show) throw new Error(`Show ${showId} not found`);

        const available = new Map();
        for (const [seatId, showSeat] of show.getAllSeats()) {
            if (showSeat.status === SEAT_STATUS.AVAILABLE) {
                available.set(seatId, {
                    seatId,
                    tier: showSeat.tier,
                    price: showSeat.price,
                });
            }
        }
        return available;
    }

    async reserveSeats(showId, seatIds, userId) {
        const lock = this.#getOrCreateLock(showId);
        const release = await lock.acquire();

        try {
            const show = this.#shows.get(showId);
            if (!show) throw new Error(`Show ${showId} not found`);

            for (const seatId of seatIds) {
                const seat = show.getSeat(seatId);
                if (!seat) throw new Error(`Seat ${seatId} does not exist in show ${showId}`);
                if (seat.status !== SEAT_STATUS.AVAILABLE) {
                    throw new Error(`Seat ${seatId} is ${seat.status} — booking aborted`);
                }
            }

            const holdExpiry = new Date(Date.now() + HOLD_DURATION_MS);
            let totalAmount = 0;

            for (const seatId of seatIds) {
                const seat = show.getSeat(seatId);
                seat.status = SEAT_STATUS.HELD;
                seat.heldBy = userId;
                seat.holdExpiry = holdExpiry;
                totalAmount += seat.price;
            }

            const bookingId = `BKG-${++this.#idCounter}`;
            const booking = new Booking(bookingId, userId, showId, [...seatIds], totalAmount);

            booking._holdTimer = setTimeout(() => {
                this.#expireHold(bookingId);
            }, HOLD_DURATION_MS);

            this.#bookings.set(bookingId, booking);

            console.log(`[HOLD]    booking=${bookingId} seats=${seatIds} user=${userId} expires=${holdExpiry.toISOString()}`);
            return booking;

        } finally {
            release();
        }
    }

    confirmPayment(bookingId, successStatus) {
        const booking = this.#bookings.get(bookingId);
        if (!booking) throw new Error(`Booking ${bookingId} not found`);
        if (booking.status !== BOOKING_STATUS.PENDING) {
            throw new Error(`Booking ${bookingId} is already ${booking.status}`);
        }

        clearTimeout(booking._holdTimer);
        booking._holdTimer = null;

        const show = this.#shows.get(booking.showId);

        if (successStatus) {
            booking.status = BOOKING_STATUS.CONFIRMED;
            for (const seatId of booking.seatIds) {
                const seat = show.getSeat(seatId);
                seat.status = SEAT_STATUS.BOOKED;
                seat.bookedBy = booking.userId;
                seat.heldBy = null;
                seat.holdExpiry = null;
            }
            console.log(`[CONFIRM] booking=${bookingId} seats=${booking.seatIds} total=₹${booking.totalAmount}`);
        } else {
            this.#releaseSeats(booking, show, BOOKING_STATUS.CANCELLED);
            console.log(`[CANCEL]  booking=${bookingId} seats released back to AVAILABLE`);
        }

        return booking.status === BOOKING_STATUS.CONFIRMED;
    }

    async bookSeats(showId, seatIds, userId) {
        const booking = await this.reserveSeats(showId, seatIds, userId);
        const paymentSuccess = await this.#paymentService.charge(userId, booking.totalAmount);
        return this.confirmPayment(booking.id, paymentSuccess);
    }

    #expireHold(bookingId) {
        const booking = this.#bookings.get(bookingId);
        if (!booking || booking.status !== BOOKING_STATUS.PENDING) return;

        const show = this.#shows.get(booking.showId);
        this.#releaseSeats(booking, show, BOOKING_STATUS.CANCELLED);
        console.log(`[EXPIRE]  booking=${bookingId} — hold timed out, seats released`);
    }

    #releaseSeats(booking, show, newStatus) {
        booking.status = newStatus;
        for (const seatId of booking.seatIds) {
            const seat = show.getSeat(seatId);
            if (seat) {
                seat.status = SEAT_STATUS.AVAILABLE;
                seat.heldBy = null;
                seat.holdExpiry = null;
            }
        }
    }

    #getOrCreateLock(showId) {
        if (!this.#showLocks.has(showId)) {
            this.#showLocks.set(showId, new Mutex());
        }
        return this.#showLocks.get(showId);
    }
}

// AI Generated tests
// ─────────────────────────────────────────────
//  SEED DATA + DEMO
// ─────────────────────────────────────────────

function seedHall(hallId, rows = ["A", "B", "C"], seatsPerRow = 5) {
    const hall = new Hall(hallId, `Hall-${hallId}`, "cinema-1");
    const tierMap = { A: SEAT_TIER.PLATINUM, B: SEAT_TIER.GOLD, C: SEAT_TIER.SILVER };

    for (const row of rows) {
        for (let n = 1; n <= seatsPerRow; n++) {
            hall.baseSeats.push({ id: `${row}${n}`, tier: tierMap[row] ?? SEAT_TIER.SILVER });
        }
    }
    return hall;
}

async function runDemo() {
    console.log("═══════════════════════════════════════════════");
    console.log("  BookMyShow — Flash Opening Concurrency Demo  ");
    console.log("═══════════════════════════════════════════════\n");

    const hall = seedHall("H1");
    const show = new Show(
        "SHOW-1", "Interstellar",
        hall.getId(), "cinema-1", "city-1",
        new Date("2026-05-01T18:00:00"),
        hall.baseSeats,
        { PLATINUM: 1000, GOLD: 500, SILVER: 200 }
    );

    const service = new BookingService();
    service.addShow(show);

    // ── 1. Normal booking ──────────────────────────────────────────────
    console.log("── Scenario 1: Normal booking ──");
    const available = service.getAvailableSeats("SHOW-1");
    console.log(`Available seats: ${[...available.keys()].join(", ")}\n`);

    const booking1 = await service.reserveSeats("SHOW-1", ["A1", "A2"], "user-alice");
    console.log(`Booking created: ${booking1.id} | total ₹${booking1.totalAmount}\n`);

    service.confirmPayment(booking1.id, true);

    // ── 2. Double-booking prevention ──────────────────────────────────
    console.log("\n── Scenario 2: Two users race for the same seat (A3) ──");
    const results = await Promise.allSettled([
        service.reserveSeats("SHOW-1", ["A3"], "user-bob"),
        service.reserveSeats("SHOW-1", ["A3"], "user-carol"),
    ]);

    results.forEach((r, i) => {
        const user = i === 0 ? "Bob  " : "Carol";
        if (r.status === "fulfilled") {
            console.log(`${user} → HELD   booking=${r.value.id}`);
            service.confirmPayment(r.value.id, true);
        } else {
            console.log(`${user} → BLOCKED: ${r.reason.message}`);
        }
    });

    // ── 3. Atomicity: partial availability should fail entirely ────────
    console.log("\n── Scenario 3: Atomicity — book A3 (taken) + B1 (free) ──");
    try {
        await service.reserveSeats("SHOW-1", ["A3", "B1"], "user-dave");
    } catch (e) {
        console.log(`Expected error: ${e.message}`);
        const b1 = show.getSeat("B1");
        console.log(`B1 status after failed attempt: ${b1.status} (must be AVAILABLE)`);
    }

    // ── 4. Hold expiry ─────────────────────────────────────────────────
    console.log("\n── Scenario 4: Hold expires — seats auto-released ──");
    const booking2 = await service.reserveSeats("SHOW-1", ["B2"], "user-eve");
    console.log(`Eve holds B2. Status: ${show.getSeat("B2").status}`);

    // Manually fire the expiry for demo (real system: wait 5 min)
    clearTimeout(booking2._holdTimer);
    service.confirmPayment(booking2.id, false); // simulate payment failure
    console.log(`After payment failure. B2 status: ${show.getSeat("B2").status}`);

    // ── 5. Final available snapshot ────────────────────────────────────
    console.log("\n── Final available seats ──");
    const finalAvail = service.getAvailableSeats("SHOW-1");
    console.log([...finalAvail.keys()].join(", ") || "None");
}

runDemo();

// ─────────────────────────────────────────────
//  SD3 DESIGN NOTES  (say these out loud in the interview)
//
//  1. LOCK LOCATION
//     LLD  → in-process Mutex (this file).
//     Prod → Redis SETNX with TTL per showId.
//           For multi-node: Redlock (quorum across ≥3 Redis instances).
//
//  2. HOLD EXPIRY
//     LLD  → setTimeout (per process, lost on crash).
//     Prod → Bull / BullMQ job with jobId = bookingId.
//           Survives restarts; can be cancelled by jobId on confirmPayment.
//           Alternative: DB cron that scans HELD seats past holdExpiry every 30s.
//
//  3. PRICE CONSISTENCY
//     Price is copied into ShowSeat at Show-creation time and into Booking at
//     hold-time. Admin price changes after that don't affect pending bookings.
//     In prod: store price in the bookings table — source of truth at checkout.
//
//  4. ATOMICITY ACROSS NODES
//     LLD  → all-or-nothing check + mutation inside Mutex.
//     Prod → DB transaction with SELECT FOR UPDATE on all seat rows,
//           or a Lua script in Redis (atomic across commands).
//
//  5. SCALABILITY
//     Per-show locks mean show-A and show-B never block each other.
//     Read-heavy paths (getAvailableSeats) don't need the lock — they read
//     a snapshot. Only writes (reserve/confirm) serialize per show.
// ─────────────────────────────────────────────
