

export const scaleArrayObj = ({arrObj, weights = {}, forceScaling = null}) => {

    if(forceScaling !== null  && forceScaling !== 'normalization' && forceScaling !==  'standardization')
    {
        throw Error('forceScalling should be null, "normalization" or "standardization"')
    }

    const n = arrObj.length;

    if (n === 0) {
        // If the input array is empty, return empty outputs
        return {
            scaledOutput: [],
            scaledConfig: {},
            keyNames: []
        };
    }

    // Get the feature names (keys) from the first object
    const keyNames = Object.keys(arrObj[0]);

    // **Loop 1: Compute weights for each keyName**
    const keyNameWeights = keyNames.map(key => {
        if (weights.hasOwnProperty(key)) {
            const weight = weights[key];
            if (weight <= 0) {
                throw new Error(`Weight for key "${key}" must be positive.`);
            }
            return weight;
        } else {
            return 1; // Default weight
        }
    });

    const totalColumns = keyNameWeights.reduce((sum, weight) => sum + weight, 0);

    // **Loop 2: Build the new keyNames array with weights applied**
    const outputKeyNames = new Array(totalColumns);
    let idx = 0;
    for (let i = 0; i < keyNames.length; i++) {
        const key = keyNames[i];
        const weight = keyNameWeights[i];
        for (let w = 0; w < weight; w++) {
            outputKeyNames[idx++] = key;
        }
    }

    // Initialize variables for scaling
    const inputTypes = {};
    const min = {};
    const max = {};
    const mean = {};
    const M2 = {};
    const approach = {};
    const uniqueStringIndexes = {};
    const counts = {};

    // **Loop 3: Initialize variables for each key**
    for (const key of keyNames) {
        const firstValue = arrObj[0][key];
        inputTypes[key] = typeof firstValue;

        if (inputTypes[key] === 'string') {
            uniqueStringIndexes[key] = {};
        }

        min[key] = Infinity;
        max[key] = -Infinity;
        mean[key] = 0;
        M2[key] = 0;
        counts[key] = 0;
    }

    // **Loop 4: Single pass to process data**
    for (const obj of arrObj) {
        for (const key of keyNames) {
            let value = obj[key];

            if (inputTypes[key] === 'string') {
                const uniqueIndexes = uniqueStringIndexes[key];
                if (!uniqueIndexes.hasOwnProperty(value)) {
                    uniqueIndexes[value] = Object.keys(uniqueIndexes).length;
                }
                value = uniqueIndexes[value];
                obj[key] = value; 
            }

            if (value < min[key]) min[key] = value;
            if (value > max[key]) max[key] = value;

            counts[key]++;
            const delta = value - mean[key];
            mean[key] += delta / counts[key];
            M2[key] += delta * (value - mean[key]);
        }
    }

    // **Loop 5: Finalize standard deviation and decide scaling approach**
    const std = {};
    for (const key of keyNames) {
        std[key] = counts[key] > 1 ? Math.sqrt(M2[key] / (counts[key] - 1)) : 0;

        // Apply forceScaling if specified, else use automatic selection
        if (forceScaling === 'normalization' || forceScaling === 'standardization') {
            approach[key] = forceScaling;
        } else {
            approach[key] = std[key] < 1 ? 'normalization' : 'standardization';
        }
    }

    // **Loop 6: Create scaled and reweighted output**
    const scaledOutput = new Array(n);
    for (let i = 0; i < n; i++) {
        const obj = arrObj[i];
        const scaledRow = new Array(totalColumns);
        let idx = 0;
        for (let j = 0; j < keyNames.length; j++) {
            const key = keyNames[j];
            const value = obj[key];
            const minValue = min[key];
            const maxValue = max[key];
            const meanValue = mean[key];
            const stdValue = std[key];

            let scaledValue;
            if (approach[key] === 'normalization') {
                scaledValue = maxValue !== minValue ? (value - minValue) / (maxValue - minValue) : 0;
            } else {
                scaledValue = stdValue !== 0 ? (value - meanValue) / stdValue : 0;
            }

            const weight = keyNameWeights[j];
            for (let w = 0; w < weight; w++) {
                scaledRow[idx++] = scaledValue;
            }
        }
        scaledOutput[i] = scaledRow;
    }

    const scaledConfig = { min, max, std, mean, approach, inputTypes, uniqueStringIndexes };

    return {
        scaledOutput,
        scaledConfig,
        keyNames: outputKeyNames
    };
};
