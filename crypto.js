import { runClassifier } from "./src/classifiers.js"
import OHLCV_INDICATORS from "ohlcv-indicators"
const MM = 200
const atrSize = 14

const xCallbackFunc = ({ objRow, index, state }) => {
  
  const curr = objRow[index]
  const {
    BTC_1h_minmax_200_close: close,
    [`BTC_5m_atr_${atrSize}_percentage`]: atrPercentage,
  } = curr

  const takeProfit = close * (1 + atrPercentage)//Math.min(close * (1 + atrPercentage), 1)
  const stopLoss   = close * (1 - atrPercentage)//Math.max(close * (1 - atrPercentage), -1)

  const output = {takeProfit, stopLoss}

  for(const k of Object.keys(curr))
  {
    if(k.startsWith('BTC_1h_'))
    {
      if(k.includes('_x_'))
      {
        continue
      }
      else if(k.includes('_minmax_') || k.includes('_rsi_'))
      {
        output[k] = curr[k]
      }
    }
  }

  return output
}

const yCallbackFunc = ({ objRow, index }) => {
  //this function is looped in 5m intervals
  //in this objRow we can find ohlcv and indicators of 5m and 1 hour intervals
  //if the return is null it will be excluded from training and testing

  if (index + 12 > objRow.length) return null
  const curr = objRow[index]
  
  const {
    [`BTC_5m_atr_${atrSize}_percentage`]: atrPercentage,
    BTC_1h_open: currOpen,
    BTC_1h_close: currClose,
  } = curr

  if(atrPercentage < 0.001) return null //excluded from training and testing if atr is below the limit for creatint sl and tp orders
  if(currOpen > currClose) return null //excluded from training and testing bearish candles

  const nextRows = Array.from({length: 12}).map((_, i) => objRow[index + (i+1)])


  const entryPrice = (currOpen + currClose) / 2
  const isLimitOrderAccepted = nextRows.findIndex(o => o.BTC_1h_low < entryPrice)
  
  if(isLimitOrderAccepted === -1) return null //excluded from training and testing if order is not accepted

  //if the order is accepted it can only return 1 if takeProfitSucess, or 0 if stopLossExecuted 

  const takeProfit = entryPrice * (1 + atrPercentage)
  const stopLoss   = entryPrice * (1 - atrPercentage)


  const takeProfitSucess = nextRows.findIndex(o => o.BTC_1h_high > takeProfit)
  const stopLossExecuted = nextRows.findIndex(o => o.BTC_1h_low < stopLoss)

  if(takeProfitSucess === -1 && stopLossExecuted === -1)
  {
    return null //excluded from training and testing if tp neither sl are executed
  }

  let trade = 0

  if(takeProfitSucess > -1)
  {
    if(stopLossExecuted === -1 || stopLossExecuted > takeProfitSucess)
    {
      trade = 1
    }
    else if(stopLossExecuted === takeProfitSucess)
    {
      return null //excluded from training and testing as we do not have any means to detect which as executed first
    }
  }

  if(trade !== 1 && trade !== 0) return null

  return { trade };
};




const validateRows = ({ objRow, index, state }) => {
  
  const curr = objRow[index]
  const {
    ['BTC_5m_minute']: minute,
    ['BTC_1h_open']: open,
    ['BTC_1h_close']: close,
  } = curr

  return minute === 55 && close > open
}

const addIndicators = (input, keyName) => {
  
  const indicators = new OHLCV_INDICATORS({input, ticker: keyName, precision: false, chunkProcess: 4500})

  if(keyName === 'BTC_5m')
  {
    indicators
      .dateTime()
      .atr(atrSize, {type: 'percentage'})

  } else if(keyName === 'BTC_1h')
  {
    indicators
      .rsi(14, {lag: 1})
      .ema(9)
      .ema(21)
      .ema(50)
      .sma(100)
      .sma(200)
      .volumeOscillator(5, 10)

    const ohlcvKeyNames = ['open', 'high', 'low', 'close']
    const maKeyNames = ['ema_9', 'ema_21', 'ema_50', 'sma_100', 'sma_200']
    
    indicators.scaler(MM, [...ohlcvKeyNames, ...maKeyNames], {group: true, lag: 1})
    indicators.scaler(MM, ['volume_oscillator_5_10'], {group: false, lag: 1})
  }

  return indicators
}

const assetGroups = [
  [
    {symbol: 'BTC', interval: '5m', type: 'crypto', limit: 200000}, 
    {symbol: 'BTC', interval: '1h', type: 'crypto', limit: 20000}
  ]
]

const shuffle = false
const balancing = null
const skipNext = 0
const strategyDuration = 40

runClassifier({
  assetGroups,
  shuffle, 
  balancing, 
  skipNext, 
  strategyDuration,
  addIndicators,
  validateRows, 
  yCallbackFunc, 
  xCallbackFunc
})