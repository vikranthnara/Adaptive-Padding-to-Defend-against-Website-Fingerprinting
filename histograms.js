// histograms.js

export function initializeHistograms(intensity = 3) {
  return {
    burstHistogram: createHistogram('burst', intensity),
    gapHistogram: createHistogram('gap', intensity)
  };
}

function createHistogram(mode, intensity) {
  // Base delays in milliseconds
  const bins = [
    { 
      range: [1000, 2000],  // 1-2 seconds
      tokens: getInitialTokensForBin(mode, 'short', intensity),
      initialTokens: getInitialTokensForBin(mode, 'short', intensity)
    },
    { 
      range: [2000, 3500],  // 2-3.5 seconds
      tokens: getInitialTokensForBin(mode, 'medium', intensity),
      initialTokens: getInitialTokensForBin(mode, 'medium', intensity)
    },
    { 
      range: [3500, 5000],  // 3.5-5 seconds
      tokens: getInitialTokensForBin(mode, 'long', intensity),
      initialTokens: getInitialTokensForBin(mode, 'long', intensity)
    }
  ];
  return bins;
}

function getInitialTokensForBin(mode, binType, intensity) {
  let baseTokens;

  switch(binType) {
    case 'short':
      baseTokens = mode === 'burst' ? 10 : 5;
      break;
    case 'medium':
      baseTokens = mode === 'burst' ? 6 : 8;
      break;
    case 'long':
      baseTokens = mode === 'burst' ? 4 : 3;
      break;
    default:
      baseTokens = 5;
  }

  return Math.max(1, Math.floor(baseTokens * intensity));
}

export function refillTokens(histogram) {
  histogram.forEach(bin => {
    bin.tokens = bin.initialTokens;
  });
  return histogram;
}