// popup.js

document.addEventListener('DOMContentLoaded', function () {
    const enableToggle = document.getElementById('enableToggle');
    const paddingIntensity = document.getElementById('paddingIntensity');
    const intensityValue = document.getElementById('intensityValue');
  
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
  });
  