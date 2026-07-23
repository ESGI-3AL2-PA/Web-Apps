import { createContext, useContext } from "react";
import type { Socket } from "socket.io-client";

// Contexte Socket.IO de user-front : la définition du contexte et son hook sont
// isolés du provider (SocketProvider.tsx) pour rester compatibles avec le Fast Refresh.

/** Valeur exposée par le contexte : socket courant, présences et test d'appartenance. */
export type SocketContextValue = {
  socket: Socket | null;
  onlineUsers: Set<string>;
  isUserOnline: (userId: string) => boolean;
};

// Valeurs par défaut « déconnecté » utilisées hors d'un SocketProvider.
export const SocketContext = createContext<SocketContextValue>({
  socket: null,
  onlineUsers: new Set(),
  isUserOnline: () => false,
});

/** Hook d'accès au contexte socket (socket, utilisateurs en ligne, présence). */
export const useSocket = () => useContext(SocketContext);
