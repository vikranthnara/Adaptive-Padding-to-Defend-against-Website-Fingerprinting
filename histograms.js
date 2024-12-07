// histograms.js

export function initializeHistograms(intensity = 3) {
  return {
    burstHistogram: createHistogram(intensity),
    gapHistogram: createHistogram(intensity)
  };
}

function createHistogram(intensity) {
  return [
    { range: [0, 50], tokens: intensity * 5, isInfinityBin: false },
    { range: [50, 200], tokens: intensity * 3, isInfinityBin: false },
    { range: [200, Infinity], tokens: intensity * 1, isInfinityBin: true },
  ];
}

// Get initial token counts for a bin based on mode and intensity
function getInitialTokensForBin(mode, range, intensity) {
  // Adjust token counts based on intensity
  let baseTokens;

  if (range[1] === Infinity) {
    baseTokens = 5; // Infinity bin has fewer tokens
  } else {
    if (mode === 'burst') {
      baseTokens = 10;
    } else if (mode === 'gap') {
      baseTokens = 15;
    }
    // Apply intensity multiplier
    baseTokens = baseTokens * intensity;
  }

  return baseTokens;
}

// Export functions if needed
