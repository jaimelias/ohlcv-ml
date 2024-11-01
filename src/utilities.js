import { promises as fs } from 'fs';
import path from 'path';

export const loadDataset = async ({symbol, interval, type}) => {
    try {

        const fileName = (`${interval}-${type}-${symbol}.json`).toLowerCase()
        const datasetPath = path.join(process.cwd(), 'datasets', fileName);
        const data = await fs.readFile(datasetPath, 'utf8');
        console.log(`File ${fileName} loaded!`);
        return JSON.parse(data); // Optionally return the file content for further processing
    } catch (err) {
        console.error('Error reading file:', err);
        throw err; // Re-throw the error for handling in the calling function
    }
};

export const storeModel = async ({ model, modelName }) => {
    try {
        const fileName = modelName.toLowerCase();
        const datasetPath = path.join(process.cwd(), 'models', fileName);

        // Write data to the file
        await fs.writeFile(datasetPath,  JSON.stringify(model.toJSON()), 'utf8');
        console.log(`Model saved to ${fileName}!`);
        return datasetPath; // Optionally return the file path for reference
    } catch (err) {
        console.error('Error saving model:', err);
        throw err; // Re-throw the error for handling in the calling function
    }
};

export const validateKeyNames = (objDataset, keyNames) => {

    const lastValues = objDataset[objDataset.length -1]

    //check if all the keyNames are in objDataset
    keyNames.forEach(k =>  {
        if(!lastValues.hasOwnProperty(k))
        {
            throw Error((`Invalid keyName "${k}" not found in: ${JSON.stringify(Object.keys(lastValues))}`));
        }
    })

    console.log('lastValues of objDataset', lastValues)

    return true
}