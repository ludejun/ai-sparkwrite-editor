import * as awarenessProtocol from 'y-protocols/awareness';
import * as Y from 'yjs';

/**
 * y-protocols over any message transport (a WebSocket the host already owns,
 * a BroadcastChannel, a test relay). Frames are the `y-websocket` binary
 * format, so a `y-websocket` server, Hocuspocus-compatible relays and the
 * StarNote API all speak it:
 *
 *   varUint 0 sync      — varUint 0 SyncStep1 (state vector) | 1 SyncStep2 (update) | 2 Update (update)
 *   varUint 1 awareness — varUint8Array awareness update
 *   varUint 2 auth      — varUint 0 permission denied, varString reason
 *   varUint 3 query awareness
 *
 * The host wires it up in three calls: `connect(send)` when the transport is
 * open, `receive(bytes)` for every binary frame, `disconnect()` when it drops.
 * Local document and awareness changes are sent while connected; on
 * `connect` the provider starts a sync round (`synced` turns true once the
 * peer answered SyncStep1).
 */
export type YSyncStatus = 'disconnected' | 'connecting' | 'connected';

export interface YSyncProviderEvents {
  status: (status: YSyncStatus) => void;
  synced: (synced: boolean) => void;
  /** The server refused our updates (read-only member, document too large…). */
  denied: (reason: string) => void;
}

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;
const MSG_AUTH = 2;
const MSG_QUERY_AWARENESS = 3;
const STEP1 = 0;
const STEP2 = 1;
const UPDATE = 2;

function writeVarUint(out: number[], num: number) {
  while (num > 0x7f) {
    out.push(0x80 | (num & 0x7f));
    num = Math.floor(num / 128);
  }
  out.push(num);
}

function frame(head: number[], payload?: Uint8Array): Uint8Array {
  const out = [...head];
  if (payload) writeVarUint(out, payload.length);
  const bytes = new Uint8Array(out.length + (payload?.length ?? 0));
  bytes.set(out, 0);
  if (payload) bytes.set(payload, out.length);
  return bytes;
}

class Reader {
  pos = 0;
  constructor(private readonly data: Uint8Array) {}
  varUint(): number {
    let num = 0;
    let mult = 1;
    for (;;) {
      if (this.pos >= this.data.length) throw new Error('Unexpected end of message');
      const byte = this.data[this.pos++];
      num += (byte & 0x7f) * mult;
      if (byte < 0x80) return num;
      mult *= 128;
    }
  }
  varBytes(): Uint8Array {
    const len = this.varUint();
    if (this.pos + len > this.data.length) throw new Error('Unexpected end of message');
    const chunk = this.data.subarray(this.pos, this.pos + len);
    this.pos += len;
    return chunk;
  }
  varString(): string {
    return new TextDecoder().decode(this.varBytes());
  }
}

export class YSyncProvider {
  readonly doc: Y.Doc;
  readonly awareness: awarenessProtocol.Awareness;
  status: YSyncStatus = 'disconnected';
  synced = false;
  private send: ((data: Uint8Array) => void) | null = null;
  private listeners: { [K in keyof YSyncProviderEvents]: Set<YSyncProviderEvents[K]> } = {
    status: new Set(),
    synced: new Set(),
    denied: new Set(),
  };

  constructor(doc: Y.Doc, options: { awareness?: awarenessProtocol.Awareness } = {}) {
    this.doc = doc;
    this.awareness = options.awareness ?? new awarenessProtocol.Awareness(doc);
    doc.on('update', this.onDocUpdate);
    this.awareness.on('update', this.onAwarenessUpdate);
  }

  on<K extends keyof YSyncProviderEvents>(event: K, listener: YSyncProviderEvents[K]): () => void {
    this.listeners[event].add(listener);
    return () => this.listeners[event].delete(listener);
  }

