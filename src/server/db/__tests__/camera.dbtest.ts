import { describe, it, expect, beforeEach } from 'vitest';
import { createPrismaPorts } from '../index';
import { getPrisma } from '@/lib/db';
import { createDbContext } from '../context';

describe('camera db repository', () => {
  const prisma = getPrisma();
  const ports = createPrismaPorts(prisma);

  beforeEach(async () => {
    await prisma.participant.deleteMany();
    await prisma.clinic.deleteMany();

    const clinic = await prisma.clinic.create({
      data: { code: 'test-clinic', name: 'Test Clinic' },
    });
    await prisma.participant.create({
      data: { id: 'pt-1', clinicId: clinic.id, label: 'Pt 1', source: 'live' },
    });
  });

  it('saves and reads camera readings', async () => {
    await ports.camera!.saveCameraReading({
      participantId: 'pt-1',
      date: '2026-11-15',
      durationSec: 20.5,
      effectiveFps: 30,
      faceDetectedRatio: 1.0,
      expressivityScore: 0.123,
      smileFraction: 0.05,
      yawSdDeg: 2.1,
      pitchSdDeg: 1.5,
      angularPathDegPerMin: 120,
    });

    const readings = await ports.camera!.getCameraReadings('pt-1');
    expect(readings.length).toBe(1);
    expect(readings[0].durationSec).toBe(20.5);
    expect(readings[0].expressivityScore).toBe(0.123);
  });
});
