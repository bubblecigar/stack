import { getRubberBandDistance } from './rubberBand';

describe('getRubberBandDistance', () => {
  it('adds diminishing resistance without exceeding its visual limit', () => {
    expect(getRubberBandDistance(0)).toBe(0);
    expect(getRubberBandDistance(40)).toBeGreaterThan(0);
    expect(getRubberBandDistance(400)).toBeLessThan(44);
  });

  it('applies the same resistance in both directions', () => {
    expect(getRubberBandDistance(-120)).toBeCloseTo(-getRubberBandDistance(120));
  });
});
