export const DEFAULT_RANGES = [
  { range: [1000, 2000], type: 'short' },
  { range: [2000, 3500], type: 'medium' },
  { range: [3500, 5000], type: 'long' }
];

export function initializeHistograms(intensity = 3) {
  return {
    burstHistogram: createHistogram('burst', intensity),
    gapHistogram: createHistogram('gap', intensity)
  };
}

function createHistogram(mode, intensity, customRanges = DEFAULT_RANGES) {
  return customRanges.map(({ range, type }) => ({
    range,
    tokens: getInitialTokensForBin(mode, type, intensity),
    initialTokens: getInitialTokensForBin(mode, type, intensity)
  }));
}

function getInitialTokensForBin(mode, binType, intensity) {
  let baseTokens;

  switch (binType) {
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

  return Math.max(1, Math.floor(baseTokens * Math.sqrt(intensity))); // Adjust scaling
}

export function refillTokens(histogram) {
  histogram.forEach(bin => {
    bin.tokens = bin.initialTokens;
  });
  console.log('Tokens refilled:', histogram);
  return histogram;
}

export function logHistogramState(histogram, mode) {
  console.log(`Histogram (${mode}):`, histogram.map(bin => ({
    range: bin.range,
    tokens: bin.tokens,
    initialTokens: bin.initialTokens
  })));
}
