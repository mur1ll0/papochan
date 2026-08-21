import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId,
      username,
      displayName,
      deviceId,
      deviceName,
      deviceType,
      publicKeyEd,
      publicKeyDh,
    } = body;

    if (!userId || !deviceId || !publicKeyEd || !publicKeyDh) {
      return NextResponse.json(
        { error: 'Missing mandatory zero-knowledge registration fields' },
        { status: 400 }
      );
    }

    try {
      // Upsert User
      const user = await db.user.upsert({
        where: { id: userId },
        update: {
          username: username || `user_${userId.slice(0, 8)}`,
          displayName: displayName || username || `User ${userId.slice(0, 4)}`,
        },
        create: {
          id: userId,
          username: username || `user_${userId.slice(0, 8)}`,
          displayName: displayName || username || `User ${userId.slice(0, 4)}`,
        },
      });

      // Upsert Device
      const device = await db.device.upsert({
        where: { id: deviceId },
        update: {
          deviceName: deviceName || 'Device',
          deviceType: deviceType || 'browser',
          publicKeyEd,
          publicKeyDh,
          lastSeen: new Date(),
        },
        create: {
          id: deviceId,
          userId: user.id,
          deviceName: deviceName || 'Device',
          deviceType: deviceType || 'browser',
          publicKeyEd,
          publicKeyDh,
        },
      });

      return NextResponse.json({
        success: true,
        user: { id: user.id, username: user.username },
        device: { id: device.id, deviceName: device.deviceName },
      });
    } catch (dbError: any) {
      // If DB is offline or not provisioned in dev mode, return safe zero-knowledge fallback
      console.warn('[API:auth/device] DB unavailable, continuing with client-side zero-knowledge mode:', dbError?.message);
      return NextResponse.json({
        success: true,
        offlineMode: true,
        user: { id: userId, username },
        device: { id: deviceId, deviceName },
      });
    }
  } catch (error: any) {
    console.error('[API:auth/device] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error during device registration' },
      { status: 500 }
    );
  }
}
