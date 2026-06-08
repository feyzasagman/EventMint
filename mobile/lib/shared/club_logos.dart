const clubLogoFiles = <String, String>{
  'robotik': 'robotik.png',
  'tiyatro': 'tiyatro.png',
  'yazilim': 'yazilim_kulubu.png',
  'girisimcilik': 'girisimcilik.png',
  'fotografcilik': 'fotografcilik.png',
};

String? clubLogoAssetPath(String? logoKey) {
  final key = logoKey?.trim();
  if (key == null || key.isEmpty) return null;
  final fileName = clubLogoFiles[key];
  if (fileName == null) return null;
  return 'assets/clubs/$fileName';
}
