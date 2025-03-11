
import dotenv from 'dotenv';
dotenv.config();

const {NASDAQ_API} = process.env

export const NASDAQ_INTERVALS = ['5min', '10min', '15min',  '30min', '45min', '60min', '1d']
export const CRYPTO_INTERVALS = ['10s', '1m', '5m', '15m', '30m', '1h', '4h', '8h', '1d', '7d', '30d']

export const getNasdaqOHLCV = async ({symbol, interval, type, limit}) => {

    const url = new URL(`${NASDAQ_API}/market-data/ohlcv`)
    url.searchParams.append('symbol', symbol)
    url.searchParams.append('interval', interval)
    url.searchParams.append('type', type)
    url.searchParams.append('limit', limit)

    const response = await fetch(url)
    const {status, statusText} = response

    if(!response.ok){
        console.error('ERROR', {status, statusText, symbol, type, interval, limit, url})
        return []
    }

    return await response.json()
}