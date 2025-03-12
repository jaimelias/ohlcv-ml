import OHLCV_INDICATORS from "ohlcv-indicators"
import { runClassifier } from "./src/classifiers.js"
import { isBetweenOrEqual } from "./studies/utilities/numbers.js"


const addIndicators = (inputOhlcv, limit) => {

    const indicators = new OHLCV_INDICATORS({input: inputOhlcv.slice(-(limit*1.5)), precision: false})
    const maDiffArgs = {stdDev: 2, scale: 0.01, lag: 0}

    indicators
        .dateTime()
        .ema(9, {diff: {targets: ['close'], maDiffArgs}})
        .ema(21, {diff: {targets: ['close', 'ema_9'], maDiffArgs}})
        .ema(50, {diff: {targets: ['close', 'ema_9', 'ema_21'], maDiffArgs}})
        .sma(100, {diff: {targets: ['close', 'ema_9', 'ema_21', 'ema_50'], maDiffArgs}})
        .sma(200, {diff: {targets: ['close', 'ema_9', 'ema_21', 'ema_50', 'sma_100'], maDiffArgs}})
        .rsi(8, {scale: 2.5, lag: 5})
        .rsi(14, {scale: 2.5, lag: 5})
        .bollingerBands(20, 1.5, {scale: 0.025, height: true})
        .donchianChannels(20, 2, {scale: 0.025, height: true})
        .crossPairs([
          {fast: 'price', slow: 'ema_50'},
          {fast: 'price', slow: 'sma_100'},
          {fast: 'price', slow: 'sma_200'},
          {fast: 'price', slow: 'donchian_channel_lower'}
        ])

    const arrObj = indicators.getData().slice(-limit)
    const {inputParams, minMaxRanges} = indicators

    return {
      arrObj,
      inputParams,
      minMaxRanges
    }
}

const xCallbackFunc = ({ objRow, index, state }) => {
  
  const curr = objRow[index]

  const maDiffArr = [
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

  const rsiArr = [
    'rsi_14', 
    'rsi_8',
    'rsi_sma_8',
    'rsi_sma_14',
  ]

  

  const requiredKeys = [
    ...rsiArr,
    ...maDiffArr
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

    if(state.skipIndex >= index) return null
    state.add(index + state.skipNext)

    const nextRows = new Array(state.strategyDuration).fill(0).map((_, i) => objRow[index + (i + 1)])
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

  return isBetweenOrEqual(price_x_ema_50, [1, 2]) 
  || isBetweenOrEqual(price_x_sma_100, [1, 2]) 
  || isBetweenOrEqual(price_x_sma_200, [1, 2]) 
  || isBetweenOrEqual(price_x_donchian_channel_lower, [1, 2]) 
}

const limit = 100000
const type = 'crypto'
const interval = '5m'
const useCache = false
const shuffle = false
const balancing = null
const skipNext = 6
const strategyDuration = 10
const sufix = `${type}-${interval}-${limit}`

runClassifier({
  limit,
  type, 
  interval, 
  useCache, 
  shuffle, 
  balancing, 
  skipNext, 
  strategyDuration,
  sufix, 
  validateRows, 
  yCallbackFunc, 
  xCallbackFunc, 
  addIndicators
})