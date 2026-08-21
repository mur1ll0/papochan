<div align="center">

  <img src="public/brand/papochan-logo-horizontal.svg" alt="PapoChan Logo" width="380" />

  <p align="center">
    <strong>Zero-Knowledge, Multi-Device Co-Presence Real-Time Communication Platform</strong>
  </p>

  <p align="center">
    <img src="https://img.shields.io/badge/Next.js-15.5-black?style=for-the-badge&logo=next.js" alt="Next.js 15" />
    <img src="https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript" alt="TypeScript" />
    <img src="https://img.shields.io/badge/WebRTC-Mesh%20Topology-orange?style=for-the-badge&logo=webrtc" alt="WebRTC" />
    <img src="https://img.shields.io/badge/Web%20Crypto-E2EE%20AES--256--GCM-emerald?style=for-the-badge" alt="E2EE" />
    <img src="https://img.shields.io/badge/i18n-EN%20%7C%20PT--BR-cyan?style=for-the-badge" alt="i18n" />
  </p>

</div>

---

## 🦎 About PapoChan

**PapoChan** is a modern, ultra-secure, peer-to-peer (P2P) video conferencing and real-time communication platform built with an uncompromising focus on **Zero-Knowledge privacy**, **End-to-End Encryption (E2EE)**, and first-class support for **Multi-Device Co-Presence** (allowing you to connect your phone and computer into the same room simultaneously without session conflicts).

Featuring a distinctive chameleon mascot and vibrant brand palette (*Papo Coral* `#F47151` and *Chan Turquoise* `#5C9AA7`), PapoChan delivers on-device AI-powered neural noise suppression, high-fidelity 60 FPS screen sharing with system audio, trusted contacts with instant direct dialing, and full bilingual internationalization.

---

## 🌟 Key Features

### 🔒 1. Zero-Knowledge Cryptography & Hardware Security
- **Locally Generated Key Pairs**: Asymmetric **Ed25519** (digital signatures preventing MITM attacks) and **X25519** (Diffie-Hellman key exchange via ECDH) key pairs generated directly on your hardware and safely isolated in browser `IndexedDB`.
- **Complete End-to-End Encryption**:
  - Voice and video streams are hardware-encrypted in transit with **DTLS-SRTP**.
  - Chat messages and file transfers are encrypted with **AES-256-GCM** using unique 96-bit IVs and verified with **SHA-256** checksum digests.
- **Volatile In-Memory Chat**: Messages and files are never persisted to any database and are purged immediately when leaving the room or via the panic button (*wipe memory*).
- **Safety Numbers**: Visual cryptographic fingerprint inspection to verify the identity of other participants in the room.

### 📱💻 2. Simultaneous Multi-Device Co-Presence
- A single authenticated user identity (`userId`) can join the same room across multiple devices at once:
  - **Smartphone / Tablet**: Used for front/rear camera capture and close-proximity voice microphone.
  - **Computer / Laptop**: Used simultaneously for high-frame-rate **60 FPS screen sharing with internal system audio**.
- The `MeshManager` engine orchestrates each hardware instance independently via composite `userId:deviceId` addressing, displaying sister instance badges without session takeover conflicts.

### 🎙️ 3. On-Device AI Noise Suppression & Acoustic Diagnostics
- **Neural Spectral Filter**: Eliminates keyboard clicks, fans, ambient noise, and background chatter directly in the browser with zero audio telemetry sent to external servers.
- **Real-Time RMS Meters**: Live audio level meters in decibels (dB) with dynamic clipping and distortion detection.

### 📞 4. Trusted Contacts & Direct Calling
- Save verified devices and contacts into your local encrypted vault with custom aliases.
- Place instant peer-to-peer direct calls with ringing tones, incoming/outgoing call popups, and auto-connection without needing manual room codes.

### 🌐 5. Native Internationalization (i18n)
- Seamless bilingual support for **English (US)** 🇺🇸 and **Português (Brasil)** 🇧🇷 with instant hot-switching from the navigation bar and in-call settings.

---

## 🏗️ Architecture Overview

```mermaid
graph TB
    subgraph ClientBrowser["Client Browser (User Device)"]
        direction TB
        subgraph SecurityCrypto["Zero-Knowledge Crypto Core"]
            KeyStore["IndexedDB Vault (Private Keys)"]
            SubtleCrypto["Native Web Crypto API"]
            KeyGen["KeyGen: Ed25519 + X25519"]
            AESCipher["AES-256-GCM + HKDF-SHA256"]
        end

        subgraph WebRTCEngine["P2P Media & Data Layer"]
            MediaEng["MediaEngine: Cam, Mic, AI Noise & 60FPS Screen"]
            DataChan["DataChannel: E2EE Chat & File Streams"]
            PeerConn["RTCPeerConnection (Perfect Negotiation)"]
            MeshMgr["MeshManager (Multi-Device Co-Presence)"]
        end

        subgraph UILayer["Next.js 15 UI Layer (App Router + Tailwind CSS)"]
            HomePage["Homepage (Centered Hero & Contacts)"]
            LobbyModal["Lobby / Device Setup & AI Tuning"]
            RoomPage["Call Room (Stage & Dynamic Video Grid)"]
            ChatPanel["E2EE Chat & File Transfer Sidebar"]
        end
    end

    subgraph SignalingBackend["Ephemeral Signaling & Database"]
        Ably["Ably Realtime (Ephemeral Pub/Sub Channels)"]
        NextAPI["Next.js API Routes (/api/rooms, /api/signaling-token)"]
        PrismaDB[("Neon Serverless PostgreSQL (Public Metadata Only)")]
    end

    KeyGen --> KeyStore
    KeyStore --> SubtleCrypto
    SubtleCrypto --> AESCipher
    AESCipher <--> DataChan
    MediaEng --> PeerConn
    PeerConn <--> MeshMgr
    MeshMgr <--> Ably
    NextAPI <--> PrismaDB
    NextAPI --> Ably
    HomePage --> LobbyModal
    LobbyModal --> RoomPage
    RoomPage --> MeshMgr
    RoomPage --> ChatPanel
```

