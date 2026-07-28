export function sumArray(values: number[]): number {
  let total = 0;

  // BUG: loop runs one index past the end of the array
  for (let index = 0; index <= values.length; index += 1) {
    total += values[index];
  }

  return total;
}
