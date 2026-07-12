import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "@repo/hooks";
import { config } from "@repo/config";

type SocketContextValue = {
  socket: Socket | null;
  onlineUsers: Set<string>;
  isUserOnline: (userId: string) => boolean;
};

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  onlineUsers: new Set(),
  isUserOnline: () => false,
});

export const useSocket = () => useContext(SocketContext);

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
      transports: ["websocket", "polling"],
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
