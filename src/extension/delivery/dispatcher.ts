/**
 * @file Notification delivery through independent extension adapters.
 */

import type { Disposable } from "vscode";
import type { NotificationRequest } from "../../protocol/notification.js";
import type { DiagnosticCode } from "../diagnostic.js";
import type {
  NotificationDeliveryAdapter,
  NotificationDeliveryTarget,
} from "./adapter.js";
import type { NotificationDeliveryConfig } from "./config.js";

/**
 * Failure isolation across independent notification delivery adapters.
 */
export class NotificationDeliveryDispatcher implements Disposable {
  #adapterList: NotificationDeliveryAdapter[];
  #diagnose: (code: DiagnosticCode) => void;
  #readConfig: () => NotificationDeliveryConfig;
  #readFocus: () => boolean;

  constructor({
    adapterList,
    diagnose,
    readConfig,
    readFocus,
  }: {
    /**
     * Independent delivery channels in registration order.
     */
    adapterList: NotificationDeliveryAdapter[];

    /**
     * Content-free delivery failure reporter.
     */
    diagnose: (code: DiagnosticCode) => void;

    /**
     * Fresh configuration snapshot for each notification.
     */
    readConfig: () => NotificationDeliveryConfig;

    /**
     * Current VS Code window focus state.
     */
    readFocus: () => boolean;
  }) {
    this.#adapterList = adapterList;
    this.#diagnose = diagnose;
    this.#readConfig = readConfig;
    this.#readFocus = readFocus;
  }

  /**
   * Deliver one notification through every eligible adapter.
   */
  deliver = async ({
    notification: request,
    signal,
    target,
  }: {
    notification: NotificationRequest;
    signal: AbortSignal;
    target: NotificationDeliveryTarget;
  }): Promise<void> => {
    const config = this.#readDeliveryConfig();

    if (this.#readFocus() && config.focusSuppression.enable) {
      return;
    }

    const notification = this.#prepareNotification({
      config,
      notification: request,
    });

    for (const adapter of this.#adapterList) {
      if (!adapter.allow(config)) {
        continue;
      }

      await this.#send({
        adapter,
        config,
        notification,
        signal,
        target,
      });
    }
  };

  /**
   * Dispose every delivery adapter.
   */
  dispose = (): void => {
    for (const adapter of this.#adapterList) {
      adapter.dispose();
    }
  };

  #readDeliveryConfig = (): NotificationDeliveryConfig => {
    try {
      return this.#readConfig();
    } catch (error: unknown) {
      this.#diagnose("delivery-configuration-error");
      throw error;
    }
  };

  #prepareNotification = ({
    config: { detail },
    notification,
  }: {
    config: NotificationDeliveryConfig;
    notification: NotificationRequest;
  }): NotificationRequest => ({
    ...notification,
    body:
      !detail.enable || notification.body === null
        ? null
        : this.#sanitizeText(notification.body),
    title: this.#sanitizeText(notification.title),
  });

  #sanitizeText = (value: string): string =>
    value
      .replace(/[\p{Cc}\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]+/gu, " ")
      .replace(/\s+/gu, " ")
      .trim();

  #send = async ({
    adapter,
    config,
    notification,
    signal,
    target,
  }: {
    adapter: NotificationDeliveryAdapter;
    config: NotificationDeliveryConfig;
    notification: NotificationRequest;
    signal: AbortSignal;
    target: NotificationDeliveryTarget;
  }): Promise<void> => {
    try {
      await adapter.deliver({ config, notification, signal, target });
    } catch {
      this.#diagnose("delivery-adapter-error");
    }
  };
}
