import KNN from "ml-knn"
import { GaussianNB } from 'ml-naivebayes'
import {evaluate2dPredictions} from './evaluate-2d-predictions.js'
import { saveFile, loadFile, loadOhlcv, resetDirectory } from "./utilities.js"
import { DecisionTreeClassifier } from 'ml-cart'
import { parseTrainingXY } from "xy-scale"
import TensorFlowClassifier from "./tensorflow.js"
import dotenv from 'dotenv'
import { mergeMultiTimeframes } from "merge-multi-timeframe"
import xxhash64 from 'xxhashjs'

dotenv.config();

const {KV_AUTORIZATION} = process.env


export const trainModel = async (modelType, dataParams) => {

  const {trainX, trainY, testX, testY, keyNamesY, keyNamesX, inputParams, scaledGroups} = dataParams

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
          activation: 'sigmoid', //relu, sigmoid, tanh, elu, selu, 
          optimizer: 'adam', //adam, sgd, adagrad, adamax, rmsprop
          batchSize: 32,
          epochs: 600,
          learningRate: 0.0001
        }
        model = new TensorFlowClassifier(params)
        await model.train(trainX, fittedTrainY)
        break;
    default:
      throw new Error(`Unsupported model type: ${modelType}`);
  }

  const fileName = `model-${modelType}.json`
  const predictions = model.predict(testX)
  const fitPredictions = (flatY) ? predictions.map(v => ([v])) : predictions
  const metrics = evaluate2dPredictions(testY, fitPredictions, keyNamesY, true, modelType.toUpperCase())

  let strModel 

  if(isStrModelJson)
  {
    await saveFile({fileName, pathName: 'models', data: {model: model.toJSON(), keyNamesY, keyNamesX, inputParams, scaledGroups}})
    
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
    addIndicators,
    skipNext,
    validateRows, 
    yCallbackFunc, 
    xCallbackFunc
  }) => {

  let inputParams = null
  let scaledGroups = null
  let trainXMatrix = [], trainYMatrix = [], testXMatrix = [], testYMatrix = []
  let configXMatrix = {}, configYMatrix = {}
  let firstAssetId = null
  const excludes = []

  for(const assetObj of assetGroups)
  {
    const assetId = xxhash64.h32(`${JSON.stringify(assetObj)}_${addIndicators.toString()}`, 0xABCD).toString(16)

    if(!firstAssetId)
    {
      firstAssetId = assetId
    }

    const assetOhlcv = {}
    let skipRow = false

    for(const asset of assetObj)
    {
      const {symbol, interval, type, limit} = asset
      const keyName = `${symbol}_${interval}`
      const hashFileName = xxhash64.h32(`${type}-${symbol}-${interval}-${limit}-${assetId}`, 0xABCD).toString(16)
      const pathName = `datasets/temp/${keyName}`
      const ohlcvFileName = `ohlcv-${hashFileName}.json`
      const settingsFileName = `settings-${hashFileName}.json`
      const localOhlcvTSV = await loadFile({fileName: ohlcvFileName, pathName})
      const localSettingsJSON = await loadFile({fileName: settingsFileName, pathName})
      let localSettings, localOhlcv

      if(localOhlcvTSV && localSettingsJSON)
      {
        localSettings = JSON.parse(localSettingsJSON)
        localOhlcv = JSON.parse(localOhlcvTSV)

        if(!inputParams)
        {
          inputParams = localSettings.inputParams
        }

        if(!scaledGroups)
        {
          scaledGroups = localSettings.scaledGroups
        }

        for(const arr of Object.values(scaledGroups))
        {
          excludes.push(...(arr.map(v => `${keyName}_${v}`)))
        }

        assetOhlcv[keyName] = localOhlcv
        continue
      }
      
      const rawOhlcv = await loadOhlcv({symbol, interval, type, limit})

      if (!Array.isArray(rawOhlcv)){
        skipRow = true
        console.log(`Skipping row: ${symbol} (${interval})`)
        continue
      }

      const start = performance.now()
      const indicators = addIndicators(rawOhlcv, keyName)
      const end = performance.now()
      console.log(`${keyName} took ${end - start} milliseconds`)

      const ohlcv = indicators.getData()

      if(!inputParams)
      {
        inputParams = indicators.inputParams
      }
      
      if(!scaledGroups)
      {
        scaledGroups = indicators.scaledGroups
      }
      
      assetOhlcv[keyName] = ohlcv

      for(const arr of Object.values(scaledGroups))
      {
        excludes.push(...(arr.map(v => `${keyName}_${v}`)))
      }

      await resetDirectory(pathName)

      try{
        await saveFile({pathName, fileName: ohlcvFileName, data: ohlcv})
        await saveFile({pathName, fileName: settingsFileName, data: {inputParams, scaledGroups}})
      } catch(err)
      {
        console.log(err.message)
      }

    }


    if(skipRow === true)
    {
      break
    }

    let mergedOhlcv = mergeMultiTimeframes({inputObj: assetOhlcv, target: 'date', chunkSize: 1000})
    const customMinMaxRanges = []
    const firstRow = mergedOhlcv[0]

    for(const k of Object.keys(firstRow))
    {
      if(k.includes('rsi'))
      {
        customMinMaxRanges.push({[k]: {min: 0, max: 100}})
      }
    }

    const {
      trainX,
      trainY,
      testX, 
      testY,
      configX,
      configY
    } = parseTrainingXY({
      arrObj: mergedOhlcv,
      trainingSplit: 0.80,
      validateRows,
      yCallbackFunc,
      xCallbackFunc,
      state: new StrategyClass({skipNext, strategyDuration}),
      shuffle,
      balancing,
      excludes,
      customMinMaxRanges
    })


    //console.log(`trainX[0]`, trainX[0])
    //console.log(`configX`, configX)

    if(!configXMatrix.hasOwnProperty(assetId))
    {
      configXMatrix[assetId] = [];
      configYMatrix[assetId] = [];
    }

    configXMatrix[assetId].push(configX);
    configYMatrix[assetId].push(configY);
    trainXMatrix.push(...trainX);
    trainYMatrix.push(...trainY);
    testXMatrix.push(...testX);
    testYMatrix.push(...testY);

  }
  
  const keyNamesX = configXMatrix[firstAssetId][0].outputKeyNames
  const keyNamesY = configYMatrix[firstAssetId][0].outputKeyNames

  console.log(`trainX (${trainXMatrix[0].length})`, trainXMatrix[0])
  console.log(`trainY (${trainYMatrix[0].length})`, trainYMatrix)
  console.log(`keyNamesX (${keyNamesX.length})`, keyNamesX)

  
  const trainingTestingData = {
    trainX: trainXMatrix,
    trainY: trainYMatrix,
    testX: testXMatrix,
    testY: testYMatrix,
    keyNamesY,
    keyNamesX,
    inputParams,
    scaledGroups
  };

  //await trainModel('knn', trainingTestingData);
  //await trainModel('naive-bayes', trainingTestingData);
  await trainModel('tensorflow', trainingTestingData);

  //await trainModel('decision-tree', trainingTestingData);
};