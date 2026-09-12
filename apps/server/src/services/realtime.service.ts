import type { Server as HttpServer } from "node:http";
import { parseCookie } from "cookie";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { config } from "../config/env.js";
import { AttemptModel } from "../models/index.js";
import type { AuthUser } from "../types/http.js";

let realtimeServer: Server | null = null;

const attemptRoom = (attemptId: string) => `attempt:${attemptId}`;

export const initializeRealtime = (server: HttpServer) => {
  const io = new Server(server, {
    cors: { origin: config.clientUrl, credentials: true }
  });

  io.use((socket, next) => {
    try {
      const cookies = parseCookie(socket.request.headers.cookie ?? "");
      if (!cookies.accessToken) return next(new Error("Authentication required"));
      socket.data.user = jwt.verify(cookies.accessToken, config.jwtSecret) as AuthUser;
      next();
    } catch {
      next(new Error("Session expired"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("attempt:join", async ({ attemptId }: { attemptId: string }, acknowledge?: (result: { ok: boolean; error?: string }) => void) => {
      const user = socket.data.user as AuthUser;
      const ownsAttempt = await AttemptModel.exists({ _id: attemptId, userId: user.id });
      if (!ownsAttempt) {
        acknowledge?.({ ok: false, error: "Attempt not found" });
        return;
      }
      await socket.join(attemptRoom(attemptId));
      acknowledge?.({ ok: true });
    });

    socket.on("attempt:leave", async ({ attemptId }: { attemptId: string }) => {
      await socket.leave(attemptRoom(attemptId));
    });
  });

  realtimeServer = io;
  return io;
};

export interface AttemptRealtimeChanges {
  resultAdded?: boolean;
  patientUpdated?: boolean;
  vitalsUpdated?: boolean;
  enteredFinalOrders?: boolean;
  completed?: boolean;
}

export const publishAttemptUpdate = (
  attemptId: string,
  attempt: unknown,
  changes: AttemptRealtimeChanges = {}
) => {
  const room = attemptRoom(attemptId);
  realtimeServer?.to(room).emit("attempt:updated", { attempt });
  if (changes.resultAdded) realtimeServer?.to(room).emit("result:available", { attempt });
  if (changes.patientUpdated) realtimeServer?.to(room).emit("patient:updated", { attempt });
  if (changes.vitalsUpdated) realtimeServer?.to(room).emit("vitals:updated", { attempt });
  if (changes.enteredFinalOrders) realtimeServer?.to(room).emit("case:final-orders", { attempt });
  if (changes.completed) realtimeServer?.to(room).emit("case:completed", { attempt });
};

export const publishTimerSynchronization = (
  attemptId: string,
  payload: { serverTime: string; realTimeEndsAt: Date; finalOrdersStartsAt: Date; status: string }
) => {
  realtimeServer?.to(attemptRoom(attemptId)).emit("timer:synchronized", payload);
};
