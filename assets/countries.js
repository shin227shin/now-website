// Where each country sits on the hero globe (assets/globe.js): latitude / longitude of a point near its middle.

const COUNTRIES = {
  // Current members
  'Norway':        { lat: 60.47, lon: 8.47 },
  'Germany':       { lat: 51.17, lon: 10.45 },
  'Greece':        { lat: 39.07, lon: 21.82 },
  'Romania':       { lat: 45.94, lon: 24.97 },
  'Spain':         { lat: 40.46, lon: -3.75 },
  'Portugal':      { lat: 39.40, lon: -8.22 },
  'France':        { lat: 46.23, lon: 2.21 },
  'Japan':         { lat: 36.20, lon: 138.25 },
  'India':         { lat: 20.59, lon: 78.96 },
  'Philippines':   { lat: 12.88, lon: 121.77 },
  'Poland':        { lat: 51.92, lon: 19.15 },
  'Netherlands':   { lat: 52.13, lon: 5.29 },
  'Australia':     { lat: -25.27, lon: 133.78 },
  'Singapore':     { lat: 1.35,  lon: 103.82 },

  // Europe
  'United Kingdom':{ lat: 54.0,  lon: -2.0 },
  'Ireland':       { lat: 53.4,  lon: -8.2 },
  'Italy':         { lat: 42.8,  lon: 12.6 },
  'Belgium':       { lat: 50.5,  lon: 4.5 },
  'Switzerland':   { lat: 46.8,  lon: 8.2 },
  'Austria':       { lat: 47.5,  lon: 14.6 },
  'Denmark':       { lat: 56.0,  lon: 10.0 },
  'Sweden':        { lat: 60.1,  lon: 18.6 },
  'Finland':       { lat: 61.9,  lon: 25.7 },
  'Czech Republic':{ lat: 49.8,  lon: 15.5 },
  'Hungary':       { lat: 47.2,  lon: 19.5 },
  'Slovakia':      { lat: 48.7,  lon: 19.7 },
  'Bulgaria':      { lat: 42.7,  lon: 25.5 },
  'Croatia':       { lat: 45.1,  lon: 15.2 },
  'Serbia':        { lat: 44.0,  lon: 21.0 },
  'Lithuania':     { lat: 55.2,  lon: 23.9 },
  'Latvia':        { lat: 56.9,  lon: 24.6 },
  'Estonia':       { lat: 58.6,  lon: 25.0 },
  'Ukraine':       { lat: 48.4,  lon: 31.2 },
  'Turkey':        { lat: 39.0,  lon: 35.2 },
  'Luxembourg':    { lat: 49.8,  lon: 6.1 },

  // Middle East & Africa
  'Israel':        { lat: 31.0,  lon: 34.9 },
  'United Arab Emirates': { lat: 23.4, lon: 53.8 },
  'Saudi Arabia':  { lat: 23.9,  lon: 45.1 },
  'Qatar':         { lat: 25.3,  lon: 51.2 },
  'Egypt':         { lat: 26.8,  lon: 30.8 },
  'Morocco':       { lat: 31.8,  lon: -7.1 },
  'Nigeria':       { lat: 9.1,   lon: 8.7 },
  'Ghana':         { lat: 7.9,   lon: -1.0 },
  'Kenya':         { lat: -0.0,  lon: 37.9 },
  'Ethiopia':      { lat: 9.1,   lon: 40.5 },
  'South Africa':  { lat: -30.6, lon: 22.9 },
  'Mauritius':     { lat: -20.3, lon: 57.6 },

  // Asia & Oceania
  'China':         { lat: 35.9,  lon: 104.2 },
  'South Korea':   { lat: 35.9,  lon: 127.8 },
  'Taiwan':        { lat: 23.7,  lon: 121.0 },
  'Hong Kong':     { lat: 22.3,  lon: 114.2 },
  'Vietnam':       { lat: 14.1,  lon: 108.3 },
  'Thailand':      { lat: 15.9,  lon: 101.0 },
  'Malaysia':      { lat: 4.2,   lon: 101.98 },
  'Indonesia':     { lat: -2.5,  lon: 118.0 },
  'Sri Lanka':     { lat: 7.9,   lon: 80.8 },
  'Bangladesh':    { lat: 23.7,  lon: 90.4 },
  'Pakistan':      { lat: 30.4,  lon: 69.3 },
  'New Zealand':   { lat: -40.9, lon: 174.9 },

  // Americas
  'United States': { lat: 37.1,  lon: -95.7 },
  'Canada':        { lat: 56.1,  lon: -106.3 },
  'Mexico':        { lat: 23.6,  lon: -102.6 },
  'Brazil':        { lat: -14.2, lon: -51.9 },
  'Argentina':     { lat: -38.4, lon: -63.6 },
  'Chile':         { lat: -35.7, lon: -71.5 },
  'Colombia':      { lat: 4.6,   lon: -74.3 },
  'Costa Rica':    { lat: 9.7,   lon: -83.8 }
};

// Returns [lat, lon], or null when the country is unknown and has no position set by hand.
function countryLatLon(name, override) {
  if (override && override.length === 2) return override;
  const c = COUNTRIES[name];
  return c ? [c.lat, c.lon] : null;
}
