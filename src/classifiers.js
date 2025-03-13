import KNN from "ml-knn";
import { GaussianNB } from 'ml-naivebayes';
import {evaluate2dPredictions} from './evaluate-2d-predictions.js'
import { saveFile, loadFile } from "./utilities.js";
import { DecisionTreeClassifier } from 'ml-cart';
import { parseTrainingXY } from "xy-scale"

import dotenv from 'dotenv';
dotenv.config();

const {KV_AUTORIZATION} = process.env


export const trainModel = async (modelType, dataParams) => {

  const {trainX, trainY, testX, testY, keyNamesY, keyNamesX, sufix, inputParams, minMaxRanges} = dataParams

  let params = {}
  let model
  const flatY = (Array.isArray(trainY[0])) ? true : false
  const fittedTrainY = (flatY) ? trainY.flat() : trainY
  
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
    default:
      throw new Error(`Unsupported model type: ${modelType}`);
  }

  const predictions = model.predict(testX)

  const fitPredictions = (flatY) ? predictions.map(v => ([v])) : predictions
  const metrics = evaluate2dPredictions(testY, fitPredictions, keyNamesY, true, modelType.toUpperCase())
  const jsonData = JSON.stringify({model: model.toJSON(), keyNamesY, keyNamesX, inputParams, minMaxRanges})
  const fileName = `model-${modelType}-${sufix}.json`
  await saveFile({fileName, pathName: 'models', jsonData})

  const kvStorage = await fetch(`https://api.gpu.trading/v1/kv/CACHE/${fileName}`, {
    method: 'POST',
    body: jsonData,
    headers: {
      Authorization: KV_AUTORIZATION
    }
  })

  console.log(`${modelType} stored in KV ${kvStorage.statusText}`)

  return {metrics, model}

}


class StrategyClass  {
  constructor({skipNext, strategyDuration, inputKeyNames})
  {
    this.skipIndex = 0
    this.skipNext = skipNext
    this.strategyDuration = strategyDuration
    this.inputKeyNames = inputKeyNames
  }
  add(idx)
  {
    this.skipIndex = idx
  }
}

export const runClassifier = async ({
    limit, 
    type, 
    interval, 
    shuffle, 
    balancing,
    strategyDuration,
    skipNext,
    sufix,
    inputKeyNames,
    validateRows, 
    yCallbackFunc, 
    xCallbackFunc, 
    addIndicators
  }) => {

  const allSymbols = await loadFile({ fileName: 'matrix.json', pathName: `datasets/${type}/${interval}` });
  let trainXMatrix = [], trainYMatrix = [], testXMatrix = [], testYMatrix = [];
  let configXMatrix = {}, configYMatrix = {};

  // Process symbols concurrently.

  let inputParams
  let minMaxRanges

  for(let index = 0; index < allSymbols.length; index++)
  {
    const symbol = allSymbols[index]
    const ohlcv = await loadFile({ fileName: `${symbol}.json`, pathName: `datasets/${type}/${interval}` });
    if (!Array.isArray(ohlcv) || ohlcv.length < limit) continue;
    
    const indicators = addIndicators(ohlcv, limit, symbol)

    if(!inputParams) inputParams = indicators.inputParams
    if(!minMaxRanges) minMaxRanges = indicators.minMaxRanges

    if (index === 0) {
      console.log(indicators.arrObj.length, limit, indicators.arrObj[0]);
    }

    const {
      trainX,
      trainY,
      testX, 
      testY,
      configX,
      configY
    } = parseTrainingXY({
      arrObj: indicators.arrObj,
      trainingSplit: 0.9,
      validateRows,
      yCallbackFunc,
      xCallbackFunc,
      state: new StrategyClass({skipNext, strategyDuration, inputKeyNames}),
      shuffle,
      balancing,
      customMinMaxRanges: {
        ...indicators.minMaxRanges
      }
    })

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

  const firstSymbol = allSymbols[0]
  const keyNamesX = configXMatrix[firstSymbol][0].outputKeyNames
  const keyNamesY = configYMatrix[firstSymbol][0].outputKeyNames

  console.log({keyNamesX, keyNamesY});

  const trainingTestingData = {
    trainX: trainXMatrix,
    trainY: trainYMatrix,
    testX: testXMatrix,
    testY: testYMatrix,
    keyNamesY,
    keyNamesX,
    inputParams,
    minMaxRanges,
    sufix
  };

  //await knn(trainingTestingData);
  await trainModel('knn', trainingTestingData);
  await trainModel('decision-tree', trainingTestingData);
  await trainModel('naive-bayes', trainingTestingData);
};