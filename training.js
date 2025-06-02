import { runClassifier } from "./src/classifiers.js"
import OHLCV_INDICATORS from "ohlcv-indicators"
import { maxLeveragePossible } from "./src/orders.js"
import StrategyClass from "./src/strategy.js"

const MM = 200
const atrSlRatio = 0.5
const atrTpRatio = 0.5
const symbol1 = 'BTC'

const xCallbackFunc = ({ objRow, index, state }) => {
  
  const curr = objRow[index]
  const output = {}

  for(const k of Object.keys(curr))
  {
      if(k.includes('_x_'))
      {
        continue
      }
      else if(k.includes('_minmax_') || k.includes('_zscore_') || (k.includes('_rsi_') && !k.includes('_x_')) )
      {
        output[k] = curr[k]
      }
  }


  return output
}

const yCallbackFunc = ({ objRow, index, state }) => {
  //this function is looped in 1h intervals
  //this function triggers a "sell" order
  //in this objRow we can find ohlcv and indicators of 1d and 1 hour intervals
  //if the return is null it will be excluded from training and testing
  //side 0 means stop loss executed, side 1 means take profit executed

  const futureIntervals = 8 //2 hours in 5 mins interval
  if (index + futureIntervals > objRow.length) return null
  const curr = objRow[index]
  
  let {
    [`${symbol1}_1h_atr_14_upper`]: upperAtr,
    [`${symbol1}_1h_atr_14_lower`]: lowerAtr,
    [`${symbol1}_1h_close`]: currClose
  } = curr //contains 1d and 1h properties

  const nextRows = Array.from({length: futureIntervals}).map((_, i) => objRow[index + (i+1)]) //array of objects in 1h intervals containing 1d and 1h properties

  if(nextRows.some(o => typeof o === 'undefined')) return null //excludes this row if nextRow has any undefined item

  //tp and sl can only be execute if order is already accepted
  const upperAtrCrossed = nextRows.findIndex(o => o[`${symbol1}_1h_close`] > upperAtr)
  const lowerAtrCrossed = nextRows.findIndex(o => o[`${symbol1}_1h_close`] < lowerAtr)
  let trade = 0 //initiate as crossed down

  if(upperAtrCrossed === -1 && lowerAtrCrossed === -1)
  {
      const lastRow = nextRows.at(-1)
      const lastClose = lastRow[`${symbol1}_1h_close`]
      trade = Number(lastClose > currClose)
  }

  if(upperAtrCrossed > -1)
  {
    if(lowerAtrCrossed === -1 || lowerAtrCrossed > upperAtrCrossed)
    {
      trade = 1 //upper band crossed
    }
    else if(lowerAtrCrossed === upperAtrCrossed)
    {
      const equalRow = nextRows[upperAtrCrossed]
      trade = Number(equalRow.close > currClose)
    }
  }

  if(trade !== 1 && trade !== 0) return null

  const side = trade === 1 ? 'BUY' : trade === 0 ? 'SELL' : `NONE`

  return { trade };
};




const validateRows = ({ objRow, index, state }) => {
  
  let output = false
  const curr = objRow[index]
  const prev = objRow[index - 1]
  const prevPrev = objRow[index -2]

  for(const [k, v] of Object.entries(curr))
  {
    if((v !== 1 && v !== -1)) continue 
    if(k.includes('price_x_') || k.includes('macd_diff_x_macd_dea'))
    {
      output = true
    }
  }

  return true
}

const addIndicators = (input, keyName) => {
  
  const indicators = new OHLCV_INDICATORS({input, ticker: keyName, precision: false, chunkProcess: 4000})

  if(keyName.endsWith('_1h'))
  {
      indicators
        .dateTime()
        .atr(14, {percentage: true, upper: atrTpRatio, lower: atrSlRatio})
        .rsi(14, {lag: 1})
        .ema(9)
        .ema(21)
        .ema(50)
        .sma(100)
        .sma(200)
        .bollingerBands(20, 2)
        .macd()
        .crossPairs([
          {fast: 'price', slow: 'ema_50'},
          {fast: 'price', slow: 'sma_100'},
          {fast: 'price', slow: 'sma_200'},
        ])

      const ohlcvKeyNames = ['close']
      const maKeyNames = ['ema_9', 'ema_21', 'ema_50', 'sma_100', 'sma_200', 'atr_14_upper', 'atr_14_lower']
      indicators.scaler(MM, [...ohlcvKeyNames, ...maKeyNames], {group: true, lag: 0, type: 'zscore'})
      //indicators.scaler(MM, ['macd_diff', 'macd_dea'], {group: true, lag: 0, type: 'zscore'})
  }
  else if(keyName.endsWith('_1d')) {
    indicators
      .rsi(14, {lag: 1, target: 'open'})
  }

  return indicators
}

const state = new StrategyClass()

const assetGroups = [
  [
    {symbol: symbol1, interval: '1d', type: 'crypto', limit: 2090}, 
    {symbol: symbol1, interval: '1h', type: 'crypto', limit: 20000}
  ]
]

const shuffle = true
const balancing = null

await runClassifier({
  state,
  assetGroups,
  shuffle, 
  balancing, 
  addIndicators,
  validateRows, 
  yCallbackFunc, 
  xCallbackFunc
})

const finalBalance = state.initialBalance.toLocaleString('en', { useGrouping: false, maximumFractionDigits: 0, notation: 'standard' })
console.log('final balance:', finalBalance)
console.log('total operations:', state.idx)