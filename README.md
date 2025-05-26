# VWorld 주소 지도 매핑

엑셀 파일의 주소 데이터를 지도에 시각화하는 웹 애플리케이션입니다.

## 주요 기능

- 엑셀 파일(.xlsx, .xls)에서 주소 데이터 읽기
- VWorld API를 사용한 주소 지오코딩
- 동일 주소 통합 및 마커 크기 자동 조정
- 마커 클릭 시 상세 주소 정보 표시
- 기본/위성/하이브리드 지도 타입 전환

## 기술 스택

- Next.js
- React
- Leaflet (지도)
- TailwindCSS (스타일링)

## 설치 방법

1. 저장소 클론:
```bash
git clone [repository-url]
cd vworld-web-mapper
```

2. 의존성 설치:
```bash
npm install
```

3. 환경 변수 설정:
- `.env.local` 파일 생성
- VWorld API 키 설정:
```
NEXT_PUBLIC_VWORLD_API_KEY=your-api-key
```

4. 개발 서버 실행:
```bash
npm run dev
```

## 사용 방법

1. 웹 브라우저에서 애플리케이션 접속
2. "엑셀 파일 업로드" 버튼 클릭
3. 주소 데이터가 포함된 엑셀 파일 선택
4. 지도에 표시된 마커 확인
5. 마커 클릭으로 상세 주소 정보 확인

## 라이선스

MIT License
