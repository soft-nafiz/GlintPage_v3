"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RevealWrapper } from "./RevealWrapper";

const SAMPLES: Record<string, { input: string; output: string }> = {
  fr: {
    input:
      "La nuit, tous les chats sont gris. C'est une vérité ancienne, que l'obscurité efface les distinctions entre les choses, nivelant le monde dans une égalité sombre et mystérieuse.",
    output:
      "At night, all cats are gray. It is an ancient truth — that darkness erases the distinctions between things, leveling the world into a somber and mysterious equality.",
  },
  de: {
    input:
      "Wer mit Ungeheuern kämpft, mag zusehn, dass er nicht dabei zum Ungeheuer wird. Und wenn du lange in einen Abgrund blickst, blickt der Abgrund auch in dich hinein.",
    output:
      "Whoever fights monsters should take care not to become a monster in the process. And when you gaze long into an abyss, the abyss also gazes back into you.",
  },
  es: {
    input:
      "El mundo es un lugar peligroso de vivir, no a causa de los que hacen el mal, sino a causa de los que no hacen nada al respecto.",
    output:
      "The world is a dangerous place to live — not because of the people who do evil, but because of the people who do nothing about it.",
  },
  jp: {
    input:
      "人間は考える葦である。宇宙全体が彼を押しつぶすことができる。しかし、人間は死ぬときでも、彼を殺すものより尊い。",
    output:
      "Man is but a thinking reed. The universe might crush him — and yet, even as he dies, he is nobler than that which kills him.",
  },
  en: {
    input: "Paste any text above to see the translation in action.",
    output:
      "Your text has been translated with full contextual fidelity, preserving the author's original tone and intent across languages.",
  },
};

export function DemoSection() {
  const [inputText, setInputText] = useState("");
  const [targetLang, setTargetLang] = useState("fr");
  const [outputText, setOutputText] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function typeText(text: string) {
    setOutputText("");
    setShowOutput(true);
    let i = 0;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (i < text.length) {
        setOutputText((prev) => prev + text[i]);
        i++;
      } else {
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }, 20);
  }

  function handleTranslate() {
    const sample = SAMPLES[targetLang] ?? SAMPLES.en;
    const result = sample.output;

    if (!inputText.trim()) {
      setInputText(sample.input);
    }

    setIsTranslating(true);
    setShowOutput(false);

    setTimeout(() => {
      setIsTranslating(false);
      typeText(result);
    }, 900);
  }

  return (
    <section
      className="py-24 sm:py-32 px-5 sm:px-8"
      style={{ background: "var(--paper-dim)" }}
    >
      <div className="max-w-3xl mx-auto text-center">
        {/* Header */}
        <RevealWrapper>
          <span className="text-xs font-semibold tracking-[0.14em] uppercase text-primary block mb-4">
            Live Demo
          </span>
        </RevealWrapper>
        <RevealWrapper delay={80}>
          <h2
            className="font-heading font-light tracking-[-0.02em] leading-[1.05] mb-3"
            style={{ fontSize: "clamp(34px, 5vw, 58px)" }}
          >
            See it in <em className="italic text-primary">action.</em>
          </h2>
        </RevealWrapper>
        <RevealWrapper delay={140}>
          <p className="text-[15px] sm:text-[16px] font-light text-muted-foreground mb-12">
            Paste any text — in any language — and watch the AI work.
          </p>
        </RevealWrapper>

        {/* Demo box */}
        <RevealWrapper delay={200}>
          <div
            className="bg-card rounded-[1.75rem] border border-foreground/08 overflow-hidden text-left"
            style={{ boxShadow: "0 4px 24px oklch(0.101 0.005 265 / 0.06)" }}
          >
            {/* Input area */}
            <div className="p-6 sm:p-8 border-b border-foreground/06">
              <Textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste a paragraph in any language here — French, German, Japanese, Arabic, Spanish..."
                className="font-heading text-[17px] leading-[1.7] bg-secondary border-foreground/10 rounded-[14px] min-h-[120px] resize-none focus-visible:ring-primary focus-visible:border-primary/50 placeholder:text-muted-foreground/60 placeholder:font-sans"
              />

              <div className="flex flex-wrap items-center gap-3 mt-4">
                <Select value={targetLang} onValueChange={setTargetLang}>
                  <SelectTrigger className="w-auto rounded-full border-foreground/15 text-[13px] font-light min-w-[180px]">
                    <SelectValue placeholder="Translate to…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fr">Translate to French</SelectItem>
                    <SelectItem value="de">Translate to German</SelectItem>
                    <SelectItem value="es">Translate to Spanish</SelectItem>
                    <SelectItem value="jp">Translate to Japanese</SelectItem>
                    <SelectItem value="en">Translate to English</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  onClick={handleTranslate}
                  disabled={isTranslating}
                  className="rounded-full font-medium px-6 text-[14px]"
                >
                  {isTranslating ? "Translating…" : "Translate & Read"}
                </Button>
              </div>
            </div>

            {/* Output area */}
            <div className="p-6 sm:p-8 min-h-[160px]">
              {showOutput ? (
                <>
                  <p
                    className="text-[11px] font-semibold tracking-[0.1em] uppercase mb-5"
                    style={{ color: "var(--gold)" }}
                  >
                    Translation
                  </p>
                  <p className="font-heading text-[18px] sm:text-[20px] leading-[1.75] text-foreground">
                    {outputText}
                    {outputText.length <
                      (SAMPLES[targetLang]?.output.length ?? 0) && (
                      <span
                        className="inline-block w-0.5 h-[1.2em] bg-primary align-text-bottom ml-0.5 animate-caret-blink"
                        aria-hidden
                      />
                    )}
                  </p>
                </>
              ) : isTranslating ? (
                <p className="font-heading text-[18px] text-muted-foreground/50 italic mt-2">
                  Analyzing context…
                </p>
              ) : (
                <p className="font-heading text-[18px] italic text-muted-foreground/50 mt-2">
                  Your translation will appear here, beautifully rendered…
                </p>
              )}
            </div>
          </div>
        </RevealWrapper>
      </div>
    </section>
  );
}
