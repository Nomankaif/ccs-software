import type { z } from "zod";
import { Types } from "mongoose";
import { orderCatalogEntrySchema, orderDefinitionSchema } from "@ccs/validation";
import { AppError } from "../errors/app-error.js";
import { OrderCatalogModel } from "../models/index.js";

type CatalogInput = z.infer<typeof orderCatalogEntrySchema>;
type OrderDefinitionInput = z.infer<typeof orderDefinitionSchema>;

const serialize = (entry: any) => ({
  id: entry.orderId,
  name: entry.name,
  aliases: entry.aliases ?? [],
  category: entry.category,
  route: entry.route,
  dose: entry.dose,
  frequency: entry.frequency,
  duration: entry.duration,
  priority: entry.priority,
  resultDelayMinutes: entry.defaultResultDelayMinutes,
  active: entry.active,
  updatedAt: entry.updatedAt
});

export const listCatalogOrders = async (query = "", includeInactive = false, limit?: number) => {
  const filter: Record<string, unknown> = includeInactive ? {} : { active: true };
  if (query.trim()) {
    const expression = new RegExp(query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ orderId: expression }, { name: expression }, { aliases: expression }];
  }
  const catalogQuery = OrderCatalogModel.find(filter).sort({ category: 1, name: 1 });
  if (limit) catalogQuery.limit(limit);
  const entries = await catalogQuery.lean();
  return entries.map(serialize);
};

export const getActiveCatalogOrder = async (orderId: string) => {
  const entry = await OrderCatalogModel.findOne({ orderId, active: true }).lean();
  return entry ? serialize(entry) : null;
};

export const createCatalogOrder = async (input: CatalogInput, userId: string) => {
  if (await OrderCatalogModel.exists({ orderId: input.id })) {
    throw new AppError(409, `Order ID '${input.id}' already exists`);
  }
  const entry = await OrderCatalogModel.create({
    orderId: input.id,
    name: input.name,
    aliases: input.aliases,
    category: input.category,
    route: input.route,
    dose: input.dose,
    frequency: input.frequency,
    duration: input.duration,
    priority: input.priority,
    defaultResultDelayMinutes: input.resultDelayMinutes,
    active: input.active,
    createdBy: userId,
    updatedBy: userId
  });
  return serialize(entry);
};

export const updateCatalogOrder = async (orderId: string, input: CatalogInput, userId: string) => {
  if (input.id !== orderId) throw new AppError(400, "Order ID cannot be changed");
  const entry = await OrderCatalogModel.findOneAndUpdate(
    { orderId },
    {
      name: input.name,
      aliases: input.aliases,
      category: input.category,
      route: input.route,
      dose: input.dose,
      frequency: input.frequency,
      duration: input.duration,
      priority: input.priority,
      defaultResultDelayMinutes: input.resultDelayMinutes,
      active: input.active,
      updatedBy: userId
    },
    { new: true, runValidators: true }
  );
  if (!entry) throw new AppError(404, "Catalog order not found");
  return serialize(entry);
};

export const setCatalogOrderActive = async (orderId: string, active: boolean, userId: string) => {
  const entry = await OrderCatalogModel.findOneAndUpdate(
    { orderId },
    { active, updatedBy: userId },
    { new: true }
  );
  if (!entry) throw new AppError(404, "Catalog order not found");
  return serialize(entry);
};

export const ensureCatalogOrders = async (orders: OrderDefinitionInput[], userId?: string) => {
  if (!orders.length) return;
  const actorId = userId ? new Types.ObjectId(userId) : undefined;
  await OrderCatalogModel.bulkWrite(
    orders.map((order) => ({
      updateOne: {
        filter: { orderId: order.id },
        update: {
          $setOnInsert: {
            orderId: order.id,
            name: order.name,
            aliases: order.aliases,
            category: order.category,
            route: order.route,
            dose: order.dose,
            frequency: order.frequency,
            duration: order.duration,
            priority: order.priority,
            defaultResultDelayMinutes: order.resultDelayMinutes,
            active: true,
            createdBy: actorId,
            updatedBy: actorId
          }
        },
        upsert: true
      }
    }))
  );
};

export const resolveCatalogOrders = async (orders: OrderDefinitionInput[]) => {
  const entries = await OrderCatalogModel.find({
    orderId: { $in: orders.map((order) => order.id) },
    active: true
  }).lean();
  const byId = new Map(entries.map((entry) => [entry.orderId, entry]));
  const missing = orders.map((order) => order.id).filter((id) => !byId.has(id));
  if (missing.length) throw new AppError(422, `Inactive or missing catalog orders: ${missing.join(", ")}`);

  return orders.map((order) => {
    const entry = byId.get(order.id)!;
    return {
      id: entry.orderId,
      name: entry.name,
      aliases: entry.aliases ?? [],
      category: entry.category,
      route: entry.route,
      dose: entry.dose,
      frequency: entry.frequency,
      duration: entry.duration,
      priority: entry.priority,
      resultDelayMinutes: entry.defaultResultDelayMinutes
    } as OrderDefinitionInput;
  });
};
