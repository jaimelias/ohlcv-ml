export const fetchBinanceKlines = async ({symbol = 'BTC', interval = '1m', limit = 1000, type = 'crypto'}) => {
    try {
        const intervalInMs = intervalToMilliseconds(interval);
        if (!intervalInMs) throw new Error('Invalid interval format');

        const dateRanges = generateDateRanges(limit, intervalInMs);
        if (!dateRanges || dateRanges.length === 0) throw new Error('Failed to generate date ranges');

        const responsePromises = dateRanges.map(o => {
            const url = new URL('https://fapi.binance.com/fapi/v1/klines');
            url.searchParams.set('symbol', `${symbol}USDT`);
            url.searchParams.set('pair', `${symbol}USDT`);
            url.searchParams.set('interval', interval);
            url.searchParams.set('startTime', o.from);
            url.searchParams.set('endTime', o.to);
            return fetch(url);
        });

        const responses = await Promise.all(responsePromises);

        const dataPromises = responses.map(resp => {
            if (!resp.ok) throw new Error(`Error ${resp.status} fetching ${limit} ${type}/${symbol} (${interval}): ${resp.statusText}`)
            return resp.json()
        })

        const data = (await Promise.all(dataPromises)).map(batch => batch.map(twoDArr => ({
            open: formatNumber(twoDArr[1]),
            high: formatNumber(twoDArr[2]),
            low: formatNumber(twoDArr[3]),
            close: formatNumber(twoDArr[4]),
            volume: parseFloat(twoDArr[5]),
            date: yyyymmddFromTimeStamp(twoDArr[0], interval)
        }))).flat();

        console.log('data.length', data.length)
        
        return {status: 200, data}
    } catch (error) {
        console.error(error.message)
       return {status: 500, data: [], error: error.message}
    }
};


const intervalToMilliseconds = interval => {
    const unit = interval.slice(-1);
    const amount = parseInt(interval.slice(0, -1), 10);

    switch (unit) {
        case 's':
            return amount * 1000;
        case 'm':
            return amount * 60 * 1000;
        case 'h':
            return amount * 3600 * 1000;
        case 'd':
            return amount * 86400 * 1000;
        case 'w':
            // 1 week = 7 days
            return amount * 7 * 86400 * 1000;
        case 'M':
            // Approximate 1 month as 30 days
            return amount * 30 * 86400 * 1000;
        default:
            throw new Error(`Unsupported interval unit: ${unit}`);
    }
};

// Updated function to work in milliseconds
const generateDateRanges = (numberOfDataPoints, intervalInMs) => {
    // Each full range covers 1000 data points
    const batchSize = 500;
    const count = Math.ceil(numberOfDataPoints / batchSize);
    const currentTime = Date.now(); // Now in milliseconds

    let remainingDataPoints = numberOfDataPoints;
    const ranges = [];

    for (let i = 0; i < count; i++) {
        const dataPointsForThisRange = Math.min(batchSize, remainingDataPoints);
        const to = currentTime - (i * intervalInMs * (batchSize + 1));
        const from = to - (dataPointsForThisRange * intervalInMs);

        remainingDataPoints -= dataPointsForThisRange;
        ranges.unshift({ from, to });
    }

    return ranges;
};

const yyyymmddFromTimeStamp = (timestamp, interval) => {
    const date = new Date(timestamp); // Convierte el timestamp UNIX a milisegundos
    const unit = interval.slice(-1); // Obtiene la última letra del intervalo (por ejemplo, 'd', 'h', etc.)

    // Construcción rápida de YYYY-MM-DD
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0'); // Mes (0-indexado, ajustado)
    const d = String(date.getUTCDate()).padStart(2, '0'); // Día del mes

    if (unit === 'd' || unit === 'w' || unit === 'M') {
        return `${y}-${m}-${d} 00:00:00`; // Devuelve sólo la fecha
    } else {
        // Construcción de hora, minutos y segundos
        const h = String(date.getUTCHours()).padStart(2, '0');
        const min = String(date.getUTCMinutes()).padStart(2, '0');
        const s = String(date.getUTCSeconds()).padStart(2, '0');
        return `${y}-${m}-${d} ${h}:${min}:${s}`; // Devuelve fecha y hora
    }
}

const formatNumber = num => {
    const cleaned = num.replace(/[$,]/g, '')
    return Math.round(parseFloat(cleaned) * 100) / 100
}