/**
 * Logger with Namespace-prefix for ioBroker
 */
export default class NamespaceLogger {
    readonly #namespaceLog: `${`system.adapter.${string}.${number}` | `system.host.${string}`} Plugin ${string}`;
    #logger: ioBroker.Logger;

    /**
     * @param namespaceLog Logging-Namespace as prefix
     * @param logger Logger-instance
     */
    constructor(
        namespaceLog: `${`system.adapter.${string}.${number}` | `system.host.${string}`} Plugin ${string}`,
        logger: ioBroker.Logger,
    ) {
        this.#namespaceLog = namespaceLog;
        // We need to bind this context, otherwise this can be undefined
        // when logger methods are passed around.
        this.#logger = logger;
        this.silly = this.silly.bind(this);
        this.debug = this.debug.bind(this);
        this.info = this.info.bind(this);
        this.error = this.error.bind(this);
        this.warn = this.warn.bind(this);
    }

    silly(msg: string): void {
        this.#logger.silly(`${this.#namespaceLog} ${msg}`);
    }

    debug(msg: string): void {
        this.#logger.debug(`${this.#namespaceLog} ${msg}`);
    }

    info(msg: string): void {
        this.#logger.info(`${this.#namespaceLog} ${msg}`);
    }

    error(msg: string): void {
        this.#logger.error(`${this.#namespaceLog} ${msg}`);
    }

    warn(msg: string): void {
        this.#logger.warn(`${this.#namespaceLog} ${msg}`);
    }
}
