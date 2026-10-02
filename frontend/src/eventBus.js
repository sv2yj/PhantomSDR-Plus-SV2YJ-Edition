class EventBus {
    constructor() {
        this.events = {};
    }

    subscribe(eventName, callback) {
        if (!this.events[eventName]) {
            this.events[eventName] = [];
        }
        this.events[eventName].push(callback);
        // FIX: return an unsubscribe function so callers can do:
        //   const unsub = eventBus.subscribe('event', handler);
        //   onDestroy(() => unsub());
        // Previously subscribe() returned undefined, so every captured
        // unsubscriber in both App files was undefined, eventBusUnsubscribers
        // was always [], and stale callbacks from destroyed component instances
        // accumulated permanently across HMR reloads and SPA navigation.
        return () => this.unsubscribe(eventName, callback);
    }

    // FIX: unsubscribe a specific callback from an event.
    // Called internally by the closure returned from subscribe().
    unsubscribe(eventName, callback) {
        if (!this.events[eventName]) return;
        this.events[eventName] = this.events[eventName].filter(cb => cb !== callback);
    }

    publish(eventName, data) {
        if (this.events[eventName]) {
            this.events[eventName].forEach(callback => callback(data));
        }
    }
}

export const eventBus = new EventBus();
