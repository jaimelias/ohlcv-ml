import { saveFile, nasdaq100List, cryptoList, etfList, resetDirectory} from "../src/utilities.js"
import { getNasdaqOHLCV, NASDAQ_INTERVALS, CRYPTO_INTERVALS } from "./fetch-nasdaq.js"
import { fetchBinanceKlines } from "./fetch-binance.js"

export const fetchDatasets = async (type, interval) => {

    if(!type) throw Error('Error: "type" param is required: "npm run fetch-datasets stocks 1d"')
    if(!interval) throw Error('Error: "interval" param is required: "npm run fetch-datasets stocks 1d"')

    const output = []
    const limit = 500000
    
    const assets = {
        stocks: nasdaq100List,
        crypto: cryptoList,
        etf: etfList
    }

    if(!assets.hasOwnProperty(type)) throw Error(`Error: "type" (${type}) param not valid. Accepted values: ${Object.keys(assets)}`)
    
    const arr = assets[type]


    let intervalArr = []

    if(type === 'etf' || type === 'stocks')
    {
        intervalArr = NASDAQ_INTERVALS
    }
    else if(type === 'crypto')
    {
        intervalArr = CRYPTO_INTERVALS
    }

    if(!intervalArr.includes(interval)) throw new Error(`Invalid "interval" (${interval}) in "npm run fetch-datasets".`)

    const matrix = []
    const pathName = `datasets/${type}/${interval}`

    await resetDirectory(pathName)

    for(let x = 0; x < arr.length; x++)
    {
        const symbol = arr[x]
        
        const ohlcv = (type === 'crypto') ? await fetchBinanceKlines(symbol, interval, limit) : await getNasdaqOHLCV({symbol, interval, type, limit})

        output.push([symbol, ohlcv.data.length])

        if(!Array.isArray(ohlcv.data)) continue
        
        await saveFile({fileName: `${symbol}.json`, pathName, jsonData: JSON.stringify(ohlcv.data)})
        matrix.push(symbol)
    }

    await saveFile({fileName: `matrix.json`, pathName, jsonData: JSON.stringify(matrix)})


    console.log(output)
}


const typeArg = process.argv[2];
const intervalArg = process.argv[3];
fetchDatasets(typeArg, intervalArg)
