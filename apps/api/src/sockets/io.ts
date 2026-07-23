// Couche sockets : configure le serveur Socket.IO (temps réel), authentifie chaque
// connexion via JWT, suit la présence des utilisateurs (rooms par user, multi-onglets)
// et expose des helpers de broadcast que les use-cases REST appellent après une action
// (nouveau message, nouvelle notification).
import type { Server as HttpServer } from "http";
import { Server, type Socket } from "socket.io";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Message } from "../entities/conversation.entity.js";
import type { Notification } from "../entities/notification.entity.js";

const jwksUrl = process.env.AUTH_JWKS_URL ?? "http://localhost:3001/.well-known/jwks.json";
const JWKS = createRemoteJWKSet(new URL(jwksUrl));
const ISSUER = "auth-service";
const AUD_USER = "api";

// Singleton io — exposé pour que les use-cases puissent broadcast après une action REST.
let io: Server | null = null;
// userId → Set des socketIds actifs (multi-onglets).
const onlineSockets = new Map<string, Set<string>>();

// Socket dont le middleware d'auth a renseigné l'id utilisateur dans `data`.
type AuthedSocket = Socket & { data: { userId: string } };

const allowedOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:4000,http://localhost:5000")
  .split(",")
  .map((s) => s.trim());

/** Initialise le serveur Socket.IO sur le serveur HTTP donné, câble l'auth et la présence, et renvoie l'instance. */
export const setupSocketIo = (httpServer: HttpServer): Server => {
  io = new Server(httpServer, {
    cors: { origin: allowedOrigins, credentials: true },
  });

  // Middleware d'authentification — token JWT passé dans le handshake.
  io.use(async (socket, next) => {
    try {
      // Token uniquement via handshake.auth (jamais la query string, qui finit dans les logs).
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) throw new Error("missing token");
      const { payload } = await jwtVerify(token, JWKS, {
        algorithms: ["RS256"],
        issuer: ISSUER,
        audience: [AUD_USER],
      });
      socket.data.userId = payload.sub as string;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket: AuthedSocket) => {
    const { userId } = socket.data;

    // Chaque user a sa propre "room" pour qu'on puisse lui broadcast facilement.
    void socket.join(`user:${userId}`);

    // Track présence.
    const wasOffline = !onlineSockets.has(userId);
    const set = onlineSockets.get(userId) ?? new Set();
    set.add(socket.id);
    onlineSockets.set(userId, set);

    if (wasOffline) {
      broadcastPresenceList();
    } else {
      // Si déjà online ailleurs, on envoie juste l'état actuel à CE socket.
      socket.emit("presence:list", Array.from(onlineSockets.keys()));
    }

    socket.on("disconnect", () => {
      const current = onlineSockets.get(userId);
      if (!current) return;
      current.delete(socket.id);
      if (current.size === 0) {
        onlineSockets.delete(userId);
        broadcastPresenceList();
      }
    });
  });

  return io;
};

// Appelé lors de l'arrêt gracieux : déconnecte de force chaque socket vivant pour que
// les connexions WS keep-alive du serveur HTTP sous-jacent tombent et que `server.close()`
// puisse réellement se terminer (sinon il reste bloqué jusqu'à ce que le watchdog d'arrêt
// force la sortie).
export const closeSocketIo = (): void => {
  if (!io) return;
  io.disconnectSockets(true);
};

const broadcastPresenceList = () => {
  if (!io) return;
  io.emit("presence:list", Array.from(onlineSockets.keys()));
};

// Émis par le use-case sendMessage après création.
export const broadcastNewMessage = (participantIds: string[], message: Message): void => {
  if (!io) return;
  for (const pid of participantIds) {
    io.to(`user:${pid}`).emit("message:new", message);
  }
};

// Émis après création d'une notification — le destinataire refetchera automatiquement.
export const broadcastNewNotification = (recipientId: string, notification: Notification): void => {
  if (!io) return;
  io.to(`user:${recipientId}`).emit("notification:new", notification);
};

export const isUserOnline = (userId: string): boolean => onlineSockets.has(userId);
