
import chalk from 'chalk'

//the following code provides a logic an accurate evaluation for 2d array predicitons and test labels

export const evaluate2dPredictions = (testY, predictions, keyNamesY, log = false, modelName = 'default') => {

  if (testY.length !== predictions.length) {
      throw new Error("testY and predictions must have the same length.");
  }

  for (let i = 0; i < testY.length; i++) {
      if (testY[i].length !== keyNamesY.length || predictions[i].length !== keyNamesY.length) {
          throw new Error(`Row ${i} in testY or predictions does not match keyNamesY length.`);
      }
  }

  const metrics = {modelName, total: 0, correct: 0, accuracy: 0, labels: {}}

  for (let i = 0; i < testY.length; i++) {
      for (let j = 0; j < keyNamesY.length; j++) {
          const key = keyNamesY[j];
          const actual = testY[i][j];
          const predicted = predictions[i][j];

          if (!metrics.labels[key]) {
            metrics.labels[key] = {}
          }
          if (!metrics.labels[key][predicted]) {
            metrics.labels[key][predicted] = {total: 0, correct: 0}
          }

          metrics.labels[key][predicted].total++;

          if (actual === predicted) {
            metrics.labels[key][predicted].correct++;
          }
      }
  }

  for(const [labelKey, labelObj] of Object.entries(metrics.labels))
  {
    if (Object.keys(labelObj).length <= 1) {
      //throw new Error(`Underfitting error: Label '${labelKey}' has only one unique prediction result in model ${modelName}.`);
    }

    for(const [valueKey, {total, correct}] of Object.entries(labelObj))
    {
      metrics.labels[labelKey][valueKey].accuracy = correct / total
      metrics.total += total
      metrics.correct += correct
    }

    metrics.accuracy = metrics.correct / metrics.total
  }

  if(log){
    logLabelValueMetrics(metrics, keyNamesY)
  }

  return metrics;
};

export const logLabelValueMetrics = (metrics, keyNamesY) => {
  try {
      const {modelName} = metrics
      console.log(chalk.bold.green(`${modelName} Classifier Metric Results:`));
      console.log(chalk.blue("========================================"));

      keyNamesY.forEach((key) => {

          const keyResult = metrics.labels[key];
          console.log(chalk.yellow(`Label: ${key}`));
          
          let totalSamples = 0;
          let correctPredictions = 0;
          Object.values(keyResult).forEach(({ total, correct }) => {
              totalSamples += total;
              correctPredictions += correct;
          });

          console.log(chalk.cyan(`  * Total Samples: ${totalSamples}`));
          console.log(chalk.cyan(`  * Correct Predictions: ${correctPredictions}`));
          console.log(
              chalk.magenta(`  * Overall Accuracy: ${(correctPredictions / totalSamples * 100).toFixed(2)}%`)
          );

          console.log(chalk.underline("  Value Breakdown:"));
          Object.entries(keyResult).forEach(([value, valueMetrics]) => {
              console.log(chalk.yellow(`    Value: ${value}`));
              console.log(chalk.cyan(`      + Total: ${valueMetrics.total}`));
              console.log(chalk.cyan(`      + Correct: ${valueMetrics.correct}`));
              console.log(
                  chalk.magenta(`      + Accuracy: ${(valueMetrics.accuracy * 100).toFixed(2)}%`)
              );
          });
          console.log(chalk.blue("----------------------------------------"));
      });
  } catch (error) {
      console.error(chalk.red("Error evaluating KNN:"), chalk.red(error.message));
  }
};