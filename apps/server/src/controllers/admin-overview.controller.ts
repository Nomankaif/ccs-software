import type { Request, Response } from "express";
import { z } from "zod";
import * as service from "../services/admin-overview.service.js";
import type { AuthedRequest } from "../types/http.js";
import { getRouteParam } from "../utils/route-param.js";

const querySchema = z.object({ q: z.string().max(200).default(""), page: z.coerce.number().int().min(1).max(100000).default(1) });
export async function users(request: Request, response: Response) {
  const query = querySchema.parse(request.query);
  response.json(await service.listUsers(query.q, "student", query.page));
}
export async function employees(request: Request, response: Response) {
  const query = querySchema.extend({ role: z.enum(["", "admin", "subadmin", "writer"]).default("") }).parse(request.query);
  response.json(await service.listUsers(query.q, query.role || "employees", query.page));
}
export async function createUser(request: Request, response: Response) {
  response.status(201).json({ user: await service.createUser(request.body) });
}
export async function employeeStatus(request: AuthedRequest, response: Response) {
  response.json({ user: await service.changeEmployee(getRouteParam(request, "id"), request.user!.id, request.body.paused ? "pause" : "resume") });
}
export async function deleteEmployee(request: AuthedRequest, response: Response) {
  await service.changeEmployee(getRouteParam(request, "id"), request.user!.id, "delete");
  response.status(204).send();
}
export async function analytics(request: Request, response: Response) {
  const { days } = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }).parse(request.query);
  response.json(await service.analytics(days));
}
export async function audit(request: Request, response: Response) {
  const query = querySchema.parse(request.query);
  response.json(await service.auditLog(query.q, query.page));
}
