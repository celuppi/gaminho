// apps/web/src/components/ema-chat/TypingDots.tsx
// Três pontinhos animados: substitui o "…" enquanto a EMA gera a resposta.
import { motion, useReducedMotion } from "framer-motion";

export default function TypingDots() {
  const reduce = useReducedMotion();

  if (reduce) {
    return (
      <span
        className="inline-flex items-center gap-1 py-1"
        aria-label="EMA está digitando"
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-violet-500 dark:bg-violet-400"
          />
        ))}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 py-1"
      aria-label="EMA está digitando"
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-violet-500 dark:bg-violet-400"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.15,
          }}
        />
      ))}
    </span>
  );
}
