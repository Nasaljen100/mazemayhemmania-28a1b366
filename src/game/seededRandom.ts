export class SeededRandom {
  private s: number;

  constructor(seed: number) {
    this.s = ((seed % 2147483647) + 2147483647) % 2147483647;
    if (this.s === 0) this.s = 1;
    // warm up
    for (let i = 0; i < 5; i++) this.next();
  }

  next(): number {
    this.s = (this.s * 16807) % 2147483647;
    return (this.s - 1) / 2147483646;
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  bool(chance = 0.5): boolean {
    return this.next() < chance;
  }

  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}
