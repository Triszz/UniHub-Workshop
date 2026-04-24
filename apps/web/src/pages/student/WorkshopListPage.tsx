import React from "react";
import { useAuth } from "../../context/AuthContext";

export const WorkshopListPage: React.FC = () => {
  const { user, logout } = useAuth();
  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Danh sách Workshop</h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-600">Xin chào, {user?.fullName}</span>
          <button
            onClick={() => {
              void logout();
            }}
            className="text-red-500 hover:underline text-sm"
          >
            Đăng xuất
          </button>
        </div>
      </div>
      <p className="text-gray-500">
        Workshop list sẽ được implement ở Ngày 4...
      </p>
    </div>
  );
};
