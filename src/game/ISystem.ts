export interface ISystem {
  update(delta: number): void;
  destroy(): void;
}
