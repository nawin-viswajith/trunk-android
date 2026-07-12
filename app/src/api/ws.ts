import { wsBaseUrl } from "./client";

export function connectJsonWs<T>(path: string, onMessage: (data: T) => void, onClose?: () => void): () => void {
  let closedByCaller = false;
  let socket: WebSocket | null = new WebSocket(`${wsBaseUrl()}${path}`);

  socket.onmessage = (event) => {
    try {
      onMessage(JSON.parse(event.data));
    } catch {
      // ignore malformed frames
    }
  };
  socket.onclose = () => {
    if (!closedByCaller) onClose?.();
  };

  return () => {
    closedByCaller = true;
    socket?.close();
    socket = null;
  };
}
