import type { Response } from "express";
import * as attemptService from "../services/attempt.service.js";
import type { AuthedRequest } from "../types/http.js";
import { getRouteParam } from "../utils/route-param.js";

export const start = async (request: AuthedRequest, response: Response) => {
  const result = await attemptService.startAttempt(request.body.caseId, request.user!.id);
  response.status(result.created ? 201 : 200).json({ attempt: result.attempt });
};

export const list = async (request: AuthedRequest, response: Response) => {
  response.json({ attempts: await attemptService.listAttempts(request.user!.id) });
};

export const getState = async (request: AuthedRequest, response: Response) => {
  const attempt = await attemptService.getAttemptState(getRouteParam(request, "id"), request.user!.id);
  response.json({ attempt });
};

export const searchOrders = async (request: AuthedRequest, response: Response) => {
  const search = typeof request.query.search === "string" ? request.query.search : "";
  response.json({
    orders: await attemptService.searchAttemptOrders(
      getRouteParam(request, "id"),
      request.user!.id,
      search
    )
  });
};

export const submitAction = async (request: AuthedRequest, response: Response) => {
  const attempt = await attemptService.submitAttemptAction(
    getRouteParam(request, "id"),
    request.user!.id,
    request.body
  );
  response.json({ attempt });
};

export const getReport = async (request: AuthedRequest, response: Response) => {
  response.json({
    report: await attemptService.getScoreReport(getRouteParam(request, "id"), request.user!.id)
  });
};
