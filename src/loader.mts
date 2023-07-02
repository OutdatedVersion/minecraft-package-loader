import debug from 'debug';

const resolveLog = debug('loader:resolve');
const root = new Map();
export function resolve(
  specifier: string,
  context: { parentURL?: string },
  nextResolve: (specifier: string, context: unknown) => unknown
) {
  resolveLog('resolve', { specifier, context });
  const { parentURL = null } = context;

  if (specifier.startsWith('minecraft:')) {
    resolveLog('using special handler');
    root.set(specifier, parentURL);
    return {
      shortCircuit: true,
      url: specifier,
    };
  } else if (parentURL && parentURL.startsWith('minecraft:')) {
    if (root.has(parentURL)) {
      const url = root.get(parentURL);
      resolveLog(`overriding 'parentURL' for '${specifier}' to ${url}`);
      context.parentURL = url;
    }
  }

  return nextResolve(specifier, context);
}

const loadLog = debug('loader:load');
export function load(
  url: string,
  context: unknown,
  nextLoad: (url: string) => unknown
) {
  loadLog('load', { url, context });

  if (url.startsWith('minecraft:')) {
    return import('./minecraft.mjs')
      .then(({ getPackage }) => {
        return getPackage(url.substring('minecraft:'.length));
      })
      .then((pkg) => {
        if (!pkg) {
          throw new Error(`${url} not found`);
        }
        return {
          format: 'module',
          shortCircuit: true,
          source: pkg.source,
        };
      });
  }

  return nextLoad(url);
}
