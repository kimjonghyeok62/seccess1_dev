import { ChangeEvent, useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import type { MapComponentProps } from './MapComponent';

interface FileUploadProps {
  setMarkers: (markers: MapComponentProps['markers']) => void;
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

  useEffect(() => {
    if (processResult) {
      const popupContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>주소 처리 결과</title>
          <meta charset="utf-8">
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
          </style>
        </head>
        <body class="bg-white">
          <div class="max-w-2xl mx-auto">
            <h3 class="text-xl font-semibold mb-6">주소 처리 결과</h3>
            <div class="space-y-4">
              <div class="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded">
                <div>
                  <p class="font-medium">엑셀 대상주소</p>
                  <p class="text-lg">총 ${processResult.totalAddresses}개</p>
                </div>
                <div>
                  <p class="font-medium">주소 표시 수</p>
                  <p class="text-lg">${processResult.successCount}개</p>
                </div>
                <div>
                  <p class="font-medium">주소 변환 불가 수</p>
                  <p class="text-lg">${processResult.failedAddresses.length}개</p>
                </div>
              </div>
              ${processResult.failedAddresses.length > 0 ? `
                <div>
                  <h4 class="font-medium mb-2">주소 변환 불가 내역</h4>
                  <div class="bg-gray-50 p-4 rounded max-h-[300px] overflow-auto">
                    <table class="w-full text-sm">
                      <thead>
                        <tr class="text-left">
                          <th class="pb-2">행</th>
                          <th class="pb-2">주소</th>
                          <th class="pb-2">변환 불가 사유</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${processResult.failedAddresses.map((item, index) => `
                          <tr class="border-t border-gray-200">
                            <td class="py-2">${item.row}행</td>
                            <td class="py-2">${item.address}</td>
                            <td class="py-2 text-red-600">${item.reason}</td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
        </body>
        </html>
      `;

      const popup = window.open('', '주소 처리 결과', 'width=800,height=600,scrollbars=yes');
      if (popup) {
        popup.document.write(popupContent);
        popup.document.close();
      }
    }
  }, [processResult]);

  const cleanAddress = (address: string) => {
    return address
      .replace(/\s*\d+동\s*\d+호\s*$/, '') // 동호수 제거
      .replace(/\s+/g, ' ') // 중복 공백 제거
      .trim();
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setProcessResult(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<any>(worksheet);

        const failedList: FailedAddress[] = [];
        const addressMap = new Map<string, { 
          lat: number; 
          lng: number; 
          originalAddress: string;
          count: number;
          dong?: string;  // 행정동
          apartment?: string;  // 아파트 이름
          buildingNumber?: string;  // 아파트 동 번호
          addresses: string[];
        }>();

        // 모든 주소를 처리
        for (let i = 0; i < json.length; i++) {
          const row = json[i];
          const originalAddress = row.address || row.주소 || Object.values(row)[0];
          if (!originalAddress) {
            failedList.push({
              address: '빈 주소',
              reason: '주소가 비어있습니다.',
              row: i + 2
            });
            continue;
          }

          const cleanedAddress = cleanAddress(originalAddress);
          
          if (addressMap.has(cleanedAddress)) {
            // 이미 존재하는 주소인 경우 카운트만 증가
            const existing = addressMap.get(cleanedAddress)!;
            existing.count += 1;
            existing.addresses.push(originalAddress);
          } else {
            // 새로운 주소인 경우 좌표 조회
            try {
              const VWORLD_API_KEY = process.env.NEXT_PUBLIC_VWORLD_API_KEY;
              const encodedAddress = encodeURIComponent(cleanedAddress);
              
              const params = {
                service: 'address',
                request: 'getCoord',
                version: '2.0',
                crs: 'epsg:4326',
                address: encodedAddress,
                refine: 'true',
                simple: 'false',
                format: 'json',
                type: 'road',
                key: VWORLD_API_KEY,
                domain: 'vworld-web-mapper.vercel.app'
              };

              const queryString = Object.entries(params)
                .map(([key, value]) => `${key}=${value}`)
                .join('&');

              console.log('Calling VWorld API:', `http://api.vworld.kr/req/address?${queryString}`);
              const response = await fetch(
                `http://api.vworld.kr/req/address?${queryString}`,
                {
                  method: 'GET',
                  headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Referer': 'https://vworld-web-mapper.vercel.app',
                    'Origin': 'https://vworld-web-mapper.vercel.app'
                  }
                }
              );
              
              if (!response.ok) {
                const errorText = await response.text();
                console.error('VWorld API Error:', errorText);
                failedList.push({
                  address: originalAddress,
                  reason: '주소를 찾을 수 없습니다.',
                  row: i + 2
                });
                continue;
              }

              const data = await response.json();
              console.log('VWorld API Response:', data);
              
              if (data.response.status === 'OK' && data.response.result?.point) {
                const { x, y } = data.response.result.point;
                addressMap.set(cleanedAddress, {
                  lat: parseFloat(y),
                  lng: parseFloat(x),
                  originalAddress: originalAddress,
                  count: 1,
                  addresses: [originalAddress]
                });
              } else {
                failedList.push({
                  address: originalAddress,
                  reason: data.response.error?.message || '주소를 찾을 수 없습니다.',
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
          }
        }

        // 동별/아파트 단지별로 그룹화
        const groupedAddresses = new Map<string, {
          lat: number;
          lng: number;
          count: number;
          addresses: string[];
          isApartment: boolean;
          buildingCounts?: string;  // 동별 카운트를 문자열로 변경
        }>();

        addressMap.forEach((value) => {
          // 아파트 단지 기준으로 그룹화
          const groupKey = value.apartment || value.originalAddress;
          const isApartment = !!value.apartment;

          if (groupedAddresses.has(groupKey)) {
            const group = groupedAddresses.get(groupKey)!;
            group.count += value.count;
            group.addresses.push(...value.addresses);
            
            // 아파트인 경우 동별 카운트 추가
            if (isApartment && value.buildingNumber) {
              const buildingCounts = new Map<string, number>();
              if (group.buildingCounts) {
                group.buildingCounts.split(', ').forEach(item => {
                  const [dong, countStr] = item.split(': ');
                  buildingCounts.set(dong, parseInt(countStr) || 0);
                });
              }
              const currentCount = buildingCounts.get(value.buildingNumber) || 0;
              buildingCounts.set(value.buildingNumber, currentCount + value.count);
              
              // 동별 건수를 문자열로 변환
              group.buildingCounts = Array.from(buildingCounts.entries())
                .sort((a, b) => {
                  const aNum = parseInt(a[0].replace(/[^0-9]/g, '')) || 0;
                  const bNum = parseInt(b[0].replace(/[^0-9]/g, '')) || 0;
                  return aNum - bNum;
                })
                .map(([dong, count]) => `${dong}: ${count}건`)
                .join(', ');
            }
          } else {
            const buildingCounts = isApartment && value.buildingNumber
              ? `${value.buildingNumber}: ${value.count}건`
              : undefined;
            
            groupedAddresses.set(groupKey, {
              lat: value.lat,
              lng: value.lng,
              count: value.count,
              addresses: [...value.addresses],
              isApartment,
              buildingCounts
            });
          }
        });

        // 맵을 마커 배열로 변환
        const markers = Array.from(groupedAddresses.entries()).map(([key, value]) => ({
          lat: value.lat,
          lng: value.lng,
          address: key,
          count: value.count,
          addresses: value.addresses,
          isApartment: value.isApartment,
          buildingCounts: value.buildingCounts
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