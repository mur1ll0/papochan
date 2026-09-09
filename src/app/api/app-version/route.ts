import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { PLATFORMS_CONFIG, PlatformType, compareSemver } from '@/lib/platform';
import pkg from '../../../../package.json';

export const dynamic = 'force-dynamic';


/**
 * The version actually shipped, taken from the one file the release pipeline
 * already treats as the source of truth. This used to be a hardcoded '1.0.0' per
 * platform, so the endpoint reported "you are up to date" forever no matter how
 * many releases went out - which is exactly what it did after 2.0.0.
 */
const SHIPPED_VERSION: string = pkg.version;

/**
 * Oldest build still allowed to connect. Raise it to force an update when a
 * release breaks compatibility with older clients.
 */
const MIN_SUPPORTED_VERSION: string = process.env.APP_MIN_VERSION?.trim() || '1.0.0';

/** Download URL resolution, shared with the rest of the app (GitHub Releases). */
function downloadUrlFor(platform: string): string {
  const config = PLATFORMS_CONFIG[platform as PlatformType];
  return config?.defaultDownloadUrl || '/downloads/papochan.apk';
}


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
    minVersion: MIN_SUPPORTED_VERSION,
    latestVersion: SHIPPED_VERSION,
    downloadUrl: downloadUrlFor('windows'),
    releaseNotes: 'Aplicativo nativo para Windows com compartilhamento de tela em 60 FPS e E2EE Zero-Knowledge.',
    isMandatory: false,
  },
  android: {
    platform: 'android',
    minVersion: MIN_SUPPORTED_VERSION,
    latestVersion: SHIPPED_VERSION,
    downloadUrl: downloadUrlFor('android'),
    releaseNotes: 'Aplicativo Android com câmera, microfone, supressão de ruído neural e chamadas diretas.',
    isMandatory: false,
  },
  ios: {
    platform: 'ios',
    minVersion: MIN_SUPPORTED_VERSION,
    latestVersion: SHIPPED_VERSION,
    downloadUrl: downloadUrlFor('ios'),
    releaseNotes: 'Aplicativo para iPhone / iPad com WebRTC Mesh e áudio em alta fidelidade.',
    isMandatory: false,
  },
  macos: {
    platform: 'macos',
    minVersion: MIN_SUPPORTED_VERSION,
    latestVersion: SHIPPED_VERSION,
    downloadUrl: downloadUrlFor('macos'),
    releaseNotes: 'Versão nativa para macOS com compartilhamento de tela e áudio interno.',
    isMandatory: false,
  },
  linux: {
    platform: 'linux',
    minVersion: MIN_SUPPORTED_VERSION,
    latestVersion: SHIPPED_VERSION,
    downloadUrl: downloadUrlFor('linux'),
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
        const client = db as unknown as {
          appRelease?: {
            findUnique: (args: { where: { platform: string } }) => Promise<{
              platform: string;
              minVersion: string;
              latestVersion: string;
              downloadUrl: string;
              releaseNotes: string | null;
              isMandatory: boolean;
            } | null>;
          };
        };

        if (client.appRelease) {
          const dbRelease = await client.appRelease.findUnique({
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
      const client = db as unknown as {
        appRelease?: {
          findMany: () => Promise<
            Array<{
              platform: string;
              minVersion: string;
              latestVersion: string;
              downloadUrl: string;
              releaseNotes: string | null;
              isMandatory: boolean;
            }>
          >;
        };
      };

      if (client.appRelease) {
        const dbReleases = await client.appRelease.findMany();
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

    const client = db as unknown as {
      appRelease?: {
        upsert: (args: Record<string, unknown>) => Promise<unknown>;
      };
    };

    if (!client.appRelease) {
      return NextResponse.json(
        { success: false, error: 'Database model AppRelease is not initialized yet' },
        { status: 503 }
      );
    }

    const updated = await client.appRelease.upsert({
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

