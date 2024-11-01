//this function uses skewness and standard deviation to decide between standardizing and normalizing each row
export const scaleOhlcv = (objDataset, keyNames) => {

    const min = Object.fromEntries(keyNames.map(k => [k, Infinity]));
    const max = Object.fromEntries(keyNames.map(k => [k, -Infinity]));
    const std = Object.fromEntries(keyNames.map(k => [k, null]));
    const mean = Object.fromEntries(keyNames.map(k => [k, null]));
    const approach = Object.fromEntries(keyNames.map(k => [k, null])); // normalization, standardization

    const scaledOutput = objDataset.map(() => ({})); // Creates an array of objects for the transformed data

    // First pass to calculate min, max, and mean
    objDataset.forEach(row => {
        keyNames.forEach(key => {
            const value = row[key];
            min[key] = Math.min(min[key], value);
            max[key] = Math.max(max[key], value);
            mean[key] = (mean[key] ?? 0) + value;
        });
    });

    // Calculate the mean for each key
    keyNames.forEach(key => {
        mean[key] /= objDataset.length;
    });

    // Second pass to calculate std and decide approach
    objDataset.forEach(row => {
        keyNames.forEach(key => {
            const value = row[key];
            std[key] = (std[key] ?? 0) + Math.pow(value - mean[key], 2);
        });
    });

    // Finalize std and determine approach (normalization or standardization)
    keyNames.forEach(key => {
        std[key] = Math.sqrt(std[key] / objDataset.length);

        // Decide approach: If skewness is low and std is small, use normalization, else standardize
        approach[key] = std[key] < 1 ? 'normalization' : 'standardization';
    });

    // Third pass to transform data
    objDataset.forEach((row, rIdx) => {
        keyNames.forEach(key => {
            const value = row[key];
            if (approach[key] === 'normalization') {
                scaledOutput[rIdx][key] = (value - min[key]) / (max[key] - min[key]);
            } else { // standardization
                scaledOutput[rIdx][key] = (value - mean[key]) / std[key];
            }
        });
    });

    const scaledConfig = {min, max, std, mean, approach}

    return {        
        scaledOutput,
        scaledConfig,
        keyNames,
        descaledVal: (key, arr) => descaledVal(key, scaledVal(key, arr, keyNames), scaledConfig),
        scaledVal: (key, arr) => scaledVal(key, arr, keyNames)
    };
};

// function to revert from Standardized or Normalized Values back to original values
const descaledVal = (key, value, scaledConfig) => {
    const {min, max, std, mean, approach} = scaledConfig;

    if (approach[key] === 'normalization') {
        // Revert normalization
        return value * (max[key] - min[key]) + min[key];
    } else {
        // Revert standardization
        return value * std[key] + mean[key];
    }
};

const scaledVal = (str, arr, cols) => {

    if(typeof str !== 'string' || str.length === 0) throw Error('the first argument of scaledVal must be an string with 1 or more characters')
    if(!Array.isArray(arr)) throw Error('the second argument of scaledVal must be an array')
    if(!Array.isArray(cols)) throw Error('the third argument of scaledVal must be an array')

    const i = cols.indexOf(str)

    if(i === -1) throw Error((`the string argument ${str} of scaledVal not found`).toString())

    return arr[i]
}