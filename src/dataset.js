
export const prepareDataset = ({ transformedOhlcv, trainingSplit = 0.8, futureWindow = 1, parseFeaturesAndLabelsFunc, includeOnes, includeZeros, hiddenFeatures }) => {

    const {scaledOutput, keyNames} = transformedOhlcv
    const rawDataset = scaledOutput.map(rowObj => Object.values(rowObj))

    let dataset = new Array(rawDataset.length - futureWindow).fill(null)
    let labels = new Array(rawDataset.length - futureWindow).fill(null)

    // Iterate through the rawDataset to populate dataset and labels arrays
    for (let x = 0; x < rawDataset.length - futureWindow; x++) {

        const {
            parsedFeatures = null, 
            parsedLabels = null
        } = parseFeaturesAndLabelsFunc({rawDataset, index: x, futureWindow, transformedOhlcv, includeOnes, includeZeros, hiddenFeatures})
 
        dataset[x] = parsedFeatures
        labels[x] = parsedLabels
    }

    dataset = dataset.filter(d => d !== null)
    labels = labels.filter(l => l !== null)

    const splitIndex = Math.floor(dataset.length * trainingSplit)

    // Split the dataset and labels into training and testing sets
    const trainDataset = dataset.slice(0, splitIndex)
    const trainLabels = labels.slice(0, splitIndex)
    const testDataset = dataset.slice(splitIndex)
    const testLabels = labels.slice(splitIndex)

    console.log(`${keyNames.length} keyNames:\n`, keyNames)

    return {
        trainDataset,
        trainLabels,
        testDataset,
        testLabels
    }
}

