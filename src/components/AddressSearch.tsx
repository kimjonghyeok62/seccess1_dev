import React, { useState } from 'react';

interface AddressSearchProps {
  onAddressFound: (result: {
    lat: number;
    lng: number;
    address: string;
    refined?: string;
  }) => void;
  onError?: (error: string) => void;
}

const AddressSearch: React.FC<AddressSearchProps> = ({ onAddressFound, onError }) => {
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '주소를 찾을 수 없습니다.');
      }

      onAddressFound({
        lat: data.lat,
        lng: data.lng,
        address: data.address,
        refined: data.refined
      });
      
      setAddress('');
    } catch (error: any) {
      const errorMessage = error.message || '주소 검색 중 오류가 발생했습니다.';
      setError(errorMessage);
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <form onSubmit={handleSearch} className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="주소를 입력하세요 (예: 경기도 수원시 영통구 영통동)"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            className={`px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={isLoading}
          >
            {isLoading ? '검색 중...' : '검색'}
          </button>
        </div>
        {error && (
          <div className="text-red-500 text-sm mt-1">
            {error}
          </div>
        )}
      </form>
    </div>
  );
};

export default AddressSearch; 