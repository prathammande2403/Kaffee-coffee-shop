const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validates whether an input is a valid RFC 4122 UUID string
 */
export const isValidUUID = (val: any): boolean => {
  return typeof val === 'string' && UUID_REGEX.test(val.trim());
};

/**
 * Converts UTC ISO string to IST formatted string (DD MMM YYYY, hh:mm A)
 */
export const formatIST = (isoString?: string | null): string => {
  if (!isoString) return '--';
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
};

/**
 * Converts UTC ISO string to only IST time (hh:mm A)
 */
export const formatISTTimeOnly = (isoString?: string | null): string => {
  if (!isoString) return '--';
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
};

/**
 * Formats a number or numeric string as Indian Rupees (₹)
 */
export const formatCurrency = (amount: number | string): string => {
  const numericVal = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericVal || 0);
};

/**
 * Converts "HH:MM:SS" (e.g. "07:00:00") into friendly 12-hour format "7:00 AM"
 */
export const formatTimeString = (timeStr?: string | null): string => {
  if (!timeStr) return '--';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return timeStr;
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const displayM = m < 10 ? `0${m}` : m;
  return `${displayH}:${displayM} ${period}`;
};

export interface OutletStatusInfo {
  isOpen: boolean;
  statusText: string;
  badgeClass: string;
  dotClass: string;
  timingsFormatted: string;
}

/**
 * Determines live operational status of an outlet based on active flag and operating hours
 */
export const getOutletStatus = (outlet: {
  is_active: boolean;
  opening_time?: string;
  closing_time?: string;
}): OutletStatusInfo => {
  const timingsFormatted =
    outlet.opening_time && outlet.closing_time
      ? `${formatTimeString(outlet.opening_time)} – ${formatTimeString(outlet.closing_time)}`
      : 'Hours unavailable';

  if (!outlet.is_active) {
    return {
      isOpen: false,
      statusText: 'Temporarily Closed',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
      dotClass: 'bg-rose-500',
      timingsFormatted,
    };
  }

  if (!outlet.opening_time || !outlet.closing_time) {
    return {
      isOpen: true,
      statusText: 'Open',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dotClass: 'bg-emerald-500',
      timingsFormatted,
    };
  }

  try {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [openH, openM] = outlet.opening_time.split(':').map((v) => parseInt(v, 10));
    const [closeH, closeM] = outlet.closing_time.split(':').map((v) => parseInt(v, 10));

    const openMinutes = openH * 60 + (openM || 0);
    const closeMinutes = closeH * 60 + (closeM || 0);

    let isOpen = false;
    if (closeMinutes > openMinutes) {
      isOpen = currentMinutes >= openMinutes && currentMinutes < closeMinutes;
    } else {
      // Midnight crossover (e.g. 17:00 to 02:00)
      isOpen = currentMinutes >= openMinutes || currentMinutes < closeMinutes;
    }

    if (isOpen) {
      return {
        isOpen: true,
        statusText: 'Open Now',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
        dotClass: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]',
        timingsFormatted,
      };
    } else {
      return {
        isOpen: false,
        statusText: `Closed • Opens ${formatTimeString(outlet.opening_time)}`,
        badgeClass: 'bg-stone-100 text-stone-600 border-stone-200',
        dotClass: 'bg-stone-400',
        timingsFormatted,
      };
    }
  } catch {
    return {
      isOpen: outlet.is_active,
      statusText: outlet.is_active ? 'Open' : 'Closed',
      badgeClass: outlet.is_active
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-stone-100 text-stone-600 border-stone-200',
      dotClass: outlet.is_active ? 'bg-emerald-500' : 'bg-stone-400',
      timingsFormatted,
    };
  }
};

/**
 * Normalizes raw category string (e.g. "hot_coffee", "Hot Coffee") to canonical slug
 */
export const normalizeCategorySlug = (category: string): string => {
  return category.toLowerCase().trim().replace(/[\s-]+/g, '_');
};

/**
 * Provides clean display title and subtitle for categories
 */
export const getCategoryMeta = (
  slug: string
): { title: string; subtitle: string; iconName: string } => {
  const norm = normalizeCategorySlug(slug);
  switch (norm) {
    case 'hot_coffee':
      return {
        title: 'Hot Coffee',
        subtitle: 'Slow-dripped, espresso craft & artisanal brews',
        iconName: 'Coffee',
      };
    case 'cold_coffee':
      return {
        title: 'Cold Coffee',
        subtitle: '18-hour cold brew, iced tonics & blended frappes',
        iconName: 'CupSoda',
      };
    case 'matcha':
      return {
        title: 'Matcha & Teas',
        subtitle: 'Ceremonial Uji matcha, herbal infusions & botanicals',
        iconName: 'Sparkles',
      };
    case 'food':
      return {
        title: 'Artisan Bakery & Food',
        subtitle: 'Freshly baked viennoiserie, gourmet croissants & savory bites',
        iconName: 'Croissant',
      };
    case 'add_ons':
    case 'add_on':
      return {
        title: 'Add-ons & Extras',
        subtitle: 'Custom syrups, extra espresso shots & plant-based milks',
        iconName: 'PlusCircle',
      };
    default:
      return {
        title: slug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        subtitle: 'Handcrafted artisan selections',
        iconName: 'Utensils',
      };
  }
};

