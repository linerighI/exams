import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  Sequence,
  staticFile,
  Track,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/fonts";
void Promise.all([
  loadFont({
    family: "FilmTajawal",
    url: staticFile("onboarding-fonts/regular.woff2"),
    weight: "400",
  }),
  loadFont({
    family: "FilmTajawal",
    url: staticFile("onboarding-fonts/bold.woff2"),
    weight: "700",
  }),
]).catch(() => {
  /* Existing app fonts remain an offline fallback. */
});

export type FilmVariant = "overview" | "teacher" | "student";
export type WelcomeFilmProps = {
  variant: FilmVariant;
  reducedMotion?: boolean;
};
const blue = "#2863b0",
  ink = "#24476f",
  pale = "#edf4ff";
const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};
const curve = Easing.bezier(0.16, 1, 0.3, 1);
const paper: CSSProperties = {
  background: "#fff",
  border: "1px solid #dbe7f7",
  boxShadow: "0 25px 65px #315b9218",
  borderRadius: 24,
};

// Keep app-wide heading, SVG and panel styles out of the film canvas.
function FilmCanvas({children}: {children: ReactNode}) {
  const host = useRef<HTMLDivElement>(null);
  const [target, setTarget] = useState<ShadowRoot | null>(null);
  useLayoutEffect(() => {
    if (host.current) setTarget(host.current.shadowRoot || host.current.attachShadow({mode: 'open'}));
  }, []);
  return <div ref={host} style={{position:'absolute',inset:0, width:'100%',height:'100%'}}>
    {target && createPortal(<><style>{':host{font-family:FilmTajawal,Tajawal,sans-serif}*{box-sizing:border-box}h1,h2,h3,p{margin:0}svg{flex-shrink:0}'}</style>{children}</>,target)}
  </div>;
}

function Orb({ frame, reduced = false }: { frame: number; reduced?: boolean }) {
  return (
    <svg
      width="130"
      height="130"
      viewBox="0 0 140 140"
      style={{
        position: "absolute",
        left: 22,
        bottom: 15,
        translate: reduced ? "0 0" : `0 ${Math.sin(frame / 26) * 7}px`,
      }}
    >
      <defs>
        <radialGradient id="film-orb">
          <stop stopColor="#fff" offset="0" />
          <stop stopColor="#d7f4ff" offset=".38" />
          <stop stopColor="#83c4ef" offset=".74" />
          <stop stopColor="#428bce" offset="1" />
        </radialGradient>
        <linearGradient id="film-glass">
          <stop stopColor="#fff" stopOpacity=".8" />
          <stop offset="1" stopColor="#fff" stopOpacity=".03" />
        </linearGradient>
      </defs>
      <circle cx="70" cy="70" r="59" fill="#d9ebfb" />
      <circle
        cx="70"
        cy="68"
        r="51"
        fill="url(#film-orb)"
        stroke="#c1e2ff"
        strokeWidth="3"
      />
      <ellipse
        cx="57"
        cy="48"
        rx="30"
        ry="17"
        fill="url(#film-glass)"
        rotate="-25"
      />
      <path
        d="M28 82 Q72 118 112 45 Q110 103 63 116Z"
        fill="#fff"
        opacity=".2"
      />
    </svg>
  );
}

