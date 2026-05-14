import { encode, decode } from '@msgpack/msgpack';

export function encodePacketClient(event: string, args: any[]): string | ArrayBuffer {
  // If single binary arg
  if (args.length === 1 && (args[0] instanceof ArrayBuffer || ArrayBuffer.isView(args[0]))) {
     const eventBuf = new TextEncoder().encode(event);
     const argBuf = args[0] instanceof ArrayBuffer ? args[0] : args[0].buffer;
     const argView = new Uint8Array(argBuf, (args[0] as ArrayBufferView).byteOffset || 0, (args[0] as ArrayBufferView).byteLength || argBuf.byteLength);
     const out = new Uint8Array(1 + eventBuf.length + argView.length);
     out[0] = eventBuf.length;
     out.set(eventBuf, 1);
     out.set(argView, 1 + eventBuf.length);
     return out.buffer;
  }
  
  // msgpack mode
  const encoded = encode({ e: event, a: args });
  const out = new Uint8Array(1 + encoded.length);
  out[0] = 255;
  out.set(encoded, 1);
  return out.buffer;
}

export function decodePacketClient(data: string | ArrayBuffer | Blob): Promise<{ event: string, args: any[] } | null> | { event: string, args: any[] } | null {
  if (typeof data === 'string') {
     try {
       const d = JSON.parse(data);
       return { event: d.e, args: d.a };
     } catch(e) { return null; }
  } else if (data instanceof ArrayBuffer) {
     const view = new Uint8Array(data);
     if (view.length > 0 && view[0] === 255) {
        try {
          const d = decode(view.subarray(1)) as any;
          return { event: d.e, args: d.a };
        } catch(e) { return null; }
     } else if (view.length > 0 && view[0] < 50) {
        const len = view[0];
        const event = new TextDecoder().decode(view.subarray(1, 1 + len));
        const rest = data.slice(1 + len);
        return { event, args: [rest] }; // returns ArrayBuffer
     } else {
        try {
          const d = JSON.parse(new TextDecoder().decode(view));
          return { event: d.e, args: d.a };
        } catch(e) { return null; }
     }
  } else {
      // Blob
      return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(decodePacketClient(reader.result as ArrayBuffer) as any);
          reader.readAsArrayBuffer(data as Blob);
      });
  }
}

