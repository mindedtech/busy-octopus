/**
 * @file Expose programmatic notification publishing.
 */

export type { NotificationSource } from "../protocol/notification.js";
export { type NotifyInput, type NotifyResult, notify } from "./notify.js";
