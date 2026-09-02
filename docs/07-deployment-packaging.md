# 07. 배포·패키징 설계

## 배포 대상

주 사용 환경은 인터넷이 제한될 수 있는 학교 교실 Windows PC다. Windows x64를 MVP 기본 대상으로 하고 ARM/다른 OS는 Post-MVP로 둔다.

## 빌드 산출물

개발 빌드는 빠른 로컬 실행과 fixture 주입을 위한 것이다. production build는 devtools·상세 로그를 끄고 assets를 묶는다. `electron-builder` NSIS installer를 기본으로 하며, 설치 권한이 제한된 PC를 위해 portable 버전을 보조 산출물로 검토한다. portable은 데이터 백업·보안·업데이트가 취약할 수 있어 기본 배포판으로 확정하지 않는다.

## 네이티브 모듈 빌드 전제

SQLite는 `better-sqlite3`를 사용하므로 Electron용 native module ABI가 산출물에 포함되어야 한다. 개발·패키징 기준 환경은 Windows x64, Node.js LTS(우선 Node 22 LTS)로 둔다. Node.js Current 버전은 사전 빌드 바이너리가 없을 수 있으므로 MVP 지원 환경에서 제외한다.

개발 PC에서 `better-sqlite3` 설치 스크립트가 실행되어야 하며, 사전 빌드 바이너리가 제공되지 않으면 Visual Studio Build Tools의 `Desktop development with C++` workload와 Windows SDK가 필요하다. `--ignore-scripts` 설치는 TypeScript·UI 빌드 확인용으로만 허용하고, SQLite 실행·installer 생성 전에는 native binding 로딩을 반드시 확인한다.

검증 명령은 다음과 같다.

```powershell
npm run check:sqlite
npm run build
npm run package:win
```

이 검증이 실패한 상태에서는 앱이 화면 번들까지 생성되더라도 실제 로컬 DB를 사용할 수 없으므로 교실 배포를 진행하지 않는다.

## 데이터 위치와 유지

프로그램 파일과 사용자 데이터를 분리한다. DB는 Electron userData 경로 아래에 두고, installer 업데이트·앱 재설치 시 유지되어야 한다. DB를 설치 폴더나 임시 폴더에 저장하지 않는다. 첫 실행 시 데이터 경로와 백업 메뉴를 안내한다.

## 버전·migration·백업 호환

앱 버전과 DB `schemaVersion`을 별도로 관리한다. 시작 시 migration을 transaction으로 실행하고 실패하면 원본을 보존한 채 실행을 중단·복구 안내한다. 백업에는 `formatVersion`을 포함하며, 복원 전 현재 데이터 자동 백업, 파일 구조 검증, 지원 버전 확인을 수행한다. 오래된 백업은 가능한 migration 후 복원하고 불가능하면 이유를 보여준다.

## 학교 PC 고려사항

- 설치 관리자 권한이 없는 환경을 위해 portable 또는 per-user 설치를 검토한다.
- 백신·그룹 정책이 unsigned 실행 파일을 차단할 수 있다.
- 코드 서명 인증서는 다른 교사에게 배포할 때 신뢰와 경고 감소를 위해 권장하나 MVP 개인 테스트에는 비용을 이유로 보류할 수 있다.
- 프린터 드라이버와 PDF 저장 권한을 별도 점검한다.
- 자동 업데이트는 외부 통신·권한·운영 복잡성이 커 MVP에서 제외한다.

## 단계별 배포

### 개인 테스트

fixture 데이터로 설치·실행·migration·백업·복원을 확인한다. 실제 학생 데이터는 최소화한다.

### 교실 실사용

한 학급의 실제 흐름(최초 설정, 자리 확정, 출력, 전출)을 오프라인에서 검증하고 매 변경 전 백업을 안내한다.

### 소수 교사 테스트

서로 다른 Windows 권한·프린터·해상도에서 portable/installer를 비교하고 anonymized 오류 보고를 받는다.

### 배포 준비 / 일반 배포

릴리스 노트, 설치·백업·복원 안내, 서명 여부, 지원 Windows 버전, rollback 방법을 마련한다. 일반 배포 전에는 backup restore와 DB migration을 실제 산출물로 재검증한다.

## 복구와 운영

앱 시작 전 DB 무결성 체크, 저장 실패 시 재시도와 다른 경로 백업, 강제 종료 후 재실행 검사를 수행한다. 사용자가 복사한 백업은 앱이 자동 동기화하지 않으며 USB/OneDrive의 접근 권한과 보관 책임을 안내한다.
