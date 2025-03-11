export const isBetweenOrEqual = (target = 0, arrValues = []) => {

    const min = Math.min(...arrValues)
    const max = Math.max(...arrValues)

    return target >= min && target <= max
}
  