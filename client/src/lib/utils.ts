import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatCurrency = (amount: number, currency = "INR"): string => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount / 100);
};

export const formatDate = (date: string | Date, options?: Intl.DateTimeFormatOptions): string => {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...options,
  });
};

export const formatTime = (time: string): string => {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m} ${ampm}`;
};

export const getInitials = (firstName: string, lastName: string): string => {
  return `${firstName[0]}${lastName[0]}`.toUpperCase();
};

export const getMatchStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    SCHEDULED: "bg-blue-500",
    LIVE: "bg-red-500 animate-pulse",
    POSTPONED: "bg-yellow-500",
    CANCELLED: "bg-gray-500",
    COMPLETED: "bg-green-500",
  };
  return colors[status] || "bg-gray-500";
};

export const getFormBadge = (result: string): string => {
  const colors: Record<string, string> = {
    W: "bg-green-500",
    D: "bg-yellow-500",
    L: "bg-red-500",
  };
  return colors[result] || "bg-gray-500";
};
