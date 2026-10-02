export interface ProvinceDto {
  id: string;
  name: string;
  centroid: { lat: number; lng: number };
}

export interface DepartmentDto {
  id: string;
  provinceId: string;
  name: string;
  category: string;
  centroid: { lat: number; lng: number };
}

export interface LocalityDto {
  id: string;
  provinceId: string;
  departmentId: string | null;
  name: string;
  centroid: { lat: number; lng: number };
}

export interface ResolvedLocationDto {
  province: { id: string; name: string };
  department: { id: string; name: string };
}
