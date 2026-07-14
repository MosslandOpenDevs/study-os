/**
 * Summary card renderer (issue #11). Renders the SummaryCardDraft shape
 * produced by @study-os/summary, including generation provenance so AI
 * output is always labeled as such.
 */

export interface SummaryCardData {
  shortSummary: string;
  keyConcepts: string[];
  confusionPoints: string[];
  tonePreset: string;
  generation: {
    provider: string;
    model: string;
    promptVersion: string;
  };
}

const TONE_LABELS: Record<string, string> = {
  teacher: "교사 모드",
  tutor: "과외 모드",
  "concise-exam": "시험 요약 모드",
};

export function SummaryCardView({ card }: { card: SummaryCardData }) {
  return (
    <article
      aria-label="학습 요약 카드"
      style={{
        border: "1px solid #ddd",
        borderRadius: 8,
        padding: 16,
        marginTop: 12,
      }}
    >
      <header style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>요약</h3>
        <span
          style={{
            fontSize: 12,
            background: "#eef2ff",
            color: "#3730a3",
            borderRadius: 4,
            padding: "2px 8px",
          }}
        >
          {TONE_LABELS[card.tonePreset] ?? card.tonePreset}
        </span>
      </header>

      <p>{card.shortSummary}</p>

      <h4 style={{ marginBottom: 4, fontSize: 14 }}>핵심 개념</h4>
      <ul aria-label="핵심 개념 목록" style={{ margin: 0, paddingLeft: 20 }}>
        {card.keyConcepts.map((concept) => (
          <li key={concept}>{concept}</li>
        ))}
      </ul>

      {card.confusionPoints.length > 0 && (
        <>
          <h4 style={{ marginBottom: 4, fontSize: 14 }}>헷갈리기 쉬운 지점</h4>
          <ul aria-label="혼동 포인트 목록" style={{ margin: 0, paddingLeft: 20 }}>
            {card.confusionPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </>
      )}

      <footer style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
        AI 생성 · {card.generation.provider}/{card.generation.model} ·{" "}
        {card.generation.promptVersion}
      </footer>
    </article>
  );
}
