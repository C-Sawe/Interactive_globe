import * as d3 from 'd3-geo';

export function centroid(feature: any): [number, number] {
  return d3.geoCentroid(feature) as [number, number];
}

export function distance(a: [number, number], b: [number, number]) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
}
