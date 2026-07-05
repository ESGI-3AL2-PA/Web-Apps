import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  const socketRef = useRef<Socket | null>(null);
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
    socketRef.current = s;

    s.on("presence:list", (userIds: string[]) => {
      setOnlineUsers(new Set(userIds));
    });

    return () => {
      s.disconnect();
      socketRef.current = null;
      setOnlineUsers(new Set());
    };
  }, [user?.id, getAccessToken]);

  const value = useMemo<SocketContextValue>(
    () => ({
      socket: socketRef.current,
      onlineUsers,
      isUserOnline: (id: string) => onlineUsers.has(id),
    }),
    [onlineUsers],
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};
