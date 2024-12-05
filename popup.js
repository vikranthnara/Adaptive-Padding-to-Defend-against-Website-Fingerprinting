// popup.js

document.addEventListener('DOMContentLoaded', function () {
  const enableToggle = document.getElementById('enableToggle');
  const paddingIntensity = document.getElementById('paddingIntensity');
  const intensityValue = document.getElementById('intensityValue');

  const dummyPacketsSent = document.getElementById('dummyPacketsSent');
  const realPacketsIntercepted = document.getElementById('realPacketsIntercepted');
  const currentState = document.getElementById('currentState');
  const timeIdle = document.getElementById('timeIdle');
  const timeBurst = document.getElementById('timeBurst');
  const timeGap = document.getElementById('timeGap');
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
    //currentState.textContent = metrics.currentState || 'S';

    timeIdle.textContent = formatTime(metrics.timeInStates['S'] || 0);
    timeBurst.textContent = formatTime(metrics.timeInStates['B'] || 0);
    timeGap.textContent = formatTime(metrics.timeInStates['G'] || 0);
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