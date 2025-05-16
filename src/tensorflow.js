import * as tf from '@tensorflow/tfjs-node';

export class TensorFlowClassifier {
  constructor(params = {}) {
    this.params = params;
    this.model = null;
  }

  /**
   * Trains a neural network on the provided training data.
   * @param {number[][]} trainX - 2D array of training features.
   * @param {number[] | number[][]} trainY - Array of labels (either flat or one-hot encoded).
   */
  async train(trainX, trainY) {
    // Convert training features to a tensor.
    const xs = tf.tensor2d(trainX);

    // Determine if labels are one-hot encoded.
    let numClasses;
    let ys;
    if (Array.isArray(trainY[0])) {
      numClasses = trainY[0].length;
      ys = tf.tensor2d(trainY);
    } else {
      numClasses = Math.max(...trainY) + 1;
      const labelsTensor = tf.tensor1d(trainY, 'int32');
      ys = tf.oneHot(labelsTensor, numClasses);
      labelsTensor.dispose();
    }

    const inputDim = xs.shape[1];

    // Build the sequential model.
    this.model = tf.sequential();

    // First hidden layer with batch normalization and dropout.
    const hiddenUnits1 = this.params.hiddenUnits1 || 64;
    const activation = this.params.activation || 'relu';
    this.model.add(tf.layers.dense({
      inputShape: [inputDim],
      units: hiddenUnits1,
      activation,
      kernelRegularizer: tf.regularizers.l2({ l2: this.params.l2 || 0.01 })
    }));
    this.model.add(tf.layers.batchNormalization());
    this.model.add(tf.layers.dropout({ rate: this.params.dropoutRate || 0.5 }));


    // Output layer: softmax for multi-class, sigmoid for binary classification.
    const outputActivation = numClasses > 1 ? 'softmax' : 'sigmoid';
    this.model.add(tf.layers.dense({
      units: numClasses,
      activation: outputActivation
    }));

    // Compile the model.
    const learningRate = this.params.learningRate || 0.001;

    const optimizers = {
      sgd: tf.train.sgd,
      adagrad: tf.train.adagrad,
      adam: tf.train.adam,
      adamax: tf.train.adamax,
      rmsprop: tf.train.rmsprop,
    }

    const optimizer = this.params.optimizer || 'adam';

    if(!optimizers.hasOwnProperty(optimizer)) throw new Error(`Invalid optimizer: "${optimizer}". Available options: ${JSON.stringify(Object.keys(optimizers))}`)

    const loss = numClasses > 1 ? 'categoricalCrossentropy' : 'binaryCrossentropy';
    this.model.compile({
      optimizer: optimizers[optimizer](learningRate),
      loss,
      metrics: ['accuracy']
    });

    console.log({learningRate})

    // Training parameters.
    const batchSize = this.params.batchSize || 32;
    const epochs = this.params.epochs || 50;

    // Early stopping callback monitoring validation loss.
    const earlyStopCallback = tf.callbacks.earlyStopping({
      monitor: 'val_loss',
      patience: this.params.patience || 20,
      verbose: 1
    });

    await this.model.fit(xs, ys, {
      batchSize,
      epochs,
      validationSplit: this.params.validationSplit || 0.1,
      verbose: 1,
      callbacks: [earlyStopCallback]
    });

    xs.dispose();
    ys.dispose();
  }

  /**
   * Predicts labels for the given test data.
   * @param {number[][]} testX - 2D array of test features.
   * @returns {number[]} - Array of predicted labels.
   */
  predict(testX) {
    const xs = tf.tensor2d(testX);
    const predictionsTensor = this.model.predict(xs);

    let predictions;
    if (predictionsTensor.shape[1] > 1) {
      predictions = predictionsTensor.argMax(1).arraySync();
    } else {
      predictions = predictionsTensor.greater(0.5).cast('int32').arraySync();
    }
    xs.dispose();
    predictionsTensor.dispose();
    return predictions;
  }
}

export default TensorFlowClassifier;
