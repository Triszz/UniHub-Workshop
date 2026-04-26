export interface NotificationPayload {
  type: string;
  userId: string;
  payload: Record<string, any>;
}

export interface NotificationChannel {
  name: string;
  send(notification: NotificationPayload): Promise<void>;
}
