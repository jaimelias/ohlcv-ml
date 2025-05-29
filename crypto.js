import { runClassifier } from "./src/classifiers.js"
import OHLCV_INDICATORS from "ohlcv-indicators"
import { maxLeveragePossible } from "./src/orders.js"

const MM = 200
const atrSize = 14
const atrSlRatio = 0.5
const atrTpRatio = .75
const symbol1 = 'PAXG'

const xCallbackFunc = ({ objRow, index, state }) => {
  
  const curr = objRow[index]
  const output = {}
  
  for(const k of Object.keys(curr))
  {
      if(k.includes('_x_'))
      {
        continue
      }
      else if(k.includes('_minmax_') || k.includes('_zscore_') || k.includes('_rsi_') )
      {
        output[k] = curr[k]
      }
  }

  return output
}

const yCallbackFunc = ({ objRow, index, state }) => {
  //this function is looped in 5m intervals
  //in this objRow we can find ohlcv and indicators of 5m and 1 hour intervals
  //if the return is null it will be excluded from training and testing
  //side 0 means stop loss executed, side 1 means take profit executed

  const futureIntervals = 12 * 2 //2 hours in 5 mins interval
  if (index + futureIntervals > objRow.length) return null
  const curr = objRow[index]
  
  let {
    [`${symbol1}_1h_atr_${atrSize}_percentage`]: atrPercentage,
    [`${symbol1}_1h_open`]: currOpen,
    [`${symbol1}_1h_close`]: currClose,
    [`${symbol1}_1h_date`]: currDate,
  } = curr //contains 5m and 1h properties


  console.log(atrPercentage)

  const currCandle = (currOpen > currClose) ? 'bearish' : 'bullish'

  if(currCandle === 'bearish') return null //excludes 

  const nextRows = Array.from({length: futureIntervals}).map((_, i) => objRow[index + (i+1)]) //array of objects in 5m intervals containing 5m and 1h properties

  if(nextRows.some(o => typeof o === 'undefined')) return null //excludes this row if nextRow has any undefined item

  const midPrice = (currOpen + currClose) / 2
  const entryPrice = midPrice * (1 + (atrPercentage))
    
  const isLimitOrderAccepted = nextRows.findIndex(o => o[`${symbol1}_5m_low`] < entryPrice) 
  
  if(isLimitOrderAccepted === -1) return null //excluded from training and testing if order is not accepted

  //if the order is accepted it can only return 1 if takeProfitSucess, or 0 if stopLossExecuted 

  const takeProfit = entryPrice * (1 - (atrPercentage * atrTpRatio))
  const stopLoss = entryPrice * (1 + (atrPercentage * atrSlRatio))

  //tp and sl can only be execute if order is already accepted
  const takeProfitSucess = nextRows.slice(isLimitOrderAccepted).findIndex(o => o[`${symbol1}_5m_low`] < takeProfit)
  const stopLossExecuted = nextRows.slice(isLimitOrderAccepted).findIndex(o => o[`${symbol1}_5m_high`] > stopLoss)

  //console.log({isLimitOrderAccepted, takeProfitSucess, stopLossExecuted})

  let trade = 0 //trade is initiated as stop loss always

  if(takeProfitSucess === -1 && stopLossExecuted === -1)
  {
    //const {[`${symbol1}_5m_close`]: lastClose} = nextRows[nextRows.length -1]
    //trade = lastClose > currClose ? 1 : 0
    return null //excluded from training and testing if tp neither sl are executed
  }

  if(takeProfitSucess > -1)
  {
    if(stopLossExecuted === -1 || stopLossExecuted > takeProfitSucess)
    {
      trade = 1 //take profit executed
    }
    else if(stopLossExecuted === takeProfitSucess)
    {
      //const {[`${symbol1}_5m_close`]: lastClose} = nextRows[stopLossExecuted]
      //trade = lastClose > currClose ? 1 : 0
      return null //excluded from training and testing as we do not have any means to detect which as executed first
    }
  }

  if(trade !== 1 && trade !== 0) return null

  const leverage = maxLeveragePossible({entryPrice, stopLoss, MAX_PERCENTUAL_LOSS: 50, maxLeverage: 50})

  state.reportInit({trade, side: 'sell', entryPrice, stopLoss, takeProfit, leverage, date: currDate}) //this part only logs the report of the c

  return { trade };
};




const validateRows = ({ objRow, index, state }) => {
  
  const curr = objRow[index]
  const {
    [`${symbol1}_5m_minute`]: minute,
    [`${symbol1}_1h_open`]: currOpen,
    [`${symbol1}_1h_close`]: currClose,
  } = curr

  return minute === 55 && currClose > currOpen
}

const addIndicators = (input, keyName) => {
  
  const indicators = new OHLCV_INDICATORS({input, ticker: keyName, precision: false, chunkProcess: 5000})

  let ohlcvKeyNames = []
  let maKeyNames = []


  if(keyName === `${symbol1}_5m`)
  {
    indicators
      .rsi(14, {lag: 1})
      .ema(9)
      .ema(21)
      .ema(50)
      .sma(100)
      .sma(200)
      .dateTime()
      .atr(atrSize, {type: 'percentage'})
      .crossPairs([
        {fast: 'rsi_14', slow: 30},
        {fast: 'price', slow: 'ema_50'},
        {fast: 'price', slow: 'sma_100'},
        {fast: 'price', slow: 'sma_200'}
      ])

      ohlcvKeyNames = ['open', 'high', 'low', 'close']
      maKeyNames = ['ema_9', 'ema_21', 'ema_50', 'sma_100', 'sma_200']
      
      indicators.scaler(MM, [...ohlcvKeyNames, ...maKeyNames], {group: true, lag: 0, type: 'zscore'})

  } else if(keyName === `${symbol1}_1h`)
  {
      indicators
      .atr(atrSize, {type: 'percentage'})
      .rsi(14, {lag: 1})
      .ema(9)
      .ema(21)
      .ema(50)
      .sma(100)
      .sma(200)

    ohlcvKeyNames = ['open', 'high', 'low', 'close']
    maKeyNames = ['ema_9', 'ema_21', 'ema_50', 'sma_100', 'sma_200']
    indicators.scaler(MM, [...ohlcvKeyNames, ...maKeyNames], {group: true, lag: 5, type: 'zscore'})
  }

  return indicators
}

const assetGroups = [
  [
    {symbol: symbol1, interval: '5m', type: 'crypto', limit: 200000}, 
    {symbol: symbol1, interval: '1h', type: 'crypto', limit: 20000}
  ]
]

const shuffle = true
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