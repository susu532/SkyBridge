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

export const ChatUI = React.memo(function ChatUI({ isLocked, isTyping, setIsTyping, isMobile }: { isLocked: boolean, isTyping: boolean, setIsTyping: (v: boolean) => void, isMobile?: boolean }) {
  const messages = useGameStore(state => state.chatMessages);
  const currentMode = useGameStore(state => state.currentMode);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const showFullChat = isTyping;
  const visibleMessages = showFullChat ? messages : messages.slice(-10);
  const isScrolledUp = useRef(false);

  // Handle scroll position when transitioning back to showing full chat or activating typing
  useEffect(() => {
    if (showFullChat) {
      isScrolledUp.current = false;
      setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
        if (isTyping) {
          inputRef.current?.focus();
        }
      }, 50);
    }
  }, [showFullChat, isTyping]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const val = inputValue.trim();
      if (val) {
        if (val.startsWith('/server ')) {
          const target = val.split(' ')[1];
          if (target === 'dungeondelver') {
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

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    // If the user has scrolled up by more than 25 pixels from bottom, mark as scrolledUp
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 25;
    isScrolledUp.current = !isAtBottom;
  };

  useEffect(() => {
    const el = chatContainerRef.current;
    if (!el) return;

    const stopPropagation = (e: Event) => {
      if (showFullChat) {
        e.stopPropagation();
      }
    };

    el.addEventListener('touchstart', stopPropagation, { passive: true });
    el.addEventListener('touchmove', stopPropagation, { passive: true });
    el.addEventListener('touchend', stopPropagation, { passive: true });
    el.addEventListener('pointerdown', stopPropagation, { passive: true });
    el.addEventListener('pointermove', stopPropagation, { passive: true });
    el.addEventListener('pointerup', stopPropagation, { passive: true });
    el.addEventListener('wheel', stopPropagation, { passive: true });

    return () => {
      el.removeEventListener('touchstart', stopPropagation);
      el.removeEventListener('touchmove', stopPropagation);
      el.removeEventListener('touchend', stopPropagation);
      el.removeEventListener('pointerdown', stopPropagation);
      el.removeEventListener('pointermove', stopPropagation);
      el.removeEventListener('pointerup', stopPropagation);
      el.removeEventListener('wheel', stopPropagation);
    };
  }, [showFullChat]);

  useEffect(() => {
    if (chatContainerRef.current && (!isScrolledUp.current || !showFullChat)) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [visibleMessages, showFullChat]);

  return (
    <div 
      className="absolute left-4 top-10 sm:top-[12vh] md:top-[15vh] lg:top-[18vh] z-[60] w-[60vw] sm:w-[45vw] md:w-[40vw] lg:w-[35vw] xl:w-[30vw] min-w-[200px] max-w-[500px] flex flex-col gap-1 pointer-events-none transition-all landscape:top-[10vh] landscape:w-[45vw] lg:landscape:w-[35vw]"
    >
      <div 
        ref={chatContainerRef}
        onScroll={handleScroll}
        className={`max-h-[25vh] sm:max-h-[30vh] md:max-h-[38vh] lg:max-h-[45vh] overflow-y-auto flex flex-col gap-0.5 rounded-sm transition-all
          ${showFullChat 
            ? 'pointer-events-auto bg-black/45 border border-white/10 p-2 custom-scrollbar' 
            : 'pointer-events-none bg-transparent'
          }`}
        style={!showFullChat ? { scrollbarWidth: 'none' } : undefined}
      >
        <div className="flex flex-col min-h-full gap-0.5">
          {visibleMessages.length > 0 && <div className="mt-auto" />}
          {visibleMessages.map((msg) => {
            const isDungeonDelver = currentMode.startsWith('dungeondelver');
            let senderColor = "text-[#FFFF55]"; // default yellow
            if (isDungeonDelver && msg.sender !== 'System') {
              senderColor = "text-[#FF5555]";
            } else if (msg.team === 'red') {
              senderColor = "text-[#FF5555]";
            } else if (msg.team === 'blue') {
              senderColor = "text-[#5555FF]";
            }

            return (
              <div key={msg.id} className="text-[11px] sm:text-[12px] md:text-[13px] lg:text-[14px] text-white drop-shadow-[1px_1px_0_rgba(0,0,0,1)] bg-black/0 px-1 py-0.5 rounded w-fit max-w-full break-words font-sans selection:bg-white/30">
                <span className={`font-bold ${senderColor}`}>{msg.sender}: </span>
                {formatMessage(msg.message)}
              </div>
            );
          })}
        </div>
      </div>
      
      {isTyping && (
        <div className="pointer-events-auto bg-black/50 p-1 flex items-center border border-white/10">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleInputKeyDown}
            className="bg-transparent text-white outline-none w-full font-sans text-[13px] sm:text-[14px] md:text-[15px]"
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
