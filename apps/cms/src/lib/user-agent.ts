// A browser and system name from a user agent, for the Devices list on the
// profile ("Chrome on Mac"). Deliberately rough: enough to recognise your own
// devices, not a full parser. Order matters, since most browsers also claim
// to be Safari and Chrome.

const BROWSERS: [RegExp, string][] = [
  [/Edg(A|iOS)?\//, 'Edge'],
  [/(OPR|Opera)\//, 'Opera'],
  [/SamsungBrowser\//, 'Samsung Internet'],
  [/(Firefox|FxiOS)\//, 'Firefox'],
  [/(Chrome|CriOS)\//, 'Chrome'],
  [/Version\/[\d.]+.*Safari\//, 'Safari'],
];

const SYSTEMS: [RegExp, string][] = [
  [/iPhone/, 'iPhone'],
  [/iPad/, 'iPad'],
  [/Android/, 'Android'],
  [/Windows/, 'Windows'],
  [/Mac OS X|Macintosh/, 'Mac'],
  [/CrOS/, 'ChromeOS'],
  [/Linux/, 'Linux'],
];

const first = (ua: string, list: [RegExp, string][]) => list.find(([test]) => test.test(ua))?.[1];

export function describeDevice(userAgent: string | null | undefined): string {
  if (!userAgent) return 'Unknown device';
  const browser = first(userAgent, BROWSERS);
  const system = first(userAgent, SYSTEMS);
  if (browser && system) return `${browser} on ${system}`;
  return browser ?? system ?? 'Unknown device';
}
