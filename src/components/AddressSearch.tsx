import React, { useState, useCallback } from 'react';
import { debounce } from 'lodash';

interface AddressSearchProps {
  onAddressFound: (result: {
    lat: number;
    lng: number;
    address: string;
  }) => void;
  onError?: (error: string) => void;
}

const AddressSearch: React.FC<AddressSearchProps> = ({ onAddressFound, onError }) => {
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  const searchAddress = useCallback(async (searchText: string) => {
    console.group('주소 검색 시작');
    console.log('검색할 주소:', searchText);
    
    if (!searchText.trim()) {
      console.warn('빈 주소 입력');
      setError('주소를 입력해주세요.');
      console.groupEnd();
      return;
    }

    setIsLoading(true);
    setError(null);
    setDebugInfo(null);

    try {
      // 주소 정제 과정 로깅
      const cleanAddress = searchText
        .split(',')[0]
        .replace(/\s*\d+호\s*$/, '')
        .replace(/\s*(아파트|APT|상가|빌딩|오피스텔)\s*$/, '')
        .trim();
      
      console.log('정제된 주소:', cleanAddress);

      const encodedAddress = encodeURIComponent(cleanAddress);
      const requestUrl = `/api/geocode?address=${encodedAddress}`;
      console.log('요청 URL:', requestUrl);

      const startTime = performance.now();
      const response = await fetch(requestUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      const endTime = performance.now();

      console.log('응답 시간:', Math.round(endTime - startTime), 'ms');
      console.log('응답 상태:', response.status, response.statusText);
      console.log('응답 헤더:', Object.fromEntries(response.headers.entries()));

      const data = await response.json();
      console.log('API 응답:', data);

      // 디버그 정보 저장
      setDebugInfo({
        requestUrl,
        responseTime: Math.round(endTime - startTime),
        responseStatus: response.status,
        responseHeaders: Object.fromEntries(response.headers.entries()),
        responseData: data
      });

      if (!response.ok) {
        throw new Error(data.error || '주소를 찾을 수 없습니다.');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      onAddressFound({
        lat: data.lat,
        lng: data.lng,
        address: data.address
      });
      
      setAddress('');
      setError(null);
    } catch (error: any) {
      console.error('검색 오류:', error);
      const errorMessage = error.message || '주소 검색 중 오류가 발생했습니다.';
      setError(errorMessage);
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setIsLoading(false);
      console.groupEnd();
    }
  }, [onAddressFound, onError]);

  // 디바운스된 검색 함수
  const debouncedSearch = useCallback(
    debounce((searchText: string) => {
      searchAddress(searchText);
    }, 500),
    [searchAddress]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (address.trim()) {
      searchAddress(address);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAddress(value);
    setError(null);
    setDebugInfo(null);
  };

  return (
    <div className="w-full max-w-md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={address}
            onChange={handleChange}
            placeholder="주소를 입력하세요 (예: 경기도 수원시 영통구 영통동)"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            className={`px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={isLoading || !address.trim()}
          >
            {isLoading ? '검색 중...' : '검색'}
          </button>
        </div>
        {error && (
          <div className="text-red-500 text-sm mt-1 bg-red-50 p-2 rounded">
            {error}
          </div>
        )}
        {process.env.NODE_ENV === 'development' && debugInfo && (
          <div className="mt-4 p-2 bg-gray-100 rounded text-xs">
            <details>
              <summary className="cursor-pointer font-bold">디버그 정보</summary>
              <pre className="mt-2 whitespace-pre-wrap">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </details>
          </div>
        )}
        <div className="text-gray-500 text-xs mt-1">
          * 도로명 주소 또는 지번 주소를 입력해주세요.
          <br />
          * 예시: "경기도 수원시 영통구 영통로 124" 또는 "경기도 수원시 영통구 영통동 1039-1"
        </div>
      </form>
    </div>
  );
};

export default AddressSearch; 