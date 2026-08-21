'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Send,
  Paperclip,
  ShieldAlert,
  Trash2,
  FileText,
  CheckCircle2,
  Download,
  Flame,
} from 'lucide-react';
import {
  ChatTextMessage,
  TypingIndicator,
  FileTransferMeta,
} from '@/core/webrtc/DataChannel';
import { formatBytes, formatTimestamp, cn } from '@/lib/utils';

export interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatTextMessage[];
  typingUsers: TypingIndicator[];
  fileTransfers: FileTransferMeta[];
  localUserId: string;
  onSendMessage: (text: string) => Promise<any>;
  onSendTyping: (isTyping: boolean) => void;
  onSendFile: (file: File) => Promise<any>;
  onClearMemory: () => void;
}

export function ChatPanel({
  isOpen,
  onClose,
  messages,
  typingUsers,
  fileTransfers,
  localUserId,
  onSendMessage,
  onSendTyping,
  onSendFile,
  onClearMemory,
}: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, fileTransfers]);

  if (!isOpen) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);

    // Broadcast typing indicator
    onSendTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onSendTyping(false);
    }, 1500);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const text = inputValue;
    setInputValue('');
    onSendTyping(false);
    await onSendMessage(text);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      onSendFile(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      onSendFile(file);
      e.target.value = '';
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleFileDrop}
      className="fixed inset-y-0 right-0 w-full sm:w-96 bg-tactical-950/95 backdrop-blur-2xl border-l border-tactical-800 flex flex-col z-40 shadow-2xl transition-all"
    >
      {/* Panel Header */}
      <div className="p-4 border-b border-tactical-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wider">
            Zero-Knowledge Chat
          </h3>
        </div>

        <div className="flex items-center gap-1">
          {/* Self-Destruct / Memory Wipe */}
          <button
            onClick={onClearMemory}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-tactical-900 transition-colors"
            title="Wipe In-Memory Messages"
          >
            <Flame className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-tactical-900 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Security Assurance Banner */}
      <div className="mx-3 mt-3 p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/20 flex items-start gap-2 text-xs text-emerald-300">
        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
        <span>
          <strong>Zero-Knowledge Memory-Only:</strong> Messages and files are encrypted via AES-256-GCM directly between peers and never saved to any database.
        </span>
      </div>

      {/* Drag & Drop Overlay */}
      {isDragging && (
        <div className="absolute inset-4 rounded-xl border-2 border-dashed border-cipher-cyan bg-tactical-950/90 flex flex-col items-center justify-center z-50 pointer-events-none">
          <Paperclip className="w-10 h-10 text-cipher-cyan animate-bounce" />
          <p className="mt-2 text-sm font-mono text-cipher-cyan">Drop file to stream E2EE</p>
        </div>
      )}

      {/* Message List */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 min-h-0">
        {messages.length === 0 && fileTransfers.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 text-xs font-mono p-6">
            <p>End-to-End Encrypted Data Channel established.</p>
            <p className="mt-1">Drop a file or type a message to start.</p>
          </div>
        )}

        {/* Text Messages */}
        {messages.map((msg) => {
          const isMe = msg.senderId.startsWith(localUserId);
          return (
            <div
              key={msg.id}
              className={cn('flex flex-col text-xs', isMe ? 'items-end' : 'items-start')}
            >
              <div className="flex items-center gap-1.5 mb-1 text-[11px] text-slate-400 font-mono">
                <span className="font-semibold text-slate-300">{msg.senderName}</span>
                <span>•</span>
                <span>{formatTimestamp(msg.timestamp)}</span>
              </div>
              <div
                className={cn(
                  'p-3 rounded-2xl max-w-[85%] break-words shadow-sm font-sans text-sm',
                  isMe
                    ? 'bg-emerald-600/90 text-white rounded-br-none'
                    : 'bg-tactical-850 border border-tactical-700 text-slate-200 rounded-bl-none'
                )}
              >
                {msg.text}
              </div>
            </div>
          );
        })}

        {/* File Transfer Cards */}
        {fileTransfers.map((file) => (
          <div
            key={file.fileId}
            className="p-3 rounded-xl bg-tactical-900 border border-tactical-700/80 shadow-md flex flex-col gap-2 text-xs"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 truncate">
                <FileText className="w-5 h-5 text-cyan-400 shrink-0" />
                <div className="truncate">
                  <div className="font-medium text-slate-200 truncate">{file.fileName}</div>
                  <div className="text-[11px] font-mono text-slate-400">
                    {formatBytes(file.fileSize)}
                  </div>
                </div>
              </div>
              {file.progress === 100 && file.blobUrl && (
                <a
                  href={file.blobUrl}
                  download={file.fileName}
                  className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                  title="Download File"
                >
                  <Download className="w-4 h-4" />
                </a>
              )}
            </div>

            {/* Progress Bar */}
            {file.progress < 100 ? (
              <div className="w-full bg-tactical-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-cipher-cyan h-full transition-all duration-150"
                  style={{ width: `${file.progress}%` }}
                />
              </div>
            ) : (
              <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>SHA-256 Verified E2EE</span>
              </div>
            )}
          </div>
        ))}

        {/* Typing Indicators */}
        {typingUsers.length > 0 && (
          <div className="text-xs text-slate-400 italic flex items-center gap-1.5 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            {typingUsers.map((u) => u.senderName).join(', ')} is typing...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-3 border-t border-tactical-800 bg-tactical-950">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInputChange}
          className="hidden"
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-xl bg-tactical-900 border border-tactical-700 text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
            title="Attach file"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder="Type encrypted message..."
            className="flex-1 bg-tactical-900 border border-tactical-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />

          <button
            type="submit"
            disabled={!inputValue.trim()}
            className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
