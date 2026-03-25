export interface DataTemplate<T> {
  generate(overrides?: Partial<T>): T;
  generateMany(count: number, overrides?: Partial<T>): T[];
}
