"use client";

import { useEffect } from "react";
import { io, type Socket } from "socket.io-client";
import { getToken } from "@/lib/api";

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function useSocket(
  handlers: Record<string, (payload: unknown) => void>
): void {
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    if (!socket) {
      socket = io({
        path: "/socket.io",
        auth: { token },
        transports: ["websocket", "polling"],
      });
    }
    const entries = Object.entries(handlers);
    entries.forEach(([event, handler]) => socket?.on(event, handler));
    return () => {
      entries.forEach(([event, handler]) => socket?.off(event, handler));
    };
  }, [handlers]);
}
