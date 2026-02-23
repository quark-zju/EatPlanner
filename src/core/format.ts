export const formatQuantityWithUnit = (
  quantity: number | string,
  unit: string | undefined
): string => {
  if (!unit) {
    return String(quantity);
  }
  const normalizedUnit = unit.trim();
  if (!normalizedUnit) {
    return String(quantity);
  }
  const separator = /^\d/.test(normalizedUnit) ? " × " : " ";
  return `${quantity}${separator}${normalizedUnit}`;
};
