import { scaleOhlcv } from "./src/scale.js"
import { prepareDataset } from "./src/dataset.js"
import {evaluateKNN} from './src/evaluate-knn.js'
import {loadFile, validateKeyNames, saveFile} from './src/utilities.js'
import KNN from "ml-knn";
import OHLCV_INDICATORS from "ohlcv-indicators"


const runClassifier = async () => {
    
    const symbol = 'SPY'
    const interval = '1d'

    // loads an OHLCV array of objects in number format [{open, high, low, close, volume}, {open...}] 
    const inputOhlcv = await loadFile({fileName: `${interval}-${symbol}.json`, pathName: 'datasets'}) // "./datasets/1d-etf-spy.json"

    const start = performance.now()

    //load indicators
    const candleLabelLag = 5
    const candleLabelLaggedKeys = new Array(candleLabelLag).fill(null).map((_,i)=> `candle_label_lag_${i+1}`)
    const indicators = new OHLCV_INDICATORS({input: inputOhlcv})
        .candlesStudies(10)
        .findLinearDirection(['close'])
        .lag(['candle_label'], candleLabelLag)
    
    const objDataset = indicators.getData()  //returns array of objects of all ohlcv + indicator values
    const hiddenFeatures = [] //used for calculation in parseFeaturesAndLabelsFunc, not added to training
    const includeOnes = [] //hidden feature that includes excludes the current row of features if its value is not 1
    const includeZeros = [] //hidden feature that includes excludes the current row of features if its value is not 0
    
    const keyNames = [...includeOnes, ...includeZeros,  ...hiddenFeatures, 'close_linear_direction', 'candle_label', ...candleLabelLaggedKeys]

    validateKeyNames(objDataset, keyNames) //checks are keyNames are in objDataset, else throw error

    //flattens objDataset into a 2 dimensions array with normalized and standarized value
    //scaleOhlcv uses skewness and standard deviation to decide between standardizing and normalizing objDataset
    const transformedOhlcv = scaleOhlcv(objDataset, keyNames)

    const {
        trainDataset,
        trainLabels,
        testDataset,
        testLabels
    } = prepareDataset({
        transformedOhlcv, 
        trainingSplit: 0.95,
        futureWindow: 1, //prepares the array for future predictions removing the latest items
        parseFeaturesAndLabelsFunc: tomorrowCloseGtToday,
        includeOnes,
        includeZeros,
        hiddenFeatures
    })


    console.log('trainLabels: ', trainLabels.length)
    console.log('trainDataset: ', trainDataset.length)

    const k = (Array.isArray(trainLabels[0])) ? trainLabels[0].length + 1 : 2  //number of nearest neighbors (Default: number of labels + 1).
    const model = new KNN(trainDataset, trainLabels, { k })

    const predictionLabels = model.predict(testDataset)

    //console.log('trainLabels: ', trainLabels)
    //console.log('predictionLabels: ', predictionLabels)

    console.log(evaluateKNN(testLabels, predictionLabels)) 

    const end = performance.now();
    console.log(`exampleFunction took ${end - start} milliseconds`)

    await saveFile({
        fileName: `knn-${interval}-${symbol}.json`, 
        pathName: 'models', 
        jsonData: JSON.stringify(model.toJSON())
    })
}


const tomorrowCloseGtToday = ({rawDataset, index, futureWindow, transformedOhlcv, includeOnes, includeZeros, hiddenFeatures}) => {

    // parseFeaturesAndLabels parses already normalized / standarized rows creating {parsedFeatures, parsedLabels}
    // It's crucial to remember not to compare features from different columns directly by it index as the are scaled
    // Direct comparisons should only be made between next or previous items of the same feature / labels
    

    const {descaledVal, scaledVal} = transformedOhlcv

    const output = {
        parsedFeatures: null,
        parsedLabels: null
    }

    const curr = rawDataset[index]; //current row
    const next = rawDataset[index + futureWindow]; //next row

    // Extract feature values for dataset
    const currClose = scaledVal('close_linear_direction', curr)
    const nextClose = scaledVal('close_linear_direction', next)

    includeOnes = includeOnes.map(v => descaledVal(v, curr))
    includeZeros = includeZeros.map(v => descaledVal(v, curr))

    if(includeOnes.every(v => v === 1) && includeZeros.every(v => v === 0))
    {
        const hiddenRows = hiddenFeatures.length + includeOnes.length + includeZeros.length
        output.parsedFeatures = curr.slice(hiddenRows) //remove unnecesary features from parsedFeatures
        output.parsedLabels = nextClose > currClose ? 1 : 0
    }

    return output
}

runClassifier()