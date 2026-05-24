# 프로젝트 개발 지침 (Project Instructions)

## 🎯 1. 프로젝트 개요 & 아키텍처 목표
* 해당 프로젝트가 C, C++, Java, Python, Javascript 등 언어가 정해진것은 아니다.
* 내가 구현하고자 하는 것은 처음에 정확히 제안할 것이기에 그에 맞는 프로젝트를 수행하면 된다.
* 밑에 가이드는 Javascript기준으로 작성하는 것이며 처음과 같이 언어에 제약은 없다.
* 모든 변경사항은 changelog를 남기며 핵심 요점을 잘 요약해야 작성해라

## 🛠️ 2. 행동 가이드라인 (Do's & Don'ts)

### ✅ 권장 사항 (DO)
* **타입 안정성**: 모든 변수와 함수의 입력/출력값에 반드시 엄격한 TypeScript 타입을 지정하세요. (`any` 사용 금지)
* **테스트 최우선**: 로직 수정 후에는 반드시 관련된 단위 테스트(`npm run test`)를 수행하고 결과를 보고하세요.
* **커밋 메시지**: [feature] (scope): 규칙인데 내가 따로 언급하기 전까지 절대로 git commit, push 하지마

### ❌ 금지 사항 (DON'T)
* **하드코딩 금지**: API Endpoint나 비밀키 등은 절대 소스 코드에 직접 노출하지 말고, `.env.local` 파일에서 불러오도록 하세요.
* **독단적 코드 삭제 금지**: Existing 코드나 주석을 대량으로 삭제할 때는 사전에 합당한 이유를 먼저 설명하세요.

## 🔄 3. 작업 프로세스 (Work Step)
1. **분석**: 요구사항을 받으면 연관된 파일 목록을 먼저 스캔하여 영향을 받는 부분을 분석합니다.
2. **설계 공유**: 코드를 즉시 작성하지 말고, 어떻게 고칠 것인지 2~3줄 요약하여 사용자에게 먼저 확인을 받습니다.
3. **구현 및 검증**: 코드를 작성하고 빌드 에러(`npm run build`)가 없는지 자체 검증을 거친 후 완료 보고를 합니다.

## 📝 4. 선호하는 코드 패턴 예시
* **비동기 처리 패턴**: 아래와 같이 항상 `try-catch`와 명확한 에러 핸들링을 포함해야 합니다.
```typescript
export async function fetchData<T>(url: string): Promise<T> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json() as T;
  } catch (error) {
    console.error("Failed to fetch data:", error);
    throw error;
  }
}
```
