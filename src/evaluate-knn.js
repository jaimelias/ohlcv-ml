export const evaluateKNN = (trainLabels, predictionLabels) => {
    // Flatten 2D arrays if necessary
    const flattenArray = (arr) => arr.flat(Infinity);
  
    const trueLabels = flattenArray(trainLabels);
    const predLabels = flattenArray(predictionLabels);
  
    if (trueLabels.length !== predLabels.length) {
      throw new Error("True labels and predicted labels must be of the same length.");
    }
  
    const uniqueLabels = [...new Set(trueLabels.concat(predLabels))];
    const labelMetrics = {};
  
    // Initialize counters
    let tp = 0, fp = 0, fn = 0, tn = 0;
  
    // Count TP, FP, FN, and TN for each unique label
    uniqueLabels.forEach((label) => {
      let labelTp = 0, labelFp = 0, labelFn = 0;
  
      for (let i = 0; i < trueLabels.length; i++) {
        if (predLabels[i] === label && trueLabels[i] === label) labelTp++;
        else if (predLabels[i] === label && trueLabels[i] !== label) labelFp++;
        else if (predLabels[i] !== label && trueLabels[i] === label) labelFn++;
      }
  
      labelMetrics[label] = {
        tp: labelTp,
        fp: labelFp,
        fn: labelFn,
      };
  
      tp += labelTp;
      fp += labelFp;
      fn += labelFn;
      tn += trueLabels.length - labelTp - labelFp - labelFn;
    });
  
    // Calculate metrics
    const accuracy = (tp + tn) / (tp + tn + fp + fn);
    const precision = tp / (tp + fp);
    const recall = tp / (tp + fn);
    const f1Score = (2 * precision * recall) / (precision + recall);
  
    return {
      accuracy,
      precision,
      recall,
      f1Score,
    };
  }