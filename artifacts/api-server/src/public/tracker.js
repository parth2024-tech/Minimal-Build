(function(window) {
  const API_URL = "https://your-api-domain.com/api/v1/event";
  let workspaceId = null;
  let apiKey = null;

  // Init IDB
  const dbName = "MinimalTrackerDB";
  const storeName = "events";
  let dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(storeName, { autoIncrement: true });
    };
  });

  async function saveLocally(eventPayload) {
    try {
      const db = await dbPromise;
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).add(eventPayload);
      return tx.complete;
    } catch (e) {
      console.warn("Failed to save event locally", e);
    }
  }

  async function flushQueue() {
    if (!navigator.onLine) return;
    try {
      const db = await dbPromise;
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      
      request.onsuccess = async () => {
        const events = request.result;
        if (events.length === 0) return;
        
        let allSucceeded = true;
        for (const evt of events) {
          const success = await sendToServer(evt);
          if (!success) {
            allSucceeded = false;
            break;
          }
        }
        
        if (allSucceeded) {
          const clearTx = db.transaction(storeName, "readwrite");
          clearTx.objectStore(storeName).clear();
        }
      };
    } catch (e) {
      console.warn("Flush failed", e);
    }
  }

  async function sendToServer(payload) {
    try {
      const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      };
      
      // Use fetch with keepalive to ensure it sends even if page unloads.
      // navigator.sendBeacon does not support custom headers (like Authorization),
      // which are required by the current API schema.
      const response = await fetch(API_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        keepalive: true
      });
      return response.ok;
    } catch (e) {
      return false;
    }
  }

  window.MinimalTracker = {
    init: function(config) {
      workspaceId = config.workspaceId;
      apiKey = config.apiKey;
      
      window.addEventListener("online", flushQueue);
      if (navigator.onLine) flushQueue();
    },
    track: async function(eventName, properties = {}) {
      if (!workspaceId || !apiKey) {
        console.warn("Tracker not initialized");
        return;
      }
      
      const payload = {
        workspaceId,
        eventName,
        url: window.location.href,
        referrer: document.referrer,
        userAgent: navigator.userAgent,
        properties
      };
      
      if (navigator.onLine) {
        const success = await sendToServer(payload);
        if (!success) await saveLocally(payload);
      } else {
        await saveLocally(payload);
      }
    }
  };
})(window);
