"use client";

import { useState, useEffect } from "react";

const QUOTES = [
  {
    text: "A reader lives a thousand lives before he dies.",
    author: "George R.R. Martin",
  },
  { text: "Not all those who wander are lost.", author: "J.R.R. Tolkien" },
  { text: "A book is a dream you hold in your hands.", author: "Neil Gaiman" },
  { text: "Knowledge is the light that never dims.", author: "Glintpage" },
  { text: "So many books, so little time.", author: "Frank Zappa" },
  { text: "Reading is dreaming with open eyes.", author: "Anaïs Nin" },
  { text: "One must always be careful of books.", author: "Cassandra Clare" },
  {
    text: "Words are, in my not-so-humble opinion, our most inexhaustible source of magic.",
    author: "Albus Dumbledore",
  },
];

export function RotatingQuote() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % QUOTES.length);
        setVisible(true);
      }, 400);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const q = QUOTES[idx];

  return (
    <p
      className="text-sm max-w-md leading-relaxed"
      style={{
        color: "rgba(255,255,255,0.45)",
        fontFamily: "Georgia, serif",
        fontStyle: "italic",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(4px)",
        transition: "opacity 0.4s ease, transform 0.4s ease",
      }}
    >
      "{q.text}"
      <span
        style={{
          color: "rgba(255,255,255,0.25)",
          fontStyle: "normal",
          marginLeft: "0.5rem",
        }}
      >
        — {q.author}
      </span>
    </p>
  );
}
