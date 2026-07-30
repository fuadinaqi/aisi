package constants

var PointEligibleRoles = []string{"PEMBINA", "ANGGOTA"}

func IsPointEligible(roles []string) bool {
	for _, r := range roles {
		if r == "PEMBINA" || r == "ANGGOTA" {
			return true
		}
	}
	return false
}

var ManualPointGrantors = map[string][]string{
	"PEMBINA": {"PJ_SEKOLAH", "ADMIN", "SUPERADMIN"},
	"ANGGOTA": {"PEMBINA", "PJ_SEKOLAH", "ADMIN", "SUPERADMIN"},
}

func GetPointEligibleTargetRole(roles []string) string {
	for _, r := range roles {
		if r == "PEMBINA" {
			return "PEMBINA"
		}
	}
	for _, r := range roles {
		if r == "ANGGOTA" {
			return "ANGGOTA"
		}
	}
	return ""
}

func CanGrantManualPoints(grantorRoles, targetRoles []string) bool {
	target := GetPointEligibleTargetRole(targetRoles)
	if target == "" {
		return false
	}
	allowed := ManualPointGrantors[target]
	for _, g := range grantorRoles {
		for _, a := range allowed {
			if g == a {
				return true
			}
		}
	}
	return false
}

const (
	PointPembinaSubmitEvaluation     = 10
	PointPembinaSubmitEvaluationLate = 5
	PointAnggotaHadirPembinaan       = 5
	PointAnggotaSubmitMutabaah       = 2
)

var Roles = []string{"SUPERADMIN", "ADMIN", "PJ_SEKOLAH", "PEMBINA", "ANGGOTA"}

const InvitationExpireDays = 7

const (
	PaginationDefaultPage  = 1
	PaginationDefaultLimit = 20
)

const MutabaahOtherValue = "__other__"
const MutabaahOtherDefaultLabel = "Lainnya"

var InvitationRules = map[string][]string{
	"SUPERADMIN": {"ADMIN", "PJ_SEKOLAH", "PEMBINA", "ANGGOTA"},
	"ADMIN":      {"PJ_SEKOLAH", "PEMBINA", "ANGGOTA"},
	"PJ_SEKOLAH": {"PEMBINA"},
	"PEMBINA":    {"ANGGOTA"},
}

func CanInvite(inviterRoles []string, targetRole string) bool {
	for _, r := range inviterRoles {
		allowed, ok := InvitationRules[r]
		if !ok {
			continue
		}
		for _, a := range allowed {
			if a == targetRole {
				return true
			}
		}
	}
	return false
}

var KKSTypeLabels = map[string]string{
	"KELUHAN": "Keluhan",
	"KRITIK":  "Kritik",
	"SARAN":   "Saran",
}

var KKSStatusLabels = map[string]string{
	"PENDING":  "Menunggu",
	"READ":     "Dibaca",
	"RESOLVED": "Selesai",
}

var GenderLabels = map[string]string{
	"IKHWAN": "Ikhwan",
	"AKHWAT": "Akhwat",
}

var ICCategories = []string{
	"MANA_ASY_SYAHADAH",
	"MARIFATULLAH",
	"MARIFATUR_RASUL",
	"MARIFATUL_ISLAM",
	"MARIFATUL_INSAN",
	"MARIFATUL_QURAN",
	"FIQIH_USHUL_FIQIH",
	"KETATANEGARAAN",
	"LIFESKILLS",
	"ALQURAN_ULUMUL_QURAN",
	"HADITS_ULUMUL_HADITS",
	"AQIDAH_AKHLAK",
	"AL_HAQ_WAL_BATHIL",
	"QADHAYA_TAKWINUL_UMMAH",
	"DAKWAH_FIKRAH",
}

// ICCategoriesByLevel — Bidang Studi per level kelompok.
var ICCategoriesByLevel = map[string][]string{
	"LEVEL_1": {
		"MANA_ASY_SYAHADAH", "MARIFATULLAH", "MARIFATUR_RASUL", "MARIFATUL_ISLAM",
		"MARIFATUL_INSAN", "MARIFATUL_QURAN", "FIQIH_USHUL_FIQIH", "KETATANEGARAAN", "LIFESKILLS",
	},
	"LEVEL_2": {
		"ALQURAN_ULUMUL_QURAN", "HADITS_ULUMUL_HADITS", "AQIDAH_AKHLAK", "FIQIH_USHUL_FIQIH",
		"AL_HAQ_WAL_BATHIL", "QADHAYA_TAKWINUL_UMMAH", "DAKWAH_FIKRAH", "KETATANEGARAAN", "LIFESKILLS",
	},
}

