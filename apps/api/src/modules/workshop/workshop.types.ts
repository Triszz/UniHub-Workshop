export type WorkshopStatus = "draft" | "published" | "cancelled";

// Body của POST /admin/workshops
export interface CreateWorkshopDto {
  title: string;
  description?: string;
  speakerName?: string;
  speakerBio?: string;
  roomId: string;
  capacity: number;
  startsAt: string; // ISO8601
  endsAt: string; // ISO8601
  price: number;
  status?: WorkshopStatus;
}

// Body của PATCH /admin/workshops/:id — tất cả optional
export type UpdateWorkshopDto = Partial<CreateWorkshopDto>;

// Query params của GET /workshops (public list)
export interface WorkshopListQuery {
  page?: string;
  limit?: string;
  status?: WorkshopStatus;
  date?: string; // YYYY-MM-DD — lọc theo ngày diễn ra
}
