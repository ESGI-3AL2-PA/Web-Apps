import { useEffect, useMemo, useState, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "@repo/hooks";
import { config } from "@repo/config";
import { SocketContext, type SocketContextValue } from "./socket-context";

/**
 * Fournisseur du contexte Socket.IO de user-front. Ouvre une connexion authentifiée
 * (par access token) vers l'api dès qu'un utilisateur est connecté, expose le socket
 * et l'ensemble des utilisateurs en ligne (via l'événement `presence:list`), et ferme
 * proprement la connexion au démontage ou au changement d'utilisateur.
 */
export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const { user, getAccessToken } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  // (Re)connexion liée à l'identité utilisateur : pas d'utilisateur ou pas de token -> rien.
  useEffect(() => {
    if (!user?.id) return;
    const token = getAccessToken();
    if (!token) return;

    const s = io(config.apiUrl, {
      auth: { token },
      withCredentials: true,
      // On se connecte d'abord en long-polling puis on bascule de façon transparente
      // vers WebSocket. Démarrer directement en « websocket » génère un bruyant
      // « closed before connection established » chaque fois que le socket est détruit
      // avant la fin du handshake WS (rechargement de page / StrictMode).
      transports: ["polling", "websocket"],
    });
    setSocket(s);

    // L'api pousse la liste complète des utilisateurs en ligne à la connexion et à chaque changement.
    s.on("presence:list", (userIds: string[]) => {
      setOnlineUsers(new Set(userIds));
    });

    // Nettoyage : déconnexion et réinitialisation de l'état de présence.
    return () => {
      s.disconnect();
      setSocket(null);
      setOnlineUsers(new Set());
    };
  }, [user?.id, getAccessToken]);

  const value = useMemo<SocketContextValue>(
    () => ({
      socket,
      onlineUsers,
      isUserOnline: (id: string) => onlineUsers.has(id),
    }),
    [socket, onlineUsers],
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};
