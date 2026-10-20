const mongoose = require('mongoose');

const collectionMap = {
  Residential: 'lahore_residential',
  Commercial: 'lahore_commercial',
  Industrial: 'lahore_industrial',
  Agricultural: 'lahore_agricultural'
};

const isSupportedClassification = (classification) =>
  Object.hasOwn(collectionMap, classification);

// Helper to return the correct Mongoose model based on classification
const getPropertyModel = (classification) => {
  const collectionName = collectionMap[classification];
  if (!collectionName) {
    throw new Error(`Unsupported property classification: ${classification}`);
  }

  // Return existing model or compile a flexible schema model for the collection
  return mongoose.models[collectionName] || mongoose.model(
    collectionName, 
    new mongoose.Schema({}, { strict: false }), 
    collectionName
  );
};

module.exports = { getPropertyModel, isSupportedClassification };