function BankArt({ reduced = false }: { reduced?: boolean }) {
  const current = useCurrentFrame(),
    f = reduced ? 90 : current,
    { fps } = useVideoConfig();
  return (
    <div style={{ position: "relative", height: 420, width: 520 }}>
      <div
        style={{
          ...paper,
          position: "absolute",
          width: 330,
          height: 350,
          left: 55,
          top: 22,
          rotate: "-8deg",
          background: "#e4efff",
        }}
      />
      <div
        style={{
          ...paper,
          position: "absolute",
          width: 330,
          height: 350,
          left: 105,
          top: 44,
          rotate:
            interpolate(f, [0, 0.8 * fps], [4, -2], {
              ...clamp,
              easing: curve,
            }) + "deg",
          padding: 32,
          boxSizing: "border-box",
        }}
        dir="rtl"
      >
        <span style={{ color: "#78a1d0", fontSize: 20 }}>بنك الأسئلة</span>
        <h3 style={{ fontSize: 44, margin: "18px 0", color: ink }}>رياضيات</h3>
        <p style={{ fontSize: 20, color: "#89a0bc" }}>
          الفصل الأول · الصف العاشر
        </p>
        {[76, 100, 87].map((w, i) => (
          <div
            key={i}
            style={{
              height: 8,
              background: "#e5eef9",
              borderRadius: 6,
              width: `${w}%`,
              margin: "18px 0",
              scale: `${interpolate(f, [(0.3 + i * 0.09) * fps, (0.85 + i * 0.09) * fps], [0, 1], { ...clamp, easing: curve })} 1`,
              transformOrigin: "right",
            }}
          />
        ))}
        <div
          style={{
            marginTop: 30,
            color: blue,
            fontSize: 22,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>أسئلة معتمدة</span>
          <span>✓</span>
        </div>
      </div>
      <div
        style={{
          ...paper,
          position: "absolute",
          bottom: 0,
          right: 0,
          padding: "18px 26px",
          fontSize: 24,
          color: blue,
          translate: `0 ${interpolate(f, [0.4 * fps, 1.1 * fps], [30, 0], { ...clamp, easing: curve })}px`,
          opacity: interpolate(f, [0.4 * fps, 0.8 * fps], [0, 1], clamp),
        }}
      >
        سؤالك، بطريقتك. <span style={{ marginRight: 20 }}>＋</span>
      </div>
    </div>
  );
}

function PublishArt({ reduced = false }: { reduced?: boolean }) {
  const current = useCurrentFrame(),
    f = reduced ? 90 : current,
    { fps } = useVideoConfig();
  return (
    <div style={{ width: 540, height: 430, position: "relative" }} dir="rtl">
      <svg width="540" height="430" style={{ position: "absolute", inset: 0 }}>
        <path
          d="M300 165 C380 165 440 150 450 275 M300 165 C220 165 100 150 90 275 M300 165 L275 335"
          fill="none"
          stroke="#dce8f8"
          strokeWidth="2"
        />
        <path
          d="M300 165 C380 165 440 150 450 275 M300 165 C220 165 100 150 90 275 M300 165 L275 335"
          fill="none"
          stroke="#77a7df"
          strokeWidth="2"
          strokeDasharray="800"
          strokeDashoffset={interpolate(
            f,
            [0.3 * fps, 2 * fps],
            [800, 0],
            clamp,
          )}
        />
      </svg>
      <div
        style={{
          ...paper,
          position: "absolute",
          width: 270,
          left: 135,
          top: 25,
          padding: 28,
          textAlign: "center",
        }}
      >
        <div style={{ color: "#89a4c5", fontSize: 20 }}>الامتحان جاهز</div>
        <h3 style={{ fontSize: 34, margin: "14px 0" }}>اختبار الرياضيات</h3>
        <div
          style={{
            background: blue,
            color: "#fff",
            borderRadius: 12,
            padding: 14,
            fontSize: 23,
          }}
        >
          نشر للصف ←
        </div>
      </div>
      {[
        { x: 44, y: 275, n: "أ" },
        { x: 225, y: 330, n: "ب" },
        { x: 410, y: 275, n: "ج" },
      ].map((p, i) => (
        <div
          key={p.n}
          style={{
            ...paper,
            position: "absolute",
            left: p.x,
            top: p.y,
            width: 78,
            height: 78,
            borderRadius: 24,
            display: "grid",
            placeItems: "center",
            fontSize: 30,
            color: blue,
            opacity: interpolate(
              f,
              [(0.7 + i * 0.17) * fps, (1 + i * 0.17) * fps],
              [0, 1],
              clamp,
            ),
            translate: `0 ${interpolate(f, [(0.7 + i * 0.17) * fps, (1.2 + i * 0.17) * fps], [16, 0], { ...clamp, easing: curve })}px`,
          }}
        >
          {p.n}
        </div>
      ))}
    </div>
  );
}

function ExamArt({ reduced = false }: { reduced?: boolean }) {
  const current = useCurrentFrame(),
    f = reduced ? 90 : current,
    { fps } = useVideoConfig();
  return (
    <div
      style={{
        ...paper,
        width: 460,
        padding: 30,
        rotate: "-2deg",
        boxSizing: "border-box",
      }}
      dir="rtl"
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          color: "#8aa1bd",
          fontSize: 18,
        }}
      >
        <span>السؤال ١ من ٥</span>
        <span dir="ltr">09:45</span>
      </div>
      <h3 style={{ fontSize: 30, color: ink, margin: "28px 0" }}>
        ما ناتج جمع ٢ و٣؟
      </h3>
      {["٥", "٤", "٣"].map((option, i) => (
        <div
          key={option}
          style={{
            border: `1px solid ${i === 0 && f > fps * 0.7 ? "#8db3e4" : "#e0e9f6"}`,
            background: i === 0 && f > fps * 0.7 ? "#edf4ff" : "#fff",
            borderRadius: 12,
            padding: "13px 18px",
            margin: "10px 0",
            fontSize: 23,
            color: blue,
            display: "flex",
            justifyContent: "space-between",
            opacity: interpolate(
              f,
              [(0.12 + i * 0.1) * fps, (0.42 + i * 0.1) * fps],
              [0, 1],
              clamp,
            ),
          }}
        >
          <span>{option}</span>
          <span>{i === 0 && f > fps * 0.7 ? "●" : "○"}</span>
        </div>
      ))}
      <p style={{ fontSize: 17, color: "#7c99ba", marginBottom: 0 }}>
        حالة حفظ الإجابات أمامك
      </p>
    </div>
  );
}

