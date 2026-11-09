/** 分转元：整数不显示小数（¥38），有零头显示两位（¥38.50）。 */
export function formatPrice(cents: number): string {
  const yuan = cents / 100;
  return Number.isInteger(yuan) ? String(yuan) : yuan.toFixed(2);
}