var ICTypes = []string{"PRIMER", "SEKUNDER"}

var ICCategoryLabels = map[string]string{
	"MANA_ASY_SYAHADAH":      "A. Ma'na Asy-Syahadah",
	"MARIFATULLAH":           "B. Ma'rifatullah",
	"MARIFATUR_RASUL":        "C. Ma'rifatur Rasul",
	"MARIFATUL_ISLAM":        "D. Ma'rifatul Islam",
	"MARIFATUL_INSAN":        "E. Ma'rifatul Insan",
	"MARIFATUL_QURAN":        "F. Ma'rifatul Qur'an",
	"FIQIH_USHUL_FIQIH":      "G. Fiqih dan Ushul Fiqih",
	"KETATANEGARAAN":         "H. Ketatanegaraan",
	"LIFESKILLS":             "I. Lifeskills",
	"ALQURAN_ULUMUL_QURAN":   "A. Al-Qur'an dan Ulumul Qur'an",
	"HADITS_ULUMUL_HADITS":   "B. Hadits dan Ulumul Hadits",
	"AQIDAH_AKHLAK":          "C. Aqidah dan Akhlak",
	"AL_HAQ_WAL_BATHIL":      "E. Al-Haq wal-Bathil",
	"QADHAYA_TAKWINUL_UMMAH": "F. Qadhaya dan Takwinul Ummah",
	"DAKWAH_FIKRAH":          "G. Dakwah dan Fikrah",
}

// ICCategoryLabelsByLevel — huruf/urutan sesuai kurikulum per level.
var ICCategoryLabelsByLevel = map[string]map[string]string{
	"LEVEL_1": {
		"MANA_ASY_SYAHADAH": "A. Ma'na Asy-Syahadah",
		"MARIFATULLAH":      "B. Ma'rifatullah",
		"MARIFATUR_RASUL":   "C. Ma'rifatur Rasul",
		"MARIFATUL_ISLAM":   "D. Ma'rifatul Islam",
		"MARIFATUL_INSAN":   "E. Ma'rifatul Insan",
		"MARIFATUL_QURAN":   "F. Ma'rifatul Qur'an",
		"FIQIH_USHUL_FIQIH": "G. Fiqih dan Ushul Fiqih",
		"KETATANEGARAAN":    "H. Ketatanegaraan",
		"LIFESKILLS":        "I. Lifeskills",
	},
	"LEVEL_2": {
		"ALQURAN_ULUMUL_QURAN":   "A. Al-Qur'an dan Ulumul Qur'an",
		"HADITS_ULUMUL_HADITS":   "B. Hadits dan Ulumul Hadits",
		"AQIDAH_AKHLAK":          "C. Aqidah dan Akhlak",
		"FIQIH_USHUL_FIQIH":      "D. Fiqih dan Ushul Fiqih",
		"AL_HAQ_WAL_BATHIL":      "E. Al-Haq wal-Bathil",
		"QADHAYA_TAKWINUL_UMMAH": "F. Qadhaya dan Takwinul Ummah",
		"DAKWAH_FIKRAH":          "G. Dakwah dan Fikrah",
		"KETATANEGARAAN":         "H. Ketatanegaraan",
		"LIFESKILLS":             "I. Lifeskills",
	},
}

var ICTypeLabels = map[string]string{
	"PRIMER":   "IC Primer",
	"SEKUNDER": "IC Sekunder",
}

func ICCategoryLabel(category, level string) string {
	if byLevel, ok := ICCategoryLabelsByLevel[level]; ok {
		if label, ok := byLevel[category]; ok {
			return label
		}
	}
	if label, ok := ICCategoryLabels[category]; ok {
		return label
	}
	return category
}

func ICCategoriesForLevel(level string) []string {
	if cats, ok := ICCategoriesByLevel[level]; ok {
		return cats
	}
	return ICCategories
}
