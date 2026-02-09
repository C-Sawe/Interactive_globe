export type NetworkSite = {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: {
    name: string;
    county: string;
    users: number;
    status: 'active' | 'maintenance';
  };
};

export type NetworkArc = {
  source: [number, number];
  target: [number, number];
  users: number;
};
