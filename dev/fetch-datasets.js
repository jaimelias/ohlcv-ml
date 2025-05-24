import { saveFile, nasdaq100List, sp500List, cryptoList, etfList, resetDirectory} from "../src/utilities.js"
import { fetchNasdaqOHLCV, NASDAQ_INTERVALS, CRYPTO_INTERVALS } from "./fetch-nasdaq.js"
import { fetchBinanceKlines } from "./fetch-binance.js"

export const fetchDatasets = async (type, interval, limit) => {

    if(!type) throw Error('Error: "type" param is required. "npm run fetch-datasets stocks 1d 500"')
    if(!interval) throw Error('Error: "interval" param is required. "npm run fetch-datasets stocks 1d 500"')

    limit = Number(limit)

    if(isNaN(limit) || limit <= 0) {
        console.error({type, interval, limit})
        throw new Error('Error: "limit" param must be a positive number. "npm run fetch-datasets stocks 1d 500"')
    }

    const output = []
    
    const assets = {
        stocks: sp500List,
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
        
        const ohlcv = (type === 'crypto') ? await fetchBinanceKlines({symbol, interval, limit}) : await fetchNasdaqOHLCV({symbol, interval, type, limit})

        if(typeof ohlcv !== 'object' || !ohlcv.hasOwnProperty('status') || ohlcv.status !== 200){
            continue
        }

        output.push([symbol, ohlcv.data.length])
        
        await saveFile({fileName: `${symbol}.json`, pathName, data: JSON.stringify(ohlcv.data)})
        matrix.push(symbol)
    }

    await saveFile({fileName: `matrix.json`, pathName, data: JSON.stringify(matrix)})


    console.log(output)
}


const typeArg = process.argv[2]
const intervalArg = process.argv[3]
const limitArg = process.argv[4]
fetchDatasets(typeArg, intervalArg, limitArg)
