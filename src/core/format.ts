export const formatPrice = (priceLowerBound: number, hasUnknownPrice: boolean): string => {
  const base = priceLowerBound.toFixed(2);
  return hasUnknownPrice ? `${base}+` : base;
};

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
