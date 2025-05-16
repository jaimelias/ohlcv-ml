import { runClassifier } from "./src/classifiers.js"
import { isBetweenOrEqual } from "./studies/utilities/numbers.js"


const xCallbackFunc = ({ objRow, index, state }) => {
  
  const curr = objRow[index]
  const strategy = getStrategyName(objRow, index)
  const output = {strategy}

  for(let k in curr)
  {
    if(state.inputKeyNames.includes(k) || k.includes('_diff_'))
    {
      output[k] = curr[k]
    }
    else if(state.inputKeyNames.some(v => k.startsWith(v)) && k.includes('_lag_'))
    {
      output[k] = curr[k]
    }
  }

  if(index === 0)
  {
    console.log(output)
  }

  return output
}

const yCallbackFunc = ({ objRow, index, state }) => {
  if (state.skipIndex >= index) return null;
  state.add(index + state.skipNext);

  const nextRows = new Array(state.strategyDuration)
    .fill(0)
    .map((_, i) => objRow[index + (i + 1)]);
  if (nextRows.some(o => typeof o === 'undefined')) return null;

  const {
    close,
  } = objRow[index];

  // Find the take-profit index: when price crosses above the bands
  const tpIndex = nextRows.findIndex(o => o.high > close && (o.high > o.donchian_channel_upper))

  // If a take-profit event is found, calculate the stop-loss level
  if (tpIndex !== -1) {
    // Use the take-profit row's high as the target price
    const targetPrice = nextRows[tpIndex].donchian_channel_upper


    // Stop-loss is set at half the distance from the close to targetPrice
    const stopLoss = close - (targetPrice - close) / 2;
    // Find the first occurrence (if any)

    const slIndex = nextRows.findIndex((o, i) => i < tpIndex && o.low < stopLoss);
    // If stop loss was hit before take profit, return side: 0
    if (slIndex !== -1) {
      if(slIndex < tpIndex)
      {
        return { side: 0 };
      }
      else
      {
        return {side: 1}
      }
    }
    // Otherwise, take profit is reached first
    return { side: 1 };
  }
  
  return { side: 0 };
};


const validateRows = ({ objRow, index, state }) => {
  
  return getStrategyName(objRow, index) !== null
}


const testInputParams = [
  {"key":"macd","params":[12,26,9,{"target":"close","lag":0}]},
  {"key":"ema","params":["ema",9,{"target":"close","lag":0}]},
  {"key":"ema","params":["ema",21,{"target":"close","lag":0}]},
  {"key":"ema","params":["ema",50,{"target":"close","lag":0}]},
  {"key":"sma","params":["sma",100,{"target":"close","lag":0}]},
  {"key":"sma","params":["sma",200,{"target":"close","lag":0}]},
  {"key":"rsi","params":[8,{"target":"close","lag":0}]},
  {"key":"rsi","params":[14,{"target":"close","lag":0}]},
  {"key":"bollingerBands","params":[20,2,{"target":"close","height":false,"range":[],"lag":0}]},
  {"key":"donchianChannels","params":[25,2,{"height":false,"range":[],"lag":0}]},
  {"key":"scaler","params":[200,["open","high","low","close","ema_9","ema_21","ema_50","sma_100","sma_200","bollinger_bands_upper","bollinger_bands_lower","donchian_channel_upper","donchian_channel_lower"],"minmax",true,[0,1],0]}
]
const assetGroups = [
  [
    {symbol: 'DXY', interval: '1d', type: 'index', limit: 2000, inputParams: testInputParams },
    {symbol: 'BTC', interval: '1d', type: 'crypto', limit: 2000, inputParams: testInputParams },
    {symbol: 'BTC', interval: '5m', type: 'crypto', limit: 100000, inputParams: testInputParams }, 
    {symbol: 'BTC', interval: '1h', type: 'crypto', limit: 10000, inputParams: testInputParams }
  ]
]

const shuffle = false
const balancing = null
const skipNext = 12
const strategyDuration = 40
const inputKeyNames = [
  ...[
    'rsi_14', 
    'rsi_8',
    'rsi_sma_8',
    'rsi_sma_14',
  ]
]

const getStrategyName = (objRow, index) => {

  const curr = objRow[index]
  const prev = objRow[index - 1]

  if(typeof prev === 'undefined') return null

  if(curr.macd_diff_x_macd_dea === 1 && curr.rsi_14 > 50 && curr.rsi_14 > prev.rsi_14)
  {
    return 1
  }

  return null
}

runClassifier({
  assetGroups,
  shuffle, 
  balancing, 
  skipNext, 
  strategyDuration,
  inputKeyNames,
  validateRows, 
  yCallbackFunc, 
  xCallbackFunc, 
})