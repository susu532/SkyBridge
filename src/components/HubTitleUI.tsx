import { motion } from "motion/react";

export function HubTitleUI() {
  return (
    <div className="absolute top-[2%] left-1/2 -translate-x-1/2 pointer-events-none z-10 w-full flex justify-center perspective-1000 pl-safe pr-safe">
      <motion.div
        animate={{ y: [0, -5, 0] }}
        initial={{ rotateX: 10, rotateY: -2 }}
        transition={{ y: { duration: 4, repeat: Infinity, ease: "easeInOut" } }}
        style={{
          transformStyle: "preserve-3d",
        }}
      >
        <h1
          className="font-black tracking-[0.2em] text-center uppercase"
          style={{
            fontFamily: "'Pixelify Sans', sans-serif",
            fontSize: "clamp(2rem, 6vw, 4.5rem)",
            background: "linear-gradient(to bottom, #FFF700, #FFB300)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            WebkitTextStroke: "1px rgba(60,40,0,0.8)",
            filter: `
              drop-shadow(1px 1px 0px #CC8800) 
              drop-shadow(1px 2px 0px #AA6600) 
              drop-shadow(1px 3px 0px #884400) 
              drop-shadow(4px 6px 10px rgba(0,0,0,0.6))
            `,
            lineHeight: "1",
            margin: 0,
          }}
        >
          STARPLEX<span style={{ WebkitTextFillColor: "#ff9900" }}>.IO</span>
        </h1>
      </motion.div>
    </div>
  );
}
