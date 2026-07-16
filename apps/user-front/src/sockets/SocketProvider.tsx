import { useEffect, useMemo, useState, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "@repo/hooks";
import { config } from "@repo/config";
import { SocketContext, type SocketContextValue } from "./socket-context";

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const { user, getAccessToken } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.id) return;
    const token = getAccessToken();
    if (!token) return;

    const s = io(config.apiUrl, {
      auth: { token },
      withCredentials: true,
      // Connect over long-polling first, then transparently upgrade to WebSocket. Starting
      // with "websocket" logs a noisy "closed before connection established" whenever the
      // socket is torn down before the WS handshake finishes (page reload / StrictMode).
      transports: ["polling", "websocket"],
    });
    setSocket(s);

    s.on("presence:list", (userIds: string[]) => {
      setOnlineUsers(new Set(userIds));
    });

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
