// 워치리스트 그룹 — 백엔드 스키마에는 아직 없는 개념이라 이 브라우저에만 저장된다
// (localStorage). 다른 기기/브라우저로는 동기화되지 않는다. 백엔드에 정식 필드로
// 추가되면 이 모듈을 서버 연동으로 교체하면 된다.

export interface CompanyGroup {
  id: string;
  name: string;
  corpCodes: string[];
}

const STORAGE_KEY = "dart-dashboard:groups";

export function loadGroups(): CompanyGroup[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveGroups(groups: CompanyGroup[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
  } catch {
    // 저장 실패해도(프라이빗 모드 등) 화면 동작은 계속되게 둔다
  }
}

// group 객체 생성(랜덤 id 부여)과 배열에 반영하는 걸 분리한 이유: React 18 StrictMode는
// setState에 넘긴 updater 함수를 개발 모드에서 두 번 호출한다 — 이 안에서 매번 새 랜덤 id를
// 만들면 실제 커밋되는 그룹과 호출부가 들고 있는 id가 어긋난다. id는 항상 setState 밖에서
// 한 번만 만든다.
export function makeGroup(name: string, corpCodes: string[]): CompanyGroup {
  return {
    id: `grp_${Math.random().toString(36).slice(2, 10)}`,
    name: name.trim(),
    corpCodes,
  };
}

export function createGroup(groups: CompanyGroup[], group: CompanyGroup): CompanyGroup[] {
  const next = [...groups, group];
  saveGroups(next);
  return next;
}

export function deleteGroup(groups: CompanyGroup[], groupId: string): CompanyGroup[] {
  const next = groups.filter((g) => g.id !== groupId);
  saveGroups(next);
  return next;
}

export function renameGroup(groups: CompanyGroup[], groupId: string, name: string): CompanyGroup[] {
  const next = groups.map((g) => (g.id === groupId ? { ...g, name: name.trim() } : g));
  saveGroups(next);
  return next;
}

// 워치리스트에서 종목을 제외했을 때 그룹에 남은 참조를 같이 정리한다.
export function removeCorpCodeFromGroups(groups: CompanyGroup[], corpCode: string): CompanyGroup[] {
  const next = groups.map((g) => ({ ...g, corpCodes: g.corpCodes.filter((c) => c !== corpCode) }));
  saveGroups(next);
  return next;
}

// 그룹 생성 후에도 종목을 추가로 편입할 수 있게 한다 — 그룹 만들 때 한 번에 다 골라야
// 하는 제약을 없앤다.
export function addCorpCodesToGroup(
  groups: CompanyGroup[],
  groupId: string,
  corpCodes: string[],
): CompanyGroup[] {
  const next = groups.map((g) =>
    g.id === groupId ? { ...g, corpCodes: [...new Set([...g.corpCodes, ...corpCodes])] } : g,
  );
  saveGroups(next);
  return next;
}
