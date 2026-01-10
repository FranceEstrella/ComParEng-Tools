declare module "canvas-confetti" {
  export interface Options {
    particleCount?: number
    angle?: number
    spread?: number
    startVelocity?: number
    decay?: number
    gravity?: number
    drift?: number
    ticks?: number
    origin?: { x?: number; y?: number }
    colors?: string[]
    shapes?: Array<"square" | "circle">
    scalar?: number
    zIndex?: number
    disableForReducedMotion?: boolean
  }

  export interface CreateOptions {
    resize?: boolean
    useWorker?: boolean
  }

  export interface Confetti {
    (options?: Options): Promise<null> | null
    reset(): void
    create(canvas?: HTMLCanvasElement, opts?: CreateOptions): Confetti
  }

  const confetti: Confetti
  export default confetti
}
