import type { BodyType } from "@/types";

/* Line-art side profiles for models without photos (see CarSilhouette in car-image.tsx and the share cards).
   Plain data so both the browser and next/og can draw them. */

/** Line-art side profiles on a 240 × 96 canvas, ground at y = 84. */
export const PROFILES: Record<BodyType, { body: string; glass: string[]; wheels: [number, number]; r: number; extra?: string }> = {
  Sedan: {
    body: "M14 70 L16 60 Q18 55 27 54 L80 50 L104 35 Q109 32 116 32 L154 32 Q161 32 166 36 L188 51 L217 53 Q224 54 225 59 L226 70 Q226 73 222 73 L196 73 A14 14 0 0 0 168 73 L72 73 A14 14 0 0 0 44 73 L18 73 Q14 73 14 70 Z",
    glass: ["M86 49 L106 37 L132 36.5 L132 49 Z", "M138 49 L138 36.5 L156 36.5 Q160 36.5 163 39 L178 49.5 Z"],
    wheels: [58, 182],
    r: 11,
  },
  Hatchback: {
    body: "M26 70 L28 60 Q30 55 39 54 L84 50 L106 34 Q110 31 117 31 L170 31 Q178 31 182 37 L201 53 Q205 57 205 63 L205 70 Q205 73 201 73 L184 73 A14 14 0 0 0 156 73 L82 73 A14 14 0 0 0 54 73 L30 73 Q26 73 26 70 Z",
    glass: ["M90 49 L108 36 L136 35.5 L136 49 Z", "M142 49 L142 35.5 L169 35.5 Q174 35.5 177 39 L189 49 Z"],
    wheels: [68, 170],
    r: 11,
  },
  SUV: {
    body: "M16 69 L17 53 Q18 47 27 46 L70 43 L93 24 Q97 21 104 21 L196 21 Q204 21 207 27 L220 46 Q223 50 223 56 L224 69 Q224 73 220 73 L198 73 A15 15 0 0 0 168 73 L74 73 A15 15 0 0 0 44 73 L20 73 Q16 73 16 69 Z",
    glass: ["M78 42 L97 26.5 L134 26.5 L134 42 Z", "M140 42 L140 26.5 L172 26.5 L172 42 Z", "M178 42 L178 26.5 L196 26.5 Q200 26.5 202 30 L210 42 Z"],
    wheels: [59, 183],
    r: 12,
    extra: "M108 17.5 L190 17.5",
  },
  MUV: {
    body: "M12 69 L13 55 Q14 49 23 48 L60 45 L85 25 Q89 22 96 22 L210 22 Q218 22 220 29 L226 50 Q228 54 228 60 L228 69 Q228 73 224 73 L206 73 A15 15 0 0 0 176 73 L72 73 A15 15 0 0 0 42 73 L16 73 Q12 73 12 69 Z",
    glass: ["M69 44 L89 27.5 L124 27.5 L124 44 Z", "M130 44 L130 27.5 L168 27.5 L168 44 Z", "M174 44 L174 27.5 L211 27.5 Q214 27.5 215 31 L219 44 Z"],
    wheels: [57, 191],
    r: 12,
  },
  Coupe: {
    body: "M14 70 L16 61 Q18 56 29 55 L88 50 L116 36 Q123 32 132 32 L154 33 Q166 34 180 42 L212 54 Q222 57 224 62 L226 70 Q226 73 222 73 L196 73 A14 14 0 0 0 168 73 L72 73 A14 14 0 0 0 44 73 L18 73 Q14 73 14 70 Z",
    glass: ["M96 49 L119 38 Q125 35.5 132 35.5 L152 36.5 Q161 37.5 170 43 L177 48 Z"],
    wheels: [58, 182],
    r: 11,
  },
};

/** Wheel centre line on the 240 × 96 canvas. */
export const WHEEL_Y = 73;
