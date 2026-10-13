// Browser stand-ins for the few @nestjs/common symbols the shared logic uses.
const noopDecorator = (..._a: any[]) => (..._b: any[]) => undefined;
export const Injectable = noopDecorator;
export const Inject = noopDecorator;
export const Module = noopDecorator;
export class Logger {
  constructor(private ctx = '') {}
  log(m: string) { console.log(`[${this.ctx}]`, m); }
  warn(m: string) { console.warn(`[${this.ctx}]`, m); }
  error(m: string) { console.error(`[${this.ctx}]`, m); }
}
