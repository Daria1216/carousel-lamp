/** Motion advances only while playing; stopping preserves the exact angle and lift. */
export function createCarouselMotion() {
  let requested = false,
    speed = 0,
    angle = 0;
  return {
    restore(value: number) {
      if (Number.isFinite(value)) angle = value;
    },
    play(value: boolean) {
      requested = value;
    },
    update(dt: number, paused: boolean, reduced: boolean) {
      const elapsed = Math.max(0, Math.min(dt, 0.05));
      const target =
        // Negative Y rotation is clockwise when viewed from above.
        requested && !paused ? -(Math.PI * 2) / (reduced ? 48 : 28) : 0;
      if (paused) speed = 0;
      speed += (target - speed) * (1 - Math.exp(-elapsed * 2.5));
      if (Math.abs(speed) < 0.00001) speed = 0;
      angle += speed * elapsed;
      return {
        angle,
        heights: [0, 1, 2].map(
          (i) =>
            1.4 +
            (reduced ? 0.045 : 0.1) *
              Math.sin(angle * 4 + (i * Math.PI * 2) / 3),
        ),
        speed,
      };
    },
  };
}
