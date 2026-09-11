/** Bangladesh delivery geography: division -> district -> upazila/thana.
 *
 * The checkout used to ask for a "Division / City" and a thana, with nothing in
 * between. That skipped the level customers actually think in: Cumilla is a
 * DISTRICT of Chattogram division, so a shopper in Cumilla Sadar Dakshin could
 * pick "Chattogram" and then find only Chattogram city's own thanas -- their
 * own was not in the list at all. Sixty-three of the sixty-four districts were
 * missing for the same reason.
 *
 * This is the full administrative tree: 8 divisions, 64 districts, and the
 * upazilas (and, for the metropolitan districts, the city thanas) under them.
 * Upazila boundaries change by government gazette from time to time -- Lalmai
 * was carved out of Cumilla in 2018, Eidgaon out of Cox's Bazar in 2021 -- so
 * treat this as the current list rather than a permanent one, and add to it
 * here when a new one is gazetted. */

export interface District {
  name: string;
  /** Upazilas, plus city thanas where the district has a metropolitan area. */
  upazilas: string[];
}

export interface Division {
  name: string;
  districts: District[];
}

export const divisions: Division[] = [
  {
    name: "Barishal",
    districts: [
      { name: "Barguna", upazilas: ["Amtali", "Bamna", "Barguna Sadar", "Betagi", "Patharghata", "Taltali"] },
      { name: "Barishal", upazilas: ["Agailjhara", "Babuganj", "Bakerganj", "Banaripara", "Barishal Sadar", "Gaurnadi", "Hizla", "Mehendiganj", "Muladi", "Wazirpur"] },
      { name: "Bhola", upazilas: ["Bhola Sadar", "Burhanuddin", "Char Fasson", "Daulatkhan", "Lalmohan", "Manpura", "Tazumuddin"] },
      { name: "Jhalokati", upazilas: ["Jhalokati Sadar", "Kathalia", "Nalchity", "Rajapur"] },
      { name: "Patuakhali", upazilas: ["Bauphal", "Dashmina", "Dumki", "Galachipa", "Kalapara", "Mirzaganj", "Patuakhali Sadar", "Rangabali"] },
      { name: "Pirojpur", upazilas: ["Bhandaria", "Kawkhali", "Mathbaria", "Nazirpur", "Nesarabad (Swarupkathi)", "Pirojpur Sadar", "Zianagar (Indurkani)"] },
    ],
  },
  {
    name: "Chattogram",
    districts: [
      { name: "Bandarban", upazilas: ["Alikadam", "Bandarban Sadar", "Lama", "Naikhongchhari", "Rowangchhari", "Ruma", "Thanchi"] },
      { name: "Brahmanbaria", upazilas: ["Akhaura", "Ashuganj", "Bancharampur", "Bijoynagar", "Brahmanbaria Sadar", "Kasba", "Nabinagar", "Nasirnagar", "Sarail"] },
      { name: "Chandpur", upazilas: ["Chandpur Sadar", "Faridganj", "Haimchar", "Haziganj", "Kachua", "Matlab Dakshin", "Matlab Uttar", "Shahrasti"] },
      { name: "Chattogram", upazilas: ["Anwara", "Banshkhali", "Boalkhali", "Chandanaish", "Fatikchhari", "Hathazari", "Karnaphuli", "Lohagara", "Mirsharai", "Patiya", "Rangunia", "Raozan", "Sandwip", "Satkania", "Sitakunda", "Agrabad", "Bakalia", "Bayezid Bostami", "Chandgaon", "Double Mooring", "Halishahar", "Khulshi", "Kotwali", "Pahartali", "Panchlaish", "Patenga"] },
      { name: "Cumilla", upazilas: ["Barura", "Brahmanpara", "Burichang", "Chandina", "Chauddagram", "Cumilla Adarsha Sadar", "Cumilla Sadar Dakshin", "Daudkandi", "Debidwar", "Homna", "Laksam", "Lalmai", "Meghna", "Monohorganj", "Muradnagar", "Nangalkot", "Titas"] },
      { name: "Cox's Bazar", upazilas: ["Chakaria", "Cox's Bazar Sadar", "Eidgaon", "Kutubdia", "Maheshkhali", "Pekua", "Ramu", "Teknaf", "Ukhia"] },
      { name: "Feni", upazilas: ["Chhagalnaiya", "Daganbhuiyan", "Feni Sadar", "Fulgazi", "Parshuram", "Sonagazi"] },
      { name: "Khagrachhari", upazilas: ["Dighinala", "Guimara", "Khagrachhari Sadar", "Lakshmichhari", "Mahalchhari", "Manikchhari", "Matiranga", "Panchhari", "Ramgarh"] },
      { name: "Lakshmipur", upazilas: ["Kamalnagar", "Lakshmipur Sadar", "Raipur", "Ramganj", "Ramgati"] },
      { name: "Noakhali", upazilas: ["Begumganj", "Chatkhil", "Companiganj", "Hatiya", "Kabirhat", "Noakhali Sadar", "Senbagh", "Sonaimuri", "Subarnachar"] },
      { name: "Rangamati", upazilas: ["Baghaichhari", "Barkal", "Belaichhari", "Juraichhari", "Kaptai", "Kawkhali", "Langadu", "Naniarchar", "Rajasthali", "Rangamati Sadar"] },
    ],
  },
  {
    name: "Dhaka",
    districts: [
      { name: "Dhaka", upazilas: ["Adabar", "Badda", "Banani", "Bangshal", "Cantonment", "Chawkbazar", "Dakshinkhan", "Darus Salam", "Demra", "Dhanmondi", "Gendaria", "Gulshan", "Hazaribagh", "Jatrabari", "Kadamtali", "Kafrul", "Kalabagan", "Kamrangirchar", "Khilgaon", "Khilkhet", "Kotwali", "Lalbagh", "Mirpur", "Mohammadpur", "Motijheel", "Mugda", "New Market", "Pallabi", "Paltan", "Ramna", "Rampura", "Rupnagar", "Sabujbagh", "Shah Ali", "Shahbagh", "Sher-e-Bangla Nagar", "Shyampur", "Sutrapur", "Tejgaon", "Turag", "Uttara East", "Uttara West", "Uttarkhan", "Vatara", "Wari", "Dhamrai", "Dohar", "Keraniganj", "Nawabganj", "Savar"] },
      { name: "Faridpur", upazilas: ["Alfadanga", "Bhanga", "Boalmari", "Charbhadrasan", "Faridpur Sadar", "Madhukhali", "Nagarkanda", "Sadarpur", "Saltha"] },
      { name: "Gazipur", upazilas: ["Gazipur Sadar", "Kaliakair", "Kaliganj", "Kapasia", "Sreepur"] },
      { name: "Gopalganj", upazilas: ["Gopalganj Sadar", "Kashiani", "Kotalipara", "Muksudpur", "Tungipara"] },
      { name: "Kishoreganj", upazilas: ["Austagram", "Bajitpur", "Bhairab", "Hossainpur", "Itna", "Karimganj", "Katiadi", "Kishoreganj Sadar", "Kuliarchar", "Mithamain", "Nikli", "Pakundia", "Tarail"] },
      { name: "Madaripur", upazilas: ["Kalkini", "Madaripur Sadar", "Rajoir", "Shibchar"] },
      { name: "Manikganj", upazilas: ["Daulatpur", "Ghior", "Harirampur", "Manikganj Sadar", "Saturia", "Shibalaya", "Singair"] },
      { name: "Munshiganj", upazilas: ["Gazaria", "Lohajang", "Munshiganj Sadar", "Sirajdikhan", "Sreenagar", "Tongibari"] },
      { name: "Narayanganj", upazilas: ["Araihazar", "Bandar", "Narayanganj Sadar", "Rupganj", "Sonargaon"] },
      { name: "Narsingdi", upazilas: ["Belabo", "Monohardi", "Narsingdi Sadar", "Palash", "Raipura", "Shibpur"] },
      { name: "Rajbari", upazilas: ["Baliakandi", "Goalanda", "Kalukhali", "Pangsha", "Rajbari Sadar"] },
      { name: "Shariatpur", upazilas: ["Bhedarganj", "Damudya", "Gosairhat", "Naria", "Shariatpur Sadar", "Zanjira"] },
      { name: "Tangail", upazilas: ["Basail", "Bhuapur", "Delduar", "Dhanbari", "Ghatail", "Gopalpur", "Kalihati", "Madhupur", "Mirzapur", "Nagarpur", "Sakhipur", "Tangail Sadar"] },
    ],
  },
  {
    name: "Khulna",
    districts: [
      { name: "Bagerhat", upazilas: ["Bagerhat Sadar", "Chitalmari", "Fakirhat", "Kachua", "Mollahat", "Mongla", "Morrelganj", "Rampal", "Sarankhola"] },
      { name: "Chuadanga", upazilas: ["Alamdanga", "Chuadanga Sadar", "Damurhuda", "Jibannagar"] },
      { name: "Jashore", upazilas: ["Abhaynagar", "Bagherpara", "Chaugachha", "Jashore Sadar", "Jhikargacha", "Keshabpur", "Manirampur", "Sharsha"] },
      { name: "Jhenaidah", upazilas: ["Harinakunda", "Jhenaidah Sadar", "Kaliganj", "Kotchandpur", "Maheshpur", "Shailkupa"] },
      { name: "Khulna", upazilas: ["Batiaghata", "Dacope", "Dighalia", "Dumuria", "Koyra", "Paikgachha", "Phultala", "Rupsha", "Terokhada", "Daulatpur", "Khalishpur", "Khan Jahan Ali", "Kotwali", "Sonadanga"] },
      { name: "Kushtia", upazilas: ["Bheramara", "Daulatpur", "Khoksa", "Kumarkhali", "Kushtia Sadar", "Mirpur"] },
      { name: "Magura", upazilas: ["Magura Sadar", "Mohammadpur", "Shalikha", "Sreepur"] },
      { name: "Meherpur", upazilas: ["Gangni", "Meherpur Sadar", "Mujibnagar"] },
      { name: "Narail", upazilas: ["Kalia", "Lohagara", "Narail Sadar"] },
      { name: "Satkhira", upazilas: ["Assasuni", "Debhata", "Kalaroa", "Kaliganj", "Satkhira Sadar", "Shyamnagar", "Tala"] },
    ],
  },
  {
    name: "Mymensingh",
    districts: [
      { name: "Jamalpur", upazilas: ["Baksiganj", "Dewanganj", "Islampur", "Jamalpur Sadar", "Madarganj", "Melandaha", "Sarishabari"] },
      { name: "Mymensingh", upazilas: ["Bhaluka", "Dhobaura", "Fulbaria", "Gaffargaon", "Gauripur", "Haluaghat", "Ishwarganj", "Muktagachha", "Mymensingh Sadar", "Nandail", "Phulpur", "Tarakanda", "Trishal"] },
      { name: "Netrokona", upazilas: ["Atpara", "Barhatta", "Durgapur", "Kalmakanda", "Kendua", "Khaliajuri", "Madan", "Mohanganj", "Netrokona Sadar", "Purbadhala"] },
      { name: "Sherpur", upazilas: ["Jhenaigati", "Nakla", "Nalitabari", "Sherpur Sadar", "Sreebardi"] },
    ],
  },
  {
    name: "Rajshahi",
    districts: [
      { name: "Bogura", upazilas: ["Adamdighi", "Bogura Sadar", "Dhunat", "Dhupchanchia", "Gabtali", "Kahaloo", "Nandigram", "Sariakandi", "Shajahanpur", "Sherpur", "Shibganj", "Sonatala"] },
      { name: "Chapai Nawabganj", upazilas: ["Bholahat", "Chapai Nawabganj Sadar", "Gomastapur", "Nachole", "Shibganj"] },
      { name: "Joypurhat", upazilas: ["Akkelpur", "Joypurhat Sadar", "Kalai", "Khetlal", "Panchbibi"] },
      { name: "Naogaon", upazilas: ["Atrai", "Badalgachhi", "Dhamoirhat", "Manda", "Mohadevpur", "Naogaon Sadar", "Niamatpur", "Patnitala", "Porsha", "Raninagar", "Sapahar"] },
      { name: "Natore", upazilas: ["Bagatipara", "Baraigram", "Gurudaspur", "Lalpur", "Naldanga", "Natore Sadar", "Singra"] },
      { name: "Pabna", upazilas: ["Atgharia", "Bera", "Bhangura", "Chatmohar", "Faridpur", "Ishwardi", "Pabna Sadar", "Santhia", "Sujanagar"] },
      { name: "Rajshahi", upazilas: ["Bagha", "Bagmara", "Charghat", "Durgapur", "Godagari", "Mohanpur", "Paba", "Puthia", "Tanore", "Boalia", "Motihar", "Rajpara", "Shah Makhdum"] },
      { name: "Sirajganj", upazilas: ["Belkuchi", "Chauhali", "Kamarkhanda", "Kazipur", "Raiganj", "Shahjadpur", "Sirajganj Sadar", "Tarash", "Ullapara"] },
    ],
  },
  {
    name: "Rangpur",
    districts: [
      { name: "Dinajpur", upazilas: ["Birampur", "Birganj", "Biral", "Bochaganj", "Chirirbandar", "Dinajpur Sadar", "Ghoraghat", "Hakimpur", "Kaharole", "Khansama", "Nawabganj", "Parbatipur", "Phulbari"] },
      { name: "Gaibandha", upazilas: ["Fulchhari", "Gaibandha Sadar", "Gobindaganj", "Palashbari", "Sadullapur", "Saghata", "Sundarganj"] },
      { name: "Kurigram", upazilas: ["Bhurungamari", "Char Rajibpur", "Chilmari", "Kurigram Sadar", "Nageshwari", "Phulbari", "Rajarhat", "Raumari", "Ulipur"] },
      { name: "Lalmonirhat", upazilas: ["Aditmari", "Hatibandha", "Kaliganj", "Lalmonirhat Sadar", "Patgram"] },
      { name: "Nilphamari", upazilas: ["Dimla", "Domar", "Jaldhaka", "Kishoreganj", "Nilphamari Sadar", "Saidpur"] },
      { name: "Panchagarh", upazilas: ["Atwari", "Boda", "Debiganj", "Panchagarh Sadar", "Tetulia"] },
      { name: "Rangpur", upazilas: ["Badarganj", "Gangachara", "Kaunia", "Mithapukur", "Pirgachha", "Pirganj", "Rangpur Sadar", "Taraganj"] },
      { name: "Thakurgaon", upazilas: ["Baliadangi", "Haripur", "Pirganj", "Ranisankail", "Thakurgaon Sadar"] },
    ],
  },
  {
    name: "Sylhet",
    districts: [
      { name: "Habiganj", upazilas: ["Ajmiriganj", "Bahubal", "Baniachong", "Chunarughat", "Habiganj Sadar", "Lakhai", "Madhabpur", "Nabiganj"] },
      { name: "Moulvibazar", upazilas: ["Barlekha", "Juri", "Kamalganj", "Kulaura", "Moulvibazar Sadar", "Rajnagar", "Sreemangal"] },
      { name: "Sunamganj", upazilas: ["Bishwambarpur", "Chhatak", "Derai", "Dharampasha", "Dowarabazar", "Jagannathpur", "Jamalganj", "Madhyanagar", "Shantiganj", "Sullah", "Sunamganj Sadar", "Tahirpur"] },
      { name: "Sylhet", upazilas: ["Balaganj", "Beanibazar", "Bishwanath", "Companiganj", "Dakshin Surma", "Fenchuganj", "Golapganj", "Gowainghat", "Jaintiapur", "Kanaighat", "Osmani Nagar", "Sylhet Sadar", "Zakiganj"] },
    ],
  },
];

export const divisionNames = divisions.map((division) => division.name);

export function districtsForDivision(division: string): string[] {
  return divisions.find((entry) => entry.name === division)?.districts.map((d) => d.name) ?? [];
}

export function upazilasForDistrict(division: string, district: string): string[] {
  return (
    divisions
      .find((entry) => entry.name === division)
      ?.districts.find((entry) => entry.name === district)?.upazilas ?? []
  );
}

/** True only when the three names form a real division/district/upazila path.
 *
 * Checked server-side on every order: the browser sends three strings and an
 * address that does not exist is an address nobody can deliver to. */
export function isServedLocation(division: string, district: string, upazila: string): boolean {
  const upazilas = upazilasForDistrict(division, district);
  return upazilas.length > 0 && upazilas.includes(upazila);
}
