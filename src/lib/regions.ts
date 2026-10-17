/** A Vietnamese province or city. The code follows ISO 3166-2:VN (`VN-HN`), so it fits the
 * `User_regionCode_check` pattern. Only a code from this list can be stored: no address or GPS. */
export type Region = { readonly code: string; readonly vi: string; readonly en: string };

export const REGIONS: readonly Region[] = [
  { code: "VN-01", vi: "Lai Châu", en: "Lai Chau" },
  { code: "VN-02", vi: "Lào Cai", en: "Lao Cai" },
  { code: "VN-03", vi: "Hà Giang", en: "Ha Giang" },
  { code: "VN-04", vi: "Cao Bằng", en: "Cao Bang" },
  { code: "VN-05", vi: "Sơn La", en: "Son La" },
  { code: "VN-06", vi: "Yên Bái", en: "Yen Bai" },
  { code: "VN-07", vi: "Tuyên Quang", en: "Tuyen Quang" },
  { code: "VN-09", vi: "Lạng Sơn", en: "Lang Son" },
  { code: "VN-13", vi: "Quảng Ninh", en: "Quang Ninh" },
  { code: "VN-14", vi: "Hòa Bình", en: "Hoa Binh" },
  { code: "VN-18", vi: "Ninh Bình", en: "Ninh Binh" },
  { code: "VN-20", vi: "Thái Bình", en: "Thai Binh" },
  { code: "VN-21", vi: "Thanh Hóa", en: "Thanh Hoa" },
  { code: "VN-22", vi: "Nghệ An", en: "Nghe An" },
  { code: "VN-23", vi: "Hà Tĩnh", en: "Ha Tinh" },
  { code: "VN-24", vi: "Quảng Bình", en: "Quang Binh" },
  { code: "VN-25", vi: "Quảng Trị", en: "Quang Tri" },
  { code: "VN-26", vi: "Thừa Thiên Huế", en: "Thua Thien Hue" },
  { code: "VN-27", vi: "Quảng Nam", en: "Quang Nam" },
  { code: "VN-28", vi: "Kon Tum", en: "Kon Tum" },
  { code: "VN-29", vi: "Quảng Ngãi", en: "Quang Ngai" },
  { code: "VN-30", vi: "Gia Lai", en: "Gia Lai" },
  { code: "VN-31", vi: "Bình Định", en: "Binh Dinh" },
  { code: "VN-32", vi: "Phú Yên", en: "Phu Yen" },
  { code: "VN-33", vi: "Đắk Lắk", en: "Dak Lak" },
  { code: "VN-34", vi: "Khánh Hòa", en: "Khanh Hoa" },
  { code: "VN-35", vi: "Lâm Đồng", en: "Lam Dong" },
  { code: "VN-36", vi: "Ninh Thuận", en: "Ninh Thuan" },
  { code: "VN-37", vi: "Tây Ninh", en: "Tay Ninh" },
  { code: "VN-39", vi: "Đồng Nai", en: "Dong Nai" },
  { code: "VN-40", vi: "Bình Thuận", en: "Binh Thuan" },
  { code: "VN-41", vi: "Long An", en: "Long An" },
  { code: "VN-43", vi: "Bà Rịa - Vũng Tàu", en: "Ba Ria - Vung Tau" },
  { code: "VN-44", vi: "An Giang", en: "An Giang" },
  { code: "VN-45", vi: "Đồng Tháp", en: "Dong Thap" },
  { code: "VN-46", vi: "Tiền Giang", en: "Tien Giang" },
  { code: "VN-47", vi: "Kiên Giang", en: "Kien Giang" },
  { code: "VN-49", vi: "Vĩnh Long", en: "Vinh Long" },
  { code: "VN-50", vi: "Bến Tre", en: "Ben Tre" },
  { code: "VN-51", vi: "Trà Vinh", en: "Tra Vinh" },
  { code: "VN-52", vi: "Sóc Trăng", en: "Soc Trang" },
  { code: "VN-53", vi: "Bắc Kạn", en: "Bac Kan" },
  { code: "VN-54", vi: "Bắc Giang", en: "Bac Giang" },
  { code: "VN-55", vi: "Bạc Liêu", en: "Bac Lieu" },
  { code: "VN-56", vi: "Bắc Ninh", en: "Bac Ninh" },
  { code: "VN-57", vi: "Bình Dương", en: "Binh Duong" },
  { code: "VN-58", vi: "Bình Phước", en: "Binh Phuoc" },
  { code: "VN-59", vi: "Cà Mau", en: "Ca Mau" },
  { code: "VN-61", vi: "Hải Dương", en: "Hai Duong" },
  { code: "VN-63", vi: "Hà Nam", en: "Ha Nam" },
  { code: "VN-66", vi: "Hưng Yên", en: "Hung Yen" },
  { code: "VN-67", vi: "Nam Định", en: "Nam Dinh" },
  { code: "VN-68", vi: "Phú Thọ", en: "Phu Tho" },
  { code: "VN-69", vi: "Thái Nguyên", en: "Thai Nguyen" },
  { code: "VN-70", vi: "Vĩnh Phúc", en: "Vinh Phuc" },
  { code: "VN-71", vi: "Điện Biên", en: "Dien Bien" },
  { code: "VN-72", vi: "Đắk Nông", en: "Dak Nong" },
  { code: "VN-73", vi: "Hậu Giang", en: "Hau Giang" },
  { code: "VN-CT", vi: "Cần Thơ", en: "Can Tho" },
  { code: "VN-DN", vi: "Đà Nẵng", en: "Da Nang" },
  { code: "VN-HN", vi: "Hà Nội", en: "Hanoi" },
  { code: "VN-HP", vi: "Hải Phòng", en: "Hai Phong" },
  { code: "VN-SG", vi: "Hồ Chí Minh", en: "Ho Chi Minh City" },
];

const CODES: ReadonlySet<string> = new Set(REGIONS.map((region) => region.code));

export function isRegionCode(value: unknown): value is string {
  return typeof value === "string" && CODES.has(value);
}

/** The region's name in the given language, or null for an unknown code. */
export function regionName(code: string | null | undefined, locale: "vi" | "en"): string | null {
  const region = REGIONS.find((item) => item.code === code);
  return region ? region[locale] : null;
}
