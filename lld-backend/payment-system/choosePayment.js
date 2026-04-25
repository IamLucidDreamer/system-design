class UPIPayment {
  async pay(user, amount) {
    if (Math.random() < 0.7) {
      throw { success: false, method: "UPI", amount };
    }
    const userId = user.getUserId();
    console.log("Processing Payment via UPI:", amount, "for userId", userId);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return { success: true, method: "UPI", amount, userId };
  }
}

class CreditCardPayment {
  async pay(user, amount) {
    if (Math.random() < 0.7) {
      throw {
        success: false,
        method: "CREDIT_CARD",
        amount,
      };
    }
    const userId = user.getUserId();
    console.log(
      "Processing Payment via Credit Card:",
      amount,
      "for userId",
      userId,
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { success: true, method: "CREDIT_CARD", amount, userId };
  }
}

class WalletPayment {
  async pay(user, amount) {
    if (Math.random() < 0.7) {
      throw {
        success: false,
        method: "WALLET",
        amount,
      };
    }
    const userId = user.getUserId();
    console.log(
      "Processing Payment via Wallet:",
      amount,
      "for userId:",
      userId,
    );
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return { success: true, method: "WALLET", amount, userId };
  }
}

const PAYMENT_REGISTRY = {
  UPI: new UPIPayment(),
  CREDIT_CARD: new CreditCardPayment(),
  WALLET: new WalletPayment(),
};

class User {
  #id;
  constructor(id) {
    this.#id = id;
  }
  getUserId() {
    return this.#id;
  }
}

class PaymentService {
  #registry;
  constructor(registry) {
    this.#registry = registry;
  }

  async pay(user, amount, mode, maxRetries = 2) {
    const paymentMode = this.#registry[mode];
    if (!paymentMode) {
      return { success: false, error: "Invalid payment method" };
    }
    if (amount <= 0) {
      return { success: false, error: "Invalid Amount" };
    }
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await paymentMode.pay(user, amount);
        return response;
      } catch (err) {
        console.log(
          `Attempt ${attempt + 1} failed for ${mode}`,
          "| Method:",
          err.method,
        );
        if (attempt === maxRetries) {
          return {
            success: false,
            method: err.method,
            error: "All retries failed",
          };
        }
      }
    }
  }
}

const paymentService = new PaymentService(PAYMENT_REGISTRY);

const user = new User(1);
const user2 = new User(2);

async function main() {
  console.log(await paymentService.pay(user, 5000, "UPI"));
  console.log(await paymentService.pay(user, 6000, "CREDIT_CARD"));
  console.log(await paymentService.pay(user2, 8000, "WALLET"));
}

main();
