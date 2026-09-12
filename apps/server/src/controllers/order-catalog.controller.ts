import type { Request, Response } from "express";
import * as orderCatalogService from "../services/order-catalog.service.js";
import type { AuthedRequest } from "../types/http.js";
import { getRouteParam } from "../utils/route-param.js";

export const list = async (request: Request, response: Response) => {
  const query = typeof request.query.q === "string" ? request.query.q : "";
  const includeInactive = request.query.includeInactive === "true";
  response.json({ orders: await orderCatalogService.listCatalogOrders(query, includeInactive) });
};

export const create = async (request: AuthedRequest, response: Response) => {
  const order = await orderCatalogService.createCatalogOrder(request.body, request.user!.id);
  response.status(201).json({ order });
};

export const update = async (request: AuthedRequest, response: Response) => {
  const order = await orderCatalogService.updateCatalogOrder(
    getRouteParam(request, "orderId"),
    request.body,
    request.user!.id
  );
  response.json({ order });
};

export const archive = async (request: AuthedRequest, response: Response) => {
  const order = await orderCatalogService.setCatalogOrderActive(
    getRouteParam(request, "orderId"),
    false,
    request.user!.id
  );
  response.json({ order });
};

export const restore = async (request: AuthedRequest, response: Response) => {
  const order = await orderCatalogService.setCatalogOrderActive(
    getRouteParam(request, "orderId"),
    true,
    request.user!.id
  );
  response.json({ order });
};