---

## 📂 Directory Structure

```
papochan/
├── public/
│   ├── brand/               # Official vector brand assets (mascot, wordmarks, app icons, presentation sheet)
│   │   ├── papochan-chameleon-dark.svg
│   │   ├── papochan-wordmark-white.svg
│   │   ├── papochan-logo-horizontal.svg
│   │   ├── papochan-app-icon.svg
│   │   ├── papochan-brand-presentation.svg
│   │   ├── preview.html     # Interactive in-browser SVG showcase
│   │   └── source/          # Original master vector files
│   ├── favicon.svg
│   ├── icon.svg
│   └── sounds/              # Audio assets (ringtone, call alerts)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/device/       # Device public key registration & heartbeat
│   │   │   ├── rooms/             # Room creation and code lookup
│   │   │   └── signaling-token/   # Ephemeral signaling token generator
│   │   ├── room/[code]/page.tsx   # Video conference room with stage and grid
│   │   ├── page.tsx               # Centered hero landing page & contact vault
│   │   ├── layout.tsx             # Global layout with i18n & crypto providers
│   │   └── globals.css            # Dark theme styles and animations
│   ├── components/
│   │   ├── auth/                  # DeviceSetupModal (Pre-join lobby) and SecurityModal
│   │   ├── brand/                 # ChameleonLogo, PapoChanWordmark, LanguageSwitcher
│   │   ├── call/                  # ControlBar, VideoGrid, VideoTile, ScreenShareModal
│   │   ├── chat/                  # ChatPanel (E2EE chat and file streaming)
│   │   └── contacts/              # ContactsList, SaveContactModal
│   ├── core/
│   │   ├── crypto/                # keygen.ts, cipher.ts, storage.ts (IndexedDB)
│   │   ├── signaling/             # SignalingClient.ts, AblySignaler.ts
│   │   └── webrtc/                # PeerConnection.ts, MeshManager.ts, MediaEngine.ts,
│   │                              # NoiseSuppressionEngine.ts, AudioDiagnostics.ts, DataChannel.ts
│   ├── hooks/                     # useCrypto.ts, useDirectCalls.ts, useMediaDevices.ts, useWebRTC.ts
│   ├── i18n/                      # translations.ts (pt-BR / en) and context.tsx
│   └── lib/                       # db.ts (Prisma), ably.ts, api.ts, utils.ts
└── prisma/
    └── schema.prisma              # Database schema (Device and Room entities)
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: Version 18.x or higher
- **npm** or **pnpm**
- An [Ably Realtime](https://ably.com/) account (free tier available)

### 1. Clone Repository & Install Dependencies
```bash
git clone https://github.com/your-username/papochan.git
cd papochan
npm install
```

### 2. Configure Environment Variables
Copy the example environment file:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:
```env
# Ably Realtime for WebRTC Ephemeral Signaling
ABLY_API_KEY="your_ably_api_key_here"

# PostgreSQL Connection (Neon Serverless / Supabase / Local)
POSTGRES_PRISMA_URL="postgresql://user:password@localhost:5432/papochan?schema=public"
POSTGRES_URL_NON_POOLING="postgresql://user:password@localhost:5432/papochan?schema=public"

# Public Application URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 3. Generate Database Client & Push Schema
```bash
npx prisma generate
npx prisma db push
```

### 4. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📦 Build & Production Verification

To verify TypeScript types and create an optimized production build:

```bash
# Type check TypeScript codebase
npx tsc --noEmit

# Compile Next.js production bundle
npm run build

# Start production server
npm run start
```

---

## 🎨 Brand Colors & Visual Identity

| Color Name | Hex Code | Primary Usage |
| :--- | :--- | :--- |
| **Papo Coral** | `#F47151` | Primary action buttons, brand accents, and app icon background |
| **Chan Turquoise** | `#5C9AA7` | Secondary buttons, contact tabs, and selection highlights |
| **Stealth Emerald** | `#10B981` | Active E2EE encryption badges, audio meters, and status pills |
| **Dark Slate** | `#020617` | Primary dark theme background (`bg-slate-950`) |
| **Pure White** | `#FFFFFF` | Vector chameleon contours and stylized wordmark in dark mode |

---

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for more information.
