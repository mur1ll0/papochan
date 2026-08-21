'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import * as Ably from 'ably';
import { decodeBase64 } from 'tweetnacl-util';
import {
  SerializedIdentity,
  TrustedContact,
  getTrustedContacts,
  saveTrustedContact,
  deleteTrustedContact,
  updateContactAlias,
} from '@/core/crypto/storage';
import { signPayload, verifySignature } from '@/core/crypto/keygen';
import { generateRoomCode } from '@/lib/utils';
import { getApiEndpoint } from '@/lib/api';
import { RingtoneSynthesizer } from '@/core/audio/RingtoneSynthesizer';

export interface IncomingCallInfo {
  callId: string;
  roomCode: string;
  callerUserId: string;
  callerDeviceId: string;
  callerDeviceName: string;
  callerUsername: string;
  callerPublicKeyEd: string;
  callerPublicKeyDh: string;
  callerAlias?: string;
  timestamp: number;
}

export interface OutgoingCallInfo {
  callId: string;
  roomCode: string;
  contact: TrustedContact;
  status: 'dialing' | 'ringing' | 'rejected' | 'busy' | 'timeout';
  startedAt: number;
}

export function useDirectCalls(identity: SerializedIdentity | null) {
  const router = useRouter();
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [incomingCall, setIncomingCall] = useState<IncomingCallInfo | null>(null);
  const [outgoingCall, setOutgoingCall] = useState<OutgoingCallInfo | null>(null);

  const ablyClientRef = useRef<Ably.Realtime | null>(null);
  const inboxChannelRef = useRef<Ably.RealtimeChannel | null>(null);
  const callTimeoutRef = useRef<any>(null);

  const refreshContacts = useCallback(async () => {
    const list = await getTrustedContacts();
    setContacts(list);
  }, []);

  // Load contacts on mount
  useEffect(() => {
    refreshContacts();
  }, [refreshContacts]);

  // Subscribe to personal device inbox channel for incoming calls
  useEffect(() => {
    if (!identity) return;
    const currentIdentity = identity;

    let isMounted = true;
    const inboxChannelName = `inbox:${currentIdentity.deviceId}`;

    async function initInbox() {
      try {
        const client = new Ably.Realtime({
          authUrl: getApiEndpoint('/api/signaling-token'),
          authParams: {
            deviceId: currentIdentity.deviceId,
            userId: currentIdentity.userId,
            username: currentIdentity.username,
            roomCode: 'inbox',
          },
          autoConnect: true,
        });

        ablyClientRef.current = client;
        const channel = client.channels.get(inboxChannelName);
        inboxChannelRef.current = channel;

        await channel.subscribe('direct-call', async (message: Ably.Message) => {
          if (!isMounted) return;
          const payload = message.data;
          if (!payload) return;

          const { type, callId, roomCode, callerMeta, signature, timestamp } = payload;

          if (type === 'call-invite') {
            // Verify digital signature of caller
            const isValid = verifySignature(
              JSON.stringify({ callId, roomCode, timestamp }),
              signature,
              callerMeta.publicKeyEd
            );

            if (!isValid) {
              console.warn('[DirectCalls] Dropped call with invalid Ed25519 signature');
              return;
            }

            // Check if caller is saved in our contacts vault
            const currentContacts = await getTrustedContacts();
            const matched = currentContacts.find(
              (c) => c.deviceId === callerMeta.deviceId || c.userId === callerMeta.userId
            );

            RingtoneSynthesizer.startIncomingRingtone();

            setIncomingCall({
              callId,
              roomCode,
              callerUserId: callerMeta.userId,
              callerDeviceId: callerMeta.deviceId,
              callerDeviceName: callerMeta.deviceName,
              callerUsername: callerMeta.username,
              callerPublicKeyEd: callerMeta.publicKeyEd,
              callerPublicKeyDh: callerMeta.publicKeyDh,
              callerAlias: matched?.alias,
              timestamp,
            });
          } else if (type === 'call-accept') {
            // Callee accepted our outgoing call!
            RingtoneSynthesizer.stop();
            if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
            setOutgoingCall(null);
            router.push(`/room/${roomCode}`);
          } else if (type === 'call-reject') {
            RingtoneSynthesizer.stop();
            if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
            setOutgoingCall((prev) => (prev ? { ...prev, status: 'rejected' } : null));
            setTimeout(() => setOutgoingCall(null), 2500);
          } else if (type === 'call-cancel') {
            // Caller hung up before answer
            RingtoneSynthesizer.stop();
            setIncomingCall((current) => (current?.callId === callId ? null : current));
          }
        });
      } catch (err) {
        console.warn('[DirectCalls] Inbox subscription error:', err);
      }
    }

    initInbox();

    return () => {
      isMounted = false;
      RingtoneSynthesizer.stop();
      if (inboxChannelRef.current) {
        inboxChannelRef.current.unsubscribe();
      }
      if (ablyClientRef.current) {
        ablyClientRef.current.close();
      }
    };
  }, [identity, router]);

  // Initiate outgoing direct call to a contact
  const callContact = useCallback(
    async (contact: TrustedContact) => {
      if (!identity || !ablyClientRef.current) return;

      const callId = crypto.randomUUID();
      const roomCode = generateRoomCode();
      const timestamp = Date.now();

      const secretKeyEd = decodeBase64(identity.privateKeyEd);
      const signature = signPayload(
        JSON.stringify({ callId, roomCode, timestamp }),
        secretKeyEd
      );

      const recipientInbox = ablyClientRef.current.channels.get(`inbox:${contact.deviceId}`);

      RingtoneSynthesizer.startOutgoingDialTone();

      setOutgoingCall({
        callId,
        roomCode,
        contact,
        status: 'ringing',
        startedAt: timestamp,
      });

      // Send call invite to recipient's private inbox channel
      await recipientInbox.publish('direct-call', {
        type: 'call-invite',
        callId,
        roomCode,
        timestamp,
        signature,
        callerMeta: {
          userId: identity.userId,
          deviceId: identity.deviceId,
          deviceName: identity.deviceName,
          username: identity.username,
          publicKeyEd: identity.publicKeyEd,
          publicKeyDh: identity.publicKeyDh,
        },
      });

      // Update contact's last called timestamp
      contact.lastCalledAt = Date.now();
      await saveTrustedContact(contact);
      refreshContacts();

      // 45s Timeout
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = setTimeout(() => {
        RingtoneSynthesizer.stop();
        setOutgoingCall((prev) => (prev ? { ...prev, status: 'timeout' } : null));
        setTimeout(() => setOutgoingCall(null), 3000);
      }, 45000);
    },
    [identity, refreshContacts]
  );

  // Accept incoming call
  const acceptIncomingCall = useCallback(async () => {
    if (!incomingCall || !ablyClientRef.current) return;

    RingtoneSynthesizer.stop();

    // Notify caller that we accepted
    const callerInbox = ablyClientRef.current.channels.get(`inbox:${incomingCall.callerDeviceId}`);
    await callerInbox.publish('direct-call', {
      type: 'call-accept',
      callId: incomingCall.callId,
      roomCode: incomingCall.roomCode,
    });

    const destinationRoom = incomingCall.roomCode;
    setIncomingCall(null);
    router.push(`/room/${destinationRoom}`);
  }, [incomingCall, router]);

  // Reject incoming call
  const rejectIncomingCall = useCallback(async () => {
    if (!incomingCall || !ablyClientRef.current) return;

    RingtoneSynthesizer.stop();

    const callerInbox = ablyClientRef.current.channels.get(`inbox:${incomingCall.callerDeviceId}`);
    await callerInbox.publish('direct-call', {
      type: 'call-reject',
      callId: incomingCall.callId,
      roomCode: incomingCall.roomCode,
    });

    setIncomingCall(null);
  }, [incomingCall]);

  // Cancel outgoing call
  const cancelOutgoingCall = useCallback(async () => {
    if (!outgoingCall || !ablyClientRef.current) return;

    RingtoneSynthesizer.stop();
    if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);

    const recipientInbox = ablyClientRef.current.channels.get(`inbox:${outgoingCall.contact.deviceId}`);
    await recipientInbox.publish('direct-call', {
      type: 'call-cancel',
      callId: outgoingCall.callId,
      roomCode: outgoingCall.roomCode,
    });

    setOutgoingCall(null);
  }, [outgoingCall]);

  // Contact management methods
  const saveContact = useCallback(
    async (contact: TrustedContact) => {
      await saveTrustedContact(contact);
      await refreshContacts();
    },
    [refreshContacts]
  );

  const deleteContact = useCallback(
    async (id: string) => {
      await deleteTrustedContact(id);
      await refreshContacts();
    },
    [refreshContacts]
  );

  const updateAlias = useCallback(
    async (id: string, newAlias: string) => {
      await updateContactAlias(id, newAlias);
      await refreshContacts();
    },
    [refreshContacts]
  );

  return {
    contacts,
    incomingCall,
    outgoingCall,
    callContact,
    acceptIncomingCall,
    rejectIncomingCall,
    cancelOutgoingCall,
    saveContact,
    deleteContact,
    updateAlias,
    refreshContacts,
  };
}
