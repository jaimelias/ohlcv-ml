import { promises as fs } from 'fs';
import path from 'path';

export const loadFile = async ({fileName, pathName}) => {
    try {

        fileName = fileName.toLowerCase()
        pathName = path.join(process.cwd(), pathName, fileName);
        const data = await fs.readFile(pathName, 'utf8');
        console.log(`File ${fileName} loaded!`);
        return JSON.parse(data); // Optionally return the file content for further processing
    } catch (err) {
        console.error('Error reading file:', err);
        throw err; // Re-throw the error for handling in the calling function
    }
};

export const saveFile = async ({fileName, pathName, jsonData}) => {
    try {
        fileName = fileName.toLowerCase();
        pathName = path.join(process.cwd(), pathName, fileName);

        // Write data to the file
        await fs.writeFile(pathName,  jsonData, 'utf8');
        console.log(`Model saved to ${fileName}!`);
        return pathName; // Optionally return the file path for reference
    } catch (err) {
        console.error('Error saving model:', err);
        throw err; // Re-throw the error for handling in the calling function
    }
}