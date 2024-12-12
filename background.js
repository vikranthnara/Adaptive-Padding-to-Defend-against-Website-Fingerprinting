// Import histograms
import { initializeHistograms, refillTokens } from './histograms.js';

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

// Metrics object
let metrics = {
  dummyPacketsSent: 0,
  realPacketsIntercepted: 0,
  dummyPacketsByState: {
    ['S']: 0,
    ['B']: 0,
    ['G']: 0
  },
  currentState: STATE_IDLE,
  lastStateChange: Date.now(),
};

// Cooldown for state transitions
let lastTransitionTime = Date.now();

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

function initializeMetrics() {
  chrome.storage.local.get('metrics', (data) => {
    if (data.metrics) {
      metrics = data.metrics;
    }
    saveMetrics();
  });
}

function saveMetrics() {
  return new Promise((resolve) => {
    chrome.storage.local.set({ metrics }, () => {
      console.log('Metrics saved:', metrics);
      resolve();
    });
  });
}

// Call the initialization function
initializeMetrics();
loadSettings();

// Logging function for state transitions
function logStateTransition(oldState, newState, event) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] State transition: ${oldState} -> ${newState} (Event: ${event})`);

  metrics.currentState = newState;
  saveMetrics();
}

// Listen for messages from popup.js
chrome.runtime.onMessage.addListener(function (message) {
  if (message.action === 'setExtensionEnabled') {
    extensionEnabled = message.enabled;
    if (!extensionEnabled) {
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
    { urls: ['<all_urls>'] },
    ['requestBody']
);

// Listen to incoming responses
chrome.webRequest.onCompleted.addListener(
    handleIncomingResponse,
    { urls: ['<all_urls>'] }
);

// Handle outgoing requests
function handleOutgoingRequest(details) {
  if (!extensionEnabled) return {};

  if (details.method !== 'GET' && details.method !== 'POST') {
    return {};
  }

  metrics.realPacketsIntercepted += 1;
  saveMetrics();

  if (state === STATE_IDLE) {
    const prevState = state;
    state = STATE_BURST;
    logStateTransition(prevState, state, EVENT_REAL_PACKET);
    resetDelayTimer();
    scheduleNextDelay();
  } else if (state === STATE_BURST) {
    resetDelayTimer();
    scheduleNextDelay();
  } else if (state === STATE_GAP) {
    const prevState = state;
    state = STATE_BURST;
    logStateTransition(prevState, state, EVENT_REAL_PACKET);
    resetDelayTimer();
    scheduleNextDelay();
  }

  return {};
}

// Handle incoming responses
function handleIncomingResponse() {
  if (!extensionEnabled) return;

  if (state === STATE_GAP || state === STATE_IDLE) {
    const prevState = state;
    state = STATE_BURST;
    logStateTransition(prevState, state, EVENT_INCOMING_PACKET);
    resetDelayTimer();
    scheduleNextDelay();
  }
}

// Schedule the next delay based on the current state
function scheduleNextDelay() {
  const MINIMUM_DELAY = 2000; // Minimum delay in milliseconds

  if (state === STATE_BURST) {
    currentDelay = Math.max(sampleDelay(histograms.burstHistogram), MINIMUM_DELAY);
  } else if (state === STATE_GAP) {
    currentDelay = Math.max(sampleDelay(histograms.gapHistogram), MINIMUM_DELAY);
  } else if (state === STATE_IDLE) {
    currentDelay = 7000; // Idle state has a fixed delay
  }

  if (currentDelay === Infinity) {
    const prevState = state;
    state = state === STATE_BURST ? STATE_IDLE : STATE_BURST;
    logStateTransition(prevState, state, 'Infinity bin');
    currentDelay = state === STATE_IDLE ? 7000 : 2500;
  }

  delayTimer = setTimeout(onDelayExpire, currentDelay);
  console.log(`Delay scheduled for ${currentDelay} milliseconds.`);
}

// Called when the delay timer expires
function onDelayExpire() {
  if (!extensionEnabled) return;

  if (state === STATE_BURST) {
    sendDummyPacket();
    const prevState = state;
    state = STATE_GAP;
    logStateTransition(prevState, state, EVENT_DELAY_EXPIRE);
    scheduleNextDelay();
  } else if (state === STATE_GAP) {
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
async function sendDummyPacket() {
  if (!extensionEnabled) return;

  try {
    const delayBeforeSending = Math.max(currentDelay / 2, 500); // Ensure reasonable delay
    await new Promise(resolve => setTimeout(resolve, delayBeforeSending));
    await sendRandomizedDummyPacket();

    // Increment dummy packets count for the current state
    metrics.dummyPacketsByState[state] += 1;
    metrics.dummyPacketsSent += 1;
    await saveMetrics();
  } catch (error) {
    console.error('Error sending dummy packet:', error);
  }
}

// Generate and send randomized dummy packets
async function sendRandomizedDummyPacket() {
  if (!extensionEnabled) return;

  try {
    const dummyUrl = chrome.runtime.getURL('dummy.html');
    const dummyPayload = generateRandomDummyPayload();

    await fetch(dummyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: dummyPayload }),
      cache: 'no-cache',
      credentials: 'omit'
    });

    console.log('Randomized dummy packet sent:', dummyPayload);
  } catch (error) {
    console.error('Failed to send randomized dummy packet:', error);
  }
}

// Sample a delay from the histogram
function sampleDelay(histogram) {
  const totalTokens = histogram.reduce((sum, bin) => sum + bin.tokens, 0);

  if (totalTokens === 0) {
    refillTokens(histogram);
    console.warn('Histogram tokens depleted. Refilling...');
    return sampleDelay(histogram);
  }

  const rand = Math.random() * totalTokens;
  let cumulative = 0;

  for (const bin of histogram) {
    cumulative += bin.tokens;

    if (rand <= cumulative) {
      bin.tokens--;

      if (bin.isInfinityBin) {
        console.log('Selected an infinity bin.');
        return Infinity;
      }

      return Math.max(getRandomDelayInBin(bin), 1000); // Ensure a minimum delay of 1 second
    }
  }

  console.error('Sample delay failed: No valid bin found.');
  return 1000; // Default to 1-second delay
}

// Get a random delay within a bin's range
function getRandomDelayInBin(bin) {
  const min = bin.range[0];
  const max = bin.range[1];
  return Math.random() * (max - min) + min;
}

// Generate a random dummy payload
function generateRandomDummyPayload() {
  const payloadSize = Math.floor(Math.random() * 1024);
  return new Array(payloadSize)
      .fill(0)
      .map(() => Math.random().toString(36).charAt(2))
      .join('');
}
