import { runClassifier } from "./src/classifiers.js"
import OHLCV_INDICATORS from "ohlcv-indicators"
import { maxLeveragePossible } from "./src/orders.js"
import StrategyClass from "./src/strategy.js"

const MM = 200
const atrSlRatio = 1.2
const atrTpRatio = 1.2
const symbol1 = 'ASSET_1_1h'

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

  const futureIntervals = 10 //hours
  if (index + futureIntervals > objRow.length) return null
  const curr = objRow[index]
  
  const {
    [`${symbol1}_atr_14_upper`]: upperAtr,
    [`${symbol1}_atr_14_lower`]: lowerAtr,
    [`${symbol1}_close`]: currClose
  } = curr //contains 1d and 1h properties

  const nextRows = Array.from({length: futureIntervals}).map((_, i) => objRow[index + (i+1)]) //array of objects in 1h intervals containing 1d and 1h properties

  if(nextRows.some(o => typeof o === 'undefined')) return null //excludes this row if nextRow has any undefined item

  //tp and sl can only be execute if order is already accepted
  const upperAtrCrossed = nextRows.findIndex(o => o[`${symbol1}_close`] > upperAtr)
  const lowerAtrCrossed = nextRows.findIndex(o => o[`${symbol1}_close`] < lowerAtr)
  let trade = 0 //initiate as crossed down

  let noneLabel = ''

  if(upperAtrCrossed === -1 && lowerAtrCrossed === -1)
  {
      const lastRow = nextRows.at(-1)
      const lastClose = lastRow[`${symbol1}_close`]
      noneLabel = Number(lastClose > currClose)
      trade = 0.5
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
      noneLabel = Number(equalRow.close > currClose)
      trade = 0.5
    }
  }

  //if(trade !== 1 && trade !== 0) return null

  const side = trade === 1 ? 'BUY' : trade === 0 ? 'SELL' : `NONE_${noneLabel}`

  return { side };
};




const validateRows = ({ objRow, index, state }) => {
  

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
        .rsi(6, {lag: 1})
        .ema(9)
        .ema(21)
        .ema(50)
        .sma(100)
        .sma(200)
        .sma(300)
        .bollingerBands(20, 2)
        .donchianChannels(25, 1)
        .macd()
        
      const ohlcvKeyNames = ['close']
      const maKeyNames = ['ema_9', 'ema_21', 'ema_50', 'sma_100', 'sma_200', 'sma_300', 'atr_14_upper', 'atr_14_lower', 'bollinger_bands_upper', 'bollinger_bands_lower', 'donchian_channel_upper', 'donchian_channel_lower']
      indicators.scaler(MM, [...ohlcvKeyNames, ...maKeyNames], {group: true, lag: 0, type: 'zscore'})
      indicators.scaler(MM, ['macd_diff', 'macd_dea'], {group: true, lag: 0, type: 'zscore'})
  }
  else if(keyName.endsWith('_1d')) {
    indicators
      .rsi(14, {lag: 1})
  }

  return indicators
}

const state = new StrategyClass()

const allSymbols = ['ADA', 'BTC', 'ETH', 'PAXG', 'SOL', 'XRP']

const assetGroups = []

for(const k of allSymbols)
{
  assetGroups.push([
    {symbol: k, assetName: 'ASSET_1_1h', interval: '1h', type: 'crypto', limit: 5000}, //ASSET_0
    {symbol: k, assetName: 'ASSET_1_2h', interval: '1d', type: 'crypto', limit: 2090}
  ])
}

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