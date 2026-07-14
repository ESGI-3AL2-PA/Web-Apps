import { createContext, useContext } from "react";
import type { Socket } from "socket.io-client";

export type SocketContextValue = {
  socket: Socket | null;
  onlineUsers: Set<string>;
  isUserOnline: (userId: string) => boolean;
};

export const SocketContext = createContext<SocketContextValue>({
  socket: null,
  onlineUsers: new Set(),
  isUserOnline: () => false,
});

export const useSocket = () => useContext(SocketContext);
