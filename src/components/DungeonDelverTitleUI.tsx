import React from 'react';

export function DungeonDelverTitleUI() {
  return (
    <div className="absolute top-[2%] left-1/2 -translate-x-1/2 pointer-events-none z-10 w-full flex justify-center items-center pl-safe pr-safe">
      <h1
        className="font-black text-center uppercase flex items-center justify-center gap-1.5 sm:gap-2.5 flex-wrap whitespace-nowrap"
        style={{
          fontFamily: "'Pixelify Sans', sans-serif",
          fontSize: "clamp(0.95rem, 2.6vw, 1.7rem)",
          margin: 0,
        }}
      >
        <span 
          style={{ 
            color: "#FFFF55", 
            textShadow: "1.5px 1.5px 0px #222200, 2px 2px 4px rgba(0,0,0,0.8)",
            letterSpacing: "0.08em",
            fontWeight: "bold",
          }}
        >
          starplex.io
        </span>
        <span 
          style={{ 
            color: "#FFAAAA",
            textShadow: "1.5px 1.5px 0px #220000, 2px 2px 4px rgba(0,0,0,0.8)",
            fontWeight: "bold",
          }}
        >
          -
        </span>
        <span
          style={{
            background: "linear-gradient(to bottom, #FF5555, #D01111)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            WebkitTextStroke: "1px rgba(60,0,0,0.8)",
            letterSpacing: "0.12em",
            filter: `
              drop-shadow(1px 1px 0px #550000) 
              drop-shadow(1px 2px 0px #440000) 
              drop-shadow(3px 4px 8px rgba(0,0,0,0.6))
            `,
          }}
        >
          Dungeon Delver
        </span>
      </h1>
    </div>
  );
}
