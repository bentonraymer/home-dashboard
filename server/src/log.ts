function stamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

export const log = {
  info: (msg: string) => console.log(`${stamp()} INFO  ${msg}`),
  warn: (msg: string) => console.warn(`${stamp()} WARN  ${msg}`),
  error: (msg: string) => console.error(`${stamp()} ERROR ${msg}`),
};

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
