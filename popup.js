document.addEventListener('DOMContentLoaded', function () {
  const enableToggle = document.getElementById('enableToggle');
  const paddingIntensity = document.getElementById('paddingIntensity');
  const intensityValue = document.getElementById('intensityValue');

  const dummyPacketsSent = document.getElementById('dummyPacketsSent');
  const realPacketsIntercepted = document.getElementById('realPacketsIntercepted');
  const timeIdle = document.getElementById('timeIdle');
  const timeBurst = document.getElementById('timeBurst');
  const timeGap = document.getElementById('timeGap');
  const rateIdle = document.getElementById('rateIdle');
  const rateBurst = document.getElementById('rateBurst');
  const rateGap = document.getElementById('rateGap');
  const clearMetricsBtn = document.getElementById('clearMetrics');

  // Load stored settings
  chrome.storage.sync.get(['extensionEnabled', 'paddingIntensity'], function (data) {
    enableToggle.checked = data.extensionEnabled !== false; // Default to true
    paddingIntensity.value = data.paddingIntensity || 3; // Default to 3
    intensityValue.textContent = paddingIntensity.value;
  });

  // Update extension enabled status
  enableToggle.addEventListener('change', function () {
    const enabled = enableToggle.checked;
    chrome.storage.sync.set({ extensionEnabled: enabled }, function () {
      // Notify background script
      chrome.runtime.sendMessage({ action: 'setExtensionEnabled', enabled: enabled });
    });
  });

  // Update padding intensity
  paddingIntensity.addEventListener('input', function () {
    const intensity = parseInt(paddingIntensity.value, 10);
    intensityValue.textContent = intensity;
    chrome.storage.sync.set({ paddingIntensity: intensity }, function () {
      // Notify background script
      chrome.runtime.sendMessage({ action: 'setPaddingIntensity', intensity: intensity });
    });
  });

  // Function to update metrics display
  function updateMetricsDisplay(metrics) {
    dummyPacketsSent.textContent = metrics.dummyPacketsSent || 0;
    realPacketsIntercepted.textContent = metrics.realPacketsIntercepted || 0;

    timeIdle.textContent = formatTime(metrics.timeInStates['S'] || 0);
    timeBurst.textContent = formatTime(metrics.timeInStates['B'] || 0);
    timeGap.textContent = formatTime(metrics.timeInStates['G'] || 0);

    // Update dummy packet rates
    const rates = calculateDummyPacketRates(metrics);
    rateIdle.textContent = `${rates['S']} packets/s`;
    rateBurst.textContent = `${rates['B']} packets/s`;
    rateGap.textContent = `${rates['G']} packets/s`;
  }

  // Function to calculate dummy packet rates
  function calculateDummyPacketRates(metrics) {
    const rates = {};
    for (const state in metrics.dummyPacketsByState) {
      const timeSpent = metrics.timeInStates[state] / 1000; // Convert ms to seconds
      rates[state] = timeSpent > 0 ? (metrics.dummyPacketsByState[state] / timeSpent).toFixed(2) : '0.00';
    }
    return rates;
  }

  // Function to format time from milliseconds to seconds
  function formatTime(ms) {
    return (ms / 1000).toFixed(2) + ' s';
  }

  // Load metrics from storage
  function loadMetrics() {
    chrome.storage.local.get('metrics', (data) => {
      if (data.metrics) {
        updateMetricsDisplay(data.metrics);
      }
    });
  }

  // Clear metrics when the button is clicked
  clearMetricsBtn.addEventListener('click', () => {
    chrome.storage.local.set({
      metrics: {
        dummyPacketsSent: 0,
        realPacketsIntercepted: 0,
        dummyPacketsByState: {
          'S': 0,
          'B': 0,
          'G': 0
        },
        timeInStates: {
          'S': 0,
          'B': 0,
          'G': 0
        },
        currentState: 'S',
        lastStateChange: Date.now(),
        stateTransitions: []
      }
    }, () => {
      loadMetrics();
    });
  });

  // Load metrics on popup open and set up periodic refresh
  loadMetrics();
  setInterval(loadMetrics, 1000);
});
