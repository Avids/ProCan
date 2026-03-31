import { prisma } from './db';

type Action = 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE';

export const logActivity = async (
  userId: string,
  action: Action,
  entityType: string,
  entityId: string,
  oldValues?: object | null,
  newValues?: object | null
): Promise<void> => {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        oldValues: oldValues ?? undefined,
        newValues: newValues ?? undefined,
      },
    });
  } catch (err) {
    // Log but don't block the main operation
    console.error('[ActivityLogger] Failed to write audit log:', err);
  }
};
