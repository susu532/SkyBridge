import { useGameStore } from '../store/gameStore';
import React, { useState, useEffect, useRef } from 'react';
import { networkManager } from '../game/NetworkManager';

interface ChatMessage {
  sender: string;
  message: string;
}

const formatMessage = (msg: string) => {
  if (!msg.includes('§')) return <span>{msg}</span>;
  
  const parts = msg.split(/(§[0-9a-fk-or])/);
  let currentColor = 'inherit';
  
  const colorMap: Record<string, string> = {
    '§0': '#000000', '§1': '#0000AA', '§2': '#00AA00', '§3': '#00AAAA',
    '§4': '#AA0000', '§5': '#AA00AA', '§6': '#FFAA00', '§7': '#AAAAAA',
    '§8': '#555555', '§9': '#5555FF', '§a': '#55FF55', '§b': '#55FFFF',
    '§c': '#FF5555', '§d': '#FF55FF', '§e': '#FFFF55', '§f': '#FFFFFF'
  };

  return parts.map((part, index) => {
    if (colorMap[part]) {
      currentColor = colorMap[part];
      return null;
    }
    return <span key={index} style={{ color: currentColor }}>{part}</span>;
  });
};

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
          if (target === 'hub' || target === 'skybridge' || target === 'skycastles' || target === 'battleroyale') {
             networkManager.initMatchmaking(target);
             window.dispatchEvent(new CustomEvent('requestGameRestart'));
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
      className="absolute bottom-14 md:bottom-24 landscape:bottom-8 xl:landscape:bottom-24 left-1 md:left-4 w-[60vw] sm:w-80 flex flex-col gap-1 pointer-events-none z-30 safe-ml transform scale-[0.7] sm:scale-100 origin-bottom-left landscape:scale-[0.65] md:landscape:scale-[0.8] xl:landscape:scale-100"
      onClick={(e) => e.stopPropagation()}
    >
      <div 
        ref={chatContainerRef}
        className="max-h-32 sm:max-h-48 md:max-h-64 overflow-y-auto flex flex-col justify-end gap-0.5"
        style={{ scrollbarWidth: 'none' }}
      >
        {messages.map((msg, i) => {
          let senderColor = "text-[#FFFF55]"; // default yellow
          if (msg.team === 'red') senderColor = "text-[#FF5555]";
          else if (msg.team === 'blue') senderColor = "text-[#5555FF]";

          return (
          <div key={i} className="text-[12px] md:text-[14px] text-white drop-shadow-[1px_1px_0_rgba(0,0,0,1)] bg-black/0 px-1 py-0.5 rounded w-fit max-w-full break-words font-sans selection:bg-white/30">
            <span className={`font-bold ${senderColor}`}>{msg.sender}: </span>
            {formatMessage(msg.message)}
          </div>
          );
        })}
      </div>
      
      {isTyping && (
        <div className="pointer-events-auto bg-black/50 p-1 flex items-center border border-white/10">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleInputKeyDown}
            className="bg-transparent text-white outline-none w-full font-sans text-[12px] md:text-[14px]"
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
        <div className="text-[10px] md:text-xs text-white/50 drop-shadow-md hidden md:block">Press Enter to chat</div>
      )}
    </div>
  );
});
