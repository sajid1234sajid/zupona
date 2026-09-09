/** Delivery coverage used by the checkout address step. Division names are the
 * "Division / City" options; each maps to the thanas/upazilas we deliver to. */
export const divisions: { name: string; areas: string[] }[] = [
  {
    name: "Dhaka",
    areas: [
      "Dhanmondi",
      "Gulshan",
      "Banani",
      "Mirpur",
      "Uttara",
      "Mohammadpur",
      "Motijheel",
      "Badda",
      "Tejgaon",
      "Savar",
    ],
  },
  {
    name: "Chattogram",
    areas: ["Kotwali", "Pahartali", "Panchlaish", "Halishahar", "Agrabad", "Chandgaon", "Sitakunda"],
  },
  {
    name: "Khulna",
    areas: ["Khalishpur", "Sonadanga", "Daulatpur", "Khan Jahan Ali", "Rupsha"],
  },
  {
    name: "Rajshahi",
    areas: ["Boalia", "Motihar", "Rajpara", "Shah Makhdum"],
  },
  {
    name: "Sylhet",
    areas: ["Kotwali", "Jalalabad", "Shahporan", "South Surma", "Beanibazar"],
  },
  {
    name: "Barishal",
    areas: ["Kotwali", "Bakerganj", "Banaripara", "Gournadi"],
  },
  {
    name: "Rangpur",
    areas: ["Kotwali", "Gangachara", "Badarganj", "Pirgachha"],
  },
  {
    name: "Mymensingh",
    areas: ["Kotwali", "Trishal", "Muktagachha", "Bhaluka"],
  },
];

export const divisionNames = divisions.map((division) => division.name);

export function areasForDivision(division: string): string[] {
  return divisions.find((entry) => entry.name === division)?.areas ?? [];
}

export function isServedLocation(division: string, area: string): boolean {
  const areas = areasForDivision(division);
  return areas.length > 0 && areas.includes(area);
}
