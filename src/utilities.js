import { promises as fs } from 'fs';
import path from 'path';
import { getNasdaqOHLCV } from '../dev/fetch-nasdaq.js';

export const cryptoList = ['BTC']
export const etfList = ['SPY', 'DIA', 'QQQ', 'IWM', 'XLF', 'EEM']
export const nasdaq100List = ['AAPL','AMAT','AMGN','CMCSA','INTC','KLAC','PCAR','CTAS','PAYX','LRCX','ADSK','ROST','MNST','MSFT','ADBE','FAST','EA','CSCO','REGN','IDXX','VRTX','BIIB','ODFL','QCOM','GILD','SNPS','SBUX','INTU','MCHP','ORLY','COST','CPRT','DLTR','ASML','ANSS','TTWO','AMZN','CTSH','CSGP','NVDA','BKNG','ON','ISRG','MRVL','ILMN','ADI','AEP','AMD','ADP','AZN','CDNS','CSX','HON','MAR','MU','XEL','EXC','PEP','ROP','TXN','MDLZ','NFLX','GOOGL','DXCM','SMCI','TMUS','LULU','MELI','KDP','AVGO','VRSK','FTNT','CHTR','TSLA','NXPI','FANG','META','PANW','WDAY','CDW','GOOG','PYPL','KHC','TEAM','CCEP','TTD','BKR','MDB','ZS','PDD','MRNA','CRWD','DDOG','ABNB','DASH','GFS','CEG','WBD','GEHC','LIN','ARM']

export const loadFile = async ({fileName, pathName}) => {
    try {

        fileName = fileName.toLowerCase()
        const parsedPathName = path.join(process.cwd(), pathName, fileName);
        const data = await fs.readFile(parsedPathName, 'utf8');
        console.log(`File ${fileName} loaded!`);
        return JSON.parse(data); // Optionally return the file content for further processing
    } catch (err) {
        console.log('Error reading file:', err.message)
        console.log('Loading from API')

        const [symbol, ] = fileName.split('.')
        const [, interval, type] = pathName.split('/')

        const remoteData = await getNasdaqOHLCV({symbol, interval, type, limit: 5000})

        if(remoteData && Array.isArray(remoteData) && remoteData.length > 0)
        {
            await saveFile({fileName, pathName, jsonData: JSON.stringify(remoteData)})
            return remoteData
        }

        return false
    }
}

export const saveFile = async ({fileName, pathName, jsonData}) => {
    try {
        fileName = fileName.toLowerCase();
        const parsedPathName = path.join(process.cwd(), pathName, fileName);

        // Write data to the file
        await fs.writeFile(parsedPathName,  jsonData, 'utf8');
        console.log(`Saved to ${pathName}/${fileName}!`);
        return parsedPathName; // Optionally return the file path for reference
    } catch (err) {
        console.error('Error saving model:', err);
        throw err; // Re-throw the error for handling in the calling function
    }
}


export const resetDirectory = async (pathName) => {
    try {
        const resolvedPath = path.join(process.cwd(), pathName);

        // Check if the directory exists
        try {
            await fs.access(resolvedPath);
            console.log(`Directory exists: ${resolvedPath}`);
            
            // Recursively delete the directory
            await fs.rm(resolvedPath, { recursive: true, force: true });
            console.log(`Directory deleted: ${resolvedPath}`);
        } catch {
            console.log(`Directory does not exist, proceeding to recreate: ${resolvedPath}`);
        }

        // Recreate the directory
        await fs.mkdir(resolvedPath, { recursive: true });
        console.log(`Directory recreated: ${resolvedPath}`);
    } catch (err) {
        console.error('Error resetting directory:', err.message);
        throw err; // Re-throw for upstream error handling
    }
}