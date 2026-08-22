import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { PLATFORMS_CONFIG, PlatformType, compareSemver } from '@/lib/platform';

export const dynamic = 'force-dynamic';

interface DefaultReleaseInfo {
  platform: PlatformType;
  minVersion: string;
  latestVersion: string;
  downloadUrl: string;
  releaseNotes: string;
  isMandatory: boolean;
}

const DEFAULT_RELEASES: Record<PlatformType, DefaultReleaseInfo> = {
  windows: {
    platform: 'windows',
    minVersion: '1.0.0',
    latestVersion: '1.0.0',
    downloadUrl: process.env.NEXT_PUBLIC_DOWNLOAD_WINDOWS || '/downloads/papochan-setup.exe',
    releaseNotes: 'Versão inicial do PapoChan para Windows com suporte a 60 FPS e Zero-Knowledge E2EE.',
    isMandatory: false,
  },
  android: {
    platform: 'android',
    minVersion: '1.0.0',
    latestVersion: '1.0.0',
    downloadUrl: process.env.NEXT_PUBLIC_DOWNLOAD_ANDROID || '/downloads/papochan.apk',
    releaseNotes: 'Versão inicial do PapoChan para Android com supressão de ruído por IA e chamadas diretas.',
    isMandatory: false,
  },
  ios: {
    platform: 'ios',
    minVersion: '1.0.0',
    latestVersion: '1.0.0',
    downloadUrl: process.env.NEXT_PUBLIC_DOWNLOAD_IOS || '/downloads/papochan.ipa',
    releaseNotes: 'Versão inicial do PapoChan para iPhone / iPad com WebRTC Mesh e áudio em alta fidelidade.',
    isMandatory: false,
  },
  macos: {
    platform: 'macos',
    minVersion: '1.0.0',
    latestVersion: '1.0.0',
    downloadUrl: process.env.NEXT_PUBLIC_DOWNLOAD_MACOS || '/downloads/papochan.dmg',
    releaseNotes: 'Versão nativa para macOS com compartilhamento de tela e áudio interno.',
    isMandatory: false,
  },
  linux: {
    platform: 'linux',
    minVersion: '1.0.0',
    latestVersion: '1.0.0',
    downloadUrl: process.env.NEXT_PUBLIC_DOWNLOAD_LINUX || '/downloads/papochan.AppImage',
    releaseNotes: 'Versão Linux AppImage portátil com criptografia ponta a ponta.',
    isMandatory: false,
  },
  web: {
    platform: 'web',
    minVersion: '1.0.0',
    latestVersion: '1.0.0',
    downloadUrl: '',
    releaseNotes: 'Web Client atualizado automaticamente.',
    isMandatory: false,
  },
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const platform = (searchParams.get('platform')?.toLowerCase() || '') as PlatformType;
    const clientVersion = searchParams.get('clientVersion') || '';

    // If platform is requested
    if (platform && platform in DEFAULT_RELEASES) {
      let release = DEFAULT_RELEASES[platform];

      try {
        const dbRelease = await db.appRelease.findUnique({
          where: { platform },
        });

        if (dbRelease) {
          release = {
            platform: dbRelease.platform as PlatformType,
            minVersion: dbRelease.minVersion,
            latestVersion: dbRelease.latestVersion,
            downloadUrl: dbRelease.downloadUrl || release.downloadUrl,
            releaseNotes: dbRelease.releaseNotes || release.releaseNotes,
            isMandatory: dbRelease.isMandatory,
          };
        }
      } catch (dbError) {
        console.warn('[app-version API] Database query fallback to default:', dbError);
      }

      let isOutdated = false;
      let isUnsupported = false;
      let needsUpdate = false;
      let isMandatory = release.isMandatory;

      if (clientVersion) {
        // Compare with latest
        if (compareSemver(clientVersion, release.latestVersion) < 0) {
          isOutdated = true;
          needsUpdate = true;
        }
        // Compare with min required version
        if (compareSemver(clientVersion, release.minVersion) < 0) {
          isUnsupported = true;
          needsUpdate = true;
          isMandatory = true; // Minimum version violation forces mandatory update
        }
      }

      return NextResponse.json({
        success: true,
        platform,
        clientVersion: clientVersion || null,
        minVersion: release.minVersion,
        latestVersion: release.latestVersion,
        downloadUrl: release.downloadUrl,
        releaseNotes: release.releaseNotes,
        isMandatory,
        needsUpdate,
        isOutdated,
        isUnsupported,
      });
    }

    // Return all platforms
    let allReleases = { ...DEFAULT_RELEASES };
    try {
      const dbReleases = await db.appRelease.findMany();
      for (const r of dbReleases) {
        const p = r.platform as PlatformType;
        if (p in allReleases) {
          allReleases[p] = {
            platform: p,
            minVersion: r.minVersion,
            latestVersion: r.latestVersion,
            downloadUrl: r.downloadUrl || allReleases[p].downloadUrl,
            releaseNotes: r.releaseNotes || allReleases[p].releaseNotes,
            isMandatory: r.isMandatory,
          };
        }
      }
    } catch (dbError) {
      console.warn('[app-version API] DB findMany fallback to static config:', dbError);
    }

    return NextResponse.json({
      success: true,
      releases: allReleases,
    });
  } catch (error) {
    console.error('[app-version API] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      platform,
      minVersion,
      latestVersion,
      downloadUrl,
      releaseNotes,
      isMandatory,
      secret,
    } = body;

    // Optional simple security token check
    const expectedSecret = process.env.APP_RELEASE_SECRET;
    if (expectedSecret && secret !== expectedSecret) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!platform || !latestVersion || !downloadUrl) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields (platform, latestVersion, downloadUrl)' },
        { status: 400 }
      );
    }

    const updated = await db.appRelease.upsert({
      where: { platform },
      create: {
        platform,
        minVersion: minVersion || latestVersion,
        latestVersion,
        downloadUrl,
        releaseNotes: releaseNotes || '',
        isMandatory: Boolean(isMandatory),
      },
      update: {
        minVersion: minVersion || undefined,
        latestVersion,
        downloadUrl,
        releaseNotes: releaseNotes || undefined,
        isMandatory: isMandatory !== undefined ? Boolean(isMandatory) : undefined,
      },
    });

    return NextResponse.json({ success: true, release: updated });
  } catch (error) {
    console.error('[app-version API POST] Error saving release:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update release configuration' },
      { status: 500 }
    );
  }
}
