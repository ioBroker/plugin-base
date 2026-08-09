export type TestLogLevel = 'silly' | 'debug' | 'info' | 'warn' | 'error';

/** A single log call, recorded with the message the logger was given */
export interface LogEntry {
    level: TestLogLevel;
    message: string;
}

/** Logger that records everything instead of printing it, so tests can assert on log output */
export class TestLogger {
    readonly entries: LogEntry[] = [];
    readonly logger: ioBroker.Logger;

    constructor() {
        const record =
            (level: TestLogLevel) =>
            (message: string): void => {
                this.entries.push({ level, message });
            };

        this.logger = {
            silly: record('silly'),
            debug: record('debug'),
            info: record('info'),
            warn: record('warn'),
            error: record('error'),
            level: 'silly',
        };
    }

    /**
     * All recorded messages, optionally limited to one level
     *
     * @param level log level to filter for
     */
    messages(level?: TestLogLevel): string[] {
        return this.entries.filter(entry => !level || entry.level === level).map(entry => entry.message);
    }

    /**
     * Whether any message of the given level contains the passed text
     *
     * @param level log level to search in
     * @param text substring to search for
     */
    has(level: TestLogLevel, text: string): boolean {
        return this.messages(level).some(message => message.includes(text));
    }
}
