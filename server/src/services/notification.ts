import prisma from "../config/database";

export const createNotification = async (
  userId: string,
  title: string,
  message: string,
  type: string = "system",
  linkUrl?: string
) => {
  return prisma.notification.create({
    data: { userId, title, message, type, linkUrl },
  });
};

export const createBulkNotification = async (
  userIds: string[],
  title: string,
  message: string,
  type: string = "system",
  sentById?: string
) => {
  return prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      title,
      message,
      type,
      sentById,
    })),
  });
};

export const logActivity = async (
  userId: string,
  action: string,
  entity: string,
  entityId?: string,
  metadata?: any,
  ipAddress?: string,
  userAgent?: string
) => {
  return prisma.activityLog.create({
    data: { userId, action, entity, entityId, metadata, ipAddress, userAgent },
  });
};
