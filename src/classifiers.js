import KNN from "ml-knn"
import { GaussianNB } from 'ml-naivebayes'
import {evaluate2dPredictions} from './evaluate-2d-predictions.js'
import { saveFile, loadFile, loadOhlcv } from "./utilities.js"
import { DecisionTreeClassifier } from 'ml-cart'
import { parseTrainingXY } from "xy-scale"
import TensorFlowClassifier from "./tensorflow.js"
import dotenv from 'dotenv'
import { mergeMultiTimeframes } from "merge-multi-timeframe"
import OHLCV_INDICATORS from "ohlcv-indicators"
import xxhash64 from 'xxhashjs'

dotenv.config();

const {KV_AUTORIZATION} = process.env


export const trainModel = async (modelType, dataParams) => {

  const {trainX, trainY, testX, testY, keyNamesY, keyNamesX, sufix, inputParams} = dataParams

  let params = {}
  let model
  const flatY = (Array.isArray(trainY[0])) ? true : false
  const fittedTrainY = (flatY) ? trainY.flat() : trainY
  let isStrModelJson = true
  
  switch (modelType) {
    case 'knn':

      params = {
        k: (Array.isArray(trainY[0])) ? trainY[0].length + 1 : 2
      }

      model = new KNN(trainX, fittedTrainY, params)
      break;
    case 'decision-tree':

        params = {
        gainFunction: 'gini',
        maxDepth: 10,
        minNumSamples: 3,
      }

      model = new DecisionTreeClassifier(params)
      model.train(trainX, fittedTrainY)
      break;
    case 'naive-bayes':
      model = new GaussianNB();
      model.train(trainX, fittedTrainY)
      break;
    case 'tensorflow':
        isStrModelJson = false
        params = {
          hiddenUnits: 128,
          activation: 'relu', //relu, sigmoid, tanh, elu, selu, 
          optimizer: 'sgd', //adam, sgd, adagrad, adamax, rmsprop
          batchSize: 32,
          epochs: 150,
          learningRate: 0.001
        }
        model = new TensorFlowClassifier(params)
        await model.train(trainX, fittedTrainY)
        break;
    default:
      throw new Error(`Unsupported model type: ${modelType}`);
  }

  const fileName = `model-${modelType}-${sufix}.json`
  const predictions = model.predict(testX)
  const fitPredictions = (flatY) ? predictions.map(v => ([v])) : predictions
  const metrics = evaluate2dPredictions(testY, fitPredictions, keyNamesY, true, modelType.toUpperCase())

  let strModel 

  if(isStrModelJson)
  {
    strModel = JSON.stringify({model: model.toJSON(), keyNamesY, keyNamesX, inputParams})
    await saveFile({fileName, pathName: 'models', jsonData: strModel})
    
    const kvStorage = await fetch(`https://api.gpu.trading/v1/kv/CACHE/${fileName}`, {
      method: 'POST',
      body: strModel,
      headers: {
        Authorization: KV_AUTORIZATION
      }
    })
  
    console.log(`${modelType} stored in KV ${kvStorage.statusText}`)

  }else
  {
    await model.model.save('file:////Users/jaimecastillo/Projects/Trading/ohlcv-ml/models')
  }



 

  return {metrics, model}

}


class StrategyClass  {
  constructor({skipNext, strategyDuration})
  {
    this.skipIndex = 0
    this.skipNext = skipNext
    this.strategyDuration = strategyDuration
  }
  add(idx)
  {
    this.skipIndex = idx
  }
}

export const runClassifier = async ({
    assetGroups, 
    shuffle, 
    balancing,
    strategyDuration,
    skipNext,
    sufix,
    inputKeyNames = [],
    validateRows, 
    yCallbackFunc, 
    xCallbackFunc,
  }) => {

  
  const inputParamsMatrix = {}
  const groupsOhlcv = []

  for(const assetObj of assetGroups)
  {
    const assetOhlcv = {}
    let skipRow = false

    for(const asset of assetObj)
    {
      const {symbol, interval, type, limit, inputParams} = asset
      const hashKeyName = xxhash64.h32(`${type}-${symbol}-${interval}-${limit}-${JSON.stringify(inputParams)}`, 0xABCD).toString(16)
      const pathName = 'datasets/temp-ohlcv'
      const fileName = `${hashKeyName}.json`
      const localOhlcv = await loadFile({fileName, pathName})

      if(localOhlcv)
      {
        inputParamsMatrix[`${symbol}_${interval}`] = inputParams
        assetOhlcv[`${symbol}_${interval}`] = localOhlcv
        continue
      }
      
      const ohlcv = await loadOhlcv({symbol, interval, type, limit})

      if (!Array.isArray(ohlcv)){
        skipRow = true
        console.log(`Skipping row: ${symbol} (${interval})`)
        continue
      }

      const indicators = new OHLCV_INDICATORS({input: ohlcv, ticker: `${symbol}_${interval}`, inputParams})

      const arrObj = indicators.getData()

      inputParamsMatrix[`${symbol}_${interval}`] = inputParams

      assetOhlcv[`${symbol}_${interval}`] = arrObj

      await saveFile({pathName, fileName, jsonData: JSON.stringify(arrObj)})
    }

    if(skipRow === true)
    {
      break
    }

    groupsOhlcv.push(
      mergeMultiTimeframes({inputObj: assetOhlcv, target: 'date', chunkSize: 1000})
    )
  }
  
  console.log(groupsOhlcv)

  return

  

 


  let trainXMatrix = [], trainYMatrix = [], testXMatrix = [], testYMatrix = []
  let configXMatrix = {}, configYMatrix = {}

  for(const [symbol, arrObj] of Object.entries(groupsOhlcv))
  {
    const {
      trainX,
      trainY,
      testX, 
      testY,
      configX,
      configY
    } = parseTrainingXY({
      arrObj,
      trainingSplit: 0.90,
      validateRows,
      yCallbackFunc,
      xCallbackFunc,
      state: new StrategyClass({skipNext, strategyDuration, inputKeyNames}),
      shuffle,
      balancing
    })

    continue

    if(!configXMatrix.hasOwnProperty(symbol))
    {
      configXMatrix[symbol] = [];
      configYMatrix[symbol] = [];   
    }

    configXMatrix[symbol].push(configX);
    configYMatrix[symbol].push(configY);
    trainXMatrix.push(...trainX);
    trainYMatrix.push(...trainY);
    testXMatrix.push(...testX);
    testYMatrix.push(...testY);
  }

  return

  const firstSymbol = assetOhlcv[0]
  const keyNamesX = configXMatrix[firstSymbol][0].outputKeyNames
  const keyNamesY = configYMatrix[firstSymbol][0].outputKeyNames

  console.log(`keyNamesX (${keyNamesX.length})`, keyNamesX)

  const trainingTestingData = {
    trainX: trainXMatrix,
    trainY: trainYMatrix,
    testX: testXMatrix,
    testY: testYMatrix,
    keyNamesY,
    keyNamesX,
    inputParams,
    sufix
  };

  //await trainModel('tensorflow', trainingTestingData);
  await trainModel('knn', trainingTestingData);
  //await trainModel('naive-bayes', trainingTestingData);
  //await trainModel('decision-tree', trainingTestingData);
};