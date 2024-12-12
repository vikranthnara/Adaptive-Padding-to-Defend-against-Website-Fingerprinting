// popup.js
document.addEventListener('DOMContentLoaded', function() {
  // Get DOM elements with null checks

  console.log('Popup initialized');

  const elements = {
      enableToggle: document.getElementById('enableToggle'),
      paddingIntensity: document.getElementById('paddingIntensity'),
      intensityValue: document.getElementById('intensityValue'),
      dummyPacketsSent: document.getElementById('dummyPacketsSent'),
      dummyPacketsBurst: document.getElementById('dummyPacketsBurst'),
      dummyPacketsGap: document.getElementById('dummyPacketsGap'),
      realPacketsIntercepted: document.getElementById('realPacketsIntercepted')  
    };

    console.log('Found elements:', Object.keys(elements).filter(k => elements[k] !== null));

  // Load settings
  chrome.storage.sync.get(['extensionEnabled', 'paddingIntensity'], function(data) {
      elements.enableToggle.checked = data.extensionEnabled !== false;
      elements.paddingIntensity.value = data.paddingIntensity || 3;
      elements.intensityValue.textContent = elements.paddingIntensity.value;
  });

  // Update metrics display
  function updateMetricsDisplay() {
    chrome.storage.local.get('metrics', function(data) {
      if (data.metrics) {
        try {
            elements.dummyPacketsSent.textContent = data.metrics.dummyPacketsSent || 0;
            elements.dummyPacketsBurst.textContent = data.metrics.dummyPacketsByState['B'] || 0;
            elements.dummyPacketsGap.textContent = data.metrics.dummyPacketsByState['G'] || 0;
            elements.realPacketsIntercepted.textContent = data.metrics.realPacketsIntercepted || 0;
            
            // Debug: Log updated values
            console.log('Updated UI with values:', {
                total: elements.dummyPacketsSent.textContent,
                burst: elements.dummyPacketsBurst.textContent,
                gap: elements.dummyPacketsGap.textContent,
                real: elements.realPacketsIntercepted.textContent
            });
        } catch (error) {
            console.error('Error updating UI:', error);
        }
    }
  });
}

  // Event Listeners
  elements.enableToggle.addEventListener('change', function() {
      const enabled = elements.enableToggle.checked;
      chrome.storage.sync.set({ extensionEnabled: enabled }, function() {
          chrome.runtime.sendMessage({ 
              action: 'setExtensionEnabled', 
              enabled: enabled 
          });
      });
  });

  elements.paddingIntensity.addEventListener('input', function() {
      const intensity = parseInt(elements.paddingIntensity.value, 10);
      elements.intensityValue.textContent = intensity;
      chrome.storage.sync.set({ paddingIntensity: intensity }, function() {
          chrome.runtime.sendMessage({ 
              action: 'setPaddingIntensity', 
              intensity: intensity 
          });
      });
  });

  // Update metrics every second
  updateMetricsDisplay();
  setInterval(updateMetricsDisplay, 1000);
});