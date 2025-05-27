import { ChangeEvent, useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

// Window 타입 확장
declare global {
  interface Window {
    updateProgress?: (percent: number) => void;
    updateResult?: (result: ProcessResult) => void;
  }
}

export interface Marker {
  lat: number;
  lng: number;
  address: string;
  count: number;
  addresses: string[];
  isApartment?: boolean;
}

interface FileUploadProps {
  setMarkers: (markers: Marker[]) => void;
}

interface FailedAddress {
  address: string;
  reason: string;
  row: number;
}

interface ProcessResult {
  totalAddresses: number;
  successCount: number;
  failedAddresses: FailedAddress[];
}

export default function FileUpload({ setMarkers }: FileUploadProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processResult, setProcessResult] = useState<ProcessResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [resultPopup, setResultPopup] = useState<Window | null>(null);

  // 팝업창 생성 함수
  const createResultPopup = () => {
    const popup = window.open('', '주소 처리 결과', 'width=800,height=600,scrollbars=yes');
    if (popup) {
      popup.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>주소 처리 결과</title>
          <meta charset="utf-8">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              padding: 20px;
              margin: 0;
              background: #f8f9fa;
              color: #333;
              min-height: 100vh;
            }
            .container {
              max-width: 720px;
              margin: 0 auto;
              background: white;
              padding: 32px;
              border-radius: 12px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
              min-height: calc(100vh - 40px);
              display: flex;
              flex-direction: column;
            }
            h2 {
              margin: 0 0 24px 0;
              color: #1a1a1a;
              font-size: 24px;
              text-align: center;
            }
            .progress-container {
              margin: 30px 0;
            }
            .progress-bar {
              width: 100%;
              height: 12px;
              background-color: #e9ecef;
              border-radius: 6px;
              overflow: hidden;
            }
            .progress-bar-fill {
              height: 100%;
              background-color: #228be6;
              transition: width 0.3s ease;
              width: 0%;
            }
            .status {
              text-align: center;
              margin: 16px 0;
              color: #495057;
              font-size: 16px;
              font-weight: 500;
            }
            .processing {
              text-align: center;
              font-size: 18px;
              color: #228be6;
              margin: 20px 0;
              font-weight: 500;
            }
            .result {
              display: none;
              margin-top: 20px;
              flex: 1;
              display: flex;
              flex-direction: column;
            }
            .stats {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 20px;
              margin: 24px 0;
            }
            .stat-box {
              text-align: center;
              padding: 20px;
              background: #f8f9fa;
              border-radius: 8px;
              border: 1px solid #e9ecef;
            }
            .stat-value {
              font-size: 32px;
              font-weight: 600;
              color: #228be6;
              margin: 8px 0;
            }
            .stat-label {
              font-size: 15px;
              color: #495057;
            }
            .error-container {
              flex: 1;
              margin: 20px 0;
              overflow: hidden;
              display: flex;
              flex-direction: column;
            }
            .error-list {
              flex: 1;
              overflow-y: auto;
              border: 1px solid #e9ecef;
              border-radius: 8px;
              background: #fff;
            }
            .error-item {
              padding: 16px;
              border-bottom: 1px solid #e9ecef;
              font-size: 14px;
            }
            .error-item:last-child {
              border-bottom: none;
            }
            .error-row {
              color: #495057;
              font-weight: 500;
            }
            .error-address {
              color: #1a1a1a;
              margin: 6px 0;
              font-size: 15px;
            }
            .error-reason {
              color: #e03131;
              font-size: 14px;
            }
            .button-container {
              margin-top: 24px;
              text-align: center;
              padding-top: 16px;
              border-top: 1px solid #e9ecef;
            }
            .btn {
              display: inline-block;
              min-width: 160px;
              padding: 12px 24px;
              background: #228be6;
              color: white;
              border: none;
              border-radius: 6px;
              cursor: pointer;
              font-size: 16px;
              font-weight: 500;
              transition: all 0.2s;
            }
            .btn:hover {
              background: #1971c2;
              transform: translateY(-1px);
            }
            .error-title {
              font-size: 18px;
              color: #1a1a1a;
              margin: 0 0 16px 0;
              font-weight: 600;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>주소 처리</h2>
            <div id="processing" class="processing">
              주소를 지도에 시각화하고 있습니다...
            </div>
            <div class="progress-container">
              <div class="progress-bar">
                <div class="progress-bar-fill"></div>
              </div>
              <div class="status">0%</div>
            </div>
            <div id="result" class="result" style="display: none;">
              <div class="stats">
                <div class="stat-box">
                  <div class="stat-value" id="total-count">0</div>
                  <div class="stat-label">전체 주소</div>
                </div>
                <div class="stat-box">
                  <div class="stat-value" id="success-count">0</div>
                  <div class="stat-label">표시된 주소</div>
                </div>
                <div class="stat-box">
                  <div class="stat-value" id="fail-count">0</div>
                  <div class="stat-label">실패한 주소</div>
                </div>
              </div>
              <div id="error-container" class="error-container"></div>
              <div class="button-container">
                <button class="btn" onclick="window.close()">확인</button>
              </div>
            </div>
          </div>
          <script>
            window.updateProgress = function(percent) {
              const bar = document.querySelector('.progress-bar-fill');
              const status = document.querySelector('.status');
              if (bar && status) {
                bar.style.width = percent + '%';
                status.textContent = percent + '%';
              }
            }

            window.updateResult = function(result) {
              document.getElementById('processing').style.display = 'none';
              document.getElementById('result').style.display = 'flex';
              
              document.getElementById('total-count').textContent = result.totalAddresses;
              document.getElementById('success-count').textContent = result.successCount;
              document.getElementById('fail-count').textContent = result.failedAddresses.length;

              if (result.failedAddresses.length > 0) {
                const container = document.getElementById('error-container');
                container.innerHTML = \`
                  <h3 class="error-title">주소 변환 실패 내역</h3>
                  <div class="error-list">
                    \${result.failedAddresses.map(item => \`
                      <div class="error-item">
                        <div class="error-row">\${item.row}행</div>
                        <div class="error-address">\${item.address}</div>
                        <div class="error-reason">\${item.reason}</div>
                      </div>
                    \`).join('')}
                  </div>
                \`;
              }
            }
          </script>
        </body>
        </html>
      `);
      popup.document.close();
      setResultPopup(popup);
    }
  };

  useEffect(() => {
    if (processResult && resultPopup?.updateResult) {
      resultPopup.updateResult(processResult);
    }
  }, [processResult, resultPopup]);

  const cleanAddress = (address: string) => {
    // 쉼표로 구분된 부분 제거 (동/호수 정보)
    const mainPart = address.split(',')[0].trim();
    
    // 주소에서 동호수 정보 제거
    let cleaned = mainPart
      .replace(/\s*\d+동\s*\d+호\s*$/, '')  // "123동 456호" 패턴 제거
      .replace(/\s*\d+동\s*$/, '')          // "123동" 패턴 제거
      .replace(/\s*\d+호\s*$/, '')          // "456호" 패턴 제거
      .trim();

    // 시도명 정규화
    cleaned = cleaned
      .replace(/^경기\s/, '경기도 ')
      .replace(/^강원\s/, '강원도 ')
      .replace(/^충북\s/, '충청북도 ')
      .replace(/^충남\s/, '충청남도 ')
      .replace(/^전북\s/, '전라북도 ')
      .replace(/^전남\s/, '전라남도 ')
      .replace(/^경북\s/, '경상북도 ')
      .replace(/^경남\s/, '경상남도 ')
      .replace(/^제주\s/, '제주특별자치도 ');
    
    console.log('🏠 원본 주소:', address);
    console.log('🏠 정제된 주소:', cleaned);
    
    return cleaned;
  };

  // 주소 정규화 함수 추가
  const normalizeAddress = (address: string) => {
    // 번지 패턴을 찾아서 정규화
    const numberPattern = /-?\d+(?:-\d+)?$/;
    const match = address.match(numberPattern);
    if (!match) return address;

    // 기본 주소 부분 (번지 제외)
    const baseAddress = address.slice(0, match.index).trim();
    return baseAddress + ' ' + match[0];
  };

  // 진행상황 업데이트 함수
  const updateProgress = (current: number, total: number) => {
    const percent = Math.round((current / total) * 100);
    setProgress(percent);
    if (resultPopup?.updateProgress) {
      resultPopup.updateProgress(percent);
    }
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setProcessResult(null);

    try {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          // 파일 읽기 시작할 때 팝업창 생성
          createResultPopup();
          
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json<any>(worksheet);

          const failedList: FailedAddress[] = [];
          const coord_counts = new Map<string, number>();
          const coord_infos = new Map<string, { 
            lat: number;
            lng: number;
            addresses: string[];
            normalizedAddresses: Set<string>;
          }>();

          // 모든 주소를 처리
          for (let i = 0; i < json.length; i++) {
            const row = json[i];
            const originalAddress = row.address || row.주소 || row['주소'] || Object.values(row)[0];
            if (!originalAddress) {
              failedList.push({
                address: '빈 주소',
                reason: '주소가 비어있습니다.',
                row: i + 2
              });
              continue;
            }

            const cleanedAddress = cleanAddress(originalAddress);
            const normalizedAddress = normalizeAddress(cleanedAddress);
            
            console.log('정규화된 주소:', normalizedAddress);

            try {
              const encodedAddress = encodeURIComponent(cleanedAddress);
              console.log('주소 검색 시도:', cleanedAddress);
              
              let response = await fetch(
                `/api/vworld?address=${encodedAddress}`,
                {
                  method: 'GET',
                  headers: {
                    'Accept': 'application/json'
                  }
                }
              );

              if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: '알 수 없는 오류가 발생했습니다.' }));
                console.error('VWorld API Error:', errorData);
                failedList.push({
                  address: originalAddress,
                  reason: errorData.error || '주소를 찾을 수 없습니다.',
                  row: i + 2
                });
                continue;
              }

              const data = await response.json();
              console.log('VWorld API Response:', data);

              if (data.lat && data.lng) {
                const coordKey = `${data.lat},${data.lng},${normalizedAddress}`;
                const existingInfo = coord_infos.get(coordKey);

                if (existingInfo) {
                  existingInfo.addresses.push(originalAddress);
                  existingInfo.normalizedAddresses.add(normalizedAddress);
                  coord_counts.set(coordKey, (coord_counts.get(coordKey) || 0) + 1);
                } else {
                  coord_infos.set(coordKey, {
                    lat: data.lat,
                    lng: data.lng,
                    addresses: [originalAddress],
                    normalizedAddresses: new Set([normalizedAddress])
                  });
                  coord_counts.set(coordKey, 1);
                }
              } else {
                failedList.push({
                  address: originalAddress,
                  reason: '좌표를 찾을 수 없습니다.',
                  row: i + 2
                });
              }
            } catch (error) {
              console.error('API call error:', error);
              failedList.push({
                address: originalAddress,
                reason: '주소 변환 중 오류가 발생했습니다.',
                row: i + 2
              });
            }

            updateProgress(i + 1, json.length);
            if (i % 5 === 0) {  // 5개 처리할 때마다 딜레이
              await new Promise(resolve => setTimeout(resolve, 50));
            }
          }

          // 마커 배열로 변환
          const markers = Array.from(coord_infos.entries()).map(([key, value]) => ({
            lat: value.lat,
            lng: value.lng,
            address: value.addresses[0],
            count: value.addresses.length,
            addresses: value.addresses,
            isApartment: false
          }));

          // 처리 결과 저장
          const result = {
            totalAddresses: json.length,
            successCount: markers.reduce((sum, marker) => sum + marker.count, 0),
            failedAddresses: failedList
          };
          setProcessResult(result);

          if (markers.length === 0) {
            setError('주소를 좌표로 변환하는데 실패했습니다. 주소 형식을 확인해주세요.');
          } else if (failedList.length > 0) {
            setError(`일부 주소(${failedList.length}개)를 변환하지 못했습니다.`);
          }

          setMarkers(markers);
        } catch (error) {
          console.error('Error processing file:', error);
          setError('파일 처리 중 오류가 발생했습니다.');
        } finally {
          setIsLoading(false);
        }
      };

      reader.onerror = () => {
        setError('파일을 읽는 중 오류가 발생했습니다.');
        setIsLoading(false);
      };

      reader.readAsBinaryString(file);
    } catch (error) {
      console.error('Error handling file:', error);
      setError('파일 처리 중 오류가 발생했습니다.');
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-4">
        <label htmlFor="file-upload" className={`cursor-pointer bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
          {isLoading ? '처리 중...' : '엑셀 파일 업로드'}
        </label>
        <input
          id="file-upload"
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileUpload}
          className="hidden"
          disabled={isLoading}
        />
        <p className="text-sm text-gray-600 whitespace-nowrap">
          * 엑셀 파일의 첫 번째 시트에서 주소 데이터를 읽습니다.
        </p>
        {error && (
          <p className="text-sm text-red-600 cursor-pointer hover:underline" onClick={() => setProcessResult(null)}>
            {error}
          </p>
        )}
      </div>
    </>
  );
} 