import { parseTrainingXY } from "xy-scale"
import {loadFile, saveFile} from './src/utilities.js'
import OHLCV_INDICATORS from "ohlcv-indicators"
import { knn, dt } from "./src/classifiers.js"
import { isBetweenOrEqual } from "./studies/utilities/numbers.js"


class SkipClass  {
  constructor()
  {
    this.skip = 0
    this.initialBalance = 0
  }
  add(idx)
  {
    this.skip = idx
  }
}

const limit = 1000
const type = 'stocks'
const interval = '1d'
const useCache = false
const shuffle = true
const balancing = null
const skipNext = 1
const sufix = `${type}-${interval}-${limit}`

const runClassifier = async () => {


  if (useCache) {
    const cachedTrainingTestData = await loadFile({ fileName: `cache-${sufix}.json`, pathName: 'datasets' });
    if (cachedTrainingTestData) {
      console.log('running classifiers from cached data');
      await knn(cachedTrainingTestData, sufix);
      await dt(cachedTrainingTestData, sufix);
      return true;
    }
  }

  const allSymbols = await loadFile({ fileName: 'matrix.json', pathName: `datasets/${type}/${interval}` });
  let trainXMatrix = [], trainYMatrix = [], testXMatrix = [], testYMatrix = [];
  let configXMatrix = {}, configYMatrix = {};

  // Process symbols concurrently.

  for(let index = 0; index < allSymbols.length; index++)
  {
    const symbol = allSymbols[index]
    const ohlcv = await loadFile({ fileName: `${symbol}.json`, pathName: `datasets/${type}/${interval}` });
    if (!ohlcv) return null;

    
    const indicators = addIndicators(ohlcv.slice(-(limit + 250)))

    const arrObj = indicators.getData().slice(-limit)

    if (index === 0) {
      console.log(arrObj[0]);
    }

    const {
      trainX,
      trainY,
      testX, 
      testY,
      configX,
      configY
    } = parseTrainingXY({
      arrObj,
      trainingSplit: 0.9,
      validateRows,
      yCallbackFunc,
      xCallbackFunc,
      state: new SkipClass(),
      shuffle,
      balancing
    })

    configXMatrix[symbol] = configX;
    configYMatrix[symbol] = configY;
    trainXMatrix.push(...trainX);
    trainYMatrix.push(...trainY);
    testXMatrix.push(...testX);
    testYMatrix.push(...testY);
  }

  const firstSymbol = allSymbols[0]

  console.log(`configXMatrix.outputKeyNames`, configXMatrix[firstSymbol].outputKeyNames);
  console.log(`configYMatrix.outputKeyNames`, configYMatrix[firstSymbol].outputKeyNames);


  const trainingTestingData = {
    trainX: trainXMatrix,
    trainY: trainYMatrix,
    testX: testXMatrix,
    testY: testYMatrix,
    keyNamesY: configYMatrix[firstSymbol].outputKeyNames,
    limit,
  };

  if (!useCache) {
    await saveFile({
      fileName: `cache-${sufix}.json`,
      pathName: 'datasets',
      jsonData: JSON.stringify(trainingTestingData)
    });
  }

  console.log('running classifiers from files');
  await knn(trainingTestingData, sufix);
  await dt(trainingTestingData, sufix);
};


const addIndicators = inputOhlcv => {

    const indicators = new OHLCV_INDICATORS({input: inputOhlcv})

    const rsiLag = 0
    const maDiffArgs = {stdDev: 2, scale: 0.01, lag: 0}

    indicators
        .macd()
        .dateTime()
        .ema(9, {diff: {targets: ['close'], maDiffArgs}})
        .ema(21, {diff: {targets: ['close', 'ema_9'], maDiffArgs}})
        .ema(50, {diff: {targets: ['close', 'ema_9', 'ema_21'], maDiffArgs}})
        .sma(100, {diff: {targets: ['close', 'ema_9', 'ema_21', 'ema_50'], maDiffArgs}})
        .sma(200, {diff: {targets: ['close', 'ema_9', 'ema_21', 'ema_50', 'sma_100'], maDiffArgs}})
        .volumeOscillator(3, 10, {scale: 0.05})
        .rsi(8, {scale: 2.5, lag: rsiLag})
        .rsi(14, {scale: 2.5, lag: rsiLag})
        .bollingerBands(20, 1.5, {scale: 0.025, height: true})
        .donchianChannels(20, 2, {scale: 0.025, height: true})
        .crossPairs([
          {fast: 'price', slow: 'ema_50'},
          {fast: 'price', slow: 'sma_100'},
          {fast: 'price', slow: 'sma_200'},
          {fast: 'price', slow: 'donchian_channel_lower'}
        ])

    return indicators
}

