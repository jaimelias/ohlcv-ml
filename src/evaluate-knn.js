export const evaluateKNN = (trainLabels, testLabels) => {
  // Helper function to compare two labels
  function areLabelsEqual(label1, label2) {
      const isArray1 = Array.isArray(label1);
      const isArray2 = Array.isArray(label2);

      if (isArray1 && isArray2) {
          // Both labels are arrays
          if (label1.length !== label2.length) {
              return false;
          }
          for (let i = 0; i < label1.length; i++) {
              if (label1[i] !== label2[i]) {
                  return false;
              }
          }
          return true;
      } else if (!isArray1 && !isArray2) {
          // Both labels are primitive types
          return label1 === label2;
      } else {
          // One is an array and the other is not
          return false;
      }
  }

  const isTrainArray = Array.isArray(trainLabels);
  const isTestArray = Array.isArray(testLabels);

  if (isTrainArray && isTestArray) {
      // Both trainLabels and testLabels are arrays
      if (trainLabels.length !== testLabels.length) {
          throw new Error('The length of trainLabels and testLabels must be the same.');
      }

      let correctCount = 0;
      for (let i = 0; i < trainLabels.length; i++) {
          if (areLabelsEqual(trainLabels[i], testLabels[i])) {
              correctCount++;
          }
      }

      const accuracy = correctCount / trainLabels.length;
      return accuracy;
  } else if (!isTrainArray && !isTestArray) {
      // Both are single labels
      return areLabelsEqual(trainLabels, testLabels) ? 1 : 0;
  } else {
      throw new Error('trainLabels and testLabels must both be arrays or both be single labels.');
  }
}
