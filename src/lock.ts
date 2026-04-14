/**
 * Helper for making sure asynchronous work doesn't overlap
 * @module Lock
 */

export type WorkCompleteFn = ()=>void;
type LockEntry = {
    max:number;
    queue:StartWorkFn[];
    running:StartWorkFn[];
};
type StartWorkFn = ((value:WorkCompleteFn)=>void);

/** Helper for making sure asynchronous work doesn't overlap, or just throttling it when there are many */
export class LockSet<KeyType> {
    private readonly locks = new Map<KeyType, LockEntry>();

    /** acquire a lock
     * @param key identifies the group of tasks that are limited
     * @max maximum number of instances of running tasks in this group
     * @returns Promise for work result
     * */
    private async acquire(key:KeyType, max = 1):Promise<WorkCompleteFn> {
        let entry = this.locks.get(key);
        if (!entry) {
            entry = {running:[], queue:[], max};
            this.locks.set(key, entry);
        }
        entry.max = max;

        // promise to block on before work is executed. resolves when previous work in queue completes
        const promise = new Promise<WorkCompleteFn>(resolve=>{
            if (!entry) {return;}
            entry.queue.push(resolve);
        });

        // if we weren't already at max, it can run immediately
        if (entry.running.length < max) {this.runNext(key);}

        return promise;
    }

    /**
     * queue up work to be run non-simultaneously with other queued work, but still asynchronous
     * @param key identifies the group of tasks that are limited
     * @param work function to call to do the work
     * @max maximum number of simultaneous tasks in this group
     * @returns Promise for work result
     * */
    async enqueue<T>(key:KeyType, work:()=>Promise<T>|T, max = 1):Promise<T> {
        // wait for previous work to complete
        const workCompleteFn = await this.acquire(key, max);

        // run now, making sure we signal the end of work even if something goes wrong
        try {
            return await work();
        } finally {
            workCompleteFn();
        }
    }

    /** do blocked work */
    private runNext(key:KeyType):void {
        const entry = this.locks.get(key);
        if (!entry) {return;}
        while (entry.queue.length && entry.running.length < entry.max) {
            const startWorkFn = entry.queue.shift();
            if (!startWorkFn) {return;}
            entry.running.push(startWorkFn);

            // start work, get notified when it is done
            let released = false;
            startWorkFn(() => {
                if (released) {return;}
                released = true;

                // remove to unlock next
                const index = entry.running.indexOf(startWorkFn);
                entry.running.splice(index, 1);

                // don't hold on to keys we aren't using
                if ((entry.running.length === 0)&&(entry.queue.length===0)) {
                    this.locks.delete(key);
                } else {
                    this.runNext(key);
                }
            });
        }
    }
}

/** one global set of locks should be fine most of the time */
const locks = new LockSet<string>();

/** one global set of locks should be fine most of the time */
export default locks;

