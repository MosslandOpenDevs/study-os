import { useEffect, useState } from "react";

/**
 * Study unit list screen (issue #9). Loads the demo user's sources and their
 * units from the API (vite dev-proxied to :3000) with explicit loading /
 * error / empty states. The fetcher is injectable for tests.
 */

export interface SourceSummary {
  id: string;
  title: string;
  sourceType: string;
  unitCount: number;
}

export interface UnitDetail {
  id: string;
  title: string;
  content: string;
  orderIndex: number;
  citationStart: number | null;
  citationEnd: number | null;
}

export type Fetcher = (url: string) => Promise<Response>;

const DEMO_USER_ID = "seed-user";

type LoadState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; sources: SourceSummary[]; units: UnitDetail[] };

async function loadUnits(fetcher: Fetcher): Promise<Extract<LoadState, { phase: "ready" }>> {
  const listRes = await fetcher(`/api/sources?userId=${DEMO_USER_ID}`);
  if (!listRes.ok) {
    throw new Error(`소스 목록을 불러오지 못했습니다 (HTTP ${listRes.status})`);
  }
  const { sources } = (await listRes.json()) as { sources: SourceSummary[] };

  if (sources.length === 0) {
    return { phase: "ready", sources: [], units: [] };
  }

  const firstId = sources[0]?.id;
  const detailRes = await fetcher(`/api/sources/${firstId}`);
  if (!detailRes.ok) {
    throw new Error(`학습 유닛을 불러오지 못했습니다 (HTTP ${detailRes.status})`);
  }
  const detail = (await detailRes.json()) as { units: UnitDetail[] };
  return { phase: "ready", sources, units: detail.units };
}

export function StudyUnitList({ fetcher = fetch }: { fetcher?: Fetcher }) {
  const [state, setState] = useState<LoadState>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadUnits(fetcher).then(
      (ready) => {
        if (!cancelled) setState(ready);
      },
      (err: unknown) => {
        if (!cancelled) {
          setState({
            phase: "error",
            message: err instanceof Error ? err.message : "알 수 없는 오류",
          });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [fetcher]);

  if (state.phase === "loading") {
    return <p>학습 유닛을 불러오는 중…</p>;
  }
  if (state.phase === "error") {
    return (
      <p role="alert" style={{ color: "#b91c1c" }}>
        {state.message} — API 서버(pnpm dev)와 데이터베이스가 실행 중인지 확인하세요.
      </p>
    );
  }
  if (state.units.length === 0) {
    return <p>아직 업로드된 학습 자료가 없습니다. POST /api/sources 로 자료를 올려보세요.</p>;
  }

  return (
    <section aria-label="학습 유닛 목록">
      <p style={{ fontSize: 13, color: "#666" }}>
        {state.sources[0]?.title} · 유닛 {state.units.length}개
      </p>
      <ol style={{ paddingLeft: 20 }}>
        {state.units.map((unit) => (
          <li key={unit.id} style={{ marginBottom: 8 }}>
            <strong>{unit.title}</strong>
            {unit.citationStart !== null && unit.citationEnd !== null && (
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 11,
                  background: "#f0fdf4",
                  color: "#166534",
                  borderRadius: 4,
                  padding: "1px 6px",
                }}
              >
                근거 [{unit.citationStart}, {unit.citationEnd})
              </span>
            )}
            <div style={{ fontSize: 14, color: "#444" }}>
              {unit.content.length > 120 ? `${unit.content.slice(0, 120)}…` : unit.content}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