export interface PickupSlotOption {
  value: string; // ISO string or datetime-local format
  label: string; // e.g. "Today, 6:45 PM"
  relativeLabel: string; // e.g. "In 25 mins"
  date: Date;
}

/**
 * Validates whether a requested pickup time falls within outlet operating hours
 * and provides at least the minimum kitchen preparation buffer.
 */
export const validatePickupSlot = (
  outlet: {
    is_active: boolean;
    opening_time?: string;
    closing_time?: string;
    avg_prep_minutes?: number;
    name?: string;
  } | null,
  targetDate: Date
): { isValid: boolean; error?: string } => {
  if (!outlet) {
    return { isValid: false, error: 'No pickup outlet selected' };
  }

  if (!outlet.is_active) {
    return { isValid: false, error: `${outlet.name || 'Outlet'} is currently inactive / closed` };
  }

  const now = new Date();
  const minPrepMinutes = outlet.avg_prep_minutes || 12;
  const minAllowedTime = new Date(now.getTime() + minPrepMinutes * 60 * 1000);

  if (targetDate.getTime() < minAllowedTime.getTime()) {
    return {
      isValid: false,
      error: `Selected slot must allow at least ${minPrepMinutes} minutes for kitchen preparation.`,
    };
  }

  if (outlet.opening_time && outlet.closing_time) {
    const [openH, openM] = outlet.opening_time.split(':').map((v) => parseInt(v, 10));
    const [closeH, closeM] = outlet.closing_time.split(':').map((v) => parseInt(v, 10));

    const slotMinutes = targetDate.getHours() * 60 + targetDate.getMinutes();
    const openMinutes = openH * 60 + (openM || 0);
    const closeMinutes = closeH * 60 + (closeM || 0);

    let isWithinHours = false;
    if (closeMinutes > openMinutes) {
      isWithinHours = slotMinutes >= openMinutes && slotMinutes <= closeMinutes;
    } else {
      isWithinHours = slotMinutes >= openMinutes || slotMinutes <= closeMinutes;
    }

    if (!isWithinHours) {
      return {
        isValid: false,
        error: `Slot is outside operating hours (${formatTimeString(
          outlet.opening_time
        )} – ${formatTimeString(outlet.closing_time)}).`,
      };
    }
  }

  return { isValid: true };
};

/**
 * Generates an array of realistic 15-minute pickup slot intervals starting from
 * now + avg_prep_minutes rounded up to the nearest 15-minute boundary.
 */
export const generatePickupSlots = (
  outlet: {
    is_active: boolean;
    opening_time?: string;
    closing_time?: string;
    avg_prep_minutes?: number;
  } | null,
  maxSlots = 8
): PickupSlotOption[] => {
  if (!outlet || !outlet.is_active) return [];

  const slots: PickupSlotOption[] = [];
  const now = new Date();
  const prepBuffer = outlet.avg_prep_minutes || 12;

  // Start after prepBuffer minutes
  const startTime = new Date(now.getTime() + prepBuffer * 60 * 1000);

  // Round up to next 15-minute mark
  const remainderMinutes = startTime.getMinutes() % 15;
  const minutesToAdd = remainderMinutes === 0 ? 0 : 15 - remainderMinutes;
  const firstSlot = new Date(startTime.getTime() + minutesToAdd * 60 * 1000);
  firstSlot.setSeconds(0, 0);

  for (let i = 0; i < maxSlots; i++) {
    const slotDate = new Date(firstSlot.getTime() + i * 15 * 60 * 1000);
    const validation = validatePickupSlot(outlet, slotDate);

    if (validation.isValid) {
      const diffMinutes = Math.round((slotDate.getTime() - now.getTime()) / (60 * 1000));
      const hours = slotDate.getHours();
      const mins = slotDate.getMinutes();
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayH = hours % 12 === 0 ? 12 : hours % 12;
      const displayM = mins < 10 ? `0${mins}` : mins;

      // Local datetime string for <input type="datetime-local">
      const year = slotDate.getFullYear();
      const month = String(slotDate.getMonth() + 1).padStart(2, '0');
      const day = String(slotDate.getDate()).padStart(2, '0');
      const hStr = String(hours).padStart(2, '0');
      const mStr = String(mins).padStart(2, '0');
      const localIso = `${year}-${month}-${day}T${hStr}:${mStr}`;

      slots.push({
        value: localIso,
        label: `${displayH}:${displayM} ${period}`,
        relativeLabel: `in ~${diffMinutes}m`,
        date: slotDate,
      });
    }
  }

  return slots;
};