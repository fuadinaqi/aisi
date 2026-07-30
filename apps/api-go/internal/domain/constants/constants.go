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
	"KEAGAMAAN", "KEBANGSAAN", "KEMASYARAKATAN", "KEORGANISASIAN", "KEPEMIMPINAN_KEWIRAUSAHAAN",
}

var ICTypes = []string{"PRIMER", "SEKUNDER"}

var ICCategoryLabels = map[string]string{
	"KEAGAMAAN":                  "A. Keagamaan",
	"KEBANGSAAN":                 "B. Kebangsaan",
	"KEMASYARAKATAN":             "C. Kemasyarakatan",
	"KEORGANISASIAN":             "D. Keorganisasian",
	"KEPEMIMPINAN_KEWIRAUSAHAAN": "E. Kepemimpinan Kewirausahaan",
}

var ICTypeLabels = map[string]string{
	"PRIMER":   "IC Primer",
	"SEKUNDER": "IC Sekunder",
}
