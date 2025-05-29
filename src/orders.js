export const maxLeveragePossible = ({ entryPrice, stopLoss, MAX_PERCENTUAL_LOSS, maxLeverage = 125 }) => {
  if (entryPrice <= 0) 
    throw new Error('entryPrice must be > 0');
  if (stopLoss === entryPrice) 
    throw new Error('stopLoss must be different from entryPrice');
  if (MAX_PERCENTUAL_LOSS <= 0) 
    throw new Error('MAX_PERCENTUAL_LOSS must be > 0');

  // absolute adverse move in price
  const adverseMove = Math.abs(entryPrice - stopLoss);
  // risk per unit = adverseMove / entryPrice
  const riskPerUnit = adverseMove / entryPrice;

  // raw leverage (may be fractional)
  const rawLeverage = MAX_PERCENTUAL_LOSS / riskPerUnit;
  // round to nearest integer
  const rounded = Math.round(rawLeverage);
  // clamp between 1 and maxLeverage
  return Math.min(maxLeverage, Math.max(1, rounded));
};