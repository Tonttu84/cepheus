export function formatCentsToEuros(cents: number): string {
  const euros = Math.floor(Math.abs(cents) / 100);
  const remainder = Math.abs(cents % 100);
  const sign = cents < 0 ? "-" : "";
  return `${sign}€${euros}.${remainder.toString().padStart(2, "0")}`;
}

export function getElementPosition(index: number, width: number, height: number) {
  const x = (index * 37) % width;
  const y = (index * 17) % height;
  const size = 1 + (index % 3);
  const opacity = 0.6 + (index % 40) / 100;
  return { x, y, size, opacity };
}
