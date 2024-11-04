import { parseTrainingDataset } from "./src/dataset.js"
import {evaluateKNN} from './src/evaluate-knn.js'
import {loadFile, saveFile} from './src/utilities.js'
import KNN from "ml-knn";
import OHLCV_INDICATORS from "ohlcv-indicators"



const runClassifier = async () => {
    
    const forceScaling = null // normalization, standardization
    const symbol = 'SPY'
    const interval = '1d'

    // loads an OHLCV array of objects in number format [{open, high, low, close, volume}, {open...}] 
    const inputOhlcv = (await loadFile({fileName: `${interval}-${symbol}.json`, pathName: 'datasets'}))// "./datasets/1d-etf-spy.json"

    const start = performance.now()

    //load indicators
    const indicators = new OHLCV_INDICATORS({input: inputOhlcv})

    console.log('lastValues: ', indicators.getLastValues())
    
    const arrObj = indicators.getData()  //returns array of objects of all ohlcv + indicator values

    const {
        trainFeatures,
        trainLabels,
        testFeatures,
        testLabels
    } = parseTrainingDataset({arrObj, trainingSplit: 0.9, weights: {close: 3}, parseLabels, parseFeatures, forceScaling})


    console.log('lenghts of features and labels', trainFeatures.length, trainLabels.length)
    console.log('first scaled and weighted feature', trainFeatures[0])

    const k = (Array.isArray(trainLabels[0])) ? trainLabels[0].length + 1 : 2  //number of nearest neighbors (Default: number of labels + 1).
    const model = new KNN(trainFeatures, trainLabels, { k })

    const predictionLabels = model.predict(testFeatures)

    console.log('accuracy: ', evaluateKNN(testLabels, predictionLabels))

    const end = performance.now();
    console.log(`exampleFunction took ${end - start} milliseconds`)

    await saveFile({
        fileName: `knn-${interval}-${symbol}.json`, 
        pathName: 'models', 
        jsonData: JSON.stringify(model.toJSON())
    })

}


const parseFeatures = ({objRow, index}) => {

    const curr = objRow[index]
    const {close, high} = curr

    return {
        close,
        high
    }

}

const parseLabels = ({objRow, index}) => {

    const curr = objRow[index]
    const next = objRow[index + 1]

    if(typeof next === 'undefined') return null

    return {
        label_1: next.close > curr.close
    }

}

runClassifier()