export interface LatLng {
  lat: number;
  lng: number;
}

export interface StoreDto {
  id: number;
  name: string;
  address: string;
  location: LatLng;
  provinceId: string;
  departmentId: string;
}

export interface NearbyStoreDto extends StoreDto {
  distanceM: number;
  reportCount: number;
}

export interface StoreCandidateDto {
  id: number;
  name: string;
  address: string;
  location: LatLng;
  distanceM: number;
  reportCount: number;
}

export interface StoreDuplicateDetails {
  candidates: StoreCandidateDto[];
}

export interface CreateStoreRequest {
  name: string;
  address: string;
  lat: number;
  lng: number;
  confirmedDistinct?: boolean;
  turnstileToken: string;
}