const xCallbackFunc = ({ objRow, index, state }) => {
  
  const curr = objRow[index]

  const emaDiffArray = [
    'ema_9_diff_close',
    'ema_21_diff_close',
    'ema_21_diff_ema_9',
    'ema_50_diff_close',
    'ema_50_diff_ema_9',
    'ema_50_diff_ema_21',
    'sma_100_diff_close',
    'sma_100_diff_ema_9',
    'sma_100_diff_ema_21',
    'sma_100_diff_ema_50',
    'sma_200_diff_ema_9',
    'sma_200_diff_ema_21',
    'sma_200_diff_ema_50',
    'sma_200_diff_sma_100'
  ]

  const barriers = [
    'rsi_14', 
    'rsi_8',
    'rsi_sma_8',
    'rsi_sma_14',
    'volume_oscillator'
  ]

  const requiredKeys = [
    ...barriers,
    ...emaDiffArray,
    //'donchian_channel_range_close',
    'macd_diff_x_macd_dea',
  ]

  const output = {}

  for(let k in curr)
  {
    if(requiredKeys.includes(k))
    {
      output[k] = curr[k]
    }
    else if(requiredKeys.some(v => k.startsWith(v)) && k.includes('_lag_'))
    {
      output[k] = curr[k]
    }
  }

  return output
}

  const yCallbackFunc = ({ objRow, index, state }) => {

    if(state.skip >= index) return null
    state.add(index + skipNext)

    const nextRows = new Array(10).fill(0).map((_, i) => objRow[index + (i + 1)])
    if(nextRows.some(o => typeof o === 'undefined')) return null

    const {
      close, 
      bollinger_bands_upper, 
      donchian_channel_upper, 
      bollinger_bands_middle, 
      donchian_channel_basis
    } = objRow[index]

    const bbMid = (bollinger_bands_upper-bollinger_bands_middle)/bollinger_bands_middle
    const dcMid = (donchian_channel_upper-donchian_channel_basis)/donchian_channel_basis
    const mid = Math.max(bbMid, dcMid)
    
    //price has crosses up bollinger_bands, donchian_channel_upper or rsi_14 >= 70
    const tpIndex = nextRows.findIndex(o => o.high > close && (o.high >= bollinger_bands_upper || o.high >= donchian_channel_upper ) )
    const slIndex = nextRows.findIndex(o => Math.abs((o.low-close)/o.low) >= mid)


    if (tpIndex === -1 || tpIndex === slIndex) {
      // Either no TP is set or TP and SL positions are the same.
      return { side: 0 };
    }
    
    if (tpIndex >= 0 && slIndex === -1) {
      // A valid TP exists but no SL is set.
      return { side: 1 };
    }
    
    if (tpIndex >= 0 && slIndex >= 0) {
      // Both TP and SL are set. Compare their positions.
      return tpIndex < slIndex ? { side: 1 } : { side: 0 };
    }
    
    // Optionally, add a default case if needed.
    return { side: 0 };
}

const validateRows = row => {
  
   const {
    price_x_ema_50,
    price_x_sma_100,
    price_x_sma_200,
    price_x_donchian_channel_lower
  } = row

  return isBetweenOrEqual(price_x_ema_50, [-1, 1]) 
  || isBetweenOrEqual(price_x_sma_100, [-1, 1]) 
  || isBetweenOrEqual(price_x_sma_200, [-1, 1]) 
  || isBetweenOrEqual(price_x_donchian_channel_lower, [-1, 1]) 
}

runClassifier()