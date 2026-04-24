import { useGameStore } from '../store/gameStore';
import React, { useState, useEffect, useRef } from 'react';
import { networkManager } from '../game/NetworkManager';

interface ChatMessage {
  sender: string;
  message: string;
}

export const ChatUI = React.memo(function ChatUI({ isLocked, isTyping, setIsTyping }: { isLocked: boolean, isTyping: boolean, setIsTyping: (v: boolean) => void }) {
  const messages = useGameStore(state => state.chatMessages);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Handle focus when typing starts
  useEffect(() => {
    if (isTyping) {
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isTyping]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const val = inputValue.trim();
      if (val) {
        if (val.startsWith('/server ')) {
          const target = val.split(' ')[1];
          if (target === 'hub' || target === 'skybridge' || target === 'skycastles' || target === 'voidtrail') {
             window.location.href = `/?server=${target}`;
          } else {
             useGameStore.getState().addChatMessage('System', `§cUnknown server: ${target}`);
          }
        } else {
          networkManager.sendChatMessage(val);
        }
        setInputValue('');
      }
      setIsTyping(false);
    } else if (e.key === 'Escape') {
      setIsTyping(false);
    }
  };

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div 
      className="absolute bottom-24 left-4 w-80 flex flex-col gap-2 pointer-events-none z-40"
      onClick={(e) => e.stopPropagation()}
    >
      <div 
        ref={chatContainerRef}
        className="max-h-64 overflow-y-auto flex flex-col justify-end gap-0.5"
        style={{ scrollbarWidth: 'none' }}
      >
        {messages.map((msg, i) => (
          <div key={i} className="text-[14px] text-white drop-shadow-[1px_1px_0_rgba(0,0,0,1)] bg-black/0 px-1 py-0.5 rounded w-fit max-w-full break-words font-sans">
            <span className="font-bold text-[#FFFF55]">{msg.sender}: </span>
            <span>{msg.message}</span>
          </div>
        ))}
      </div>
      
      {isTyping && (
        <div className="pointer-events-auto bg-black/50 p-1 flex items-center border border-white/10">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleInputKeyDown}
            className="bg-transparent text-white outline-none w-full font-sans text-[14px]"
            placeholder=""
            maxLength={100}
            onBlur={() => {
              // Small delay to allow Enter key to process before unmounting
              setTimeout(() => setIsTyping(false), 100);
            }}
          />
        </div>
      )}
      {!isTyping && !isLocked && (
        <div className="text-xs text-white/50 drop-shadow-md">Press Enter to chat</div>
      )}
    </div>
  );
});
