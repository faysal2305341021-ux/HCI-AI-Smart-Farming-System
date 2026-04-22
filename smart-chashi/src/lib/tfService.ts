import * as tf from '@tensorflow/tfjs';
import * as mobilenet from '@tensorflow-models/mobilenet';

let model: mobilenet.MobileNet | null = null;

export const loadModel = async () => {
  if (model) return model;
  await tf.ready();
  model = await mobilenet.load({
    version: 1,
    alpha: 1.0
  });
  return model;
};

export const classifyImage = async (imageElement: HTMLImageElement | HTMLVideoElement | ImageData) => {
  const loadedModel = await loadModel();
  const predictions = await loadedModel.classify(imageElement);
  return predictions;
};