function ResultsArt({ reduced = false }: { reduced?: boolean }) {
  const current = useCurrentFrame(),
    f = reduced ? 90 : current,
    { fps } = useVideoConfig();
  return (
    <div
      style={{ ...paper, width: 460, padding: 32, rotate: "-2deg" }}
      dir="rtl"
    >
      <span style={{ fontSize: 20, color: "#809aba" }}>متابعة الصف</span>
      <h3 style={{ fontSize: 34, margin: "14px 0" }}>كل خطوة، أمامك.</h3>
      <div
        style={{
          display: "flex",
          gap: 17,
          alignItems: "flex-end",
          height: 160,
          padding: "20px 0",
          borderBottom: "1px solid #e5edf8",
        }}
      >
        {[0.4, 0.64, 0.51, 0.9, 0.76, 0.96].map((h, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              background: i === 5 ? blue : "#aac9ed",
              borderRadius: "7px 7px 0 0",
              height: interpolate(
                f,
                [(0.15 + i * 0.09) * fps, (0.9 + i * 0.09) * fps],
                [0, h * 150],
                { ...clamp, easing: curve },
              ),
            }}
          />
        ))}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 20,
          color: "#7e98b7",
          paddingTop: 20,
        }}
      >
        <span>تقدم الطلاب</span>
        <span>مراجعة النتائج ←</span>
      </div>
    </div>
  );
}

function ReceiptArt({ reduced = false }: { reduced?: boolean }) {
  const current = useCurrentFrame(),
    f = reduced ? 90 : current,
    { fps } = useVideoConfig();
  return (
    <div
      style={{
        ...paper,
        width: 440,
        padding: 40,
        textAlign: "center",
        rotate: "-2deg",
      }}
      dir="rtl"
    >
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill={pale} />
        <path
          d="M28 50L43 64L72 35"
          stroke={blue}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          strokeDasharray="90"
          strokeDashoffset={interpolate(
            f,
            [0.2 * fps, 1 * fps],
            [90, 0],
            clamp,
          )}
        />
      </svg>
      <h3 style={{ fontSize: 32, color: ink, margin: "22px 0" }}>
        تم استلام إجاباتك
      </h3>
      <p style={{ fontSize: 23, color: "#8aa1bd" }}>تأكيد واضح بعد التسليم.</p>
      <div
        style={{
          height: 7,
          width: "80%",
          background: "#e6eef8",
          margin: "30px auto 5px",
          borderRadius: 5,
        }}
      />
    </div>
  );
}

function FilmScene({
  title,
  caption,
  art,
  number,
  reducedMotion = false,
}: {
  title: string;
  caption: string;
  art: "bank" | "publish" | "exam" | "results" | "receipt";
  number: string;
  reducedMotion?: boolean;
}) {
  const frame = useCurrentFrame(),
    { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 165,
          transform: "scale(.9)",
          transformOrigin: "top left",
          scale: reducedMotion
            ? 1
            : interpolate(frame, [0, 1.2 * fps], [0.9, 1], {
                ...clamp,
                easing: curve,
              }),
          translate: reducedMotion
            ? "0 0"
            : `${interpolate(frame, [0, 1.2 * fps], [-44, 0], { ...clamp, easing: curve })}px 0`,
          opacity: reducedMotion
            ? 1
            : interpolate(frame, [0, 0.4 * fps], [0, 1], clamp),
        }}
      >
        {art === "bank" ? (
          <BankArt reduced={reducedMotion} />
        ) : art === "publish" ? (
          <PublishArt reduced={reducedMotion} />
        ) : art === "exam" ? (
          <ExamArt reduced={reducedMotion} />
        ) : art === "results" ? (
          <ResultsArt reduced={reducedMotion} />
        ) : (
          <ReceiptArt reduced={reducedMotion} />
        )}
      </div>
      <Interactive.Div
        name="Editorial headline"
        dir="rtl"
        lang="ar"
        style={{
          position: "absolute",
          right: 75,
          top: 195,
          width: 490,
          color: ink,
        }}
      >
        <div style={{ fontSize: 20, color: "#85a3c8", marginBottom: 20 }}>
          امتحانات{" "}
          <span style={{ marginRight: 16, color: "#b4cbe5" }}>
            {number} / 03
          </span>
        </div>
        {title.split("\n").map((line, i) => (
          <div key={line} style={{ padding: "4px 0" }}>
            <div
              style={{
                fontSize: 58,
                lineHeight: 1.65,
                fontWeight: 700,
                translate: reducedMotion
                  ? "0 0"
                  : `0 ${interpolate(frame, [(0.06 + i * 0.09) * fps, (0.6 + i * 0.09) * fps], [110, 0], { ...clamp, easing: curve })}%`,
              }}
            >
              {line}
            </div>
          </div>
        ))}
        <p
          style={{
            fontSize: 26,
            color: "#7f98b8",
            lineHeight: 1.7,
            marginTop: 25,
            opacity: reducedMotion
              ? 1
              : interpolate(frame, [0.4 * fps, 0.85 * fps], [0, 1], clamp),
          }}
        >
          {caption}
        </p>
      </Interactive.Div>
    </AbsoluteFill>
  );
}

