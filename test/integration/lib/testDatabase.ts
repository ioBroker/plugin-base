import type { Client as ObjectsClient } from '@iobroker/db-objects-redis';
import type { Client as StatesClient } from '@iobroker/db-states-redis';

/** A single database access, recorded in the order it happened */
export interface DatabaseCall {
    method: 'getObject' | 'setObject' | 'extendObject' | 'getState' | 'setState';
    id: string;
}

/**
 * Deep merge used to emulate the merge semantics of `extendObject`
 *
 * @param target object that is extended in place
 * @param source object whose properties are merged into the target
 */
function mergeDeep(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
    for (const [key, value] of Object.entries(source)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            const current = target[key];
            target[key] = mergeDeep(current && typeof current === 'object' ? current : {}, value);
        } else {
            target[key] = value;
        }
    }
    return target;
}

/**
 * In-memory stand-in for the ioBroker objects and states databases.
 *
 * The real clients (`@iobroker/db-objects-redis` / `@iobroker/db-states-redis`) cannot be required
 * outside of a js-controller installation, and plugin-base references them as type-only imports.
 * Therefore only the handful of methods that PluginBase actually calls is implemented here.
 */
export class TestDatabase {
    readonly objects = new Map<string, ioBroker.Object>();
    readonly states = new Map<string, ioBroker.State>();
    readonly calls: DatabaseCall[] = [];
    readonly objectsDb: ObjectsClient;
    readonly statesDb: StatesClient;

    constructor() {
        this.objectsDb = {
            getObjectAsync: (id: string): Promise<ioBroker.Object | null> => {
                this.calls.push({ method: 'getObject', id });
                return Promise.resolve(this.objects.get(id) ?? null);
            },
            setObjectAsync: (id: string, obj: ioBroker.Object): Promise<{ id: string }> => {
                this.calls.push({ method: 'setObject', id });
                this.objects.set(id, { ...obj, _id: id } as ioBroker.Object);
                return Promise.resolve({ id });
            },
            extendObjectAsync: (
                id: string,
                obj: Record<string, any>,
            ): Promise<{ id: string; value: ioBroker.Object }> => {
                this.calls.push({ method: 'extendObject', id });
                const merged = mergeDeep({ ...(this.objects.get(id) ?? { _id: id }) }, obj) as ioBroker.Object;
                this.objects.set(id, merged);
                return Promise.resolve({ id, value: merged });
            },
        } as unknown as ObjectsClient;

        this.statesDb = {
            getStateAsync: (id: string): Promise<ioBroker.State | null> => {
                this.calls.push({ method: 'getState', id });
                return Promise.resolve(this.states.get(id) ?? null);
            },
            setStateAsync: (id: string, state: ioBroker.SettableState): Promise<string> => {
                this.calls.push({ method: 'setState', id });
                this.states.set(id, {
                    val: state.val ?? null,
                    ack: !!state.ack,
                    from: state.from ?? '',
                    ts: state.ts ?? 1_700_000_000_000,
                    lc: state.lc ?? 1_700_000_000_000,
                });
                return Promise.resolve(id);
            },
        } as unknown as StatesClient;
    }

    /**
     * Prepare a state as if it had been written by an earlier run
     *
     * @param id id of the state
     * @param val value of the state
     */
    seedState(id: string, val: ioBroker.StateValue): void {
        this.states.set(id, { val, ack: true, from: 'test', ts: 1_700_000_000_000, lc: 1_700_000_000_000 });
    }

    /**
     * All ids a given method was called with
     *
     * @param method the database method to filter for
     */
    idsFor(method: DatabaseCall['method']): string[] {
        return this.calls.filter(call => call.method === method).map(call => call.id);
    }
}
