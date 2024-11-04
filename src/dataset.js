import { scaleArrayObj } from "./scale.js";

export const parseTrainingDataset = ({ arrObj, trainingSplit = 0.8, weights = {}, parseLabels, parseFeatures, forceScaling }) => {
    const features = [];
    const labels = [];

    for (let x = 0; x < arrObj.length; x++) {
        const parsedFeatures = parseFeatures({ objRow: arrObj, index: x });
        const parsedLabels = parseLabels({ objRow: arrObj, index: x });

        if (parsedFeatures && parsedLabels) {
            features.push(parsedFeatures)
            labels.push(parsedLabels)
        }
    }

    // Scale features and labels, if applicable
    const scaledFeatures = scaleArrayObj({arrObj: features, weights, forceScaling}).scaledOutput
    const scaledLabels = scaleArrayObj({arrObj: labels, weights, forceScaling}).scaledOutput
    const splitIndex = Math.floor(scaledFeatures.length * trainingSplit)

    // Split into training and testing sets
    return {
        trainFeatures: scaledFeatures.slice(0, splitIndex),
        trainLabels: scaledLabels.slice(0, splitIndex),
        testFeatures: scaledFeatures.slice(splitIndex),
        testLabels: scaledLabels.slice(splitIndex),
    };
};


export const parseProductionDataset = ({ arrObj, weights = {}, parseFeatures, forceScaling }) => {
    const features = [];

    for (let x = 0; x < arrObj.length; x++) {
        const parsedFeatures = parseFeatures({ objRow: arrObj, index: x })

        if (parsedFeatures && parsedLabels) {
            features.push(parsedFeatures)
        }
    }

    // Scale features and labels, if applicable
    const scaledFeatures = scaleArrayObj({arrObj: features, weights, forceScaling}).scaledOutput

    // Split into training and testing sets
    return {
        productionFeatures: scaledFeatures
    }
};