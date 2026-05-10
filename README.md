# Cosmic Coalescence

우주의 탄생부터 종말까지 — 입자 하나에서 시작해 빅뱅, 별, 은하, 문명을 거쳐 우주의 끝을 선택하는 인크리멘탈 게임.

## Play

**[게임 플레이](https://bagmk.github.io/spaceRPG/)**

## Development

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # Vitest unit tests
npm run build     # Vite production build → dist/
```

## Architecture

코드 구조, 파일 맵, 데이터 흐름, 새 기능 추가 가이드는 [ARCHITECTURE.md](./ARCHITECTURE.md) 참조.

AI 에이전트·코딩 어시스턴트용 지침은 [CODEX_CLAUDE.md](./CODEX_CLAUDE.md) 참조.

## Tech Stack

- Vite + React 18 + TypeScript (strict)
- Pure `useReducer` — no Zustand, no Redux
- Canvas 2D API — no WebGL, no Three.js
- Vitest for unit tests
