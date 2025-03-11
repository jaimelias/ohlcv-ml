import KNN from "ml-knn";
import {evaluate2dPredictions} from './evaluate-2d-predictions.js'
import { saveFile, loadFile } from "./utilities.js";
import { DecisionTreeClassifier } from 'ml-cart';


//trainX and trainY are 2D arrays of normalized or standard scaled values

export const knn = async ({trainX, trainY, testX, testY, keyNamesY}, sufix) => {
   
    const k = (Array.isArray(trainY[0])) ? trainY[0].length + 1 : 2  //number of nearest neighbors (Default: number of labels + 1).
    const model = new KNN(trainX, trainY, { k })

    const predictions = model.predict(testX)
    
    const metrics = evaluate2dPredictions(testY, predictions, keyNamesY, true, 'KNN')

    const jsonData = JSON.stringify({model: model.toJSON(), params: {k}})

    await saveFile({fileName: `model-knn-${sufix}.json`, pathName: 'models', jsonData})

    return {metrics, model}
}


export const dt =  async ({trainX, trainY, testX, testY, keyNamesY}, sufix) => {
   
    const params = {
        gainFunction: 'gini',
        maxDepth: 10,
        minNumSamples: 3,
    }

    const model = new DecisionTreeClassifier(params)
    
    model.train(trainX, trainY.flat())
    const predictions = model.predict(testX)
    
    const metrics = evaluate2dPredictions(testY, predictions.map(v => ([v])), keyNamesY, true, 'Decision Tree')
    const jsonData = JSON.stringify({model: model.toJSON(), params})

    await saveFile({fileName: `model-decision-tree-${sufix}.json`, pathName: 'models', jsonData})

    return {metrics, model}
}