  private emit<K extends keyof YSyncProviderEvents>(
    event: K,
    ...args: Parameters<YSyncProviderEvents[K]>
  ) {
    this.listeners[event].forEach((listener) => (listener as (...a: unknown[]) => void)(...args));
  }

  private setStatus(status: YSyncStatus) {
    if (this.status === status) return;
    this.status = status;
    this.emit('status', status);
  }

  private setSynced(synced: boolean) {
    if (this.synced === synced) return;
    this.synced = synced;
    this.emit('synced', synced);
  }

  /** The transport is open: start a sync round and announce our awareness state. */
  connect(send: (data: Uint8Array) => void) {
    this.send = send;
    this.setStatus('connected');
    send(frame([MSG_SYNC, STEP1], Y.encodeStateVector(this.doc)));
    if (this.awareness.getLocalState() !== null) {
      send(
        frame(
          [MSG_AWARENESS],
          awarenessProtocol.encodeAwarenessUpdate(this.awareness, [this.doc.clientID])
        )
      );
    }
  }

  /** The transport dropped: remote cursors go, local edits keep piling up in the doc until `connect`. */
  disconnect() {
    this.send = null;
    this.setSynced(false);
    this.setStatus('disconnected');
    const others = [...this.awareness.getStates().keys()].filter((id) => id !== this.doc.clientID);
    if (others.length) awarenessProtocol.removeAwarenessStates(this.awareness, others, this);
  }

  /** Feed one binary frame from the transport. */
  receive(data: Uint8Array | ArrayBuffer) {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const reader = new Reader(bytes);
    const type = reader.varUint();
    if (type === MSG_SYNC) {
      const step = reader.varUint();
      const payload = reader.varBytes();
      if (step === STEP1) {
        this.send?.(frame([MSG_SYNC, STEP2], Y.encodeStateAsUpdate(this.doc, payload)));
      } else if (step === STEP2 || step === UPDATE) {
        Y.applyUpdate(this.doc, payload, this);
        if (step === STEP2) this.setSynced(true);
      }
    } else if (type === MSG_AWARENESS) {
      awarenessProtocol.applyAwarenessUpdate(this.awareness, reader.varBytes(), this);
    } else if (type === MSG_AUTH) {
      if (reader.varUint() === 0) this.emit('denied', reader.varString());
    } else if (type === MSG_QUERY_AWARENESS) {
      this.send?.(
        frame(
          [MSG_AWARENESS],
          awarenessProtocol.encodeAwarenessUpdate(this.awareness, [
            ...this.awareness.getStates().keys(),
          ])
        )
      );
    }
  }

  private onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === this || !this.send) return;
    this.send(frame([MSG_SYNC, UPDATE], update));
  };

  private onAwarenessUpdate = (
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown
  ) => {
    if (origin === this || !this.send) return;
    const changed = [...added, ...updated, ...removed];
    this.send(
      frame([MSG_AWARENESS], awarenessProtocol.encodeAwarenessUpdate(this.awareness, changed))
    );
  };

  /** Tell peers we are gone and stop listening (the doc itself stays usable). */
  destroy() {
    awarenessProtocol.removeAwarenessStates(this.awareness, [this.doc.clientID], 'local');
    this.doc.off('update', this.onDocUpdate);
    this.awareness.off('update', this.onAwarenessUpdate);
    this.awareness.destroy();
    this.send = null;
    this.setStatus('disconnected');
    Object.values(this.listeners).forEach((set) => set.clear());
  }
}

/**
 * The kit options for a collaborative editor: `RichTextKit.configure({
 * ...collaborationKitOptions({ document, provider, user }) })`.
 */
export function collaborationKitOptions({
  document,
  provider,
  user,
  field = 'default',
}: {
  document: Y.Doc;
  provider: { awareness: awarenessProtocol.Awareness };
  user: { name: string; color: string; [key: string]: unknown };
  field?: string;
}) {
  return {
    collaboration: { document, field },
    collaborationCaret: { provider, user },
  };
}
