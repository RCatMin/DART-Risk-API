// 받침 유무에 따라 "은/는" 조사를 고른다 (예: "삼성전자" → 는, "현대차" → 는, "카카오뱅크" → 는).
export function eunNeun(word: string): "은" | "는" {
  const lastChar = word.trim().at(-1);
  if (!lastChar) return "는";
  const code = lastChar.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return "는"; // 한글 음절이 아니면(영문/숫자 등) 는으로 둔다
  const hasBatchim = code % 28 !== 0;
  return hasBatchim ? "은" : "는";
}
