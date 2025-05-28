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

  const searchAddress = useCallback(async (searchText: string) => {
    if (!searchText.trim()) {
      setError('주소를 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 주소에서 불필요한 부분 제거
      const cleanAddress = searchText
        .split(',')[0]
        .replace(/\s*\d+호\s*$/, '')
        .replace(/\s*(아파트|APT|상가|빌딩|오피스텔)\s*$/, '')
        .trim();

      const encodedAddress = encodeURIComponent(cleanAddress);
      console.log('검색할 주소:', cleanAddress); // 디버깅용 로그

      const response = await fetch(`/api/geocode?address=${encodedAddress}`, {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });

      const data = await response.json();
      console.log('API 응답:', data); // 디버깅용 로그

      if (!response.ok) {
        throw new Error(data.error || '주소를 찾을 수 없습니다.');
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