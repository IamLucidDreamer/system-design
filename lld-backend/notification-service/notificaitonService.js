class EmailNotification {
  send(message) {
    console.log("Email:", message);
  }
}

class SMSNotification {
  send(message) {
    console.log("SMS:", message);
  }
}

class PushNotification {
  send(message) {
    console.log("Push:", message);
  }
}

class InAppNotification{
    send(message){
        console.log("In App:", message)
    }
}

const CHANNEL_REGISTRY = {
  EMAIL: new EmailNotification(),
  SMS: new SMSNotification(),
  PUSH: new PushNotification(),
  IN_APP: new InAppNotification()
};

class User {
  #id;
  #preferences;
  constructor(id, preferences) {
    this.#id = id;
    this.#preferences = preferences;
  }

  getPreferences() {
    return [...this.#preferences];
  }
}

class NotificationService {
  #registry;
  constructor(registry) {
    this.#registry = registry;
  }

  send(user, message) {
    const channels = user.getPreferences();

    for (const type of channels) {
      const channel = this.#registry[type];
      if (channel) {
        channel.send(message);
      }
    }
  }
}

const notificationService = new NotificationService(CHANNEL_REGISTRY);
const user = new User(1, ["EMAIL", "PUSH"]);
const user2 = new User(2, ["EMAIL", "PUSH", "SMS", "IN_APP"]);
notificationService.send(user, "Welcome!");
notificationService.send(user, "Hello from system!");
notificationService.send(user2, "User 2");
