// background.js

// Import histograms
// Note: Use importScripts if necessary, depending on your environment.
import { initializeHistograms } from './histograms.js';

// States
const STATE_IDLE = 'S';
const STATE_BURST = 'B';
const STATE_GAP = 'G';

// Events
const EVENT_REAL_PACKET = 'R';
const EVENT_DELAY_EXPIRE = 'T_EXPIRE';
const EVENT_INCOMING_PACKET = 'RCV';

// Variables
let state = STATE_IDLE;
let delayTimer = null;
let currentDelay = 0;
let histograms;
let extensionEnabled = true; // Default to enabled
let paddingIntensity = 3; // Default intensity

// Initialize histograms based on padding intensity
function initializeHistogramsBasedOnIntensity() {
  try {
    histograms = initializeHistograms(paddingIntensity);
  } catch (error) {
    console.error('Failed to initialize histograms:', error);
    histograms = {
      burstHistogram: [],
      gapHistogram: []
    };
  }
}

// Initialize extension settings
function initializeExtension() {
  // Initialize histograms
  initializeHistogramsBasedOnIntensity();
}

// Load user settings from storage
const loadSettings = async () => {
  try {
    chrome.storage.sync.get(['extensionEnabled', 'paddingIntensity'], function (data) {
      extensionEnabled = data.extensionEnabled !== false;
      paddingIntensity = data.paddingIntensity || 3;
      initializeExtension();
    });
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
};

loadSettings();

// Logging function
function logStateTransition(oldState, newState, event) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] State transition: ${oldState} -> ${newState} (Event: ${event})`);

  // Optional: Store in extension storage for debugging
  chrome.storage.local.get(['stateLog'], function (result) {
    const logs = result.stateLog || [];
    logs.push({
      timestamp,
      oldState,
      newState,
      event,
    });
    chrome.storage.local.set({ stateLog: logs.slice(-100) }); // Keep last 100 entries
  });
}

// Listen for messages from popup.js
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.action === 'setExtensionEnabled') {
    extensionEnabled = message.enabled;
    if (!extensionEnabled) {
      // Disable the extension: clear timers and reset state
      resetDelayTimer();
      state = STATE_IDLE;
      console.log('Extension disabled.');
    } else {
      console.log('Extension enabled.');
    }
  } else if (message.action === 'setPaddingIntensity') {
    paddingIntensity = message.intensity;
    initializeHistogramsBasedOnIntensity();
    console.log(`Padding intensity set to ${paddingIntensity}.`);
  }
});

// Listen to outgoing requests
chrome.webRequest.onBeforeRequest.addListener(
  handleOutgoingRequest,
  { urls: ["<all_urls>"] },
  ["requestBody"]
);

// Listen to incoming responses
chrome.webRequest.onCompleted.addListener(
  handleIncomingResponse,
  { urls: ["<all_urls>"] }
);

// Handle outgoing requests
function handleOutgoingRequest(details) {
  if (!extensionEnabled) {
    return {};
  }

  if (details.method !== 'GET' && details.method !== 'POST') {
    return {};
  }
  console.log('Outgoing request intercepted:', details.url);

  if (state === STATE_IDLE) {
    const prevState = state;
    state = STATE_BURST;
    logStateTransition(prevState, state, EVENT_REAL_PACKET);
    resetDelayTimer();
    scheduleNextDelay();
  } else if (state === STATE_BURST) {
    // Real packet sent
    resetDelayTimer();
    scheduleNextDelay();
  } else if (state === STATE_GAP) {
    const prevState = state;
    state = STATE_BURST;
    logStateTransition(prevState, state, EVENT_REAL_PACKET);
    resetDelayTimer();
    scheduleNextDelay();
  }

  // Continue the request unmodified
  return {};
}

// Handle incoming responses
function handleIncomingResponse(details) {
  if (!extensionEnabled) {
    return;
  }

  if (state === STATE_GAP) {
    const prevState = state;
    state = STATE_BURST;
    logStateTransition(prevState, state, EVENT_INCOMING_PACKET);
    resetDelayTimer();
    scheduleNextDelay();
  }

  return;
}

// Schedule the next delay based on the current state
function scheduleNextDelay() {
  if (!histograms?.burstHistogram) {
    console.error('Histograms not initialized');
    return;
  }
  
  if (!extensionEnabled) {
    return;
    
  }

  if (state === STATE_BURST) {
    currentDelay = sampleDelay(histograms.burstHistogram);
  } else if (state === STATE_GAP) {
    currentDelay = sampleDelay(histograms.gapHistogram);
  } else {
    return; // Do not schedule delay in Idle state
  }

  console.log(`Scheduled next delay: ${currentDelay}ms in state ${state}`);

  if (currentDelay === Infinity) {
    const prevState = state;
    state = state === STATE_BURST ? STATE_IDLE : STATE_BURST;
    logStateTransition(prevState, state, 'Infinity bin');
    if (state !== STATE_IDLE) {
      scheduleNextDelay();
    }
  } else {
    delayTimer = setTimeout(onDelayExpire, currentDelay);
  }
}

// Called when the delay timer expires
function onDelayExpire() {
  if (!extensionEnabled) {
    return;
  }

  if (state === STATE_BURST) {
    // Delay expired without real packet; send dummy packet
    sendDummyPacket();
    const prevState = state;
    state = STATE_GAP;
    logStateTransition(prevState, state, EVENT_DELAY_EXPIRE);
    scheduleNextDelay();
  } else if (state === STATE_GAP) {
    // Send dummy packet
    sendDummyPacket();
    scheduleNextDelay();
  }
}

// Reset the delay timer
function resetDelayTimer() {
  if (delayTimer) {
    clearTimeout(delayTimer);
    delayTimer = null;
  }
}

// Send a dummy packet
function sendDummyPacket() {
  const dummyUrl = 'https://httpbin.org/get';
  
  fetch(dummyUrl, { method: 'GET' })
    .then((response) => {
      console.log('Dummy packet sent successfully:', response.status);
    })
    .catch((error) => {
      console.error('Failed to send dummy packet:', error);
    });
  console.log('Sending dummy packet at', new Date().toISOString());
}

// Sample a delay from the histogram
function sampleDelay(histogram) {
  const totalTokens = histogram.reduce((sum, bin) => sum + bin.tokens, 0);

  if (totalTokens === 0) {
    // Refill histogram
    refillHistogram(histogram);
  }

  const rand = Math.random() * totalTokens;
  let cumulative = 0;

  for (let i = 0; i < histogram.length; i++) {
    cumulative += histogram[i].tokens;
    if (rand <= cumulative) {
      histogram[i].tokens--;
      const delay = getRandomDelayInBin(histogram[i]);
      if (histogram[i].isInfinityBin) {
        return Infinity;
      } else {
        return delay;
      }
    }
  }

  // Fallback
  return Infinity;
}

// Get a random delay within a bin's range
function getRandomDelayInBin(bin) {
  const min = bin.range[0];
  const max = bin.range[1];
  return Math.random() * (max - min) + min;
}

// Refill histogram tokens
function refillHistogram(histogram) {
  for (let bin of histogram) {
    bin.tokens = bin.initialTokens;
  }
}
