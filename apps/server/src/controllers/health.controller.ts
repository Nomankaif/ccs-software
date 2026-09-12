import type { Request, Response } from "express";

export const getHealth = (_request: Request, response: Response) => {
  response.json({ status: "ok", realtime: "socket.io-with-rest-fallback" });
};
