import { promises as fs } from 'fs';
import path from 'path';
import { getNasdaqOHLCV } from '../dev/fetch-nasdaq.js';

export const cryptoList = ['BTC']
export const etfList = ['SPY', 'DIA', 'QQQ', 'IWM', 'XLF', 'EEM']
export const nasdaq100List = ['AAPL','AMAT','AMGN','CMCSA','INTC','KLAC','PCAR','CTAS','PAYX','LRCX','ADSK','ROST','MNST','MSFT','ADBE','FAST','EA','CSCO','REGN','IDXX','VRTX','BIIB','ODFL','QCOM','GILD','SNPS','SBUX','INTU','MCHP','ORLY','COST','CPRT','DLTR','ASML','ANSS','TTWO','AMZN','CTSH','CSGP','NVDA','BKNG','ON','ISRG','MRVL','ILMN','ADI','AEP','AMD','ADP','AZN','CDNS','CSX','HON','MAR','MU','XEL','EXC','PEP','ROP','TXN','MDLZ','NFLX','GOOGL','DXCM','SMCI','TMUS','LULU','MELI','KDP','AVGO','VRSK','FTNT','CHTR','TSLA','NXPI','FANG','META','PANW','WDAY','CDW','GOOG','PYPL','KHC','TEAM','CCEP','TTD','BKR','MDB','ZS','PDD','MRNA','CRWD','DDOG','ABNB','DASH','GFS','CEG','WBD','GEHC','LIN','ARM']
export const sp500List = ["MMM","ABT","ABBV","ACN","ATVI","AYI","ADBE","AMD","AAP","AES","AET","AMG","AFL","A","APD","AKAM","ALK","ALB","ARE","ALXN","ALGN","ALLE","AGN","ADS","LNT","ALL","GOOGL","GOOG","MO","AMZN","AEE","AAL","AEP","AXP","AIG","AMT","AWK","AMP","ABC","AME","AMGN","APH","APC","ADI","ANDV","ANSS","ANTM","AON","AOS","APA","AIV","AAPL","AMAT","ADM","ARNC","AJG","AIZ","T","ADSK","ADP","AZO","AVB","AVY","BHGE","BLL","BAC","BK","BCR","BAX","BBT","BDX","BBY","BIIB","BLK","HRB","BA","BWA","BXP","BSX","BHF","BMY","AVGO","CHRW","CA","COG","CDNS","CPB","COF","CAH","CBOE","KMX","CCL","CAT","CBG","CBS","CELG","CNC","CNP","CTL","CERN","CF","SCHW","CHTR","CHK","CVX","CMG","CB","CHD","CI","XEC","CINF","CTAS","CSCO","C","CFG","CTXS","CLX","CME","CMS","KO","CTSH","CL","CMCSA","CMA","CAG","CXO","COP","ED","STZ","COO","GLW","COST","COTY","CCI","CSRA","CSX","CMI","CVS","DHI","DHR","DRI","DVA","DE","DLPH","DAL","XRAY","DVN","DLR","DFS","DISCA","DISCK","DISH","DG","DLTR","D","DOV","DWDP","DPS","DTE","DRE","DUK","DXC","ETFC","EMN","ETN","EBAY","ECL","EIX","EW","EA","EMR","ETR","EVHC","EOG","EQT","EFX","EQIX","EQR","ESS","EL","ES","RE","EXC","EXPE","EXPD","ESRX","EXR","XOM","FFIV","FB","FAST","FRT","FDX","FIS","FITB","FE","FISV","FLIR","FLS","FLR","FMC","FL","F","FTV","FBHS","BEN","FCX","GPS","GRMN","IT","GD","GE","GGP","GIS","GM","GPC","GILD","GPN","GS","GT","GWW","HAL","HBI","HOG","HRS","HIG","HAS","HCA","HCP","HP","HSIC","HSY","HES","HPE","HLT","HOLX","HD","HON","HRL","HST","HPQ","HUM","HBAN","IDXX","INFO","ITW","ILMN","IR","INTC","ICE","IBM","INCY","IP","IPG","IFF","INTU","ISRG","IVZ","IRM","JEC","JBHT","SJM","JNJ","JCI","JPM","JNPR","KSU","K","KEY","KMB","KIM","KMI","KLAC","KSS","KHC","KR","LB","LLL","LH","LRCX","LEG","LEN","LUK","LLY","LNC","LKQ","LMT","L","LOW","LYB","MTB","MAC","M","MRO","MPC","MAR","MMC","MLM","MAS","MA","MAT","MKC","MCD","MCK","MDT","MRK","MET","MTD","MGM","KORS","MCHP","MU","MSFT","MAA","MHK","TAP","MDLZ","MON","MNST","MCO","MS","MOS","MSI","MYL","NDAQ","NOV","NAVI","NTAP","NFLX","NWL","NFX","NEM","NWSA","NWS","NEE","NLSN","NKE","NI","NBL","JWN","NSC","NTRS","NOC","NCLH","NRG","NUE","NVDA","ORLY","OXY","OMC","OKE","ORCL","PCAR","PKG","PH","PDCO","PAYX","PYPL","PNR","PBCT","PEP","PKI","PRGO","PFE","PCG","PM","PSX","PNW","PXD","PNC","RL","PPG","PPL","PX","PCLN","PFG","PG","PGR","PLD","PRU","PEG","PSA","PHM","PVH","QRVO","PWR","QCOM","DGX","Q","RRC","RJF","RTN","O","RHT","REG","REGN","RF","RSG","RMD","RHI","ROK","COL","ROP","ROST","RCL","CRM","SBAC","SCG","SLB","SNI","STX","SEE","SRE","SHW","SIG","SPG","SWKS","SLG","SNA","SO","LUV","SPGI","SWK","SBUX","STT","SRCL","SYK","STI","SYMC","SYF","SNPS","SYY","TROW","TPR","TGT","TEL","FTI","TXN","TXT","TMO","TIF","TWX","TJX","TMK","TSS","TSCO","TDG","TRV","TRIP","FOXA","FOX","TSN","UDR","ULTA","USB","UA","UAA","UNP","UAL","UNH","UPS","URI","UTX","UHS","UNM","VFC","VLO","VAR","VTR","VRSN","VRSK","VZ","VRTX","VIAB","V","VNO","VMC","WMT","WBA","DIS","WM","WAT","WEC","WFC","HCN","WDC","WU","WRK","WY","WHR","WMB","WLTW","WYN","WYNN","XEL","XRX","XLNX","XL","XYL","YUM","ZBH","ZION","ZTS"]
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