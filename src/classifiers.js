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

  const {trainX, trainY, testX, testY, keyNamesY, keyNamesX, inputParamsMatrix, excludes} = dataParams

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
          optimizer: 'sgd', //adam, sgd, adagrad, adamax, rmsprop
          batchSize: 32,
          epochs: 300,
          learningRate: 0.001
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
    await saveFile({fileName, pathName: 'models', data: {model: model.toJSON(), keyNamesY, keyNamesX, inputParamsMatrix, excludes}})
    
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





export const runClassifier = async ({
    state,
    assetGroups, 
    shuffle, 
    balancing,
    addIndicators,
    validateRows, 
    yCallbackFunc, 
    xCallbackFunc
  }) => {


  let inputParamsMatrix = {}
  let trainXMatrix = [], trainYMatrix = [], testXMatrix = [], testYMatrix = []
  let keyNamesX = []
  let keyNamesY = []
  let firstAssetId = null
  const excludes = new Set()

  for(let assetGroupsIdx = 0; assetGroupsIdx < assetGroups.length; assetGroupsIdx++)
  {
    const assetArr = assetGroups[assetGroupsIdx]
    const assetId = xxhash64.h32(`${JSON.stringify(assetArr)}_${addIndicators.toString()}`, 0xABCD).toString(16)

    if(!firstAssetId)
    {
      firstAssetId = assetId
    }

    const assetOhlcv = {}
    let skipRow = false
    let prevAssetName = null

    for(let assetIdx = 0; assetIdx < assetArr.length; assetIdx++)
    {
      const asset = assetArr[assetIdx]
      const {symbol, interval, type, limit, assetName} = asset


      if(!assetName || assetName === prevAssetName) {
        throw new Error(`property "assetName" in group ${assetGroupsIdx} symbol ${symbol} can not be repeated or undefined.`)
      } else {
        prevAssetName = assetName
      }

      const keyName = `${symbol}_${interval}`
      const rawOhlcv = (await loadOhlcv({symbol, interval, type, limit})).slice(-limit)

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

      if(!inputParamsMatrix.hasOwnProperty(keyName))
      {
        inputParamsMatrix[keyName] = indicators.inputParams
      }
      
      assetOhlcv[assetName] = ohlcv
    }


    if(skipRow === true)
    {
      break
    }

    let mergedOhlcv = mergeMultiTimeframes({inputObj: assetOhlcv, target: 'date', chunkSize: 1000})

    const customMinMaxRanges = {}
    const firstRow = mergedOhlcv[0]

    for(const k of Object.keys(firstRow))
    {
      if(k.includes('rsi') && !k.includes('_x_'))
      {
        customMinMaxRanges[k] = {min: 0, max: 100}
      }
      else if(k.includes('_minmax_') || k.includes('_zscore_'))
      {
        excludes.add(k)
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
      trainingSplit: 0.90,
      validateRows,
      yCallbackFunc,
      xCallbackFunc,
      state,
      shuffle,
      balancing,
      excludes: [...excludes],
      customMinMaxRanges
    })

    if(assetGroupsIdx === 0)
    {
      keyNamesX = configX.outputKeyNames
      keyNamesY = configY.keyNames
    }

    trainXMatrix.push(...trainX);
    trainYMatrix.push(...trainY);
    testXMatrix.push(...testX);
    testYMatrix.push(...testY);

  }

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
    inputParamsMatrix,
    excludes: [...excludes]
  };

  await trainModel('knn', trainingTestingData);
  //await trainModel('naive-bayes', trainingTestingData);
  //await trainModel('tensorflow', trainingTestingData);
  //await trainModel('decision-tree', trainingTestingData);
};