export default class StrategyClass  {
  constructor() {
    this.initialBalance = 2000;
    this.riskFraction = 0.2;
    this.idx = 0
  }

  reportInit = ({trade, side, entryPrice, stopLoss, takeProfit, leverage, date}) => {

    const { initialBalance, riskFraction } = this;

    const d = new Date(date)

    const positionSize = initialBalance * riskFraction; 
    let pnlPct, pnl;

    // profit scenario
    if (trade === 1) {
      // relative move to TP
      pnlPct = side === 'buy'
        ? (takeProfit - entryPrice) / entryPrice
        : (entryPrice - takeProfit) / entryPrice;
    } 
    // loss scenario
    else if (trade === 0) {
      // relative move to SL
      pnlPct = side === 'buy'
        ? (entryPrice - stopLoss) / entryPrice
        : (stopLoss - entryPrice) / entryPrice;
      pnlPct = -pnlPct;
    } 
    else {
      throw new Error('Invalid trade flag: must be 0 (SL) or 1 (TP).');
    }

    // scaled by leverage and position size in USD
    pnl = positionSize * leverage * pnlPct;

    console.log(d, pnl, leverage, trade)

    // update balance
    this.initialBalance += pnl;

    this.idx++

    // you can log or return whatever you need for downstream reporting
    return {
      pnl,                          // USD PnL
      pnlPct: pnlPct * 100,        // PnL % of entry
      balance: this.initialBalance // new account balance
    };
  }
}