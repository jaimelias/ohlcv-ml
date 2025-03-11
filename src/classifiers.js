import KNN from "ml-knn";
import { GaussianNB } from 'ml-naivebayes';
import {evaluate2dPredictions} from './evaluate-2d-predictions.js'
import { saveFile, loadFile } from "./utilities.js";
import { DecisionTreeClassifier } from 'ml-cart';
import { parseTrainingXY } from "xy-scale"


//trainX and trainY are 2D arrays of normalized or standard scaled values

export const knn = async ({trainX, trainY, testX, testY, keyNamesY, keyNamesX, sufix, limit, inputParams}) => {
   
    const k = (Array.isArray(trainY[0])) ? trainY[0].length + 1 : 2  //number of nearest neighbors (Default: number of labels + 1).
    const model = new KNN(trainX, trainY, { k })

    const predictions = model.predict(testX)
    
    const metrics = evaluate2dPredictions(testY, predictions, keyNamesY, true, 'KNN')

    const jsonData = JSON.stringify({model: model.toJSON(), params: {k}, keyNamesY, keyNamesX, limit, inputParams})

    await saveFile({fileName: `model-knn-${sufix}.json`, pathName: 'models', jsonData})

    return {metrics, model}
}


export const dt =  async ({trainX, trainY, testX, testY, keyNamesY, keyNamesX, sufix, limit, inputParams}) => {
   
    const params = {
        gainFunction: 'gini',
        maxDepth: 10,
        minNumSamples: 3,
    }

    const model = new DecisionTreeClassifier(params)
    
    model.train(trainX, trainY.flat())
    const predictions = model.predict(testX)
    
    const metrics = evaluate2dPredictions(testY, predictions.map(v => ([v])), keyNamesY, true, 'Decision Tree')
    const jsonData = JSON.stringify({model: model.toJSON(), params, keyNamesY, keyNamesX, limit, inputParams})

    await saveFile({fileName: `model-decision-tree-${sufix}.json`, pathName: 'models', jsonData})

    return {metrics, model}
}

export const nb =  async ({trainX, trainY, testX, testY, keyNamesY, keyNamesX, sufix, limit, inputParams}) => {
   
  const model = new GaussianNB()
  
  model.train(trainX, trainY.flat())
  const predictions = model.predict(testX)
  
  const metrics = evaluate2dPredictions(testY, predictions.map(v => ([v])), keyNamesY, true, 'Naive Bayes')
  const jsonData = JSON.stringify({model: model.toJSON(), keyNamesY, keyNamesX, limit, inputParams})

  await saveFile({fileName: `model-naive-bayes-${sufix}.json`, pathName: 'models', jsonData})

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
    limit, 
    type, 
    interval, 
    useCache, 
    shuffle, 
    balancing,
    strategyDuration,
    skipNext,
    scaleChunkSize = Infinity,
    sufix, 
    validateRows, 
    yCallbackFunc, 
    xCallbackFunc, 
    addIndicators
  }) => {

  if (useCache) {
    const cachedTrainingTestData = await loadFile({ fileName: `cache-${sufix}.json`, pathName: 'datasets' });
    if (cachedTrainingTestData) {
      console.log('running classifiers from cached data');
      await knn(cachedTrainingTestData);
      await nb(cachedTrainingTestData);
      await dt(cachedTrainingTestData);
      return true;
    }
  }

  const allSymbols = await loadFile({ fileName: 'matrix.json', pathName: `datasets/${type}/${interval}` });
  let trainXMatrix = [], trainYMatrix = [], testXMatrix = [], testYMatrix = [];
  let configXMatrix = {}, configYMatrix = {};

  // Process symbols concurrently.

  let inputParams

  for(let index = 0; index < allSymbols.length; index++)
  {
    const symbol = allSymbols[index]
    const ohlcv = await loadFile({ fileName: `${symbol}.json`, pathName: `datasets/${type}/${interval}` });
    if (!ohlcv) continue;

    
    const indicators = addIndicators(ohlcv.slice(-(limit + 250)))

    if(!inputParams) inputParams = indicators.inputParams

    const arrObj = indicators.getData().slice(-limit)

    if (index === 0) {
      console.log(arrObj[0]);
    }

    for (let i = 0; i < arrObj.length; i += scaleChunkSize) {
      const chunk = arrObj.slice(i, i + scaleChunkSize)

      const {
        trainX,
        trainY,
        testX, 
        testY,
        configX,
        configY
      } = parseTrainingXY({
        arrObj: chunk,
        trainingSplit: 0.9,
        validateRows,
        yCallbackFunc,
        xCallbackFunc,
        state: new StrategyClass({skipNext, strategyDuration}),
        shuffle,
        balancing
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
    limit,
    inputParams,
    sufix
  };

  if (!useCache) {
    await saveFile({
      fileName: `cache-${sufix}.json`,
      pathName: 'datasets',
      jsonData: JSON.stringify(trainingTestingData)
    });
  }

  

  console.log('running classifiers from files');
  await knn(trainingTestingData);
  await dt(trainingTestingData);
  await nb(trainingTestingData);
};