export function WelcomeFilm({
  variant,
  reducedMotion = false,
}: WelcomeFilmProps) {
  const frame = useCurrentFrame(),
    { fps } = useVideoConfig();
  return (
    <FilmCanvas><AbsoluteFill
      dir="rtl"
      lang="ar"
      style={{
        fontFamily: "FilmTajawal, Tajawal, sans-serif",
        background: "#f5f8fd",
        color: ink,
        overflow: "hidden",
      }}
    >
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 12% 50%, #dfeeff 0, transparent 58%)",
        }}
      />
      <header
        style={{
          position: "absolute",
          top: 45,
          right: 65,
          left: 65,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #dfe8f6",
          paddingBottom: 20,
        }}
      >
        <strong style={{ fontSize: 30 }}>
          امتحانات
          <span
            style={{
              fontSize: 16,
              color: "#93adcd",
              fontWeight: 400,
              marginRight: 16,
            }}
          >
            من التحضير إلى النتائج
          </span>
        </strong>
        <span style={{ fontSize: 14, color: "#a2b6d0" }}>
          عرض توضيحي · 10 ثوانٍ
        </span>
      </header>
      <Track name="Ten-second introduction">
        <Sequence name="Prepare / arrive" from={0} durationInFrames={3 * fps}>
          <FilmScene
            number="01"
            reducedMotion={reducedMotion}
            art={variant === "student" ? "exam" : "bank"}
            title={
              variant === "student"
                ? "مرحبًا بك.\nهذه مساحتك."
                : variant === "teacher"
                  ? "أسئلتك،\nبأسلوبك."
                  : "مساحة واحدة.\nخطوات واضحة."
            }
            caption={
              variant === "student"
                ? "امتحانات صفّك ومواعيدك، أمامك."
                : variant === "teacher"
                  ? "اكتب سؤالًا أو اختر من بنكك."
                  : "للمعلم والطالب، من البداية إلى النتيجة."
            }
          />
        </Sequence>
        <Sequence
          name="Create / answer"
          from={3 * fps}
          durationInFrames={4 * fps}
        >
          <FilmScene
            number="02"
            reducedMotion={reducedMotion}
            art={variant === "student" ? "exam" : "publish"}
            title={
              variant === "student"
                ? "سؤالٌ بسؤال.\nبتركيز ووضوح."
                : "حضّر. انشر.\nواصِل مع صفّك."
            }
            caption={
              variant === "student"
                ? "راقب الوقت وحالة حفظ إجاباتك."
                : "امتحان واضح، يصل إلى طلابه."
            }
          />
        </Sequence>
        <Sequence
          name="Review / ready"
          from={7 * fps}
          durationInFrames={3 * fps}
        >
          <FilmScene
            number="03"
            reducedMotion={reducedMotion}
            art={
              variant === "teacher"
                ? "results"
                : variant === "student"
                  ? "receipt"
                  : "exam"
            }
            title={
              variant === "teacher"
                ? "تابع التقدّم.\nوراجع النتائج."
                : variant === "student"
                  ? "راجع. سلّم.\nوانتظر التأكيد."
                  : "ادخل بثقة.\nولنبدأ."
            }
            caption={
              variant === "teacher"
                ? "مساحتك جاهزة. والخطوة التالية لك."
                : variant === "student"
                  ? "تأكد من وصول التسليم قبل المغادرة."
                  : "اختر مساحتك: طالب أو معلم."
            }
          />
        </Sequence>
      </Track>


    </AbsoluteFill></FilmCanvas>
  );
}
