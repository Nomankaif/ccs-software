import type { Request, Response } from "express";
import * as caseService from "../services/case.service.js";
import { previewCaseDefinition } from "../services/attempt.service.js";
import { evaluateCaseQuality } from "../services/case-quality.service.js";
import type { AuthedRequest } from "../types/http.js";
import { getRouteParam } from "../utils/route-param.js";

export const listPublished = async (_request: Request, response: Response) => {
  response.json({ cases: await caseService.listPublishedCases() });
};

export const getPublished = async (request: Request, response: Response) => {
  response.json({ case: await caseService.getPublishedCase(getRouteParam(request, "id")) });
};

export const listForAdmin = async (_request: Request, response: Response) => {
  response.json({ cases: await caseService.listAdminCases() });
};

export const create = async (request: AuthedRequest, response: Response) => {
  const entry = await caseService.createCaseVersion(request.body, request.user!.id);
  response.status(201).json({ case: entry });
};

export const update = async (request: AuthedRequest, response: Response) => {
  const entry = await caseService.updateCaseVersion(
    getRouteParam(request, "id"),
    request.body,
    request.user!.id,
    request.user!.role
  );
  response.json({ case: entry });
};

export const importCases = async (request: AuthedRequest, response: Response) => {
  const cases = await caseService.importCaseVersions(request.body, request.user!.id);
  response.status(201).json({ cases });
};

export const preview = async (request: Request, response: Response) => {
  response.json({ preview: previewCaseDefinition(request.body.definition, request.body.actions) });
};

export const quality = async (request: Request, response: Response) => {
  response.json({ quality: evaluateCaseQuality(request.body) });
};

export const validate = async (request: Request, response: Response) => {
  const result = await caseService.validateCaseVersion(getRouteParam(request, "id"));
  response.status(result.success ? 200 : 422).json(
    result.success ? { valid: true } : { valid: false, issues: result.error.issues }
  );
};

export const submitForReview = async (request: AuthedRequest, response: Response) => {
  response.json({
    case: await caseService.submitCaseForReview(
      getRouteParam(request, "id"),
      request.user!.id,
      request.body.comment
    )
  });
};

export const review = async (request: AuthedRequest, response: Response) => {
  response.json({
    case: await caseService.reviewCaseVersion(
      getRouteParam(request, "id"),
      request.user!.id,
      request.body.decision,
      request.body.comment
    )
  });
};

export const history = async (request: Request, response: Response) => {
  response.json(await caseService.getCaseVersionHistory(getRouteParam(request, "id")));
};

export const publish = async (request: Request, response: Response) => {
  response.json({ case: await caseService.publishCaseVersion(getRouteParam(request, "id")) });
};

export const retire = async (request: Request, response: Response) => {
  response.json({ case: await caseService.retireCaseVersion(getRouteParam(request, "id")) });
};

export const remove = async (request: Request, response: Response) => {
  await caseService.deleteCase(getRouteParam(request, "id"));
  response.status(204).send();
};
